import { toMoneyNumber } from '../../common/utils/money.util';
// apps/api/src/modules/kitchen/kitchen.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventStoreService } from '../../core/event-store.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductionService } from '../production/production.service';
import type { SubmitClosingStockDto } from './dto/closing-stock.dto';

export type KitchenOrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export interface KitchenOrderLineSelection {
  group_index: number;
  group_name?: string;
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
}

export interface KitchenOrder {
  order_id: string;
  items: Array<{
    menu_id?: string;
    menu_name: string;
    quantity: number;
    selling_price?: number;
    notes?: string;
    line_type?: 'menu_item' | 'combo' | string;
    combo_id?: string;
    /** Expanded picks for kitchen / order tickets */
    selections?: KitchenOrderLineSelection[];
  }>;
  order_type: string;
  table_number?: string;
  customer_name?: string;
  status: KitchenOrderStatus;
  total_amount: number;
  payment_method?: string;
  payment_status?: string;
  timestamp: Date | string;
  started_at?: string;
  batch_number?: string;
  last_updated_at?: Date | string;
}

export type ProductionStatus = 'started' | 'finished';

export interface ProductionQueueItem {
  id: string;
  position: number;
  productionId: string;
  recipeId: string;
  recipeName: string;
  batchSize: number;
  status: ProductionStatus;
  startedAt: string;
  finishedAt: string | null;
  production_id: string;
  recipe_id: string;
  recipe_name: string;
  batch_size: number;
  started_at: string;
  finished_at: string | null;
}

export interface ProductionHistoryRow {
  productionId: string;
  recipeId: string;
  recipeName: string;
  itemId: string;
  batchSize: number;
  actualYield: number | null;
  batchNumber: string | null;
  expiryDate: string | null;
  stockExpiry: string | null;
  availableStock: number | null;
  totalValue: number | null;
  unitCost: number | null;
  runUnitCost: number | null;
  totalInputCost: number | null;
  unit: string;
  status: 'finished';
  startedAt: string;
  finishedAt: string | null;
  production_id: string;
  recipe_id: string;
  recipe_name: string;
  batch_size: number;
  actual_yield: number | null;
  batch_number: string | null;
  expiry_date: string | null;
  available_stock: number | null;
  total_value: number | null;
  unit_cost: number | null;
  run_unit_cost: number | null;
  total_input_cost: number | null;
  started_at: string;
  finished_at: string | null;
}

export interface StartProductionInput {
  recipeId?: string;
  recipe_id?: string;
  batchSize?: number;
  batch_size?: number;
  shopId?: string;
  shop_id?: string;
}

export interface FinishProductionInput {
  productionId?: string;
  production_id?: string;
  actualYield?: number;
  actual_yield?: number;
  unitCost?: number;
  wasteQuantity?: number;
  wasteReason?: string;
  batchNumber?: string;
  expiryDate?: string;
  inputs?: Array<{
    item_id: string;
    item_name?: string;
    actual_quantity: number;
    unit?: string;
    standard_quantity?: number;
    unit_cost?: number;
  }>;
  outputs?: Array<{
    item_id: string;
    item_name?: string;
    actual_quantity: number;
    unit?: string;
    standard_quantity?: number;
    unit_cost?: number;
    unit_weight?: number;
    weight_unit?: string;
  }>;
}

@Injectable()
export class KitchenService {
  private readonly logger = new Logger(KitchenService.name);

  constructor(
    private readonly eventStore: EventStoreService,
    private readonly prisma: PrismaService,
    private readonly productionService: ProductionService,
  ) {}

