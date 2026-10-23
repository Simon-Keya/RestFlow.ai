import { toMoneyNumber } from '../../common/utils/money.util';
// apps/api/src/modules/pos/pos.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventStoreService } from '../../core/event-store.service';
import { IdempotencyService } from '../../core/idempotency.service';
import {
  MenuService,
  type MenuComponentLine,
  type MenuListItem,
} from '../menu/menu.service';
import { SellableResolutionService } from '../menu/sellable-resolution.service';
import { RecipeCostingService } from '../recipe/recipe-costing.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { UpdatePaymentDto } from './dto/update-payment.dto';
import { PosGateway } from './pos.gateway';
import {
  quantityInItemUnit,
  toCanonicalStockQty,
} from '../../common/utils/stock-units';

interface IdempotencyExisting {
  id: string;
  payload: unknown;
  event_type?: string;
}

interface IdempotencyResult {
  isReplay: boolean;
  existing?: IdempotencyExisting;
}

export interface StockDeduction {
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  component_key?: string;
  component_type?: string;
}

export interface CreateOrderResult {
  success: boolean;
  orderId: string;
  eventId?: string;
  stock_deductions?: StockDeduction[];
  message: string;
}

interface SelectionIn {
  component_key: string;
  finished_good_id: string;
  finished_good_name?: string;
  quantity: number;
}

const MENU_LOW_THRESHOLD = 5;

