import { toMoneyNumber } from '../../common/utils/money.util';
// apps/api/src/modules/recipe/recipe.service.ts
import {
  ConflictException,
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventStoreService } from '../../core/event-store.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { portionsFromStock } from '../../common/utils/units.utils';
import { normalizeSku } from '../../common/utils/sku.util';
import type {
  CreateRecipeDto,
  CreateRecipeIngredientDto,
} from './dto/create-recipe.dto';
import type { RecipeIngredientDto } from './dto/recipe-ingredient.dto';
import type { RecipeOutputDto } from './dto/recipe-output.dto';
import type { UpdateRecipeDto } from './dto/update-recipe.dto';

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

const recipeInclude = {
  ingredients: true,
  outputs: true,
} as const;

const FINISHED_CATEGORY = 'Finished Goods';
const RAW_CATEGORY = 'General';
const FINISHED_CATEGORY_RE = /finished|production|fg\b/i;

export interface IngredientAvailability {
  rawItemId: string;
  rawItemName: string;
  needPerPortion: number;
  unit: string;
  availableStock: number;
  stockUnit: string;
  maxPortions: number;
}

export interface RecipeAvailability {
  recipeId: string;
  shopId: string;
  maxPortionsFromStock: number;
  isAvailable: boolean;
  limitingItemId: string | null;
  limitingItemName: string | null;
  ingredients: IngredientAvailability[];
}

type RecipeListItem = Record<string, unknown>;

type StockSnap = { available: number; unit: string; unitCost: number };

@Injectable()
export class RecipeService {
  private readonly logger = new Logger(RecipeService.name);

  constructor(
    private readonly eventStore: EventStoreService,
    private readonly prisma: PrismaService,
  ) {}

  async listRecipes(shopId: string = '1', category?: string) {
    const categoryFilter = category?.trim();

    const where: Prisma.RecipeWhereInput = categoryFilter
      ? ({
          category: {
            equals: categoryFilter,
            mode: 'insensitive',
          },
        } as Prisma.RecipeWhereInput)
      : {};

    const dbRecipes = await this.prisma.recipe.findMany({
      where,
      include: recipeInclude,
      orderBy: { updated_at: 'desc' },
      take: 100,
    });

    if (dbRecipes.length === 0) {
      return { success: true, items: [], total: 0 };
    }

    const allRawIds = new Set<string>();
    for (const r of dbRecipes) {
      for (const ing of r.ingredients ?? []) {
        if (ing.raw_item_id) {
          allRawIds.add(normalizeSku(ing.raw_item_id) || ing.raw_item_id);
        }
      }
    }

    const stockById = await this.loadStockMap(shopId, [...allRawIds]);

    const items: RecipeListItem[] = dbRecipes.map((r) => {
      const base = this.mapDbRecipe(
        {
          ...r,
          ingredients: (r.ingredients || []).map((ing) => ({
            raw_item_id: ing.raw_item_id,
            raw_item_name: ing.raw_item_name,
            quantity_per_unit: ing.quantity_per_unit,
            unit: ing.unit,
            unit_cost: toMoneyNumber(ing.unit_cost),
          })),
        },
        shopId,
      );
      const costing = this.enrichRecipeCosting(
        base as Record<string, unknown>,
        stockById,
      );
      const availability = this.computeMaxPortionsFromStock(
        costing.ingredients as Array<Record<string, unknown>>,
        asNumber(costing.standardYield ?? costing.standard_yield, 1),
        stockById,
      );
      return {
        ...costing,
        maxPortionsFromStock: availability.maxPortionsFromStock,
        max_portions: availability.maxPortionsFromStock,
        isAvailable: availability.isAvailable,
        is_available: availability.isAvailable,
        limitingItemId: availability.limitingItemId,
        limitingItemName: availability.limitingItemName,
      };
    });

    return { success: true, items, total: items.length };
  }

  /**
   * Distinct free-text categories for UI suggestions (manager can still type new ones).
   */
  async listCategories(): Promise<{ success: boolean; items: string[] }> {
    const rows = await this.prisma.recipe.findMany({
      where: {
        category: { not: null },
      },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
      take: 100,
    });

    const items = rows.map((r) => (r.category ?? '').trim()).filter(Boolean);

    return { success: true, items };
  }