  async getActiveOrders(shopId: string = '1'): Promise<KitchenOrder[]> {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: {
          in: ['pos_sale', 'order_status_updated', 'order_sent_to_kitchen'],
        },
        created_at: { gte: since },
      },
      select: {
        event_type: true,
        created_at: true,
        payload: true,
      },
      orderBy: { created_at: 'asc' },
      take: 500,
    });

    const ordersMap = new Map<string, KitchenOrder>();

    const mapItems = (
      payload: Record<string, unknown>,
    ): KitchenOrder['items'] => {
      const raw = Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.lines)
          ? payload.lines
          : [];
      return (raw as Record<string, unknown>[]).map((it) => {
        const menuName =
          typeof it.menu_name === 'string'
            ? it.menu_name
            : typeof it.name === 'string'
              ? it.name
              : typeof it.item_name === 'string'
                ? it.item_name
                : 'Item';
        const lineType =
          typeof it.line_type === 'string'
            ? it.line_type
            : typeof it.lineType === 'string'
              ? it.lineType
              : undefined;

        const selections: KitchenOrderLineSelection[] = [];

        // Preferred: resolved_menu_items from POS enrichment
        const resolved = Array.isArray(it.resolved_menu_items)
          ? (it.resolved_menu_items as Record<string, unknown>[])
          : Array.isArray(it.resolvedMenuItems)
            ? (it.resolvedMenuItems as Record<string, unknown>[])
            : [];
        if (resolved.length > 0) {
          for (const r of resolved) {
            selections.push({
              group_index: Number(r.group_index ?? r.groupIndex ?? 0),
              group_name:
                typeof r.group_name === 'string'
                  ? r.group_name
                  : typeof r.menuCategoryName === 'string'
                    ? r.menuCategoryName
                    : typeof r.category_name === 'string'
                      ? r.category_name
                      : undefined,
              menu_item_id: String(
                r.menu_item_id ?? r.menuItemId ?? r.id ?? '',
              ),
              menu_item_name: String(
                r.name ?? r.menu_item_name ?? r.menuItemName ?? 'Item',
              ),
              quantity: Number(r.quantity ?? r.qty ?? 1),
            });
          }
        } else {
          // Fallback: combo_selections + optional names map
          const comboSel = Array.isArray(it.combo_selections)
            ? (it.combo_selections as Record<string, unknown>[])
            : Array.isArray(it.comboSelections)
              ? (it.comboSelections as Record<string, unknown>[])
              : [];
          for (const g of comboSel) {
            const gIdx = Number(g.group_index ?? g.groupIndex ?? 0);
            const gName =
              typeof g.group_name === 'string'
                ? g.group_name
                : typeof g.menu_category_name === 'string'
                  ? g.menu_category_name
                  : typeof g.menuCategoryName === 'string'
                    ? g.menuCategoryName
                    : undefined;
            const ids = Array.isArray(g.menu_item_ids)
              ? (g.menu_item_ids as unknown[])
              : Array.isArray(g.menuItemIds)
                ? (g.menuItemIds as unknown[])
                : [];
            const names = Array.isArray(g.menu_item_names)
              ? (g.menu_item_names as unknown[])
              : Array.isArray(g.menuItemNames)
                ? (g.menuItemNames as unknown[])
                : [];
            ids.forEach((id, i) => {
              selections.push({
                group_index: gIdx,
                group_name: gName,
                menu_item_id: String(id),
                menu_item_name:
                  names[i] != null ? String(names[i]) : String(id),
                quantity: 1,
              });
            });
          }
        }

        // Last resort: stock_deductions (what POS actually reserved)
        if (selections.length === 0) {
          const deductions = Array.isArray(it.stock_deductions)
            ? (it.stock_deductions as Record<string, unknown>[])
            : Array.isArray(it.stockDeductions)
              ? (it.stockDeductions as Record<string, unknown>[])
              : [];
          for (const d of deductions) {
            const nm = String(
              d.item_name ?? d.itemName ?? d.item_id ?? d.itemId ?? '',
            );
            if (!nm) continue;
            selections.push({
              group_index: 0,
              menu_item_id: String(d.item_id ?? d.itemId ?? nm),
              menu_item_name: nm,
              quantity: Number(d.quantity ?? d.qty ?? 1),
            });
          }
        }

        // Flatten camelCase comboSelections from getOrder shape
        if (selections.length === 0 && Array.isArray(it.comboSelections)) {
          for (const s of it.comboSelections as Record<string, unknown>[]) {
            selections.push({
              group_index: Number(s.groupIndex ?? s.group_index ?? 0),
              group_name:
                typeof s.groupName === 'string'
                  ? s.groupName
                  : typeof s.group_name === 'string'
                    ? s.group_name
                    : undefined,
              menu_item_id: String(s.menuItemId ?? s.menu_item_id ?? ''),
              menu_item_name: String(
                s.menuItemName ?? s.menu_item_name ?? s.name ?? 'Item',
              ),
              quantity: Number(s.quantity ?? 1),
            });
          }
        }

        return {
          menu_id:
            typeof it.menu_id === 'string'
              ? it.menu_id
              : typeof it.combo_id === 'string'
                ? it.combo_id
                : undefined,
          menu_name: menuName,
          quantity: Number(it.quantity ?? it.qty ?? 0),
          selling_price:
            it.selling_price != null ? Number(it.selling_price) : undefined,
          notes: typeof it.notes === 'string' ? it.notes : undefined,
          line_type: lineType,
          combo_id:
            typeof it.combo_id === 'string'
              ? it.combo_id
              : typeof it.comboId === 'string'
                ? it.comboId
                : undefined,
          selections: selections.length > 0 ? selections : undefined,
        };
      });
    };

    for (const event of events) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const orderId = this.extractString(payload, ['order_id', 'orderId']);
      if (!orderId) continue;

      /* --------------------------------------------------------
       * POS SALE — only show if it was sent to kitchen
       * -------------------------------------------------------- */

      if (event.event_type === 'pos_sale') {
        const paymentStatus =
          typeof payload.payment_status === 'string'
            ? payload.payment_status.toLowerCase()
            : 'paid';
        if (paymentStatus === 'failed') {
          continue;
        }

        // New orders sit on POS until Send to Kitchen
        const sent =
          payload.sent_to_kitchen === true ||
          payload.kitchen_status === 'pending' ||
          payload.kitchen_status === 'preparing' ||
          payload.kitchen_status === 'ready';

        if (!sent) {
          continue;
        }

        const statusRaw =
          typeof payload.kitchen_status === 'string'
            ? payload.kitchen_status
            : typeof payload.status === 'string'
              ? payload.status
              : 'pending';
        const status = (
          ['pending', 'preparing', 'ready', 'completed', 'cancelled'].includes(
            statusRaw,
          )
            ? statusRaw
            : 'pending'
        ) as KitchenOrderStatus;

        ordersMap.set(orderId, {
          order_id: orderId,
          items: mapItems(payload),
          order_type:
            typeof payload.order_type === 'string'
              ? payload.order_type
              : 'dine_in',
          table_number:
            typeof payload.table_number === 'string'
              ? payload.table_number
              : undefined,
          customer_name:
            typeof payload.customer_name === 'string'
              ? payload.customer_name
              : undefined,
          status,
          total_amount: Number(payload.total_amount ?? 0),
          payment_method:
            typeof payload.payment_method === 'string'
              ? payload.payment_method
              : undefined,
          payment_status:
            typeof payload.payment_status === 'string'
              ? payload.payment_status
              : undefined,
          timestamp: event.created_at,
          started_at:
            typeof payload.started_at === 'string'
              ? payload.started_at
              : undefined,
          batch_number:
            typeof payload.batch_number === 'string'
              ? payload.batch_number
              : undefined,
          last_updated_at: event.created_at,
        });
        continue;
      }

      /* --------------------------------------------------------
       * ORDER SENT TO KITCHEN — first kitchen sighting
       * -------------------------------------------------------- */

      if (event.event_type === 'order_sent_to_kitchen') {
        const existing = ordersMap.get(orderId);
        const ticketItems = mapItems(payload);

        if (existing) {
          existing.last_updated_at = event.created_at;
          if (
            typeof payload.kitchen_status === 'string' &&
            [
              'pending',
              'preparing',
              'ready',
              'completed',
              'cancelled',
            ].includes(payload.kitchen_status)
          ) {
            existing.status = payload.kitchen_status as KitchenOrderStatus;
          }
          if (typeof payload.batch_number === 'string') {
            existing.batch_number = payload.batch_number;
          }
          // Prefer richer line detail (combo picks) when kitchen event carries it
          const existingDetail = existing.items.some(
            (i) => (i.selections?.length ?? 0) > 0,
          );
          const incomingDetail = ticketItems.some(
            (i) => (i.selections?.length ?? 0) > 0,
          );
          if (incomingDetail && !existingDetail) {
            existing.items = ticketItems;
          } else if (ticketItems.length > existing.items.length) {
            existing.items = ticketItems;
          }
          continue;
        }

        // First kitchen sighting — create entry with status 'pending'
        ordersMap.set(orderId, {
          order_id: orderId,
          items: mapItems(payload),
          order_type:
            typeof payload.order_type === 'string'
              ? payload.order_type
              : 'dine_in',
          table_number:
            typeof payload.table_number === 'string'
              ? payload.table_number
              : undefined,
          customer_name:
            typeof payload.customer_name === 'string'
              ? payload.customer_name
              : undefined,
          status: 'pending',
          total_amount: Number(payload.total_amount ?? 0),
          payment_method:
            typeof payload.payment_method === 'string'
              ? payload.payment_method
              : undefined,
          payment_status:
            typeof payload.payment_status === 'string'
              ? payload.payment_status
              : undefined,
          timestamp: event.created_at,
          started_at: undefined,
          batch_number:
            typeof payload.batch_number === 'string'
              ? payload.batch_number
              : undefined,
          last_updated_at: event.created_at,
        });
        continue;
      }

      /* --------------------------------------------------------
       * ORDER STATUS UPDATE
       * -------------------------------------------------------- */

      if (event.event_type === 'order_status_updated') {
        const nextStatus =
          typeof payload.status === 'string'
            ? (payload.status as KitchenOrderStatus)
            : 'pending';
        const existing = ordersMap.get(orderId);

        if (existing) {
          existing.status = nextStatus;
          existing.last_updated_at = event.created_at;
          if (typeof payload.batch_number === 'string') {
            existing.batch_number = payload.batch_number;
          }
          if (nextStatus === 'preparing' && !existing.started_at) {
            existing.started_at =
              typeof payload.started_at === 'string'
                ? payload.started_at
                : event.created_at.toISOString();
          } else if (typeof payload.started_at === 'string') {
            existing.started_at = payload.started_at;
          }
          continue;
        }

        // Status update without prior kitchen sighting — only include
        // if it explicitly has a kitchen status or sent flag.
        const sent =
          payload.sent_to_kitchen === true ||
          payload.kitchen_status === 'pending' ||
          payload.kitchen_status === 'preparing' ||
          payload.kitchen_status === 'ready';
        if (!sent) {
          continue;
        }

        ordersMap.set(orderId, {
          order_id: orderId,
          items: mapItems(payload),
          order_type:
            typeof payload.order_type === 'string'
              ? payload.order_type
              : 'dine_in',
          table_number:
            typeof payload.table_number === 'string'
              ? payload.table_number
              : undefined,
          customer_name:
            typeof payload.customer_name === 'string'
              ? payload.customer_name
              : undefined,
          status: nextStatus,
          total_amount: Number(payload.total_amount ?? 0),
          payment_method:
            typeof payload.payment_method === 'string'
              ? payload.payment_method
              : undefined,
          payment_status:
            typeof payload.payment_status === 'string'
              ? payload.payment_status
              : undefined,
          timestamp: event.created_at,
          started_at:
            typeof payload.started_at === 'string'
              ? payload.started_at
              : nextStatus === 'preparing'
                ? event.created_at.toISOString()
                : undefined,
          batch_number:
            typeof payload.batch_number === 'string'
              ? payload.batch_number
              : undefined,
          last_updated_at: event.created_at,
        });
      }
    }

    return Array.from(ordersMap.values())
      .filter((order) =>
        ['pending', 'preparing', 'ready'].includes(order.status),
      )
      .sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return tb - ta;
      });
  }

  async startProduction(input: StartProductionInput, actorUserId?: string) {
    const recipeId = this.extractString(input as Record<string, unknown>, [
      'recipeId',
      'recipe_id',
    ]);
    if (!recipeId) {
      throw new BadRequestException('Recipe ID is required');
    }

    const batchSize = this.extractNumber(input as Record<string, unknown>, [
      'batchSize',
      'batch_size',
    ]);
    if (!Number.isFinite(batchSize) || batchSize <= 0) {
      throw new BadRequestException('Batch size must be greater than zero');
    }

    const recipe = await this.prisma.recipe.findFirst({
      where: { OR: [{ id: recipeId }, { recipe_code: recipeId }] },
      select: {
        id: true,
        item_id: true,
        item_name: true,
      },
    });
    if (!recipe) {
      throw new NotFoundException(`Recipe ${recipeId} was not found`);
    }

    const result = await this.productionService.startProduction(
      {
        recipe_id: recipe.id,
        item_id: recipe.item_id,
        item_name: recipe.item_name,
        planned_quantity: batchSize,
      },
      actorUserId || 'system',
    );

    return {
      success: result.success,
      productionId: result.productionId,
      production_id: result.productionId,
      recipeId: recipe.id,
      recipe_id: recipe.id,
      recipeName: recipe.item_name,
      recipe_name: recipe.item_name,
      batchSize,
      batch_size: batchSize,
      status: 'started' as const,
      eventId: result.eventId,
      message: result.message,
    };
  }

  async finishProduction(
    input: FinishProductionInput | string,
    actualYieldInput?: number,
    actorUserId?: string,
  ) {
    let productionId: string | undefined;
    let actualYield: number;
    let extras: FinishProductionInput = {};

    if (typeof input === 'string') {
      productionId = input;
      actualYield = Number(actualYieldInput);
    } else {
      productionId = this.extractString(input as Record<string, unknown>, [
        'productionId',
        'production_id',
      ]);
      actualYield = this.extractNumber(input as Record<string, unknown>, [
        'actualYield',
        'actual_yield',
      ]);
      extras = input;
    }

    if (!productionId) {
      throw new BadRequestException('Production ID is required');
    }
    if (!Number.isFinite(actualYield) || actualYield <= 0) {
      throw new BadRequestException('Actual yield must be greater than zero');
    }

    const batchNumber =
      extras.batchNumber ||
      `AUTO-${productionId.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`;
    const expiryDate =
      extras.expiryDate || new Date().toISOString().slice(0, 10);

    const result = await this.productionService.finishProduction(
      {
        production_id: productionId,
        actual_quantity_produced: actualYield,
        batch_number: batchNumber,
        expiry_date: expiryDate,
        unit_cost: extras.unitCost ?? 0,
        waste_quantity: extras.wasteQuantity ?? 0,
        waste_reason: extras.wasteReason,
        inputs: extras.inputs,
        outputs: extras.outputs,
      },
      actorUserId || 'system',
    );

    return {
      success: result.success,
      productionId,
      production_id: productionId,
      eventId: result.eventId,
      inputs: result.inputs,
      outputs: result.outputs,
      varianceBatchId: result.varianceBatchId,
      message: result.message,
    };
  }

  async getProductionQueue(shopId: string = '1') {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [starts, finishes] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          shop_id: shopId,
          event_type: 'production_started',
          created_at: { gte: since },
        },
        select: { created_at: true, payload: true },
        orderBy: { created_at: 'asc' },
        take: 150,
      }),
      this.prisma.event.findMany({
        where: {
          shop_id: shopId,
          event_type: {
            in: ['production_finished', 'production_completed'],
          },
          created_at: { gte: since },
        },
        select: { payload: true },
        orderBy: { created_at: 'desc' },
        take: 300,
      }),
    ]);

    const finishedIds = new Set<string>();
    for (const event of finishes) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const id = this.extractString(payload, [
        'productionId',
        'production_id',
        'productionID',
        'batchId',
        'batch_id',
      ]);
      if (id) finishedIds.add(id);
    }

    const queue: ProductionQueueItem[] = [];
    let position = 0;

    for (const event of starts) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const productionId = this.extractString(payload, [
        'productionId',
        'production_id',
        'productionID',
        'batchId',
        'batch_id',
      ]);
      if (!productionId || finishedIds.has(productionId)) continue;

      position += 1;
      const recipeId =
        this.extractString(payload, ['recipeId', 'recipe_id']) ?? '';
      const recipeName =
        this.extractString(payload, [
          'recipeName',
          'recipe_name',
          'itemName',
          'item_name',
        ]) ?? '';
      const batchSize = this.extractNumber(payload, [
        'batchSize',
        'batch_size',
        'plannedQuantity',
        'planned_quantity',
        'quantity',
      ]);
      const startedAt =
        this.extractDateString(payload, ['startedAt', 'started_at']) ??
        event.created_at.toISOString();

      queue.push({
        id: productionId,
        position,
        productionId,
        recipeId,
        recipeName,
        batchSize,
        status: 'started',
        startedAt,
        finishedAt: null,
        production_id: productionId,
        recipe_id: recipeId,
        recipe_name: recipeName,
        batch_size: batchSize,
        started_at: startedAt,
        finished_at: null,
      });
    }

    return {
      success: true,
      shop_id: shopId,
      queue,
      items: queue,
      data: queue,
      count: queue.length,
    };
  }

  async getProductionHistory(shopId: string = '1', opts?: { limit?: number }) {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: {
          in: ['production_finished', 'production_completed'],
        },
        created_at: { gte: since },
      },
      select: {
        created_at: true,
        payload: true,
        item_id: true,
        quantity: true,
        unit_cost: true,
        total_cost: true,
        batch_number: true,
        expiry_date: true,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    const seen = new Set<string>();
    const itemIds = new Set<string>();
    const draft: Array<{
      productionId: string;
      recipeId: string;
      recipeName: string;
      itemId: string;
      batchSize: number;
      actualYield: number | null;
      runUnitCost?: number | null;
      totalInputCost?: number | null;
      batchNumber: string | null;
      expiryDate: string | null;
      startedAt: string;
      finishedAt: string | null;
    }> = [];

    for (const event of events) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const productionId = this.extractString(payload, [
        'productionId',
        'production_id',
        'batchId',
        'batch_id',
      ]);
      if (!productionId || seen.has(productionId)) continue;
      seen.add(productionId);

      const finishedAt =
        this.extractDateString(payload, [
          'finishedAt',
          'finished_at',
          'completedAt',
          'completed_at',
        ]) ?? event.created_at.toISOString();

      const startedAt =
        this.extractDateString(payload, ['startedAt', 'started_at']) ??
        finishedAt;

      const recipeId =
        this.extractString(payload, ['recipeId', 'recipe_id']) ?? '';
      const recipeName =
        this.extractString(payload, [
          'recipeName',
          'recipe_name',
          'itemName',
          'item_name',
        ]) ?? '';
      const itemId =
        this.extractString(payload, ['itemId', 'item_id']) ??
        event.item_id ??
        '';
      if (itemId) itemIds.add(itemId);

      const batchSize = this.extractNumber(payload, [
        'batchSize',
        'batch_size',
        'plannedQuantity',
        'planned_quantity',
      ]);
      const actualYield = this.extractNumber(payload, [
        'actualYield',
        'actual_yield',
        'actual_quantity_produced',
        'quantity',
      ]);

      const batchNumber =
        this.extractString(payload, ['batch_number', 'batchNumber']) ??
        event.batch_number ??
        null;

      let expiryDate =
        this.extractString(payload, ['expiry_date', 'expiryDate']) ?? null;
      if (!expiryDate && event.expiry_date) {
        expiryDate = event.expiry_date.toISOString().slice(0, 10);
      }

      draft.push({
        productionId,
        recipeId,
        recipeName,
        itemId,
        batchSize,
        actualYield: actualYield || Number(event.quantity ?? 0) || null,
        runUnitCost: (() => {
          const p = (event.payload ?? {}) as Record<string, unknown>;
          const rawUc = p.unit_cost ?? p.unitCost ?? event.unit_cost;
          const n = rawUc == null ? 0 : Number(rawUc);
          return Number.isFinite(n) && n > 0 ? n : null;
        })(),
        totalInputCost: (() => {
          const p = (event.payload ?? {}) as Record<string, unknown>;
          const n = Number(p.total_input_cost ?? p.totalInputCost ?? 0);
          return Number.isFinite(n) && n > 0 ? n : null;
        })(),
        batchNumber,
        expiryDate,
        startedAt,
        finishedAt,
      });
    }

    const stockRows =
      itemIds.size === 0
        ? []
        : await this.prisma.inventoryProjection.findMany({
            where: {
              shop_id: shopId,
              item_id: { in: [...itemIds] },
            },
            include: {
              item: { select: { unit: true, name: true } },
            },
          });

    const stockById = new Map(
      stockRows.map((r) => {
        const available = Number(r.available_stock ?? 0);
        const value = Number(r.total_value ?? 0);
        let wac = Number(r.avg_unit_cost ?? 0);
        if (!(wac > 0) && available > 0 && value > 0) {
          wac = value / available;
        }
        return [
          r.item_id,
          {
            available,
            value,
            unitCost: wac > 0 ? wac : 0,
            unit: r.item?.unit ?? 'pcs',
            nextExpiry: r.next_expiry_date
              ? r.next_expiry_date.toISOString().slice(0, 10)
              : null,
          },
        ] as const;
      }),
    );

    const history: ProductionHistoryRow[] = draft.map((row) => {
      const stock = stockById.get(row.itemId);
      const availableStock = stock?.available ?? null;
      const totalValue = stock?.value ?? null;
      const unit = stock?.unit ?? 'pcs';
      const stockExpiry = stock?.nextExpiry ?? row.expiryDate;

      const unitCost =
        stock?.unitCost && stock.unitCost > 0 ? stock.unitCost : null;
      const runUnitCost =
        (row as { runUnitCost?: number | null }).runUnitCost ?? null;
      const totalInputCost =
        (row as { totalInputCost?: number | null }).totalInputCost ?? null;

      return {
        productionId: row.productionId,
        recipeId: row.recipeId,
        recipeName: row.recipeName,
        itemId: row.itemId,
        batchSize: row.batchSize,
        actualYield: row.actualYield,
        batchNumber: row.batchNumber,
        expiryDate: row.expiryDate,
        stockExpiry,
        availableStock,
        totalValue,
        unitCost,
        runUnitCost,
        totalInputCost,
        unit,
        status: 'finished' as const,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        production_id: row.productionId,
        recipe_id: row.recipeId,
        recipe_name: row.recipeName,
        batch_size: row.batchSize,
        actual_yield: row.actualYield,
        batch_number: row.batchNumber,
        expiry_date: row.expiryDate,
        available_stock: availableStock,
        total_value: totalValue,
        unit_cost: unitCost,
        run_unit_cost: runUnitCost,
        total_input_cost: totalInputCost,
        started_at: row.startedAt,
        finished_at: row.finishedAt,
      };
    });

    return {
      success: true,
      shop_id: shopId,
      items: history,
      history,
      data: history,
      count: history.length,
    };
  }

  async getClosingStockForm(shopId: string = '1') {
    const [rows, lastCountByItem] = await Promise.all([
      this.prisma.inventoryProjection.findMany({
        where: { shop_id: shopId },
        include: {
          item: {
            select: {
              name: true,
              unit: true,
              category: true,
            },
          },
        },
        orderBy: { item_id: 'asc' },
      }),
      this.loadLastCountedMap(shopId),
    ]);

    const items = rows.map((row) => {
      const systemQty = Number(row.available_stock ?? 0);
      // Prefer live WAC (avg_unit_cost); fall back to value/qty
      let unitCost = Number(row.avg_unit_cost ?? 0);
      if (!(unitCost > 0) && systemQty > 0) {
        const tv = toMoneyNumber(row.total_value ?? 0);
        if (tv > 0) unitCost = tv / systemQty;
      }
      const previous = lastCountByItem.get(row.item_id);
      return {
        item_id: row.item_id,
        item_name: row.item?.name ?? row.item_id,
        unit: row.item?.unit ?? 'pcs',
        category: row.item?.category ?? null,
        system_qty: systemQty,
        counted_qty: null as number | null,
        unit_cost: Number.isFinite(unitCost) ? unitCost : 0,
        last_counted_at: previous?.countedAt ?? null,
        last_counted_qty: previous?.countedQty ?? null,
      };
    });

    return {
      success: true,
      shop_id: shopId,
      counted_at_hint: new Date().toISOString(),
      items,
      total: items.length,
    };
  }

  async submitClosingStock(dto: SubmitClosingStockDto, actorUserId: string) {
    const shopId = dto.shop_id || '1';
    const dayKey = new Date().toISOString().slice(0, 10);
    const shiftKey = (dto.shift_label?.trim() || 'default')
      .toLowerCase()
      .replace(/\s+/g, '-');

    const idempotencyKey = `closing-stock-${shopId}-${dayKey}-${shiftKey}`;

    const existing = await this.prisma.event.findUnique({
      where: { idempotency_key: idempotencyKey },
    });

    if (existing) {
      const payload = (existing.payload ?? {}) as Record<string, unknown>;
      return {
        success: true,
        alreadySubmitted: true,
        batchId: typeof payload.batch_id === 'string' ? payload.batch_id : '',
        batchNumber:
          typeof payload.batch_number === 'string'
            ? payload.batch_number
            : typeof existing.batch_number === 'string'
              ? existing.batch_number
              : '',
        eventId: existing.id,
        shop_id: shopId,
        items_counted: Number(payload.items_counted ?? 0),
        items_flagged: Number(payload.items_flagged ?? 0),
        total_variance_value: Number(payload.total_variance_value ?? 0),
        lines: Array.isArray(payload.lines) ? payload.lines : [],
        message: 'Closing stock already submitted for this shift/day',
      };
    }

    const displayBatchCode = `${dayKey.replace(/-/g, '').slice(-6)}-${shiftKey
      .slice(0, 4)
      .toUpperCase()}`;
    const batchId = `COUNT-${shopId}-${dayKey}-${shiftKey}`;

    const itemIds = dto.lines.map((line) => line.item_id);
    const projections = await this.prisma.inventoryProjection.findMany({
      where: { shop_id: shopId, item_id: { in: itemIds } },
      include: {
        item: { select: { name: true, unit: true } },
      },
    });
    const byItem = new Map(projections.map((p) => [p.item_id, p]));

    const lines = dto.lines.map((line) => {
      const projection = byItem.get(line.item_id);
      const systemQty = Number(projection?.available_stock ?? 0);
      const countedQty = Number(line.counted_qty);
      const varianceQty = countedQty - systemQty;
      let unitCost = Number(projection?.avg_unit_cost ?? 0);
      if (!(unitCost > 0) && systemQty > 0 && projection) {
        const tv = Number(projection.total_value ?? 0);
        if (tv > 0) unitCost = tv / systemQty;
      }
      const safeUnitCost = Number.isFinite(unitCost) ? unitCost : 0;
      return {
        item_id: line.item_id,
        item_name: projection?.item?.name ?? line.item_id,
        unit: projection?.item?.unit ?? 'pcs',
        system_qty: systemQty,
        expected_quantity: systemQty,
        counted_qty: countedQty,
        counted_quantity: countedQty,
        variance_qty: varianceQty,
        variance_quantity: varianceQty,
        variance_value: varianceQty * safeUnitCost,
        unit_cost: safeUnitCost,
        notes: line.notes ?? null,
      };
    });

    const totalVarianceValue = lines.reduce(
      (sum, line) => sum + Math.abs(Number(line.variance_value ?? 0)),
      0,
    );
    const itemsFlagged = lines.filter(
      (line) => Number(line.variance_qty) !== 0,
    ).length;
    const countedAt = new Date().toISOString();

    const event = await this.eventStore.appendEvent({
      event_type: 'closing_stock_counted',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      batch_number: displayBatchCode,
      payload: {
        batch_id: batchId,
        batch_number: displayBatchCode,
        display_batch_code: displayBatchCode,
        shop_id: shopId,
        shift_label: dto.shift_label ?? null,
        notes: dto.notes ?? null,
        status: 'completed',
        counted_at: countedAt,
        items_counted: lines.length,
        items_flagged: itemsFlagged,
        total_variance_value: totalVarianceValue,
        stock_count_completed: true,
        lines,
      },
    });

    try {
      await this.eventStore.appendEvent({
        event_type: 'stock_count_completed',
        actor_user_id: actorUserId,
        idempotency_key: `${idempotencyKey}-alias`,
        batch_number: displayBatchCode,
        payload: {
          batch_id: batchId,
          batch_number: displayBatchCode,
          display_batch_code: displayBatchCode,
          shop_id: shopId,
          status: 'completed',
          counted_at: countedAt,
          items_counted: lines.length,
          items_flagged: itemsFlagged,
          total_variance_value: totalVarianceValue,
          stock_count_completed: true,
          lines,
          source_event_id: event.id,
        },
      });
    } catch {
      // alias best-effort
    }

    this.logger.log(
      `Closing stock ${batchId}: ${lines.length} lines, ${itemsFlagged} flagged`,
    );

    return {
      success: true,
      alreadySubmitted: false,
      batchId,
      batchNumber: displayBatchCode,
      eventId: event.id,
      shop_id: shopId,
      items_counted: lines.length,
      items_flagged: itemsFlagged,
      total_variance_value: totalVarianceValue,
      lines,
      message: 'Closing stock count submitted successfully',
    };
  }

  async updateOrderStatus(
    orderId: string,
    status: KitchenOrderStatus,
    actorUserId: string,
    batchInfo?: { batch_number?: string; item_id?: string },
  ) {
    const idempotencyKey = `kitchen-status-${orderId}-${status}`;
    const now = new Date().toISOString();
    const event = await this.eventStore.appendEvent({
      event_type: 'order_status_updated',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      batch_number: batchInfo?.batch_number,
      payload: {
        order_id: orderId,
        status,
        kitchen_status: status,
        batch_number: batchInfo?.batch_number,
        item_id: batchInfo?.item_id,
        updated_at: now,
        ...(status === 'preparing' ? { started_at: now } : {}),
      },
    });
    return {
      success: true,
      eventId: event.id,
      message: `Order marked as ${status}`,
    };
  }

  async getBatchesForItem(itemId: string) {
    const events = await this.eventStore.getEventsForItem(itemId, {
      take: 100,
    });
    return events
      .filter((event) => !!event.batch_number)
      .map((event) => {
        const payload = (event.payload ?? {}) as Record<string, unknown>;
        return {
          batch_number: event.batch_number,
          expiry_date: event.expiry_date,
          quantity: Number(payload.quantity ?? payload.quantity_approved ?? 0),
          event_type: event.event_type,
          created_at: event.created_at,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
  }

  private async loadLastCountedMap(shopId: string) {
    const map = new Map<string, { countedAt: string; countedQty: number }>();
    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: {
          in: ['closing_stock_counted', 'stock_count_completed'],
        },
      },
      select: { created_at: true, payload: true },
      orderBy: { created_at: 'desc' },
      take: 3,
    });

    for (const event of events) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const lines = Array.isArray(payload.lines) ? payload.lines : [];
      const countedAt =
        typeof payload.counted_at === 'string' && payload.counted_at
          ? payload.counted_at
          : event.created_at.toISOString();

      for (const raw of lines) {
        const line = raw as Record<string, unknown>;
        const itemId =
          typeof line.item_id === 'string'
            ? line.item_id
            : typeof line.itemId === 'string'
              ? line.itemId
              : null;
        if (!itemId || map.has(itemId)) continue;
        map.set(itemId, {
          countedAt,
          countedQty: Number(
            line.counted_qty ??
              line.counted_quantity ??
              line.countedQuantity ??
              0,
          ),
        });
      }
    }
    return map;
  }

  private extractString(
    payload: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number') return String(value);
    }
    return undefined;
  }

  private extractNumber(
    payload: Record<string, unknown>,
    keys: string[],
  ): number {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return 0;
  }

  private extractDateString(
    payload: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
      }
      if (value instanceof Date) return value.toISOString();
    }
    return undefined;
  }
  async listClosingStockHistory(shopId: string = '1', limit = 50) {
    const take = Math.min(Math.max(limit || 50, 1), 200);
    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: { in: ['closing_stock_counted', 'stock_count_completed'] },
      },
      orderBy: { created_at: 'desc' },
      take,
      include: { actor: { select: { name: true, email: true } } },
    });

    const items = events.map((ev) => {
      const p = (ev.payload ?? {}) as Record<string, unknown>;
      return {
        batchId: String(p.batch_id ?? p.batchId ?? ev.id),
        batchNumber: String(p.batch_number ?? p.batchNumber ?? ev.batch_number ?? ''),
        shopId: ev.shop_id,
        shiftLabel: (p.shift_label ?? p.shiftLabel ?? null) as string | null,
        countedAt: ev.created_at.toISOString(),
        countedBy:
          (ev as { actor?: { name?: string; email?: string } }).actor?.name ||
          (ev as { actor?: { email?: string } }).actor?.email ||
          null,
        itemsCounted: Number(p.items_counted ?? p.itemsCounted ?? 0),
        itemsFlagged: Number(p.items_flagged ?? p.itemsFlagged ?? 0),
        totalVarianceValue: Number(
          p.total_variance_value ?? p.totalVarianceValue ?? 0,
        ),
        readOnly: true,
      };
    });

    return { success: true, shopId, items, total: items.length };
  }

  async getClosingStockHistoryItem(batchId: string) {
    const events = await this.prisma.event.findMany({
      where: {
        event_type: { in: ['closing_stock_counted', 'stock_count_completed'] },
      },
      orderBy: { created_at: 'desc' },
      take: 300,
      include: { actor: { select: { name: true, email: true } } },
    });

    const ev = events.find((e) => {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const id = String(p.batch_id ?? p.batchId ?? e.id);
      const num = String(p.batch_number ?? p.batchNumber ?? e.batch_number ?? '');
      return id === batchId || num === batchId || e.id === batchId;
    });

    if (!ev) {
      return { success: false, message: 'Closing stock batch not found' };
    }

    const p = (ev.payload ?? {}) as Record<string, unknown>;
    return {
      success: true,
      readOnly: true,
      batchId: String(p.batch_id ?? p.batchId ?? ev.id),
      batchNumber: String(p.batch_number ?? p.batchNumber ?? ev.batch_number ?? ''),
      shopId: ev.shop_id,
      shiftLabel: (p.shift_label ?? p.shiftLabel ?? null) as string | null,
      countedAt: ev.created_at.toISOString(),
      countedBy:
        (ev as { actor?: { name?: string } }).actor?.name ||
        (ev as { actor?: { email?: string } }).actor?.email ||
        null,
      itemsCounted: Number(p.items_counted ?? 0),
      itemsFlagged: Number(p.items_flagged ?? 0),
      totalVarianceValue: Number(p.total_variance_value ?? 0),
      lines: Array.isArray(p.lines) ? p.lines : [],
      notes: (p.notes ?? null) as string | null,
    };
  }


}
