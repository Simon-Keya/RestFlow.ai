// apps/api/src/modules/menu/menu.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventStoreService } from '../../core/event-store.service';
import { IdempotencyService } from '../../core/idempotency.service';
import { MenuGateway } from './menu.gateway';
import type { CreateMenuDto } from './dto/create-menu.dto';
import type { MenuItemDto } from './dto/menu-item.dto';
import { FefoStockService } from '../../core/fefo-stock.service';

interface IdempotencyResult {
  isReplay: boolean;
  existing: { id: string; payload?: unknown } | null;
}

export type ComponentType = 'FIXED' | 'CHOICE' | 'MULTI_CHOICE' | 'INVENTORY';

export interface ChoiceOption {
  finishedGoodId: string;
  finishedGoodName: string;
  unit: string;
  availableStock: number;
  unitCost: number;
  maxPortions: number;
}

export interface MenuComponentLine {
  componentKey: string;
  componentType: ComponentType;
  finishedGoodId: string | null;
  finishedGoodName: string | null;
  finishedGoodCategoryId: string | null;
  finishedGoodCategoryCode: string | null;
  finishedGoodCategoryName: string | null;
  quantityRequired: number;
  unit: string;
  minSelect: number;
  maxSelect: number;
  allowRepeat: boolean;
  availableStock: number;
  maxPortions: number;
  unitCost: number;
  lineCost: number;
  options: ChoiceOption[];
}

export interface MenuListItem {
  menuId: string;
  menuCode: string;
  name: string;
  category: string | null;
  sellingPrice: number;
  taxRate: number;
  finishedGoodId: string | null;
  finishedGoodName: string | null;
  quantityRequired: number;
  unit: string;
  lines: MenuComponentLine[];
  isAvailable: boolean;
  isVisible: boolean;
  availableQuantity: number;
  maxPortions: number;
  unitCost: number;
  foodCost: number;
  margin: number;
  marginPercent: number | null;
  foodCostPercent?: number | null;
  costMissing?: boolean;
  status: string;
  createdAt: string | null;
  requiresSelection: boolean;
}

type LineDraft = {
  componentKey: string;
  componentType: ComponentType;
  finishedGoodId: string | null;
  finishedGoodName: string | null;
  finishedGoodCategoryId: string | null;
  finishedGoodCategoryCode: string | null;
  finishedGoodCategoryName: string | null;
  /** Inventory Select — explicit SKUs (no category required) */
  optionItemIds: string[];
  quantityRequired: number;
  unit: string;
  minSelect: number;
  maxSelect: number;
  allowRepeat: boolean;
};

type NormalizedLine = {
  component_key: string;
  component_type: ComponentType;
  finished_good_id?: string;
  finished_good_name?: string;
  finished_good_category_id?: string;
  finished_good_category_code?: string;
  finished_good_category_name?: string;
  /** Explicit inventory SKUs for inventory-select CHOICE lines */
  option_item_ids?: string[];
  option_items?: Array<Record<string, unknown> | string>;
  quantity_required: number;
  unit: string;
  min_select: number;
  max_select: number;
  allow_repeat: boolean;
};

type StockSnapshot = {
  available: number;
  unitCost: number;
};

type FgCategoryRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type FgCategoryWithItems = FgCategoryRow & {
  items: Array<{ item_id: string; name: string; unit: string }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

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

function asComponentType(value: unknown): ComponentType {
  const t = String(value ?? 'FIXED').toUpperCase();
  if (t === 'CHOICE' || t === 'MULTI_CHOICE' || t === 'INVENTORY') {
    return t as ComponentType;
  }
  return 'FIXED';
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function isFinishedCategory(category: string | null | undefined): boolean {
  const cat = (category ?? '').toLowerCase();
  return (
    cat.includes('finished') ||
    cat.includes('production') ||
    cat === 'fg' ||
    cat.includes('complete recipe')
  );
}

function normalizeLines(dto: CreateMenuDto): NormalizedLine[] {
  if (Array.isArray(dto.lines) && dto.lines.length > 0) {
    return dto.lines.map((line, idx) => {
      const type = (line.component_type ?? 'FIXED') as ComponentType;
      const fgId =
        line.finished_good_id ||
        (line as { inventory_item_id?: string }).inventory_item_id ||
        undefined;
      const qty = line.quantity_required ?? 1;
      const isChoice = type === 'CHOICE' || type === 'MULTI_CHOICE';
      const minSelect =
        line.min_select ?? (type === 'CHOICE' ? 1 : isChoice ? 1 : 0);
      const maxSelect =
        line.max_select ?? (type === 'CHOICE' ? 1 : isChoice ? qty : 1);

      return {
        component_key: line.component_key?.trim() || `line_${idx + 1}`,
        component_type: type,
        finished_good_id: line.finished_good_id?.trim(),
        finished_good_name: line.finished_good_name,
        finished_good_category_id: line.finished_good_category_id?.trim(),
        finished_good_category_code: line.finished_good_category_code?.trim(),
        finished_good_category_name: line.finished_good_category_name,
        option_item_ids: line.option_item_ids,
        option_items: line.option_items,
        quantity_required: qty,
        unit: line.unit ?? 'pcs',
        min_select: minSelect,
        max_select: maxSelect,
        allow_repeat: line.allow_repeat ?? type === 'MULTI_CHOICE',
      };
    });
  }

  if (dto.finished_good_id?.trim()) {
    return [
      {
        component_key: 'main',
        component_type: 'FIXED',
        finished_good_id: dto.finished_good_id.trim(),
        finished_good_name: dto.finished_good_name,
        quantity_required: dto.quantity_required ?? 1,
        unit: dto.unit ?? 'pcs',
        min_select: 0,
        max_select: 1,
        allow_repeat: false,
      },
    ];
  }

  return [];
}

@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  /** Short TTL cache — POS hits listMenus + availability together */
  private listMenusCache = new Map<
    string,
    { at: number; data: { success: boolean; items: MenuListItem[]; count: number } }
  >();
  private static readonly LIST_MENUS_TTL_MS = 120_000;

  invalidateListMenusCache(shopId?: string): void {
    if (shopId) this.listMenusCache.delete(shopId);
    else this.listMenusCache.clear();
  }

  /** Update maxPortions from live stock without re-folding menu events (~3s). */
  async refreshListMenusStock(shopId: string): Promise<void> {
    const cached = this.listMenusCache.get(shopId);
    if (!cached) return;

    // Prefer usable-batch sum so menu maxPortions matches Inventory Available
    const batchMap = await this.fefoStock.getUsableStockByItemMap(shopId);
    const avail = new Map<string, number>(
      [...batchMap.entries()].map(([id, v]) => [id, v.qty]),
    );
    // Fill gaps from projection only when no batch rows exist (legacy)
    const rows = await this.prisma.inventoryProjection.findMany({
      where: { shop_id: shopId },
      select: { item_id: true, available_stock: true },
    });
    for (const r of rows) {
      if (!avail.has(r.item_id)) {
        avail.set(r.item_id, Math.max(0, Number(r.available_stock ?? 0)));
      }
    }

    for (const item of cached.data.items) {
      const lines = item.lines ?? [];
      if (lines.length === 0 && item.finishedGoodId) {
        const a = avail.get(item.finishedGoodId) ?? 0;
        const need = Math.max(item.quantityRequired || 1, 0.0001);
        item.maxPortions = Math.max(0, Math.floor(a / need));
        item.availableQuantity = item.maxPortions;
        item.isAvailable = item.maxPortions > 0 && item.isAvailable !== false;
        continue;
      }
      let minP = Infinity;
      for (const line of lines) {
        if (line.componentType === 'FIXED' && line.finishedGoodId) {
          const a = avail.get(line.finishedGoodId) ?? 0;
          const need = Math.max(line.quantityRequired || 1, 0.0001);
          const mp = Math.max(0, Math.floor(a / need));
          line.availableStock = a;
          line.maxPortions = mp;
          if (mp < minP) minP = mp;
        } else if (line.options && line.options.length > 0) {
          let total = 0;
          for (const opt of line.options) {
            const a = avail.get(opt.finishedGoodId) ?? 0;
            opt.availableStock = a;
            const need = Math.max(line.quantityRequired || 1, 0.0001);
            opt.maxPortions = Math.max(0, Math.floor(a / need));
            total += a;
          }
          const need = Math.max(line.quantityRequired || 1, 0.0001);
          const mp = Math.max(0, Math.floor(total / need));
          line.availableStock = total;
          line.maxPortions = mp;
          if (mp < minP) minP = mp;
        }
      }
      if (minP !== Infinity) {
        item.maxPortions = Math.max(0, minP);
        item.availableQuantity = item.maxPortions;
        item.isAvailable = item.maxPortions > 0;
      }
    }
    this.listMenusCache.set(shopId, { at: Date.now(), data: cached.data });
  }

  constructor(
    private readonly eventStore: EventStoreService,
    private readonly idempotencyService: IdempotencyService,
    private readonly menuGateway: MenuGateway,
    private readonly prisma: PrismaService,
    private readonly fefoStock: FefoStockService,
  ) {}

  // ── Finished goods (FIXED picker only) ─────────────────

  /**
   * FIXED component picker — only Finished Goods / complete recipe products.
   * Never returns raw materials or general inventory.
   */
  async listFinishedGoods(shopId: string = '1'): Promise<{
    success: boolean;
    items: Array<{
      itemId: string;
      name: string;
      unit: string;
      category: string | null;
      availableStock: number;
      totalValue: number;
    }>;
    count: number;
  }> {
    const recipeProducts = await this.prisma.recipe.findMany({
      select: { item_id: true },
      distinct: ['item_id'],
    });
    const recipeSkuSet = new Set(
      recipeProducts.map((r) => r.item_id).filter(Boolean),
    );

    const items = await this.prisma.item.findMany({
      orderBy: { name: 'asc' },
      take: 2000,
    });

    const stockRows = await this.prisma.inventoryProjection.findMany({
      where: { shop_id: shopId },
      select: {
        item_id: true,
        available_stock: true,
        total_value: true,
      },
    });
    const stockById = new Map(
      stockRows.map((s) => [
        s.item_id,
        {
          available: Number(s.available_stock ?? 0),
          value: Number(s.total_value ?? 0),
        },
      ]),
    );

    const finished = items.filter((item) => {
      if (item.finished_good_category_id) return true;
      if (recipeSkuSet.has(item.item_id)) return true;
      return isFinishedCategory(item.category);
    });

    const result = finished.map((item) => {
      const stock = stockById.get(item.item_id);
      return {
        itemId: item.item_id,
        name: item.name,
        unit: item.unit,
        category: item.category,
        availableStock: stock?.available ?? 0,
        totalValue: stock?.value ?? 0,
      };
    });

    return {
      success: true,
      items: result,
      count: result.length,
    };
  }

  // ── Finished Good categories (selection pools only) ────

  async listFinishedGoodCategories(): Promise<{
    success: boolean;
    items: Array<{
      id: string;
      code: string;
      name: string;
      description: string | null;
      itemCount: number;
      items: Array<{
        finishedGoodId: string;
        name: string;
        unit: string;
      }>;
    }>;
    count: number;
  }> {
    const rows = (await this.prisma.finishedGoodCategory.findMany({
      where: { is_active: true },
      include: {
        items: {
          select: { item_id: true, name: true, unit: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })) as FgCategoryWithItems[];

    const items = rows.map((category) => ({
      id: category.id,
      code: category.code,
      name: category.name,
      description: category.description,
      itemCount: category.items.length,
      items: category.items.map((item) => ({
        finishedGoodId: item.item_id,
        name: item.name,
        unit: item.unit,
      })),
    }));

    return {
      success: true,
      items,
      count: items.length,
    };
  }

  async createFinishedGoodCategory(input: {
    code: string;
    name: string;
    description?: string;
  }): Promise<{ success: boolean; category: FgCategoryRow }> {
    const code = input.code.trim().toUpperCase().replace(/\s+/g, '_');

    const row = (await this.prisma.finishedGoodCategory.upsert({
      where: { code },
      create: {
        code,
        name: input.name.trim(),
        description: input.description ?? null,
      },
      update: {
        name: input.name.trim(),
        description: input.description ?? null,
        is_active: true,
      },
    })) as FgCategoryRow;

    return { success: true, category: row };
  }

  async assignItemToFinishedGoodCategory(
    itemId: string,
    categoryIdOrCode: string | null,
  ): Promise<{ success: boolean; itemId: string; categoryId: string | null }> {
    let categoryId: string | null = null;

    if (categoryIdOrCode) {
      const category = await this.findCategory(categoryIdOrCode);
      if (!category) {
        throw new NotFoundException(
          `Finished good category ${categoryIdOrCode} not found`,
        );
      }
      categoryId = category.id;
    }

    const item = await this.prisma.item.update({
      where: { item_id: itemId },
      data: { finished_good_category_id: categoryId },
    });

    return {
      success: true,
      itemId: item.item_id,
      categoryId,
    };
  }

  // ── Menu list / create ─────────────────────────────────

  async listMenus(shopId: string = '1'): Promise<{
    success: boolean;
    items: MenuListItem[];
    count: number;
  }> {
    const cached = this.listMenusCache.get(shopId);
    if (
      cached &&
      Date.now() - cached.at < MenuService.LIST_MENUS_TTL_MS
    ) {
      return cached.data;
    }

    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: { in: ['menu_created', 'menu_item_added', 'menu_adjusted'] },
      },
      orderBy: { created_at: 'asc' },
      take: 2000,
    });

    const byId = new Map<string, MenuListItem>();
    const linesByMenu = new Map<string, Map<string, LineDraft>>();

    for (const event of events) {
      const payload = asRecord(event.payload);
      const eventShop = asString(
        payload.shop_id ?? payload.shopId ?? event.shop_id,
        '1',
      );
      if (eventShop && eventShop !== shopId) continue;

      if (event.event_type === 'menu_created') {
        const menuId = asString(payload.menu_id ?? payload.menuId);
        if (!menuId) continue;

        byId.set(menuId, {
          menuId,
          menuCode: asString(payload.menu_code ?? payload.menuCode, menuId),
          name: asString(payload.name),
          category: asString(payload.category) || null,
          sellingPrice: asNumber(
            payload.selling_price ?? payload.sellingPrice,
            0,
          ),
          taxRate: asNumber(payload.tax_rate ?? payload.taxRate, 16),
          finishedGoodId:
            asString(payload.finished_good_id ?? payload.finishedGoodId) ||
            null,
          finishedGoodName:
            asString(payload.finished_good_name ?? payload.finishedGoodName) ||
            null,
          quantityRequired: asNumber(
            payload.quantity_required ?? payload.quantityRequired,
            1,
          ),
          unit: asString(payload.unit, 'pcs'),
          lines: [],
          isAvailable:
            payload.is_available !== false && payload.isAvailable !== false,
          isVisible:
            payload.is_visible !== false && payload.isVisible !== false,
          availableQuantity: 0,
          maxPortions: 0,
          unitCost: 0,
          foodCost: 0,
          margin: 0,
          marginPercent: null,
          status: asString(payload.status, 'active'),
          createdAt:
            asString(payload.created_at) || event.created_at.toISOString(),
          requiresSelection: false,
        });

        const map = linesByMenu.get(menuId) ?? new Map<string, LineDraft>();
        const payloadLines = Array.isArray(payload.lines) ? payload.lines : [];

        if (payloadLines.length > 0) {
          payloadLines.forEach((raw, idx) => {
            const row = asRecord(raw);
            const draft = this.draftFromPayload(row, idx);
            map.set(draft.componentKey, draft);
          });
        } else {
          const finishedGoodId = asString(
            payload.finished_good_id ?? payload.finishedGoodId,
          );
          if (finishedGoodId) {
            const draft: LineDraft = {
              componentKey: 'main',
              componentType: 'FIXED',
              finishedGoodId,
              finishedGoodName:
                asString(
                  payload.finished_good_name ?? payload.finishedGoodName,
                ) || null,
              finishedGoodCategoryId: null,
              finishedGoodCategoryCode: null,
              finishedGoodCategoryName: null,
              optionItemIds: [],
              quantityRequired: asNumber(
                payload.quantity_required ?? payload.quantityRequired,
                1,
              ),
              unit: asString(payload.unit, 'pcs'),
              minSelect: 0,
              maxSelect: 1,
              allowRepeat: false,
            };
            map.set(draft.componentKey, draft);
          }
        }

        linesByMenu.set(menuId, map);
      }

      if (event.event_type === 'menu_item_added') {
        const menuId = asString(payload.menu_id ?? payload.menuId);
        if (!menuId || !byId.has(menuId)) continue;

        const map = linesByMenu.get(menuId) ?? new Map<string, LineDraft>();
        const draft = this.draftFromPayload(payload, map.size);
        map.set(draft.componentKey, draft);
        linesByMenu.set(menuId, map);
      }

      if (event.event_type === 'menu_adjusted') {
        const menuId = asString(payload.menu_id ?? payload.menuId);
        if (!menuId || !byId.has(menuId)) continue;
        const existing = byId.get(menuId)!;
        if (payload.name != null) {
          existing.name = asString(payload.name, existing.name);
        }
        if (payload.selling_price != null || payload.sellingPrice != null) {
          existing.sellingPrice = asNumber(
            payload.selling_price ?? payload.sellingPrice,
            existing.sellingPrice,
          );
        }
        if (payload.category !== undefined) {
          existing.category =
            asString(payload.category) || null;
        }
        if (payload.is_available !== undefined || payload.isAvailable !== undefined) {
          existing.isAvailable =
            payload.is_available !== false && payload.isAvailable !== false;
        }
        if (payload.is_visible !== undefined || payload.isVisible !== undefined) {
          existing.isVisible =
            payload.is_visible !== false && payload.isVisible !== false;
        }
        if (payload.tax_rate != null || payload.taxRate != null) {
          existing.taxRate = asNumber(
            payload.tax_rate ?? payload.taxRate,
            existing.taxRate,
          );
        }
        if (payload.menu_code != null || payload.menuCode != null) {
          const code = asString(payload.menu_code ?? payload.menuCode);
          if (code) existing.menuCode = code;
        }
        existing.createdAt =
          asString(payload.adjusted_at) ||
          event.created_at.toISOString() ||
          existing.createdAt;

        const payloadLines = Array.isArray(payload.lines) ? payload.lines : null;
        if (payloadLines) {
          const map = new Map<string, LineDraft>();
          payloadLines.forEach((raw, idx) => {
            const row = asRecord(raw);
            const draft = this.draftFromPayload(row, idx);
            map.set(draft.componentKey, draft);
          });
          linesByMenu.set(menuId, map);
        }
        byId.set(menuId, existing);
      }

    }

    // Preload usable-batch stock once (aligned with Inventory Available / FEFO)
    const stockCache = new Map<string, StockSnapshot>();
    const batchMap = await this.fefoStock.getUsableStockByItemMap(shopId);
    for (const [itemId, v] of batchMap) {
      const available = Math.max(0, v.qty);
      const value = Math.max(0, v.value);
      const unitCost =
        available > 0 && value > 0 ? value / available : 0;
      stockCache.set(itemId, {
        available,
        unitCost: Number.isFinite(unitCost) ? unitCost : 0,
      });
    }
    // Legacy projection-only items (no batches yet)
    const allStock = await this.prisma.inventoryProjection.findMany({
      where: { shop_id: shopId },
      select: {
        item_id: true,
        available_stock: true,
        total_value: true,
      },
    });
    for (const row of allStock) {
      if (stockCache.has(row.item_id)) continue;
      const available = Math.max(0, Number(row.available_stock ?? 0));
      const value = Math.max(0, Number(row.total_value ?? 0));
      const unitCost =
        available > 0 && value > 0 ? value / available : 0;
      stockCache.set(row.item_id, {
        available,
        unitCost: Number.isFinite(unitCost) ? unitCost : 0,
      });
    }
    const getStock = async (itemId: string): Promise<StockSnapshot> => {
      const cached = stockCache.get(itemId);
      if (cached) return cached;
      const snapshot = await this.stockSnapshot(shopId, itemId);
      stockCache.set(itemId, snapshot);
      return snapshot;
    };

    const items = Array.from(byId.values());

    for (const item of items) {
      const lineMap =
        linesByMenu.get(item.menuId) ?? new Map<string, LineDraft>();
      let lineDrafts = Array.from(lineMap.values());

      if (lineDrafts.length === 0 && item.finishedGoodId) {
        lineDrafts = [
          {
            componentKey: 'main',
            componentType: 'FIXED',
            finishedGoodId: item.finishedGoodId,
            finishedGoodName: item.finishedGoodName,
            finishedGoodCategoryId: null,
            finishedGoodCategoryCode: null,
            finishedGoodCategoryName: null,
            optionItemIds: [],
            quantityRequired: item.quantityRequired || 1,
            unit: item.unit || 'pcs',
            minSelect: 0,
            maxSelect: 1,
            allowRepeat: false,
          },
        ];
      }

      const lines: MenuComponentLine[] = [];
      let minPortions = Infinity;
      let totalFoodCost = 0;
      let requiresSelection = false;

      for (const draft of lineDrafts) {
        if (draft.componentType === 'FIXED' || draft.componentType === 'INVENTORY') {
          const finishedGoodId = draft.finishedGoodId;
          if (!finishedGoodId) continue;

          const snapshot = await getStock(finishedGoodId);
          const need = Math.max(draft.quantityRequired || 1, 0.0001);
          const maxPortions = Math.floor(snapshot.available / need);
          const lineCost = roundMoney(need * snapshot.unitCost);

          lines.push({
            componentKey: draft.componentKey,
            componentType: draft.componentType === 'INVENTORY' ? 'INVENTORY' : 'FIXED',
            finishedGoodId,
            finishedGoodName: draft.finishedGoodName,
            finishedGoodCategoryId: null,
            finishedGoodCategoryCode: null,
            finishedGoodCategoryName: null,
            quantityRequired: draft.quantityRequired,
            unit: draft.unit,
            minSelect: 0,
            maxSelect: 1,
            allowRepeat: false,
            availableStock: snapshot.available,
            maxPortions,
            unitCost: roundMoney(snapshot.unitCost),
            lineCost,
            options: [],
          });

          totalFoodCost += lineCost;
          if (maxPortions < minPortions) minPortions = maxPortions;
          continue;
        }

        requiresSelection = true;
        const resolved = await this.resolveCategoryOptions(draft, getStock);
        const need = Math.max(draft.quantityRequired || 1, 0.0001);
        const totalUnits = resolved.options.reduce(
          (sum, option) => sum + option.availableStock,
          0,
        );
        const maxPortions = Math.floor(totalUnits / need);
        const priced = resolved.options.filter((option) => option.unitCost > 0);
        const avgUnit =
          priced.length > 0
            ? priced.reduce((sum, option) => sum + option.unitCost, 0) /
              priced.length
            : 0;
        const lineCost = roundMoney(need * avgUnit);

        lines.push({
          componentKey: draft.componentKey,
          componentType: draft.componentType,
          finishedGoodId: null,
          finishedGoodName: null,
          finishedGoodCategoryId: resolved.categoryId,
          finishedGoodCategoryCode: resolved.categoryCode,
          finishedGoodCategoryName: resolved.categoryName,
          quantityRequired: draft.quantityRequired,
          unit: draft.unit,
          minSelect: draft.minSelect,
          maxSelect: draft.maxSelect,
          allowRepeat: draft.allowRepeat,
          availableStock: totalUnits,
          maxPortions,
          unitCost: roundMoney(avgUnit),
          lineCost,
          options: resolved.options,
        });

        totalFoodCost += lineCost;
        if (maxPortions < minPortions) minPortions = maxPortions;
      }

      if (lines.length === 0) minPortions = 0;

      item.lines = lines;
      item.requiresSelection = requiresSelection;
      item.maxPortions =
        minPortions === Infinity ? 0 : Math.max(0, minPortions);

      const foodCost = roundMoney(totalFoodCost);
      item.unitCost = foodCost;
      item.foodCost = foodCost;
      item.margin = roundMoney(item.sellingPrice - foodCost);
      item.marginPercent =
        item.sellingPrice > 0
          ? roundMoney(item.margin / item.sellingPrice)
          : null;
      // Food cost % = COG / price (same as 1 - margin% when price > 0)
      (item as MenuListItem & { foodCostPercent: number | null }).foodCostPercent =
        item.sellingPrice > 0
          ? roundMoney(foodCost / item.sellingPrice)
          : null;
      const anyLineNeedsCost = lines.some(
        (line) => line.quantityRequired > 0 && line.unitCost <= 0,
      );
      (item as MenuListItem & { costMissing: boolean }).costMissing =
        lines.length > 0 && (foodCost <= 0 || anyLineNeedsCost);

      const firstFixed = lines.find((line) => line.componentType === 'FIXED');
      if (firstFixed) {
        item.finishedGoodId = firstFixed.finishedGoodId;
        item.finishedGoodName = firstFixed.finishedGoodName;
        item.quantityRequired = firstFixed.quantityRequired;
        item.unit = firstFixed.unit;
        item.availableQuantity = firstFixed.availableStock;
      } else {
        item.availableQuantity = item.maxPortions;
      }
    }

    items.sort((a, b) => a.name.localeCompare(b.name));

    const result = {
      success: true as const,
      items,
      count: items.length,
    };
    this.listMenusCache.set(shopId, { at: Date.now(), data: result });
    return result;
  }

  async createMenu(dto: CreateMenuDto, actorUserId: string) {
    const lines = normalizeLines(dto);
    if (lines.length === 0) {
      throw new BadRequestException(
        'At least one menu component line is required',
      );
    }

    const enriched: NormalizedLine[] = [];

    for (const line of lines) {
      if (
        line.component_type === 'CHOICE' ||
        line.component_type === 'MULTI_CHOICE'
      ) {
        // Inventory select: explicit option_item_ids / option_items — no FG category required
        const optionIds = Array.isArray(line.option_item_ids)
          ? line.option_item_ids.filter((id) => typeof id === 'string' && id.trim())
          : [];
        const optionItems = Array.isArray(line.option_items)
          ? line.option_items
          : [];
        const hasOptionPool = optionIds.length > 0 || optionItems.length > 0;

        if (hasOptionPool) {
          enriched.push({
            ...line,
            option_item_ids: optionIds.length
              ? optionIds
              : optionItems
                  .map((o) => {
                    if (o && typeof o === 'object') {
                      const rec = o as Record<string, unknown>;
                      const id = rec.item_id ?? rec.itemId ?? rec.finished_good_id;
                      return typeof id === 'string' ? id : '';
                    }
                    return '';
                  })
                  .filter(Boolean),
            // Keep category fields only if provided (optional grouping)
            finished_good_category_id:
              line.finished_good_category_id?.trim() || undefined,
            finished_good_category_code:
              line.finished_good_category_code?.trim() || undefined,
            finished_good_category_name:
              line.finished_good_category_name || undefined,
          });
          continue;
        }

        // Category-pool CHOICE (legacy FG category path)
        const category = await this.findCategory(
          line.finished_good_category_id ||
            line.finished_good_category_code ||
            '',
        );
        if (!category) {
          throw new BadRequestException(
            `Inventory select needs at least one stock item selected, or a valid finished-good category (component ${line.component_key})`,
          );
        }

        enriched.push({
          ...line,
          finished_good_category_id: category.id,
          finished_good_category_code: category.code,
          finished_good_category_name: category.name,
        });
      } else {
        if (line.finished_good_id) {
          await this.assertFinishedGoodSku(line.finished_good_id);
        }
        enriched.push(line);
      }
    }

    const menuCode =
      dto.menu_code?.trim() ||
      dto.name.toLowerCase().replace(/\s+/g, '-').slice(0, 40);
    const idempotencyKey = `menu-create-${menuCode}`;

    const result = (await this.idempotencyService.enforce(
      idempotencyKey,
      dto,
    )) as IdempotencyResult;

    if (result.isReplay) {
      const payload = asRecord(result.existing?.payload);
      return {
        success: true,
        menuId: asString(payload.menu_id) || undefined,
        eventId: result.existing?.id,
        message: 'Already processed (idempotent replay)',
      };
    }

    const menuId = `MENU-${menuCode}`;
    const createdAt = new Date().toISOString();
    const primaryFixed = enriched.find(
      (line) => line.component_type === 'FIXED',
    );

    const event = await this.eventStore.appendEvent({
      event_type: 'menu_created',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      item_id: primaryFixed?.finished_good_id,
      payload: {
        menu_id: menuId,
        menu_code: menuCode,
        name: dto.name,
        category: dto.category ?? null,
        selling_price: dto.selling_price,
        tax_rate: dto.tax_rate ?? 16,
        finished_good_id: primaryFixed?.finished_good_id ?? null,
        finished_good_name: primaryFixed?.finished_good_name ?? null,
        quantity_required: primaryFixed?.quantity_required ?? 1,
        unit: primaryFixed?.unit ?? 'pcs',
        lines: enriched,
        preparation_time_minutes: dto.preparation_time_minutes ?? null,
        image_url: dto.image_url || null,
        is_available: dto.is_available ?? true,
        is_visible: dto.is_visible ?? true,
        notes: dto.notes ?? null,
        status: 'active',
        shop_id: '1',
        created_at: createdAt,
        ...(dto.payload ?? {}),
      },
    });

    for (const line of enriched) {
      try {
        await this.eventStore.appendEvent({
          event_type: 'menu_item_added',
          actor_user_id: actorUserId,
          idempotency_key: `menu-item-${menuId}-${line.component_key}`,
          item_id: line.finished_good_id,
          payload: {
            menu_id: menuId,
            ...line,
          },
        });
      } catch {
        // best-effort per line
      }
    }

    this.logger.log(
      `Menu created: ${dto.name} (${enriched.length} component(s)) @ ${dto.selling_price}`,
    );

    return {
      success: true,
      menuId,
      eventId: event.id,
      message: 'Menu item created successfully',
    };
  }


  /**
   * ADMIN adjust: name, price, and full component set in one transaction event.
   * Past orders keep their line prices; recipe changes apply going forward only.
   */
  async adjustMenu(
    menuId: string,
    dto: {
      name?: string;
      menu_code?: string | null;
      selling_price?: number;
      tax_rate?: number;
      is_available?: boolean;
      is_visible?: boolean;
      category?: string | null;
      notes?: string | null;
      preparation_time_minutes?: number | null;
      image_url?: string | null;
      lines?: Array<Record<string, unknown>>;
      expected_updated_at?: string | null;
    },
    actorUserId: string,
    shopId: string = '1',
  ) {
    const listed = await this.listMenus(shopId);
    const current = listed.items.find((m) => m.menuId === menuId);
    if (!current) {
      throw new BadRequestException(`Menu item not found: ${menuId}`);
    }
    if (current.status && current.status !== 'active') {
      // still allow adjust of visible catalog rows
    }

    if (dto.expected_updated_at) {
      const expected = new Date(dto.expected_updated_at).getTime();
      const actual = current.createdAt
        ? new Date(current.createdAt).getTime()
        : 0;
      if (
        Number.isFinite(expected) &&
        Number.isFinite(actual) &&
        actual > expected + 500
      ) {
        throw new BadRequestException({
          message:
            'This menu item was changed by someone else. Reload and try again.',
          code: 'MENU_CONFLICT',
          expected: dto.expected_updated_at,
          actual: current.createdAt,
        });
      }
    }

    const name =
      dto.name !== undefined ? String(dto.name).trim() : current.name;
    if (!name) throw new BadRequestException('Name is required');

    const sellingPrice =
      dto.selling_price !== undefined
        ? Number(dto.selling_price)
        : current.sellingPrice;
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      throw new BadRequestException('selling_price must be 0 or more');
    }

    let enriched: NormalizedLine[] | null = null;
    if (dto.lines && dto.lines.length > 0) {
      const asDto = {
        name,
        selling_price: sellingPrice,
        lines: dto.lines,
      } as CreateMenuDto;
      // reuse normalize via a minimal shape
      const lines = normalizeLines({
        name,
        selling_price: sellingPrice,
        lines: dto.lines.map((l) => ({
          component_type: (l.component_type as string) || 'FIXED',
          component_key: (l.component_key as string) || undefined,
          finished_good_id: (l.finished_good_id as string) || undefined,
          finished_good_name: (l.finished_good_name as string) || undefined,
          finished_good_category_id:
            (l.finished_good_category_id as string) || undefined,
          finished_good_category_code:
            (l.finished_good_category_code as string) || undefined,
          finished_good_category_name:
            (l.finished_good_category_name as string) || undefined,
          option_item_ids: Array.isArray(l.option_item_ids)
            ? (l.option_item_ids as string[])
            : undefined,
          quantity_required: Number(l.quantity_required ?? 1),
          unit: String(l.unit ?? 'pcs'),
          min_select: l.min_select as number | undefined,
          max_select: l.max_select as number | undefined,
          allow_repeat: l.allow_repeat as boolean | undefined,
        })),
      } as CreateMenuDto);
      if (lines.length === 0) {
        throw new BadRequestException('At least one component is required');
      }
      enriched = [];
      for (const line of lines) {
        if (
          (line.component_type === 'CHOICE' ||
            line.component_type === 'MULTI_CHOICE') &&
          !(line.option_item_ids && line.option_item_ids.length) &&
          !line.finished_good_category_id
        ) {
          throw new BadRequestException(
            `CHOICE line ${line.component_key} needs inventory SKUs or a category`,
          );
        }
        if (
          (line.component_type === 'FIXED' ||
            line.component_type === 'INVENTORY') &&
          !line.finished_good_id
        ) {
          throw new BadRequestException(
            `FIXED/INVENTORY line ${line.component_key} needs an item id`,
          );
        }
        enriched.push(line);
      }
    }

    const previous = {
      name: current.name,
      selling_price: current.sellingPrice,
      lines: (current.lines ?? []).map((l) => ({
        component_key: l.componentKey,
        component_type: l.componentType,
        finished_good_id: l.finishedGoodId,
        finished_good_name: l.finishedGoodName,
        quantity_required: l.quantityRequired,
        unit: l.unit,
        option_item_ids: (l.options ?? []).map((o) => o.finishedGoodId),
      })),
    };

    const adjustedAt = new Date().toISOString();
    const primary =
      enriched?.find((l) => l.component_type === 'FIXED') ??
      enriched?.[0] ??
      null;

    await this.eventStore.appendEvent({
      event_type: 'menu_adjusted',
      actor_user_id: actorUserId,
      idempotency_key: `menu-adjust-${menuId}-${Date.now()}`,
      item_id: primary?.finished_good_id ?? current.finishedGoodId ?? menuId,
      total_cost: sellingPrice,
      payload: {
        menu_id: menuId,
        menu_code:
          dto.menu_code !== undefined && dto.menu_code !== null && String(dto.menu_code).trim()
            ? String(dto.menu_code).trim()
            : current.menuCode,
        name,
        selling_price: sellingPrice,
        tax_rate:
          dto.tax_rate !== undefined
            ? Number(dto.tax_rate)
            : current.taxRate,
        category: dto.category !== undefined ? dto.category : current.category,
        is_available:
          dto.is_available !== undefined
            ? dto.is_available
            : current.isAvailable,
        is_visible:
          dto.is_visible !== undefined ? dto.is_visible : current.isVisible,
        notes: dto.notes !== undefined ? dto.notes : null,
        preparation_time_minutes:
          dto.preparation_time_minutes !== undefined
            ? dto.preparation_time_minutes
            : null,
        image_url: dto.image_url !== undefined ? dto.image_url : null,
        lines: enriched
          ? enriched
          : previous.lines.map((l) => ({
              component_key: l.component_key,
              component_type: l.component_type,
              finished_good_id: l.finished_good_id,
              finished_good_name: l.finished_good_name,
              quantity_required: l.quantity_required,
              unit: l.unit,
              option_item_ids: l.option_item_ids,
            })),
        previous,
        adjusted_at: adjustedAt,
        shop_id: shopId,
      },
    });

    this.invalidateListMenusCache(shopId);

    // Duplicate-name warning (non-blocking metadata)
    const nameClash = listed.items.some(
      (m) =>
        m.menuId !== menuId &&
        m.isVisible !== false &&
        m.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );

    this.logger.log(
      `Menu adjusted: ${menuId} → ${name} @ ${sellingPrice} by ${actorUserId}`,
    );

    return {
      success: true,
      menuId,
      name,
      sellingPrice,
      nameClashWarning: nameClash
        ? `Another active item is already named ${name}`
        : null,
      adjustedAt,
    };
  }

  async addMenuItem(dto: MenuItemDto, actorUserId: string) {
    await this.assertFinishedGoodSku(dto.finished_good_id);

    const idempotencyKey = `menu-item-${dto.menu_id}-${dto.finished_good_id}`;

    const result = (await this.idempotencyService.enforce(
      idempotencyKey,
      dto,
    )) as IdempotencyResult;

    if (result.isReplay) {
      return {
        success: true,
        eventId: result.existing?.id,
        message: 'Already processed (idempotent replay)',
      };
    }

    const event = await this.eventStore.appendEvent({
      event_type: 'menu_item_added',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      item_id: dto.finished_good_id,
      payload: {
        menu_id: dto.menu_id,
        component_key: dto.component_key ?? `fg_${dto.finished_good_id}`,
        component_type: 'FIXED',
        finished_good_id: dto.finished_good_id,
        finished_good_name: dto.finished_good_name ?? dto.finished_good_id,
        quantity_required: dto.quantity_required,
        unit: dto.unit ?? 'pcs',
        min_select: 0,
        max_select: 1,
        allow_repeat: false,
        notes: dto.notes ?? null,
      },
    });

    return {
      success: true,
      eventId: event.id,
      message: 'Menu component added successfully',
    };
  }

  async checkMenuAvailability(menuId: string, shopId: string = '1') {
    const list = await this.listMenus(shopId);
    const item = list.items.find((entry) => entry.menuId === menuId);
    if (!item) {
      throw new NotFoundException(`Menu ${menuId} not found`);
    }

    this.menuGateway.broadcastAvailabilityUpdate(
      menuId,
      item.maxPortions,
      item.maxPortions > 0,
    );

    return {
      menuId: item.menuId,
      lines: item.lines,
      finishedGoodId: item.finishedGoodId,
      available_quantity: item.availableQuantity,
      max_portions: item.maxPortions,
      is_available: item.maxPortions > 0 && item.isAvailable,
      requires_selection: item.requiresSelection,
      unit_cost: item.unitCost,
      food_cost: item.foodCost,
      margin: item.margin,
      margin_percent: item.marginPercent,
    };
  }

  // ── helpers ────────────────────────────────────────────

  private async assertFinishedGoodSku(itemId: string): Promise<void> {
    const item = await this.prisma.item.findUnique({
      where: { item_id: itemId },
    });
    if (!item) {
      throw new BadRequestException(
        `Finished good SKU "${itemId}" was not found`,
      );
    }

    if (item.finished_good_category_id) return;

    const recipe = await this.prisma.recipe.findFirst({
      where: { item_id: itemId },
      select: { id: true },
    });
    if (recipe) return;

    if (isFinishedCategory(item.category)) return;

    throw new BadRequestException(
      `"${item.name}" (${itemId}) is not a Finished Good. Fixed FG only allows complete recipe / finished products.`,
    );
  }

  private draftFromPayload(
    row: Record<string, unknown>,
    idx: number,
  ): LineDraft {
    const type = asComponentType(row.component_type ?? row.componentType);
    const qty = asNumber(row.quantity_required ?? row.quantityRequired, 1);
    const key =
      asString(row.component_key ?? row.componentKey) ||
      asString(row.finished_good_id ?? row.finishedGoodId) ||
      `line_${idx + 1}`;

    const optionIdsRaw = row.option_item_ids ?? row.optionItemIds;
    const optionItemsRaw = row.option_items ?? row.optionItems;
    const optionItemIds: string[] = [];
    if (Array.isArray(optionIdsRaw)) {
      for (const id of optionIdsRaw) {
        const s = asString(id);
        if (s) optionItemIds.push(s);
      }
    }
    if (Array.isArray(optionItemsRaw)) {
      for (const o of optionItemsRaw) {
        const r = asRecord(o);
        const s = asString(r.item_id ?? r.itemId ?? r.finished_good_id);
        if (s && !optionItemIds.includes(s)) optionItemIds.push(s);
      }
    }

    return {
      componentKey: key,
      componentType: type,
      finishedGoodId:
        asString(row.finished_good_id ?? row.finishedGoodId) || null,
      finishedGoodName:
        asString(row.finished_good_name ?? row.finishedGoodName) || null,
      finishedGoodCategoryId:
        asString(row.finished_good_category_id ?? row.finishedGoodCategoryId) ||
        null,
      finishedGoodCategoryCode:
        asString(
          row.finished_good_category_code ?? row.finishedGoodCategoryCode,
        ) || null,
      finishedGoodCategoryName:
        asString(
          row.finished_good_category_name ?? row.finishedGoodCategoryName,
        ) || null,
      optionItemIds,
      quantityRequired: qty,
      unit: asString(row.unit, 'pcs'),
      minSelect: asNumber(
        row.min_select ?? row.minSelect,
        type === 'CHOICE' ? 1 : 0,
      ),
      maxSelect: asNumber(
        row.max_select ?? row.maxSelect,
        type === 'CHOICE' ? 1 : qty,
      ),
      allowRepeat: Boolean(
        row.allow_repeat ?? row.allowRepeat ?? type === 'MULTI_CHOICE',
      ),
    };
  }

  private async findCategory(idOrCode: string): Promise<FgCategoryRow | null> {
    if (!idOrCode) return null;

    const category = (await this.prisma.finishedGoodCategory.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
        is_active: true,
      },
    })) as FgCategoryRow | null;

    return category;
  }

  private async resolveCategoryOptions(
    draft: LineDraft,
    getStock: (id: string) => Promise<StockSnapshot>,
  ): Promise<{
    categoryId: string | null;
    categoryCode: string | null;
    categoryName: string | null;
    options: ChoiceOption[];
  }> {
    const need = Math.max(draft.quantityRequired || 1, 0.0001);

    // Inventory Select: explicit SKU list (no category required)
    if (draft.optionItemIds && draft.optionItemIds.length > 0) {
      const members = await this.prisma.item.findMany({
        where: { item_id: { in: draft.optionItemIds } },
      });
      const byId = new Map(members.map((m) => [m.item_id, m]));
      const options: ChoiceOption[] = [];
      for (const id of draft.optionItemIds) {
        const member = byId.get(id);
        const snapshot = await getStock(id);
        options.push({
          finishedGoodId: id,
          finishedGoodName: member?.name ?? id,
          unit: member?.unit ?? draft.unit ?? 'pcs',
          availableStock: snapshot.available,
          unitCost: roundMoney(snapshot.unitCost),
          maxPortions: Math.floor(snapshot.available / need),
        });
      }
      return {
        categoryId: null,
        categoryCode: null,
        categoryName: 'Inventory select',
        options,
      };
    }

    const category = await this.findCategory(
      draft.finishedGoodCategoryId || draft.finishedGoodCategoryCode || '',
    );

    if (!category) {
      return {
        categoryId: draft.finishedGoodCategoryId,
        categoryCode: draft.finishedGoodCategoryCode,
        categoryName: draft.finishedGoodCategoryName,
        options: [],
      };
    }

    const members = await this.prisma.item.findMany({
      where: { finished_good_category_id: category.id },
      orderBy: { name: 'asc' },
    });

    const options: ChoiceOption[] = [];

    for (const member of members) {
      const snapshot = await getStock(member.item_id);
      options.push({
        finishedGoodId: member.item_id,
        finishedGoodName: member.name,
        unit: member.unit,
        availableStock: snapshot.available,
        unitCost: roundMoney(snapshot.unitCost),
        maxPortions: Math.floor(snapshot.available / need),
      });
    }

    return {
      categoryId: category.id,
      categoryCode: category.code,
      categoryName: category.name,
      options,
    };
  }


  // ── Menu Category (grouping of sellable Menu Items) ─────────

  async listMenuCategories(shopId: string = '1') {
    const events = await this.prisma.event.findMany({
      where: {
        event_type: {
          in: ['menu_category_created', 'menu_category_updated'],
        },
      },
      orderBy: { created_at: 'asc' },
      take: 2000,
    });

    const byId = new Map<
      string,
      {
        categoryId: string;
        name: string;
        menuItemIds: string[];
        shopId: string;
        updatedAt: string;
      }
    >();

    for (const e of events) {
      const payload = asRecord(e.payload);
      const eventShop = asString(
        payload.shop_id ?? payload.shopId ?? e.shop_id,
        '1',
      );
      if (eventShop !== shopId) continue;
      const categoryId = asString(
        payload.category_id ?? payload.categoryId ?? e.item_id,
      );
      if (!categoryId) continue;
      const menuItemIds = Array.isArray(payload.menu_item_ids)
        ? (payload.menu_item_ids as unknown[]).map((x) => String(x))
        : Array.isArray(payload.menuItemIds)
          ? (payload.menuItemIds as unknown[]).map((x) => String(x))
          : [];
      byId.set(categoryId, {
        categoryId,
        name: asString(payload.name, categoryId),
        menuItemIds,
        shopId: eventShop,
        updatedAt: e.created_at.toISOString(),
      });
    }

    const items = Array.from(byId.values());
    return { success: true, items, count: items.length };
  }

  async createMenuCategory(
    dto: {
      category_id?: string;
      name: string;
      menu_item_ids?: string[];
      shop_id?: string;
      notes?: string;
    },
    actorUserId: string,
  ) {
    const shopId = asString(dto.shop_id, '1');
    const categoryId =
      (dto.category_id && dto.category_id.trim()) ||
      `MCAT-${Date.now().toString(36)}`;
    const idempotencyKey = `menu-category-${shopId}-${categoryId}`;

    const event = await this.eventStore.appendEvent({
      event_type: 'menu_category_created',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      item_id: categoryId,
      payload: {
        category_id: categoryId,
        name: dto.name,
        menu_item_ids: dto.menu_item_ids ?? [],
        shop_id: shopId,
        notes: dto.notes ?? null,
      },
    });

    return {
      success: true,
      categoryId,
      eventId: event.id,
      name: dto.name,
      menuItemIds: dto.menu_item_ids ?? [],
    };
  }

  // ── Combo (pick N from Menu Category Y) ─────────────────────

  async listCombos(shopId: string = '1') {
    const events = await this.prisma.event.findMany({
      where: {
        event_type: { in: ['combo_created', 'combo_updated'] },
      },
      orderBy: { created_at: 'asc' },
      take: 2000,
    });

    const byId = new Map<
      string,
      {
        comboId: string;
        name: string;
        sellingPrice: number;
        selectionGroups: Array<{
          menuCategoryId: string;
          menuCategoryName?: string;
          quantity: number;
        }>;
        shopId: string;
        updatedAt: string;
      }
    >();

    for (const e of events) {
      const payload = asRecord(e.payload);
      const eventShop = asString(
        payload.shop_id ?? payload.shopId ?? e.shop_id,
        '1',
      );
      if (eventShop !== shopId) continue;
      const comboId = asString(payload.combo_id ?? payload.comboId);
      if (!comboId) continue;
      const groupsRaw = Array.isArray(payload.selection_groups)
        ? payload.selection_groups
        : Array.isArray(payload.selectionGroups)
          ? payload.selectionGroups
          : [];
      const selectionGroups = (groupsRaw as Record<string, unknown>[]).map(
        (g, idx) => ({
          groupIndex: asNumber(g.group_index ?? g.groupIndex, idx),
          menuCategoryId: asString(
            g.menu_category_id ?? g.menuCategoryId,
          ),
          menuCategoryName: asString(
            g.menu_category_name ?? g.menuCategoryName,
          ),
          quantity: Math.max(1, asNumber(g.quantity, 1)),
        }),
      );
      byId.set(comboId, {
        comboId,
        name: asString(payload.name, comboId),
        sellingPrice: asNumber(
          payload.selling_price ?? payload.sellingPrice,
          0,
        ),
        selectionGroups,
        shopId: eventShop,
        updatedAt: e.created_at.toISOString(),
      });
    }

    const items = Array.from(byId.values());
    return { success: true, items, count: items.length };
  }

  async createCombo(
    dto: {
      combo_id?: string;
      name: string;
      selling_price: number;
      selection_groups: Array<{
        menu_category_id: string;
        menu_category_name?: string;
        quantity: number;
      }>;
      shop_id?: string;
      notes?: string;
    },
    actorUserId: string,
  ) {
    const shopId = asString(dto.shop_id, '1');
    const comboId =
      (dto.combo_id && dto.combo_id.trim()) ||
      `COMBO-${Date.now().toString(36)}`;
    const idempotencyKey = `combo-${shopId}-${comboId}`;

    const selection_groups = (dto.selection_groups ?? []).map((g, idx) => ({
      group_index: idx,
      menu_category_id: g.menu_category_id,
      menu_category_name: g.menu_category_name,
      quantity: Math.max(1, Number(g.quantity ?? 1)),
    }));

    const event = await this.eventStore.appendEvent({
      event_type: 'combo_created',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      item_id: comboId,
      total_cost: dto.selling_price,
      payload: {
        combo_id: comboId,
        name: dto.name,
        selling_price: dto.selling_price,
        selection_groups,
        shop_id: shopId,
        notes: dto.notes ?? null,
      },
    });

    return {
      success: true,
      comboId,
      eventId: event.id,
      name: dto.name,
      sellingPrice: dto.selling_price,
      selectionGroups: selection_groups,
    };
  }


  private async stockSnapshot(
    shopId: string,
    itemId: string,
  ): Promise<StockSnapshot> {
    const row = await this.prisma.inventoryProjection.findUnique({
      where: {
        shop_id_item_id: { shop_id: shopId, item_id: itemId },
      },
    });

    const available = Number(row?.available_stock ?? 0);
    const totalValue = Number(row?.total_value ?? 0);
    // Prefer live WAC (avg_unit_cost); fall back to value/qty
    let unitCost = Number(row?.avg_unit_cost ?? 0);
    if (!(unitCost > 0) && available > 0 && totalValue > 0) {
      unitCost = totalValue / available;
    }

    return { available, unitCost: Number.isFinite(unitCost) ? unitCost : 0 };
  }
}