  async getRecipeById(recipeId: string, shopId: string = '1') {
    const db = await this.prisma.recipe.findFirst({
      where: {
        OR: [{ id: recipeId }, { recipe_code: recipeId }],
      },
      include: recipeInclude,
    });

    if (!db) {
      throw new NotFoundException(`Recipe ${recipeId} not found`);
    }

    const base = this.mapDbRecipe(
      {
        ...db,
        ingredients: (db.ingredients || []).map((ing) => ({
          raw_item_id: ing.raw_item_id,
          raw_item_name: ing.raw_item_name,
          quantity_per_unit: ing.quantity_per_unit,
          unit: ing.unit,
          unit_cost: toMoneyNumber(ing.unit_cost),
        })),
      },
      shopId,
    );
    const ingredients = base.ingredients as Array<Record<string, unknown>>;
    const rawIds = ingredients
      .map(
        (ing) =>
          normalizeSku(ing.rawItemId ?? ing.raw_item_id) ||
          asString(ing.rawItemId ?? ing.raw_item_id),
      )
      .filter(Boolean);

    const stockById = await this.loadStockMap(shopId, rawIds);
    const costing = this.enrichRecipeCosting(
      base as Record<string, unknown>,
      stockById,
    );
    const availability = this.computeMaxPortionsFromStock(
      costing.ingredients as Array<Record<string, unknown>>,
      asNumber(costing.standardYield ?? base.standardYield, 1),
      stockById,
    );

    return {
      ...costing,
      maxPortionsFromStock: availability.maxPortionsFromStock,
      max_portions: availability.maxPortionsFromStock,
      isAvailable: availability.isAvailable,
      is_available: availability.isAvailable,
      limitingItemId: availability.limitingItemId,
      limitingItemName: availability.limitingItemName,
      availabilityIngredients: availability.ingredients,
    };
  }

  async getRecipeByItemId(itemId: string, shopId: string = '1') {
    const normalizedId = normalizeSku(itemId) || itemId;
    const db = await this.prisma.recipe.findFirst({
      where: { item_id: normalizedId },
      select: { id: true },
    });

    if (!db) {
      throw new NotFoundException(`No recipe found for item: ${itemId}`);
    }

    return this.getRecipeById(db.id, shopId);
  }

  async getAvailability(
    recipeId: string,
    shopId: string = '1',
  ): Promise<RecipeAvailability> {
    const recipe = await this.getRecipeById(recipeId, shopId);
    const limitingItemId =
      typeof recipe.limitingItemId === 'string' ? recipe.limitingItemId : null;
    const limitingItemName =
      typeof recipe.limitingItemName === 'string'
        ? recipe.limitingItemName
        : null;
    const availabilityIngredients = Array.isArray(
      recipe.availabilityIngredients,
    )
      ? recipe.availabilityIngredients
      : [];

    const recipeRec = recipe as Record<string, unknown>;
    return {
      recipeId: asString(recipeRec.recipeId ?? recipeRec.recipe_id ?? recipeId),
      shopId,
      maxPortionsFromStock: asNumber(recipe.maxPortionsFromStock, 0),
      isAvailable: Boolean(recipe.isAvailable),
      limitingItemId,
      limitingItemName,
      ingredients: availabilityIngredients,
    };
  }

  private async loadStockMap(
    shopId: string,
    itemIds: string[],
  ): Promise<Map<string, StockSnap>> {
    const map = new Map<string, StockSnap>();
    const unique = [
      ...new Set(itemIds.map((id) => normalizeSku(id) || id).filter(Boolean)),
    ];
    if (unique.length === 0) return map;

    const rows = await this.prisma.inventoryProjection.findMany({
      where: {
        shop_id: shopId,
        item_id: { in: unique },
      },
      select: {
        item_id: true,
        available_stock: true,
        avg_unit_cost: true,
        total_value: true,
        item: { select: { unit: true } },
      },
    });

    for (const r of rows) {
      const qty = Number(r.available_stock ?? 0);
      let unitCost = Number(r.avg_unit_cost ?? 0);
      if (!(unitCost > 0) && qty > 0) {
        const tv = Number(r.total_value ?? 0);
        if (tv > 0) unitCost = tv / qty;
      }
      map.set(r.item_id, {
        available: qty,
        unit: r.item?.unit ?? 'pcs',
        unitCost: Number.isFinite(unitCost) && unitCost > 0 ? unitCost : 0,
      });
    }

    return map;
  }

