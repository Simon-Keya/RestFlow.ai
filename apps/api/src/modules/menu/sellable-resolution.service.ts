import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MenuService } from './menu.service';
import { UnitConversionService } from '../../common/units/unit-conversion.service';

export type ProductionType = 'recipe' | 'stocked';

export interface StockDeductionLine {
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
}

export interface ResolvedMenuItem {
  menuItemId: string;
  name: string;
  productionType: ProductionType;
  quantity: number;
  deductions: StockDeductionLine[];
  /** Present when resolved as part of a combo group */
  group_index?: number;
  group_name?: string;
}

export interface ComboSelectionInput {
  group_index: number;
  menu_item_ids: string[];
}

export interface ResolvedSaleLine {
  lineType: 'menu_item' | 'combo';
  revenue: number;
  label: string;
  menuItems: ResolvedMenuItem[];
  stockDeductions: StockDeductionLine[];
  metadata: Record<string, unknown>;
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

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function aggregateDeductions(rows: StockDeductionLine[]): StockDeductionLine[] {
  const map = new Map<string, StockDeductionLine>();
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

/**
 * Single authority for resolving sellable lines → stock impact.
 * Used by POS sale, availability, and combo preview/trace.
 */
@Injectable()
export class SellableResolutionService {
  private readonly logger = new Logger(SellableResolutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly menuService: MenuService,
    private readonly units: UnitConversionService,
  ) {}

  async resolveMenuItemLine(
    shopId: string,
    menuItemId: string,
    quantity: number,
    revenueOverride?: number,
  ): Promise<ResolvedSaleLine> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    const resolved = await this.resolveOneMenuItem(
      shopId,
      menuItemId,
      quantity,
    );
    const revenue =
      revenueOverride !== undefined && revenueOverride > 0
        ? revenueOverride
        : resolved.unitPrice * quantity;

    return {
      lineType: 'menu_item',
      revenue,
      label: resolved.name,
      menuItems: [resolved],
      stockDeductions: aggregateDeductions(resolved.deductions),
      metadata: {
        menu_item_id: menuItemId,
        production_type: resolved.productionType,
      },
    };
  }

  async resolveComboLine(
    shopId: string,
    comboId: string,
    quantity: number,
    selections: ComboSelectionInput[],
  ): Promise<ResolvedSaleLine> {
    if (quantity <= 0) {
      throw new BadRequestException('Combo quantity must be positive');
    }

    const combo = await this.getCombo(shopId, comboId);
    if (!combo) {
      throw new NotFoundException(`Combo not found: ${comboId}`);
    }

    const groups = combo.selectionGroups;
    if (!groups.length) {
      throw new BadRequestException(`Combo ${comboId} has no selection groups`);
    }

    /**
     * Two valid payload shapes for menu_item_ids per group:
     * A) length === group.quantity  → classic “same picks for every combo unit”
     *    each id resolved at ×comboQty
     * B) length === group.quantity × comboQty → multi-qty free split
     *    each id resolved at ×1
     */
    const comboQty = quantity;
    const menuItems: ResolvedMenuItem[] = [];
    const allDeductions: StockDeductionLine[] = [];

    for (const group of groups) {
      const submitted = selections.find(
        (s) => s.group_index === group.groupIndex,
      );
      if (!submitted) {
        throw new BadRequestException(
          `Missing selections for group ${group.groupIndex} (${group.menuCategoryName})`,
        );
      }
      const ids = (submitted.menu_item_ids ?? [])
        .map((id) => String(id).trim())
        .filter(Boolean);

      const perCombo = Math.max(0, Number(group.quantity) || 0);
      const expectedClassic = perCombo;
      const expectedExpanded = perCombo * comboQty;

      let mode: 'classic' | 'expanded';
      if (ids.length === expectedClassic) {
        mode = 'classic';
      } else if (ids.length === expectedExpanded) {
        mode = 'expanded';
      } else {
        throw new BadRequestException(
          `Group ${group.groupIndex} (${group.menuCategoryName}): need ${expectedClassic} item(s) (or ${expectedExpanded} for qty ${comboQty}), got ${ids.length}`,
        );
      }

      const category = await this.getCategory(shopId, group.menuCategoryId);
      if (!category) {
        throw new BadRequestException(
          `Menu category not found: ${group.menuCategoryId}`,
        );
      }
      const allowed = new Set(category.menuItemIds);
      for (const mid of ids) {
        if (!allowed.has(mid)) {
          throw new BadRequestException(
            `Menu item ${mid} is not in category ${category.name}`,
          );
        }
      }

      const unitQty = mode === 'classic' ? comboQty : 1;
      for (const mid of ids) {
        const one = await this.resolveOneMenuItem(shopId, mid, unitQty);
        menuItems.push({
          ...one,
          group_index: group.groupIndex,
          group_name: group.menuCategoryName || group.menuCategoryId,
        });
        allDeductions.push(...one.deductions);
      }
    }

    const revenue = combo.sellingPrice * quantity;
    const stockDeductions = aggregateDeductions(allDeductions);

    if (menuItems.length > 0 && stockDeductions.length === 0) {
      throw new BadRequestException(
        `Combo ${combo.name}: selections resolved to menu items but produced zero stock deductions. ` +
          `Check each selected menu item has Fixed FG / recipe / stocked SKU configured.`,
      );
    }

    return {
      lineType: 'combo',
      revenue,
      label: combo.name,
      menuItems,
      stockDeductions,
      metadata: {
        combo_id: comboId,
        combo_name: combo.name,
        selections,
        combo_quantity: quantity,
      },
    };
  }

  /**
   * Preview only — same resolution as sale, no mutations.
   */
  async previewCombo(
    shopId: string,
    comboId: string,
    quantity: number,
    selections: ComboSelectionInput[],
  ): Promise<ResolvedSaleLine> {
    return this.resolveComboLine(shopId, comboId, quantity, selections);
  }

  // ── internal ─────────────────────────────────────────────

  private async resolveOneMenuItem(
    shopId: string,
    menuItemId: string,
    quantity: number,
  ): Promise<ResolvedMenuItem & { unitPrice: number }> {
    // Prefer stable CatalogMenuItem read model
    const catalog = await this.prisma.catalogMenuItem.findUnique({
      where: {
        shop_id_menu_item_id: { shop_id: shopId, menu_item_id: menuItemId },
      },
    });
    if (catalog && catalog.active) {
      if (catalog.production_type === 'recipe' && catalog.recipe_id) {
        const deductions = await this.expandRecipe(
          shopId,
          catalog.recipe_id,
          quantity,
        );
        if (deductions.length > 0) {
          return {
            menuItemId: catalog.menu_item_id,
            name: catalog.name,
            productionType: 'recipe',
            quantity,
            deductions,
            unitPrice: Number(catalog.selling_price),
          };
        }
        // recipe missing ingredients — fall through to event menu / FG
      }
      if (catalog.production_type === 'stocked' && catalog.stock_item_id) {
        const stock = await this.directStockDeduction(
          shopId,
          catalog.stock_item_id,
          quantity,
        );
        return {
          menuItemId: catalog.menu_item_id,
          name: catalog.name,
          productionType: 'stocked',
          quantity,
          deductions: [stock],
          unitPrice: Number(catalog.selling_price),
        };
      }
    }

    // Prefer event-folded menu list
    const { items: menus } = await this.menuService.listMenus(shopId);
    const menu = menus.find(
      (m) =>
        m.menuId === menuItemId ||
        m.menuCode === menuItemId ||
        m.menuId === `MENU-${menuItemId}`,
    );

    if (menu) {
      const deductions = await this.deductionsFromMenuRecord(
        shopId,
        menu,
        quantity,
      );
      return {
        menuItemId: menu.menuId,
        name: menu.name,
        productionType: deductions.productionType,
        quantity,
        deductions: deductions.lines,
        unitPrice: Number(menu.sellingPrice ?? 0),
      };
    }

    // Fallback: treat id as recipe or inventory SKU
    const recipeDed = await this.expandRecipe(shopId, menuItemId, quantity);
    if (recipeDed.length > 0) {
      return {
        menuItemId,
        name: menuItemId,
        productionType: 'recipe',
        quantity,
        deductions: recipeDed,
        unitPrice: 0,
      };
    }

    const stock = await this.directStockDeduction(shopId, menuItemId, quantity);
    return {
      menuItemId,
      name: stock.item_name,
      productionType: 'stocked',
      quantity,
      deductions: [stock],
      unitPrice: 0,
    };
  }

  private async deductionsFromMenuRecord(
    shopId: string,
    menu: {
      menuId: string;
      name: string;
      finishedGoodId?: string | null;
      lines?: Array<{
        componentType?: string;
        finishedGoodId?: string | null;
        quantityRequired?: number;
        unit?: string;
      }>;
    },
    quantity: number,
  ): Promise<{ productionType: ProductionType; lines: StockDeductionLine[] }> {
    const lines: StockDeductionLine[] = [];

    // FIXED finished-good lines → try recipe on FG id, else stock
    const fixedIds: Array<{ id: string; qty: number; unit: string }> = [];
    if (menu.finishedGoodId) {
      fixedIds.push({ id: menu.finishedGoodId, qty: quantity, unit: 'pcs' });
    }
    if (Array.isArray(menu.lines)) {
      for (const line of menu.lines) {
        const type = String(line.componentType ?? 'FIXED').toUpperCase();
        if (type === 'FIXED' && line.finishedGoodId) {
          fixedIds.push({
            id: line.finishedGoodId,
            qty: quantity * Number(line.quantityRequired ?? 1),
            unit: line.unit || 'pcs',
          });
        }
      }
    }

    if (fixedIds.length === 0) {
      // Treat menu itself as recipe key
      const recipeLines = await this.expandRecipe(shopId, menu.menuId, quantity);
      if (recipeLines.length) {
        return { productionType: 'recipe', lines: recipeLines };
      }
      return {
        productionType: 'stocked',
        lines: [
          await this.directStockDeduction(shopId, menu.menuId, quantity),
        ],
      };
    }

    let anyRecipe = false;
    for (const f of fixedIds) {
      const recipeLines = await this.expandRecipe(shopId, f.id, f.qty);
      if (recipeLines.length) {
        anyRecipe = true;
        lines.push(...recipeLines);
      } else {
        lines.push(await this.directStockDeduction(shopId, f.id, f.qty));
      }
    }
    return {
      productionType: anyRecipe ? 'recipe' : 'stocked',
      lines: aggregateDeductions(lines),
    };
  }

  private async expandRecipe(
    shopId: string,
    recipeOrItemId: string,
    portions: number,
  ): Promise<StockDeductionLine[]> {
    const recipe = await this.prisma.recipe.findFirst({
      where: {
        OR: [
          { id: recipeOrItemId },
          { item_id: recipeOrItemId },
          { recipe_code: recipeOrItemId },
          { item_name: recipeOrItemId },
        ],
      },
      include: { ingredients: true },
    });
    if (!recipe?.ingredients?.length) return [];

    const yieldQty = Math.max(
      Number(recipe.yield_quantity ?? recipe.standard_yield ?? 1),
      0.0001,
    );
    const scale = portions / yieldQty;

    const rawIds = [
      ...new Set(
        recipe.ingredients
          .map((ing) => asString(ing.raw_item_id))
          .filter(Boolean),
      ),
    ];

    const [itemRows, invRows] = await Promise.all([
      this.prisma.item.findMany({
        where: {
          OR: [{ item_id: { in: rawIds } }, { id: { in: rawIds } }],
        },
      }),
      this.prisma.inventoryProjection.findMany({
        where: { shop_id: shopId, item_id: { in: rawIds } },
        select: {
          item_id: true,
          available_stock: true,
          total_value: true,
        },
      }),
    ]);

    const itemBySku = new Map<string, (typeof itemRows)[0]>();
    for (const row of itemRows) {
      itemBySku.set(row.item_id, row);
      itemBySku.set(row.id, row);
    }
    const costBySku = new Map<string, number>();
    for (const inv of invRows) {
      const stock = Number(inv.available_stock ?? 0);
      const value = Number(inv.total_value ?? 0);
      costBySku.set(
        inv.item_id,
        stock > 0 && value > 0 ? value / stock : 0,
      );
    }

    const lines: StockDeductionLine[] = [];
    for (const ing of recipe.ingredients) {
      const itemId = asString(ing.raw_item_id);
      if (!itemId) continue;
      const recipeQty = Number(ing.quantity_per_unit ?? 0) * scale;
      if (recipeQty <= 0) continue;

      const recipeUnit = asString(ing.unit, 'pcs');
      const item = itemBySku.get(itemId);
      const storageUnit = asString(item?.unit, recipeUnit);

      const deductQty = this.units.convertOrThrow(
        recipeQty,
        recipeUnit,
        storageUnit,
      );
      if (deductQty <= 0) continue;

      lines.push({
        item_id: itemId,
        item_name: asString(ing.raw_item_name, item?.name ?? itemId),
        quantity: deductQty,
        unit: storageUnit,
        unit_cost: costBySku.get(itemId) ?? 0,
      });
    }
    return lines;
  }

  private async directStockDeduction(
    shopId: string,
    itemId: string,
    quantity: number,
  ): Promise<StockDeductionLine> {
    const unitCost = await this.unitCost(shopId, itemId);
    return {
      item_id: itemId,
      item_name: itemId,
      quantity,
      unit: 'pcs',
      unit_cost: unitCost,
    };
  }

  /**
   * Unit cost for menu COG / deductions (Michael + original COG):
   * on-hand WAC → latest production unit cost → recipe cost/yield estimate → 0
   */
  private async unitCost(shopId: string, itemId: string): Promise<number> {
    const row = await this.prisma.inventoryProjection.findUnique({
      where: { shop_id_item_id: { shop_id: shopId, item_id: itemId } },
    });
    const available = Number(row?.available_stock ?? 0);
    const totalValue = Number(row?.total_value ?? 0);
    const avg = Number((row as { avg_unit_cost?: unknown })?.avg_unit_cost ?? 0);
    if (avg > 0 && available > 0) return avg;
    if (available > 0 && totalValue > 0) return totalValue / available;

    const prod = await this.prisma.event.findFirst({
      where: {
        shop_id: shopId,
        item_id: itemId,
        event_type: 'production_finished',
      },
      orderBy: { created_at: 'desc' },
      select: { unit_cost: true, payload: true },
    });
    if (prod) {
      const uc = Number(prod.unit_cost ?? 0);
      if (uc > 0) return uc;
      const p = (prod.payload ?? {}) as Record<string, unknown>;
      for (const k of ['unit_cost', 'unitCost', 'finishedUnitCost']) {
        const n = Number(p[k]);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }

    // Recipe cost per yield (before any production lot exists)
    const recipes = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: { in: ['recipe_created', 'recipe_updated'] },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
      select: { payload: true },
    });
    for (const e of recipes) {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const primary = String(p.item_id ?? p.itemId ?? p.sku ?? '').toUpperCase();
      const outputs = Array.isArray(p.outputs) ? p.outputs : [];
      const match =
        primary === itemId.toUpperCase() ||
        outputs.some((o) => {
          if (!o || typeof o !== 'object') return false;
          const r = o as Record<string, unknown>;
          return (
            String(r.item_id ?? r.itemId ?? r.sku ?? '').toUpperCase() ===
            itemId.toUpperCase()
          );
        });
      if (!match) continue;
      for (const k of [
        'cost_per_yield',
        'costPerYield',
        'std_unit_cost',
        'unit_cost',
        'unitCost',
      ]) {
        const n = Number(p[k]);
        if (Number.isFinite(n) && n > 0) return n;
      }
      const batch = Number(p.batch_cost ?? p.batchCost ?? 0);
      const y = Number(p.standard_yield ?? p.standardYield ?? p.yield_qty ?? 0);
      if (batch > 0 && y > 0) return batch / y;
    }
    return 0;
  }