const ORDER_EVENTS = [
  'pos_sale',
  'order_status_updated',
  'order_sent_to_kitchen',
  'order_payment_updated',
] as const;

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    private readonly eventStore: EventStoreService,
    private readonly idempotencyService: IdempotencyService,
    private readonly posGateway: PosGateway,
    private readonly prisma: PrismaService,
    private readonly menuService: MenuService,
    private readonly sellableResolution: SellableResolutionService,
    private readonly recipeCosting: RecipeCostingService,
  ) {}

  async createOrder(
    dto: CreateOrderDto,
    actorUserId: string,
  ): Promise<CreateOrderResult> {
    const shopId = asString(dto.shop_id, '1');

    // Unique per submission so identical carts (e.g. 2× Coke twice) are separate sales.
    // Optional client_idempotency_key only blocks accidental double-submit of the *same* request.
    const rawClientKey = (dto as { client_idempotency_key?: unknown })
      .client_idempotency_key;
    const clientKey =
      typeof rawClientKey === 'string' && rawClientKey.trim().length >= 8
        ? rawClientKey.trim()
        : null;

    const orderId = `ORD-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const idempotencyKey = clientKey
      ? `pos-order-client-${clientKey}`
      : `pos-order-${orderId}`;

    const result = (await this.idempotencyService.enforce(idempotencyKey, {
      ...dto,
      order_id: orderId,
    })) as IdempotencyResult;

    if (result.isReplay && result.existing) {
      const existingPayload = asRecord(result.existing.payload);
      return {
        success: true,
        orderId: asString(existingPayload.order_id, orderId),
        eventId: result.existing.id,
        message: 'Already processed (idempotent replay)',
      };
    }

    const paymentMethod = dto.payment_method;
    const paymentSplits =
      paymentMethod === 'split' ? (dto.payment_splits ?? []) : undefined;

    if (paymentMethod === 'split') {
      if (!paymentSplits || paymentSplits.length < 2) {
        throw new BadRequestException(
          'Split payment requires at least two payment lines',
        );
      }
      const sum = paymentSplits.reduce((s, p) => s + Number(p.amount), 0);
      if (Math.abs(sum - dto.total_amount) > 0.02) {
        throw new BadRequestException(
          `Split amounts (${sum}) must equal total (${dto.total_amount})`,
        );
      }
    }

    const paymentStatus = dto.payment_status ?? 'paid';

    // Avoid full menu list when cart is combo-only (saves ~3s cold path)
    const needsMenuCatalog = dto.items.some(
      (line) => (line.line_type ?? 'menu_item') !== 'combo',
    );
    const menus = needsMenuCatalog
      ? (await this.menuService.listMenus(shopId)).items
      : [];

    const enrichedItems = await Promise.all(
      dto.items.map(async (line) => {
        const soldQty = line.quantity;
        const lineType = line.line_type ?? 'menu_item';

        // ── Combo line: server-side resolution (never trust client deductions) ──
        if (lineType === 'combo' && line.combo_id) {
          const resolved = await this.sellableResolution.resolveComboLine(
            shopId,
            line.combo_id,
            soldQty,
            (line.combo_selections ?? []).map((s) => ({
              group_index: s.group_index,
              menu_item_ids: s.menu_item_ids,
            })),
          );
          const deductions: StockDeduction[] = resolved.stockDeductions.map(
            (d) => ({
              item_id: d.item_id,
              item_name: d.item_name,
              quantity: d.quantity,
              unit: d.unit,
              unit_cost: d.unit_cost,
            }),
          );

          if (deductions.length === 0) {
            throw new BadRequestException(
              `Combo "${resolved.label}" could not resolve inventory deductions. ` +
                `Configure Fixed FG / recipe / stocked SKU on each selected menu item.`,
            );
          }
          const foodCost = roundMoney(
            deductions.reduce((s, d) => s + d.unit_cost * d.quantity, 0),
          );
          // Revenue = combo price from server resolution, not client sum
          const unitPrice = resolved.revenue / Math.max(soldQty, 1);
          // Ticket-friendly selections with names (kitchen must never guess)
          const comboSelectionsEnriched = (
            line.combo_selections ?? []
          ).map((s) => {
            const names = (s.menu_item_ids ?? []).map((id) => {
              const hit = resolved.menuItems.find((m) => m.menuItemId === id);
              return hit?.name ?? id;
            });
            const groupMeta = resolved.menuItems.find(
              (m) => m.group_index === s.group_index,
            );
            return {
              group_index: s.group_index,
              group_name: groupMeta?.group_name,
              menu_item_ids: s.menu_item_ids,
              menu_item_names: names,
            };
          });

          return {
            line_type: 'combo',
            menu_id: line.combo_id,
            menu_name: resolved.label,
            combo_id: line.combo_id,
            item_id: line.combo_id,
            name: resolved.label,
            quantity: soldQty,
            qty: soldQty,
            selling_price: unitPrice,
            unit_price: unitPrice,
            unit_cost: foodCost / Math.max(soldQty, 1),
            line_total: resolved.revenue,
            food_cost: foodCost,
            notes: line.notes,
            combo_selections: comboSelectionsEnriched,
            stock_deductions: deductions,
            resolved_menu_items: resolved.menuItems.map((m) => ({
              menu_item_id: m.menuItemId,
              name: m.name,
              quantity: m.quantity,
              group_index: m.group_index,
              group_name: m.group_name,
            })),
          };
        }

        const menuKey = line.menu_id ?? line.item_id ?? '';
        const menu = this.findMenu(menus, menuKey);
        const unitSell = Number(line.selling_price ?? 0);
        const lineTotal = soldQty * unitSell;

        const selections: SelectionIn[] = (line.selections ?? []).map((s) => ({
          component_key: s.component_key,
          finished_good_id: s.finished_good_id,
          finished_good_name: s.finished_good_name,
          quantity: s.quantity,
        }));

        let deductions: StockDeduction[];

        if (menu) {
          deductions = await this.resolveFromMenuAndSelections(
            menu,
            soldQty,
            selections,
            shopId,
          );
        } else {
          // Never trust client stock_deductions — server resolves only
          const fallbackItemId =
            line.recipe_item_id || line.item_id || menuKey;
          deductions = await this.resolveRecipeDeductions(
            fallbackItemId,
            soldQty,
            shopId,
          );
        }


        const foodCost = roundMoney(
          deductions.reduce((s, d) => s + d.unit_cost * d.quantity, 0),
        );

        return {
          line_type: 'menu_item',
          menu_id: menuKey,
          menu_name: line.menu_name ?? menu?.name ?? menuKey,
          item_id: line.item_id || line.recipe_item_id || menuKey,
          recipe_item_id: line.recipe_item_id || line.item_id || menuKey,
          name: line.menu_name ?? menu?.name ?? menuKey,
          quantity: soldQty,
          qty: soldQty,
          selling_price: unitSell,
          unit_price: unitSell,
          unit_cost: line.unit_cost ?? foodCost / Math.max(soldQty, 1),
          line_total: lineTotal,
          food_cost: foodCost,
          notes: line.notes,
          selections,
          stock_deductions: deductions,
        };
      }),
    );

    const orderLevelDeductions = this.aggregateDeductions(
      enrichedItems.flatMap((i) => i.stock_deductions),
    );

    // One batch unit-cost lookup for all SKUs (not N sequential event scans)
    const needCost = orderLevelDeductions
      .filter((d) => d.unit_cost <= 0)
      .map((d) => d.item_id);
    if (needCost.length > 0) {
      const costMap = await this.recipeCosting.getItemUnitCosts(
        shopId,
        needCost,
      );
      for (const d of orderLevelDeductions) {
        if (d.unit_cost <= 0) {
          d.unit_cost = costMap.get(d.item_id) ?? 0;
        }
      }
      for (const line of enrichedItems) {
        for (const d of line.stock_deductions) {
          if (d.unit_cost <= 0) {
            d.unit_cost = costMap.get(d.item_id) ?? 0;
          }
        }
      }
    }

    await this.assertSufficientStock(shopId, orderLevelDeductions);

    // Payment and kitchen are independent: order is NOT sent to kitchen yet
    const event = await this.eventStore.appendEvent({
      event_type: 'pos_sale',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      quantity: enrichedItems.reduce((s, i) => s + i.quantity, 0),
      total_cost: dto.total_amount,
      payload: {
        order_id: orderId,
        order_type: dto.order_type.replace(/-/g, '_'),
        table_number: dto.table_number ?? null,
        customer_name: dto.customer_name ?? null,
        customer_phone: dto.customer_phone ?? null,
        delivery_address: dto.delivery_address ?? null,
        items: enrichedItems,
        lines: enrichedItems,
        stock_deductions: orderLevelDeductions,
        total_amount: dto.total_amount,
        total: dto.total_amount,
        revenue: dto.total_amount,
        tax_amount: dto.tax_amount ?? 0,
        discount_amount: dto.discount_amount ?? 0,
        payment_method: paymentMethod,
        payment_splits: paymentSplits ?? null,
        payment_status: paymentStatus,
        mpesa_reference: dto.mpesa_reference ?? null,
        notes: dto.notes ?? null,
        // Fulfillment (kitchen) — not sent until sendToKitchen
        status: 'not_sent',
        kitchen_status: 'not_sent',
        sent_to_kitchen: false,
        shop_id: shopId,
        created_at: new Date().toISOString(),
        ...(dto.payload ?? {}),
      },
    });

    // Cheap stock refresh — do not drop menu event cache (avoids +3s on next POS open)
    void this.menuService.refreshListMenusStock(shopId).catch(() => undefined);

    this.logger.log(
      `POS Order ${orderId}: ${enrichedItems.length} lines, ` +
        `${orderLevelDeductions.length} stock SKUs to deduct, ` +
        `pay=${paymentMethod}, kitchen=not_sent`,
    );
    if (orderLevelDeductions.length === 0) {
      this.logger.warn(
        `POS Order ${orderId}: ZERO stock deductions — inventory will not move`,
      );
    }

    this.posGateway.broadcastOrderCreated(
      {
        order_id: orderId,
        event_id: event.id,
        items: enrichedItems,
        total_amount: dto.total_amount,
        order_type: dto.order_type.replace(/-/g, '_'),
        table_number: dto.table_number ?? null,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        status: 'not_sent',
        sent_to_kitchen: false,
        shop_id: shopId,
      },
      shopId,
    );

    return {
      success: true,
      orderId,
      eventId: event.id,
      stock_deductions: orderLevelDeductions,
      message: 'Order placed successfully (not yet sent to kitchen)',
    };
  }

  async sendToKitchen(
    orderId: string,
    actorUserId: string,
    shopId: string = '1',
  ) {
    const existing = await this.getOrder(orderId, shopId);
    if (!existing) {
      throw new BadRequestException(`Order ${orderId} not found`);
    }

    if (
      existing.sentToKitchen === true ||
      existing.kitchenStatus === 'pending' ||
      existing.kitchenStatus === 'preparing' ||
      existing.kitchenStatus === 'ready'
    ) {
      return {
        success: true,
        orderId,
        message: 'Already sent to kitchen',
      };
    }

    const idempotencyKey = `send-kitchen-${orderId}`;
    const now = new Date().toISOString();

    // Normalize lines for kitchen ticket (snake_case + flat selections)
    const kitchenItems = (Array.isArray(existing.items) ? existing.items : []).map(
      (raw) => {
        const it = asRecord(raw);
        const lineType = asString(it.lineType ?? it.line_type, 'menu_item');
        const resolved = Array.isArray(it.resolved_menu_items)
          ? (it.resolved_menu_items as unknown[])
          : Array.isArray(it.resolvedMenuItems)
            ? (it.resolvedMenuItems as unknown[])
            : [];
        let selections = Array.isArray(it.selections) ? it.selections : [];
        const comboPicks = Array.isArray(it.comboSelections)
          ? (it.comboSelections as Record<string, unknown>[])
          : Array.isArray(it.combo_selections)
            ? (it.combo_selections as Record<string, unknown>[])
            : [];
        if ((!selections || selections.length === 0) && comboPicks.length > 0) {
          selections = comboPicks.map((s) => ({
            group_index: asNumber(s.groupIndex ?? s.group_index),
            group_name: asString(s.groupName ?? s.group_name, '') || undefined,
            menu_item_id: asString(s.menuItemId ?? s.menu_item_id),
            menu_item_name: asString(
              s.menuItemName ?? s.menu_item_name ?? s.name,
              'Item',
            ),
            quantity: asNumber(s.quantity, 1),
          }));
        }
        if (
          (!selections || (selections as unknown[]).length === 0) &&
          resolved.length === 0
        ) {
          const deductions = Array.isArray(it.stockDeductions)
            ? (it.stockDeductions as Record<string, unknown>[])
            : Array.isArray(it.stock_deductions)
              ? (it.stock_deductions as Record<string, unknown>[])
              : [];
          selections = deductions.map((d) => ({
            group_index: 0,
            menu_item_id: asString(d.item_id ?? d.itemId),
            menu_item_name: asString(d.item_name ?? d.itemName, 'Item'),
            quantity: asNumber(d.quantity, 1),
          }));
        }
        return {
          line_type: lineType,
          menu_id: asString(it.menuItemId ?? it.menu_id ?? it.comboId ?? it.combo_id),
          menu_name: asString(it.name ?? it.menu_name),
          combo_id: asString(it.comboId ?? it.combo_id, '') || undefined,
          quantity: asNumber(it.quantity, 1),
          selling_price: asNumber(it.unitPrice ?? it.selling_price),
          notes: typeof it.notes === 'string' ? it.notes : undefined,
          selections,
          resolved_menu_items:
            resolved.length > 0
              ? resolved
              : (selections as Record<string, unknown>[]).map((s) => ({
                  menu_item_id: s.menu_item_id ?? s.menuItemId,
                  name: s.menu_item_name ?? s.menuItemName,
                  quantity: s.quantity ?? 1,
                  group_index: s.group_index ?? s.groupIndex ?? 0,
                  group_name: s.group_name ?? s.groupName,
                })),
          combo_selections: comboPicks,
          stock_deductions: it.stockDeductions ?? it.stock_deductions ?? [],
        };
      },
    );

    const event = await this.eventStore.appendEvent({
      event_type: 'order_sent_to_kitchen',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      payload: {
        order_id: orderId,
        shop_id: shopId,
        sent_to_kitchen: true,
        kitchen_status: 'pending',
        status: 'pending',
        sent_at: now,
        table_number: existing.tableNumber ?? null,
        customer_name: existing.customerName ?? null,
        customer_phone: existing.customerPhone ?? null,
        items: kitchenItems,
        lines: kitchenItems,
        total_amount: existing.totalAmount,
        order_type: existing.orderType,
        payment_status: existing.paymentStatus,
        payment_method: existing.paymentMethod,
      },
    });

    try {
      await this.eventStore.appendEvent({
        event_type: 'order_status_updated',
        actor_user_id: actorUserId,
        idempotency_key: `kitchen-status-${orderId}-pending-from-send`,
        payload: {
          order_id: orderId,
          status: 'pending',
          kitchen_status: 'pending',
          sent_to_kitchen: true,
          updated_at: now,
        },
      });
    } catch {
      // idempotent status row may already exist
    }

    this.posGateway.broadcastNewOrder({
      order_id: orderId,
      items: (existing.items as unknown[]) ?? [],
      total_amount: Number(existing.totalAmount ?? 0),
      order_type:
        typeof existing.orderType === 'string' ? existing.orderType : 'dine_in',
      table_number:
        typeof existing.tableNumber === 'string'
          ? existing.tableNumber
          : undefined,
      customer_name:
        typeof existing.customerName === 'string'
          ? existing.customerName
          : undefined,
      customer_phone:
        typeof existing.customerPhone === 'string'
          ? existing.customerPhone
          : undefined,
      payment_method:
        typeof existing.paymentMethod === 'string'
          ? existing.paymentMethod
          : undefined,
      payment_status:
        typeof existing.paymentStatus === 'string'
          ? existing.paymentStatus
          : undefined,
      status: 'pending',
      sent_to_kitchen: true,
      timestamp: now,
    });

    this.logger.log(`Order ${orderId} sent to kitchen`);

    return {
      success: true,
      orderId,
      eventId: event.id,
      message: 'Order sent to kitchen',
    };
  }

  async updatePayment(
    orderId: string,
    dto: UpdatePaymentDto,
    actorUserId: string,
  ) {
    const shopId = dto.shop_id || '1';
    const existing = await this.getOrder(orderId, shopId);
    if (!existing) {
      throw new BadRequestException(`Order ${orderId} not found`);
    }

    const idempotencyKey = `order-pay-${orderId}-${dto.payment_status}-${Date.now()}`;
    const event = await this.eventStore.appendEvent({
      event_type: 'order_payment_updated',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      payload: {
        order_id: orderId,
        shop_id: shopId,
        payment_status: dto.payment_status,
        payment_method: dto.payment_method,
        mpesa_reference: dto.mpesa_reference,
        notes: dto.notes,
        updated_at: new Date().toISOString(),
      },
    });

    return {
      success: true,
      orderId,
      eventId: event.id,
      paymentStatus: dto.payment_status,
      message: `Payment marked ${dto.payment_status}`,
    };
  }

  private async assertSufficientStock(
    shopId: string,
    deductions: StockDeduction[],
  ): Promise<void> {
    const needed = deductions.filter((d) => d.quantity > 0);
    if (needed.length === 0) return;

    const ids = [...new Set(needed.map((d) => d.item_id))];
    const rows = await this.prisma.inventoryProjection.findMany({
      where: { shop_id: shopId, item_id: { in: ids } },
      select: { item_id: true, available_stock: true },
    });
    const avail = new Map(
      rows.map((r) => [r.item_id, Number(r.available_stock ?? 0)]),
    );

    const shortages: string[] = [];
    for (const d of needed) {
      const available = avail.get(d.item_id) ?? 0;
      if (available + 1e-9 < d.quantity) {
        shortages.push(
          `${d.item_name || d.item_id}: need ${d.quantity}, have ${available}`,
        );
      }
    }
    if (shortages.length > 0) {
      throw new BadRequestException(
        `Insufficient stock — ${shortages.join('; ')}. ` +
          `Receive or produce these items before charging.`,
      );
    }
  }


  /** Item.unit is the denomination of InventoryProjection.available_stock. */
  private async resolveItemUnit(itemId: string): Promise<string> {
    const row = await this.prisma.item.findUnique({
      where: { item_id: itemId },
      select: { unit: true },
    });
    return (row?.unit && String(row.unit).trim()) || 'pcs';
  }

  private async resolveFromMenuAndSelections(
    menu: MenuListItem,
    soldQty: number,
    selections: SelectionIn[],
    shopId: string,
  ): Promise<StockDeduction[]> {
    const components = menu.lines ?? [];
    const out: StockDeduction[] = [];

    if (components.length === 0) {
      if (!menu.finishedGoodId) return [];
      const unitCost = await this.inventoryUnitCost(
        shopId,
        menu.finishedGoodId,
      );
      {
        const itemUnit = await this.resolveItemUnit(menu.finishedGoodId);
        const rawQty = (menu.quantityRequired || 1) * soldQty;
        const qty = quantityInItemUnit(rawQty, menu.unit || itemUnit, itemUnit);
        return [
          {
            item_id: menu.finishedGoodId,
            item_name: menu.finishedGoodName || menu.finishedGoodId,
            quantity: qty,
            unit: itemUnit,
            unit_cost: unitCost,
            component_key: 'main',
            component_type: 'FIXED',
          },
        ];
      }
    }

    for (const component of components) {
      if (component.componentType === 'FIXED') {
        const fgId = component.finishedGoodId;
        if (!fgId) {
          throw new BadRequestException(
            `Menu ${menu.menuId}: FIXED component ${component.componentKey} has no finished_good_id`,
          );
        }
        const rawQty = component.quantityRequired * soldQty;
        const itemUnit = await this.resolveItemUnit(fgId);
        const qty = quantityInItemUnit(
          rawQty,
          component.unit || itemUnit,
          itemUnit,
        );
        const unitCost = await this.inventoryUnitCost(shopId, fgId);
        out.push({
          item_id: fgId,
          item_name: component.finishedGoodName || fgId,
          quantity: qty,
          unit: itemUnit,
          unit_cost: unitCost,
          component_key: component.componentKey,
          component_type: 'FIXED',
        });
        continue;
      }

      const picks = selections.filter(
        (s) => s.component_key === component.componentKey,
      );
      this.validateSelections(menu, component, soldQty, picks);

      for (const pick of picks) {
        this.assertPickInPool(component, pick.finished_good_id);
        const unitCost = await this.inventoryUnitCost(
          shopId,
          pick.finished_good_id,
        );
        const itemUnit = await this.resolveItemUnit(pick.finished_good_id);
        const pickQty = quantityInItemUnit(
          pick.quantity,
          component.unit || itemUnit,
          itemUnit,
        );
        out.push({
          item_id: pick.finished_good_id,
          item_name:
            pick.finished_good_name ||
            component.options.find(
              (o) => o.finishedGoodId === pick.finished_good_id,
            )?.finishedGoodName ||
            pick.finished_good_id,
          quantity: pickQty,
          unit: itemUnit,
          unit_cost: unitCost,
          component_key: component.componentKey,
          component_type: component.componentType,
        });
      }
    }

    return out;
  }

  private validateSelections(
    menu: MenuListItem,
    component: MenuComponentLine,
    soldQty: number,
    picks: SelectionIn[],
  ): void {
    const requiredTotal = component.quantityRequired * soldQty;
    const pickedTotal = picks.reduce((s, p) => s + p.quantity, 0);
    const label = component.finishedGoodCategoryName || component.componentKey;

    if (picks.length === 0 && requiredTotal > 0) {
      throw new BadRequestException(`${menu.name}: select ${label}`);
    }

    if (component.componentType === 'CHOICE') {
      if (pickedTotal !== requiredTotal) {
        throw new BadRequestException(
          `${menu.name} / ${component.componentKey}: need ${requiredTotal} unit(s), got ${pickedTotal}`,
        );
      }
      return;
    }

    const maxPerSale = component.maxSelect || component.quantityRequired;
    const maxTotal = maxPerSale * soldQty;

    if (requiredTotal > 0 && pickedTotal !== requiredTotal) {
      throw new BadRequestException(
        `${menu.name} / ${component.componentKey}: need ${requiredTotal} selection unit(s), got ${pickedTotal}`,
      );
    }

    if (maxTotal > 0 && pickedTotal > maxTotal) {
      throw new BadRequestException(
        `${menu.name} / ${component.componentKey}: max ${maxTotal} unit(s), got ${pickedTotal}`,
      );
    }

    if (!component.allowRepeat) {
      const ids = picks.map((p) => p.finished_good_id);
      if (new Set(ids).size !== ids.length) {
        throw new BadRequestException(
          `${menu.name} / ${component.componentKey}: duplicate picks not allowed`,
        );
      }
    }
  }

  private assertPickInPool(
    component: MenuComponentLine,
    finishedGoodId: string,
  ): void {
    if (!component.options?.length) return;
    const ok = component.options.some(
      (o) => o.finishedGoodId === finishedGoodId,
    );
    if (!ok) {
      throw new BadRequestException(
        `${finishedGoodId} is not in category ${
          component.finishedGoodCategoryCode || component.componentKey
        }`,
      );
    }
  }

  private findMenu(
    menus: MenuListItem[],
    menuKey: string,
  ): MenuListItem | undefined {
    return menus.find(
      (m) =>
        m.menuId === menuKey ||
        m.menuCode === menuKey ||
        m.menuId === `MENU-${menuKey}`,
    );
  }

  private aggregateDeductions(rows: StockDeduction[]): StockDeduction[] {
    const map = new Map<string, StockDeduction>();
    for (const row of rows) {
      const prev = map.get(row.item_id);
      if (!prev) {
        map.set(row.item_id, { ...row });
        continue;
      }
      prev.quantity += row.quantity;
      if (prev.unit_cost <= 0 && row.unit_cost > 0) {
        prev.unit_cost = row.unit_cost;
      }
    }
    return Array.from(map.values());
  }

  private async inventoryUnitCost(
    shopId: string,
    itemId: string,
  ): Promise<number> {
    // Delegates to RecipeCostingService — single source of truth for unit cost
    return this.recipeCosting.getItemUnitCost(shopId, itemId);
  }

  private async resolveRecipeDeductions(
    itemId: string,
    soldQty: number,
    shopId: string = '1',
  ): Promise<StockDeduction[]> {
    if (!itemId || soldQty <= 0) return [];

    const recipe = await this.prisma.recipe.findFirst({
      where: {
        OR: [{ item_id: itemId }, { id: itemId }],
      },
      include: { ingredients: true },
    });

    if (!recipe?.ingredients?.length) return [];

    const out: StockDeduction[] = [];
    for (const ing of recipe.ingredients) {
      const q = Number(ing.quantity_per_unit) * soldQty;
      let unitCost = toMoneyNumber(ing.unit_cost ?? 0);
      if (unitCost <= 0) {
        unitCost = await this.inventoryUnitCost(shopId, ing.raw_item_id);
      }
      out.push({
        item_id: ing.raw_item_id,
        item_name: ing.raw_item_name,
        quantity: q,
        unit: ing.unit,
        unit_cost: unitCost,
      });
    }
    return out;
  }

  async listOrders(opts: { shopId: string; page: number; pageSize: number }) {
    const take = Math.min(Math.max(opts.pageSize || 25, 1), 100);
    const skip = (Math.max(opts.page || 1, 1) - 1) * take;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const events = await this.prisma.event.findMany({
      where: {
        shop_id: opts.shopId,
        event_type: { in: [...ORDER_EVENTS] },
        created_at: { gte: since },
      },
      orderBy: { created_at: 'asc' },
    });

    const map = new Map<string, Record<string, unknown>>();

    for (const e of events) {
      const p = asRecord(e.payload);
      const orderId = asString(p.order_id);
      if (!orderId) continue;

      if (e.event_type === 'pos_sale') {
        const items = Array.isArray(p.items) ? p.items : [];
        const kitchenStatus = asString(
          p.kitchen_status ?? p.status,
          'not_sent',
        );
        map.set(orderId, {
          orderId,
          status: kitchenStatus,
          kitchenStatus,
          sentToKitchen: Boolean(p.sent_to_kitchen),
          orderType: asString(p.order_type, 'dine_in'),
          totalAmount: asNumber(p.total_amount),
          itemCount: items.length,
          paymentStatus: asString(p.payment_status, 'paid'),
          paymentMethod: asString(p.payment_method, 'cash'),
          paymentSplits: Array.isArray(p.payment_splits)
            ? p.payment_splits
            : null,
          createdAt: e.created_at.toISOString(),
          items,
          tableNumber: p.table_number ?? null,
          customerName: p.customer_name ?? null,
          customerPhone: p.customer_phone ?? null,
        });
      } else if (e.event_type === 'order_sent_to_kitchen') {
        const row = map.get(orderId);
        if (row) {
          row.sentToKitchen = true;
          row.kitchenStatus = asString(p.kitchen_status ?? p.status, 'pending');
          row.status = asString(p.status ?? p.kitchen_status, 'pending');
        }
      } else if (e.event_type === 'order_status_updated') {
        const row = map.get(orderId);
        if (row) {
          if (p.status !== undefined && p.status !== null) {
            row.status = asString(p.status, 'pending');
            row.kitchenStatus = asString(
              p.kitchen_status ?? p.status,
              'pending',
            );
          }
          if (p.sent_to_kitchen === true) {
            row.sentToKitchen = true;
          }
        }
      } else if (e.event_type === 'order_payment_updated') {
        const row = map.get(orderId);
        if (
          row &&
          p.payment_status !== undefined &&
          p.payment_status !== null
        ) {
          row.paymentStatus = asString(p.payment_status, 'paid');
        }
        if (row && p.payment_method) {
          row.paymentMethod = asString(p.payment_method);
        }
      }
    }

    const all = Array.from(map.values()).sort(
      (a, b) =>
        new Date(asString(b.createdAt)).getTime() -
        new Date(asString(a.createdAt)).getTime(),
    );

    const total = all.length;
    const items = all.slice(skip, skip + take);

    return {
      items,
      total,
      page: Math.max(opts.page || 1, 1),
      pageSize: take,
      totalPages: Math.ceil(total / take) || 1,
    };
  }

  async getOrder(orderId: string, shopId: string = '1') {
    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: { in: [...ORDER_EVENTS] },
        payload: { path: ['order_id'], equals: orderId },
      },
      orderBy: { created_at: 'asc' },
    });

    if (!events.length) return null;

    let detail: Record<string, unknown> | null = null;
    const lifecycle: Array<{ status: string; timestamp: string }> = [];

    for (const e of events) {
      const p = asRecord(e.payload);

      if (e.event_type === 'pos_sale') {
        const rawItems = Array.isArray(p.items)
          ? (p.items as unknown[]).map((it) => asRecord(it))
          : [];
        const kitchenStatus = asString(
          p.kitchen_status ?? p.status,
          'not_sent',
        );

        detail = {
          orderId,
          status: kitchenStatus,
          kitchenStatus,
          sentToKitchen: Boolean(p.sent_to_kitchen),
          orderType: asString(p.order_type, 'dine_in'),
          totalAmount: asNumber(p.total_amount),
          itemCount: rawItems.length,
          paymentStatus: asString(p.payment_status, 'paid'),
          paymentMethod: asString(p.payment_method, 'cash'),
          paymentSplits: Array.isArray(p.payment_splits)
            ? p.payment_splits
            : null,
          createdAt: e.created_at.toISOString(),
          items: rawItems.map((it) => {
            const lineType = asString(it.line_type ?? it.lineType, 'menu_item');
            // Build ticket selections from resolved_menu_items or combo_selections
            let comboPicks: Array<{
              groupIndex: number;
              groupName?: string;
              menuItemId: string;
              menuItemName: string;
              quantity: number;
            }> = [];
            const resolved = Array.isArray(it.resolved_menu_items)
              ? (it.resolved_menu_items as Record<string, unknown>[])
              : [];
            if (resolved.length > 0) {
              comboPicks = resolved.map((r) => ({
                groupIndex: asNumber(r.group_index ?? r.groupIndex),
                groupName: asString(
                  r.group_name ?? r.groupName ?? '',
                  '',
                ) || undefined,
                menuItemId: asString(
                  r.menu_item_id ?? r.menuItemId ?? r.id,
                ),
                menuItemName: asString(r.name ?? r.menu_item_name, 'Item'),
                quantity: asNumber(r.quantity ?? 1, 1),
              }));
            } else if (Array.isArray(it.combo_selections)) {
              for (const g of it.combo_selections as Record<string, unknown>[]) {
                const ids = Array.isArray(g.menu_item_ids)
                  ? (g.menu_item_ids as unknown[])
                  : [];
                const names = Array.isArray(g.menu_item_names)
                  ? (g.menu_item_names as unknown[])
                  : [];
                ids.forEach((id, i) => {
                  comboPicks.push({
                    groupIndex: asNumber(g.group_index ?? g.groupIndex),
                    groupName: asString(g.group_name ?? '', '') || undefined,
                    menuItemId: String(id),
                    menuItemName:
                      names[i] != null ? String(names[i]) : String(id),
                    quantity: 1,
                  });
                });
              }
            }
            return {
              menuItemId: asString(it.menu_id ?? it.menuItemId ?? it.combo_id),
              itemId: asString(it.item_id ?? it.recipe_item_id ?? it.combo_id),
              name: asString(it.menu_name ?? it.name),
              quantity: asNumber(it.quantity),
              unitPrice: asNumber(it.selling_price ?? it.unitPrice),
              lineTotal: asNumber(it.line_total),
              foodCost: asNumber(it.food_cost),
              lineType,
              comboId: asString(it.combo_id ?? '', '') || undefined,
              selections: Array.isArray(it.selections) ? it.selections : [],
              comboSelections: comboPicks,
              stockDeductions: Array.isArray(it.stock_deductions)
                ? it.stock_deductions
                : [],
            };
          }),
          stockDeductions: Array.isArray(p.stock_deductions)
            ? p.stock_deductions
            : [],
          tableNumber: p.table_number ?? null,
          customerName: p.customer_name ?? null,
          customerPhone: p.customer_phone ?? null,
          events: lifecycle,
        };
      }

      if (e.event_type === 'order_sent_to_kitchen' && detail) {
        detail.sentToKitchen = true;
        detail.kitchenStatus = asString(
          p.kitchen_status ?? p.status,
          'pending',
        );
        detail.status = asString(p.status ?? p.kitchen_status, 'pending');
        lifecycle.push({
          status: 'sent_to_kitchen',
          timestamp: e.created_at.toISOString(),
        });
      }

      if (e.event_type === 'order_status_updated') {
        if (p.status !== undefined && p.status !== null) {
          const status = asString(p.status, 'pending');
          lifecycle.push({
            status,
            timestamp: e.created_at.toISOString(),
          });
          if (detail) {
            detail.status = status;
            detail.kitchenStatus = asString(
              p.kitchen_status ?? p.status,
              status,
            );
          }
        }
        if (detail && p.sent_to_kitchen === true) {
          detail.sentToKitchen = true;
        }
      }

      if (e.event_type === 'order_payment_updated' && detail) {
        if (p.payment_status !== undefined && p.payment_status !== null) {
          detail.paymentStatus = asString(p.payment_status, 'paid');
        }
        if (p.payment_method) {
          detail.paymentMethod = asString(p.payment_method);
        }
        lifecycle.push({
          status: `payment_${asString(p.payment_status, 'updated')}`,
          timestamp: e.created_at.toISOString(),
        });
      }
    }

    if (detail) detail.events = lifecycle;
    return detail;
  }

  /**
   * Single RTT for POS open: menus + availability derived once + combos + categories.
   * Avoids parallel listMenus + menu-availability + menu list waterfalls.
   */
  async getBootstrap(shopId: string = '1') {
    const started = Date.now();
    const [menuResult, combosResult, categoriesResult] = await Promise.all([
      this.menuService.listMenus(shopId),
      this.menuService.listCombos(shopId).catch(() => ({
        success: true,
        items: [] as unknown[],
        count: 0,
      })),
      this.menuService.listMenuCategories(shopId).catch(() => ({
        success: true,
        items: [] as unknown[],
        count: 0,
      })),
    ]);

    const items = menuResult.items ?? [];
    const menus = items.filter((m) => m.isVisible !== false);
    const availability = menus.map((m) => {
      const maxPortions = Math.max(0, Math.floor(Number(m.maxPortions ?? 0)));
      const isAvailable = maxPortions > 0 && m.isAvailable !== false;
      const isLow =
        isAvailable && maxPortions > 0 && maxPortions <= MENU_LOW_THRESHOLD;
      return {
        menuItemId: m.menuId,
        menuCode: m.menuCode || m.menuId,
        name: m.name || m.menuCode || m.menuId,
        isAvailable,
        isLow,
        maxPortions,
        availableQuantity: Number(m.availableQuantity ?? 0),
        finishedGoodId: m.finishedGoodId,
        requiresSelection: m.requiresSelection,
        lines: m.lines,
      };
    });

    return {
      success: true,
      shopId,
      menus,
      availability,
      combos: (combosResult as { items?: unknown[] }).items ?? [],
      categories: (categoriesResult as { items?: unknown[] }).items ?? [],
      counts: {
        menus: menus.length,
        availability: availability.length,
        combos: ((combosResult as { items?: unknown[] }).items ?? []).length,
        categories: ((categoriesResult as { items?: unknown[] }).items ?? [])
          .length,
      },
      serverTime: new Date().toISOString(),
      durationMs: Date.now() - started,
    };
  }

  async getMenuAvailability(shopId: string = '1') {
    // Keep endpoint; prefer shared path with bootstrap (single listMenus)
    const boot = await this.getBootstrap(shopId);
    return boot.availability;
  }
}