  private computeMaxPortionsFromStock(
    ingredients: Array<Record<string, unknown>>,
    standardYield: number,
    stockById: Map<string, StockSnap>,
  ): {
    maxPortionsFromStock: number;
    isAvailable: boolean;
    limitingItemId: string | null;
    limitingItemName: string | null;
    ingredients: IngredientAvailability[];
  } {
    const yieldSafe = Math.max(standardYield > 0 ? standardYield : 1, 0.0001);

    if (!ingredients.length) {
      return {
        maxPortionsFromStock: 0,
        isAvailable: false,
        limitingItemId: null,
        limitingItemName: null,
        ingredients: [],
      };
    }

    let maxPortions = Number.POSITIVE_INFINITY;
    let limitingItemId: string | null = null;
    let limitingItemName: string | null = null;
    const detail: IngredientAvailability[] = [];

    for (const ing of ingredients) {
      const rawItemId =
        normalizeSku(ing.rawItemId ?? ing.raw_item_id) ||
        asString(ing.rawItemId ?? ing.raw_item_id);
      if (!rawItemId) continue;

      const perBatch = asNumber(
        ing.quantityPerUnit ?? ing.quantity_per_unit,
        0,
      );
      if (perBatch <= 0) continue;

      const needPerPortion = perBatch / yieldSafe;
      const needUnit = asString(ing.unit, 'pcs');
      const name = asString(
        ing.rawItemName ?? ing.raw_item_name ?? ing.name,
        rawItemId,
      );

      const stock = stockById.get(rawItemId) ?? {
        available: 0,
        unit: needUnit,
        unitCost: 0,
      };

      const portions = portionsFromStock(
        stock.available,
        stock.unit,
        needPerPortion,
        needUnit,
      );

      detail.push({
        rawItemId,
        rawItemName: name,
        needPerPortion,
        unit: needUnit,
        availableStock: stock.available,
        stockUnit: stock.unit,
        maxPortions: Number.isFinite(portions) ? portions : 0,
      });

      if (portions < maxPortions) {
        maxPortions = portions;
        limitingItemId = rawItemId;
        limitingItemName = name;
      }
    }

    if (!Number.isFinite(maxPortions) || maxPortions < 0) {
      maxPortions = 0;
    }

    maxPortions = Math.floor(maxPortions);

    return {
      maxPortionsFromStock: maxPortions,
      isAvailable: maxPortions > 0,
      limitingItemId,
      limitingItemName,
      ingredients: detail,
    };
  }

  async createRecipe(dto: CreateRecipeDto, actorUserId: string) {
    const finishedSku = normalizeSku(dto.item_id);
    if (!finishedSku) {
      throw new Error('item_id is required and must be a valid SKU');
    }

    const existingForSku = await this.prisma.recipe.findFirst({
      where: { item_id: finishedSku },
      select: { id: true, recipe_code: true },
    });

    if (existingForSku) {
      throw new ConflictException(
        `A recipe already exists for finished SKU "${finishedSku}" (${existingForSku.recipe_code})`,
      );
    }

    const recipeCode = `RECIPE-${finishedSku}-${Date.now().toString(36)}`;
    const idempotencyKey = `recipe-create-${finishedSku}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;

    const ingredients: CreateRecipeIngredientDto[] = (
      dto.ingredients ?? []
    ).filter(
      (ing) =>
        ing.raw_item_id?.trim() &&
        ing.raw_item_name?.trim() &&
        Number(ing.quantity_per_unit) > 0,
    );

    // Snapshot WAC onto ingredient lines at create (display still uses live WAC on read)
    {
      const rawIds = ingredients.map((i) => normalizeSku(i.raw_item_id) || i.raw_item_id);
      const stockAtCreate = await this.loadStockMap(asString((dto as { shop_id?: string }).shop_id, '1'), rawIds);
      for (const ing of ingredients) {
        const id = normalizeSku(ing.raw_item_id) || ing.raw_item_id;
        const wac = stockAtCreate.get(id)?.unitCost ?? 0;
        if (wac > 0) {
          (ing as { unit_cost?: number }).unit_cost = wac;
        }
      }
    }

    const recipeType = dto.recipe_type ?? 'SINGLE_OUTPUT';
    const isMulti = recipeType === 'MULTI_OUTPUT';
    const yieldQty = dto.yield_quantity ?? dto.standard_yield;
    const yieldUnit = dto.yield_unit ?? dto.unit;
    const yieldBasis = dto.yield_basis ?? 'BATCH';
    const category = dto.category?.trim() || null;

    await this.ensureItemExists(
      finishedSku,
      dto.item_name,
      dto.unit,
      FINISHED_CATEGORY,
    );

    for (const ing of ingredients) {
      const rawSku = normalizeSku(ing.raw_item_id) || ing.raw_item_id;
      await this.ensureItemExists(
        rawSku,
        ing.raw_item_name,
        ing.unit || 'pcs',
        RAW_CATEGORY,
      );
    }

    for (const o of dto.outputs ?? []) {
      const outputSku = normalizeSku(o.item_id) || o.item_id;
      await this.ensureItemExists(
        outputSku,
        o.item_name ?? outputSku,
        o.unit || 'pcs',
        FINISHED_CATEGORY,
      );
    }

    /**
     * MULTI_OUTPUT: store fixed unit_weight only.
     * standard_quantity is optional example mix — never defaulted to batch yield.
     * Production enters whole-number counts later.
     */
    const outputRows =
      dto.outputs && dto.outputs.length > 0
        ? dto.outputs.map((o, index) => {
            const outputSku = normalizeSku(o.item_id) || o.item_id;
            return {
              item_id: outputSku,
              item_name: o.item_name ?? outputSku,
              standard_quantity: isMulti
                ? (o.standard_quantity ?? null)
                : (o.standard_quantity ?? dto.standard_yield),
              unit: o.unit || 'pcs',
              unit_weight: o.unit_weight ?? null,
              weight_unit:
                o.weight_unit ?? (o.unit_weight != null ? 'g' : null),
              is_default: o.is_default ?? index === 0,
              is_active: true,
            };
          })
        : [
            {
              item_id: finishedSku,
              item_name: dto.item_name,
              standard_quantity: dto.standard_yield,
              unit: dto.unit,
              unit_weight: null as number | null,
              weight_unit: null as string | null,
              is_default: true,
              is_active: true,
            },
          ];

    let created:
      | (Awaited<ReturnType<typeof this.prisma.recipe.create>> & {
          ingredients: unknown[];
          outputs: unknown[];
        })
      | undefined;

    try {
      created = await this.prisma.recipe.create({
        data: {
          recipe_code: recipeCode,
          item_id: finishedSku,
          item_name: dto.item_name,
          standard_yield: dto.standard_yield,
          unit: dto.unit,
          notes: dto.notes ?? null,
          category,
          recipe_type: recipeType,
          yield_quantity: yieldQty,
          yield_unit: yieldUnit,
          yield_basis: yieldBasis,
          is_active: true,
          ingredients: {
            create: ingredients.map((ing) => {
              const rawSku = normalizeSku(ing.raw_item_id) || ing.raw_item_id;
              return {
                raw_item_id: rawSku,
                raw_item_name: ing.raw_item_name,
                quantity_per_unit: ing.quantity_per_unit,
                unit: ing.unit,
                unit_cost: toMoneyNumber(ing.unit_cost) ?? null,
                notes: ing.notes ?? null,
              };
            }),
          },
          outputs: {
            create: outputRows,
          },
        } as unknown as Prisma.RecipeCreateInput,
        include: recipeInclude,
      });
    } catch (err) {
      this.logger.error(
        `Recipe DB create failed for ${finishedSku}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw err;
    }