  private async getCombo(shopId: string, comboId: string) {
    const { items } = await this.menuService.listCombos(shopId);
    const list = (items ?? []) as unknown as Array<{
      comboId: string;
      name: string;
      sellingPrice: number;
      selectionGroups: Array<{
        groupIndex?: number;
        menuCategoryId: string;
        menuCategoryName?: string;
        quantity: number;
      }>;
    }>;
    // listCombos may return different shape — normalize via service events
    const found = list.find(
      (c) => c.comboId === comboId || String((c as { id?: string }).id) === comboId,
    );
    if (found) {
      return {
        ...found,
        selectionGroups: (found.selectionGroups ?? []).map((g, idx) => ({
          groupIndex: Number(
            (g as { groupIndex?: number }).groupIndex ?? idx,
          ),
          menuCategoryId: g.menuCategoryId,
          menuCategoryName: g.menuCategoryName || 'Category',
          quantity: Math.max(1, Number(g.quantity ?? 1)),
        })),
      };
    }

    // Re-fold from events if shape differs
    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: { in: ['combo_created', 'combo_updated'] },
      },
      orderBy: { created_at: 'asc' },
      take: 2000,
    });
    let match: {
      comboId: string;
      name: string;
      sellingPrice: number;
      selectionGroups: Array<{
        groupIndex: number;
        menuCategoryId: string;
        menuCategoryName: string;
        quantity: number;
      }>;
    } | null = null;

    for (const e of events) {
      const p = asRecord(e.payload);
      const id = asString(p.combo_id ?? p.comboId ?? e.item_id);
      if (id !== comboId) continue;
      const groupsRaw = Array.isArray(p.selection_groups)
        ? p.selection_groups
        : Array.isArray(p.selectionGroups)
          ? p.selectionGroups
          : [];
      const selectionGroups = groupsRaw.map((g, idx) => {
        const gr = asRecord(g);
        return {
          groupIndex: Number(gr.group_index ?? gr.groupIndex ?? idx),
          menuCategoryId: asString(
            gr.menu_category_id ?? gr.menuCategoryId,
          ),
          menuCategoryName: asString(
            gr.menu_category_name ?? gr.menuCategoryName,
            'Category',
          ),
          quantity: Math.max(1, Number(gr.quantity ?? 1)),
        };
      });
      match = {
        comboId: id,
        name: asString(p.name, id),
        sellingPrice: asNumber(p.selling_price ?? p.sellingPrice),
        selectionGroups,
      };
    }
    return match;
  }

  private async getCategory(shopId: string, categoryId: string) {
    const { items } = await this.menuService.listMenuCategories(shopId);
    const list = (items ?? []) as Array<{
      categoryId: string;
      name: string;
      menuItemIds: string[];
    }>;
    const found = list.find((c) => c.categoryId === categoryId);
    if (found) return found;

    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: { in: ['menu_category_created', 'menu_category_updated'] },
      },
      orderBy: { created_at: 'asc' },
      take: 2000,
    });
    let match: {
      categoryId: string;
      name: string;
      menuItemIds: string[];
    } | null = null;
    for (const e of events) {
      const p = asRecord(e.payload);
      const id = asString(p.category_id ?? p.categoryId ?? e.item_id);
      if (id !== categoryId) continue;
      const menuItemIds = Array.isArray(p.menu_item_ids)
        ? (p.menu_item_ids as unknown[]).map(String)
        : Array.isArray(p.menuItemIds)
          ? (p.menuItemIds as unknown[]).map(String)
          : [];
      match = {
        categoryId: id,
        name: asString(p.name, id),
        menuItemIds,
      };
    }
    return match;
  }
}