    if (!created) {
      throw new Error('Failed to create recipe');
    }

    const event = await this.eventStore.appendEvent({
      event_type: 'recipe_created',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      item_id: finishedSku,
      payload: {
        recipe_id: created.id,
        recipe_code: recipeCode,
        item_id: finishedSku,
        item_name: dto.item_name,
        standard_yield: dto.standard_yield,
        unit: dto.unit,
        notes: dto.notes,
        category,
        recipe_type: recipeType,
        yield_quantity: yieldQty,
        yield_unit: yieldUnit,
        yield_basis: yieldBasis,
        ingredients,
        outputs: outputRows,
        ...(dto.payload ?? {}),
        created_at: new Date().toISOString(),
      },
    });

    for (const ing of ingredients) {
      const rawSku = normalizeSku(ing.raw_item_id) || ing.raw_item_id;
      await this.eventStore.appendEvent({
        event_type: 'recipe_ingredient_added',
        actor_user_id: actorUserId,
        idempotency_key: `recipe-ingredient-${created.id}-${rawSku}`,
        item_id: rawSku,
        payload: {
          recipe_id: created.id,
          recipe_code: recipeCode,
          raw_item_id: rawSku,
          raw_item_name: ing.raw_item_name,
          quantity_per_unit: ing.quantity_per_unit,
          unit: ing.unit,
          unit_cost: toMoneyNumber(ing.unit_cost),
        },
      });
    }

    this.logger.log(
      `Recipe created: ${dto.item_name} (id=${created.id}, type=${recipeType}, category=${category ?? 'none'}, outputs=${outputRows.length})`,
    );

    return {
      success: true,
      recipeId: created.id,
      recipeCode,
      eventId: event.id,
      outputs: created.outputs,
      message: 'Recipe created successfully',
    };
  }

  async addIngredient(dto: RecipeIngredientDto, actorUserId: string) {
    const rawSku = normalizeSku(dto.raw_item_id) || dto.raw_item_id;
    await this.ensureItemExists(
      rawSku,
      dto.raw_item_name,
      dto.unit || 'pcs',
      RAW_CATEGORY,
    );

    const recipe = await this.prisma.recipe.findFirst({
      where: {
        OR: [{ id: dto.recipe_id }, { recipe_code: dto.recipe_id }],
      },
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe ${dto.recipe_id} not found`);
    }

    const created = await this.prisma.recipeIngredient.create({
      data: {
        recipe_id: recipe.id,
        raw_item_id: rawSku,
        raw_item_name: dto.raw_item_name,
        quantity_per_unit: dto.quantity_per_unit,
        unit: dto.unit,
        unit_cost: dto.unit_cost ?? null,
        notes: dto.notes ?? null,
      },
    });

    const event = await this.eventStore.appendEvent({
      event_type: 'recipe_ingredient_added',
      actor_user_id: actorUserId,
      idempotency_key: `recipe-ingredient-${recipe.id}-${rawSku}-${Date.now()}`,
      item_id: rawSku,
      payload: {
        recipe_id: recipe.id,
        ingredient_id: created.id,
        raw_item_id: rawSku,
        raw_item_name: dto.raw_item_name,
        quantity_per_unit: dto.quantity_per_unit,
        unit: dto.unit,
        unit_cost: dto.unit_cost,
        notes: dto.notes,
      },
    });

    return {
      success: true,
      eventId: event.id,
      message: 'Ingredient added to recipe',
    };
  }

  async addOutput(dto: RecipeOutputDto, actorUserId: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: {
        OR: [{ id: dto.recipe_id }, { recipe_code: dto.recipe_id }],
      },
    });

    if (!recipe) {
      throw new NotFoundException(`Recipe ${dto.recipe_id} not found`);
    }

    const isMulti = recipe.recipe_type === 'MULTI_OUTPUT';

    if (isMulti && (dto.unit_weight == null || dto.unit_weight <= 0)) {
      throw new ConflictException(
        'MULTI_OUTPUT sizes require a fixed unit_weight (e.g. 250 for 250g)',
      );
    }

    const outputSku = normalizeSku(dto.item_id) || dto.item_id;
    await this.ensureItemExists(
      outputSku,
      dto.item_name ?? outputSku,
      dto.unit || 'pcs',
      FINISHED_CATEGORY,
    );

    if (dto.is_default) {
      await this.prisma.recipeOutput.updateMany({
        where: { recipe_id: recipe.id },
        data: { is_default: false },
      });
    }

    const created = await this.prisma.recipeOutput.create({
      data: {
        recipe_id: recipe.id,
        item_id: outputSku,
        item_name: dto.item_name ?? outputSku,
        // Never invent a production quantity for multi-output sizes
        standard_quantity: dto.standard_quantity ?? null,
        unit: dto.unit || 'pcs',
        unit_weight: dto.unit_weight ?? null,
        weight_unit: dto.weight_unit ?? (dto.unit_weight != null ? 'g' : null),
        is_default: dto.is_default ?? false,
        is_active: true,
      },
    });

    await this.eventStore.appendEvent({
      event_type: 'recipe_output_added',
      actor_user_id: actorUserId,
      idempotency_key: `recipe-output-${recipe.id}-${outputSku}-${Date.now()}`,
      item_id: outputSku,
      payload: {
        recipe_id: recipe.id,
        output_id: created.id,
        item_id: outputSku,
        item_name: dto.item_name,
        standard_quantity: dto.standard_quantity ?? null,
        unit: dto.unit,
        unit_weight: dto.unit_weight,
        weight_unit: dto.weight_unit,
        is_default: dto.is_default ?? false,
      },
    });

    return {
      success: true,
      outputId: created.id,
      message: 'Output added to recipe',
    };
  }

  async updateRecipe(
    recipeId: string,
    dto: UpdateRecipeDto,
    actorUserId: string,
  ) {
    const existing = await this.prisma.recipe.findFirst({
      where: {
        OR: [{ id: recipeId }, { recipe_code: recipeId }],
      },
      include: { ingredients: true, outputs: true },
    });

    if (!existing) {
      throw new NotFoundException(`Recipe ${recipeId} not found`);
    }

    const idempotencyKey = `recipe-update-${existing.id}-${Date.now()}`;

    const nextItemId =
      dto.item_id != null
        ? normalizeSku(dto.item_id) || dto.item_id.trim()
        : normalizeSku(existing.item_id) || existing.item_id;
    if (!nextItemId) {
      throw new BadRequestException('item_id is required and must be a valid SKU');
    }

    const nextName = dto.item_name ?? existing.item_name;
    const nextYield = dto.standard_yield ?? Number(existing.standard_yield);
    const nextUnit = dto.unit ?? existing.unit;
    const nextNotes = dto.notes !== undefined ? dto.notes : existing.notes;
    const nextCategory =
      dto.category !== undefined
        ? dto.category?.trim() || null
        : existing.category;
    const nextType = dto.recipe_type ?? existing.recipe_type;
    const nextYieldQty =
      dto.yield_quantity ??
      dto.standard_yield ??
      Number(existing.yield_quantity ?? existing.standard_yield);
    const nextYieldUnit =
      dto.yield_unit ?? dto.unit ?? existing.yield_unit ?? existing.unit;
    const nextYieldBasis = dto.yield_basis ?? existing.yield_basis;

    let ingredientRows: Array<{
      raw_item_id: string;
      raw_item_name: string;
      quantity_per_unit: number;
      unit: string;
      unit_cost?: number | null;
      notes?: string | null;
    }> | null = null;

    if (dto.ingredients != null) {
      ingredientRows = dto.ingredients
        .filter(
          (ing) =>
            ing.raw_item_id?.trim() &&
            ing.raw_item_name?.trim() &&
            Number(ing.quantity_per_unit) > 0,
        )
        .map((ing) => ({
          raw_item_id: normalizeSku(ing.raw_item_id) || ing.raw_item_id.trim(),
          raw_item_name: ing.raw_item_name.trim(),
          quantity_per_unit: Number(ing.quantity_per_unit),
          unit: ing.unit.trim(),
          unit_cost:
            ing.unit_cost != null ? toMoneyNumber(ing.unit_cost) : null,
          notes: ing.notes ?? null,
        }));
      for (const ing of ingredientRows) {
        await this.ensureItemExists(
          ing.raw_item_id,
          ing.raw_item_name,
          ing.unit,
          RAW_CATEGORY,
        );
      }
    }

    let outputRows: Array<{
      item_id: string;
      item_name: string | null;
      standard_quantity: number | null;
      unit: string;
      unit_weight: number | null;
      weight_unit: string | null;
      is_default: boolean;
    }> | null = null;

    if (dto.outputs != null) {
      outputRows = dto.outputs.map((o, index) => {
        const outputSku = normalizeSku(o.item_id) || o.item_id.trim();
        return {
          item_id: outputSku,
          item_name: o.item_name?.trim() || nextName,
          standard_quantity:
            o.standard_quantity != null ? Number(o.standard_quantity) : null,
          unit: o.unit?.trim() || 'pcs',
          unit_weight: o.unit_weight != null ? Number(o.unit_weight) : null,
          weight_unit: o.weight_unit ?? (o.unit_weight != null ? 'g' : null),
          is_default: o.is_default ?? index === 0,
        };
      });
      for (const o of outputRows) {
        await this.ensureItemExists(
          o.item_id,
          o.item_name || nextName,
          o.unit,
          FINISHED_CATEGORY,
        );
      }
    }

    await this.ensureItemExists(nextItemId, nextName, nextUnit, FINISHED_CATEGORY);

    await this.prisma.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id: existing.id },
        data: {
          item_id: nextItemId,
          item_name: nextName,
          standard_yield: nextYield,
          unit: nextUnit,
          notes: nextNotes,
          category: nextCategory,
          recipe_type: nextType,
          yield_quantity: nextYieldQty,
          yield_unit: nextYieldUnit,
          yield_basis: nextYieldBasis,
        },
      });

      if (ingredientRows != null) {
        await tx.recipeIngredient.deleteMany({ where: { recipe_id: existing.id } });
        if (ingredientRows.length > 0) {
          await tx.recipeIngredient.createMany({
            data: ingredientRows.map((ing) => ({
              recipe_id: existing.id,
              raw_item_id: ing.raw_item_id,
              raw_item_name: ing.raw_item_name,
              quantity_per_unit: ing.quantity_per_unit,
              unit: ing.unit,
              unit_cost: ing.unit_cost,
              notes: ing.notes,
            })),
          });
        }
      }

      if (outputRows != null) {
        await tx.recipeOutput.deleteMany({ where: { recipe_id: existing.id } });
        if (outputRows.length > 0) {
          await tx.recipeOutput.createMany({
            data: outputRows.map((o) => ({
              recipe_id: existing.id,
              item_id: o.item_id,
              item_name: o.item_name,
              standard_quantity: o.standard_quantity,
              unit: o.unit,
              unit_weight: o.unit_weight,
              weight_unit: o.weight_unit,
              is_default: o.is_default,
              is_active: true,
            })),
          });
        }
      } else if (
        nextType !== 'MULTI_OUTPUT' &&
        (dto.standard_yield != null ||
          dto.unit != null ||
          dto.item_name != null ||
          dto.item_id != null)
      ) {
        await tx.recipeOutput.updateMany({
          where: { recipe_id: existing.id, is_default: true },
          data: {
            ...(dto.standard_yield != null
              ? { standard_quantity: dto.standard_yield }
              : {}),
            ...(dto.unit != null ? { unit: dto.unit } : {}),
            ...(dto.item_name != null ? { item_name: dto.item_name } : {}),
            ...(dto.item_id != null ? { item_id: nextItemId } : {}),
          },
        });
      }
    });

    const event = await this.eventStore.appendEvent({
      event_type: 'recipe_updated',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      item_id: nextItemId,
      payload: {
        recipe_id: existing.id,
        recipe_code: existing.recipe_code,
        item_id: nextItemId,
        previous_item_id: existing.item_id,
        item_name: nextName,
        standard_yield: nextYield,
        unit: nextUnit,
        notes: nextNotes,
        category: nextCategory,
        recipe_type: nextType,
        yield_quantity: nextYieldQty,
        yield_unit: nextYieldUnit,
        yield_basis: nextYieldBasis,
        ingredients: ingredientRows,
        outputs: outputRows,
        ...(dto.payload ?? {}),
        updated_at: new Date().toISOString(),
      },
    });

    this.logger.log(
      `Recipe updated: ${nextName} (id=${existing.id}, sku=${nextItemId}, type=${nextType})`,
    );

    return {
      success: true,
      recipeId: existing.id,
      eventId: event.id,
      message: 'Recipe updated successfully',
    };
  }


  async getRecipeIngredients(recipeId: string) {
    const db = await this.prisma.recipe.findFirst({
      where: {
        OR: [{ id: recipeId }, { recipe_code: recipeId }],
      },
      include: { ingredients: true },
    });

    if (!db) {
      return [];
    }

    return (db.ingredients ?? []).map((ing) => ({
      rawItemId: normalizeSku(ing.raw_item_id) || ing.raw_item_id,
      raw_item_id: normalizeSku(ing.raw_item_id) || ing.raw_item_id,
      rawItemName: ing.raw_item_name,
      raw_item_name: ing.raw_item_name,
      quantityPerUnit: ing.quantity_per_unit,
      quantity_per_unit: ing.quantity_per_unit,
      unit: ing.unit,
      unitCost: toMoneyNumber(ing.unit_cost),
      unit_cost: toMoneyNumber(ing.unit_cost),
    }));
  }

  private async ensureItemExists(
    itemId: string,
    name: string,
    unit: string,
    category: string = RAW_CATEGORY,
  ): Promise<void> {
    const id = normalizeSku(itemId);
    if (!id) return;

    const existing = await this.prisma.item.findUnique({
      where: { item_id: id },
      select: { id: true, category: true },
    });

    if (existing) {
      if (
        category === FINISHED_CATEGORY &&
        !FINISHED_CATEGORY_RE.test(String(existing.category ?? ''))
      ) {
        await this.prisma.item.update({
          where: { item_id: id },
          data: { category: FINISHED_CATEGORY },
        });
        this.logger.debug(`Promoted Item ${id} → ${FINISHED_CATEGORY}`);
      }
      return;
    }

    await this.prisma.item.create({
      data: {
        item_id: id,
        name: name?.trim() || id,
        unit: unit?.trim() || 'pcs',
        category: category?.trim() || RAW_CATEGORY,
      },
    });
    this.logger.debug(`Auto-created Item ${id} (${category})`);
  }


  /**
   * COG Phase 2: attach live WAC to ingredients and compute batch / std unit cost.
   * unit cost is never typed second — read from inventory WAC only.
   */
  private enrichRecipeCosting(
    base: Record<string, unknown>,
    stockById: Map<string, StockSnap>,
  ): Record<string, unknown> {
    const ingredients = Array.isArray(base.ingredients)
      ? (base.ingredients as Array<Record<string, unknown>>)
      : [];

    let batchCost = 0;
    const enriched = ingredients.map((ing) => {
      const rawItemId =
        normalizeSku(ing.rawItemId ?? ing.raw_item_id) ||
        asString(ing.rawItemId ?? ing.raw_item_id);
      const qty = asNumber(ing.quantityPerUnit ?? ing.quantity_per_unit, 0);
      const snap = rawItemId ? stockById.get(rawItemId) : undefined;
      const stored = asNumber(ing.unitCost ?? ing.unit_cost, 0);
      const unitCost =
        snap && snap.unitCost > 0
          ? snap.unitCost
          : stored > 0
            ? stored
            : 0;
      const lineCost =
        qty > 0 && unitCost > 0
          ? Math.round(qty * unitCost * 100) / 100
          : 0;
      batchCost += lineCost;
      return {
        ...ing,
        unitCost,
        unit_cost: unitCost,
        lineCost,
        line_cost: lineCost,
        costMissing: qty > 0 && !(unitCost > 0),
      };
    });

    batchCost = Math.round(batchCost * 100) / 100;
    const yieldQty = asNumber(
      base.standardYield ?? base.standard_yield ?? base.yieldQuantity,
      0,
    );
    const stdUnitCost =
      yieldQty > 0 && batchCost > 0
        ? Math.round((batchCost / yieldQty) * 1e4) / 1e4
        : 0;

    return {
      ...base,
      ingredients: enriched,
      batchCost,
      batch_cost: batchCost,
      stdUnitCost,
      std_unit_cost: stdUnitCost,
      costMissing: enriched.some((i) => i.costMissing),
    };
  }


  private mapDbRecipe(
    r: {
      id: string;
      recipe_code?: string | null;
      item_id: string;
      item_name: string;
      standard_yield: number;
      unit: string;
      notes?: string | null;
      category?: string | null;
      recipe_type?: string | null;
      yield_quantity?: number | null;
      yield_unit?: string | null;
      yield_basis?: string | null;
      is_active?: boolean | null;
      created_at?: Date;
      updated_at?: Date;
      ingredients?: Array<{
        raw_item_id: string;
        raw_item_name: string;
        quantity_per_unit: number;
        unit: string;
        unit_cost?: number | null;
      }>;
      outputs?: Array<{
        id: string;
        item_id: string;
        item_name?: string | null;
        standard_quantity?: number | null;
        unit: string;
        unit_weight?: number | null;
        weight_unit?: string | null;
        is_default: boolean;
        is_active: boolean;
      }>;
    },
    shopId?: string,
  ) {
    const finishedSku = normalizeSku(r.item_id) || r.item_id;

    const outputs = (r.outputs ?? []).map((o) => {
      const outSku = normalizeSku(o.item_id) || o.item_id;
      return {
        id: o.id,
        itemId: outSku,
        item_id: outSku,
        itemName: o.item_name ?? outSku,
        item_name: o.item_name ?? outSku,
        standardQuantity: o.standard_quantity ?? null,
        standard_quantity: o.standard_quantity ?? null,
        unit: o.unit,
        unitWeight: o.unit_weight ?? null,
        unit_weight: o.unit_weight ?? null,
        weightUnit: o.weight_unit ?? null,
        weight_unit: o.weight_unit ?? null,
        isDefault: o.is_default,
        is_default: o.is_default,
        isActive: o.is_active,
        is_active: o.is_active,
      };
    });

    return {
      recipeId: r.id,
      recipe_id: r.id,
      recipe_code: r.recipe_code ?? r.id,
      itemId: finishedSku,
      item_id: finishedSku,
      name: r.item_name,
      item_name: r.item_name,
      standardYield: r.standard_yield,
      standard_yield: r.standard_yield,
      unit: r.unit,
      notes: r.notes ?? null,
      category: r.category ?? null,
      recipeType: r.recipe_type ?? 'SINGLE_OUTPUT',
      recipe_type: r.recipe_type ?? 'SINGLE_OUTPUT',
      yieldQuantity: r.yield_quantity ?? r.standard_yield,
      yield_quantity: r.yield_quantity ?? r.standard_yield,
      yieldUnit: r.yield_unit ?? r.unit,
      yield_unit: r.yield_unit ?? r.unit,
      yieldBasis: r.yield_basis ?? 'BATCH',
      yield_basis: r.yield_basis ?? 'BATCH',
      isActive: r.is_active ?? true,
      is_active: r.is_active ?? true,
      ingredients: (r.ingredients ?? []).map((ing) => {
        const rawSku = normalizeSku(ing.raw_item_id) || ing.raw_item_id;
        return {
          rawItemId: rawSku,
          raw_item_id: rawSku,
          rawItemName: ing.raw_item_name,
          raw_item_name: ing.raw_item_name,
          name: ing.raw_item_name,
          quantityPerUnit: ing.quantity_per_unit,
          quantity_per_unit: ing.quantity_per_unit,
          unit: ing.unit,
          unitCost: toMoneyNumber(ing.unit_cost),
          unit_cost: toMoneyNumber(ing.unit_cost),
        };
      }),
      outputs,
      shop_id: shopId,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }
}
