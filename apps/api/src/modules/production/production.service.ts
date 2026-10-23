import { quantityInItemUnit, toCanonicalStockQty } from '../../common/utils/stock-units';
// apps/api/src/modules/production/production.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventStoreService } from '../../core/event-store.service';
import { FefoStockService } from '../../core/fefo-stock.service';
import { IdempotencyService } from '../../core/idempotency.service';
import { RecipeService } from '../recipe/recipe.service';
import { WasteService } from '../waste/waste.service';
import { VarianceService } from '../variance/variance.service';
import type { VarianceComputeResult } from '../variance/variance-engine.service';
import { ProductionGateway } from './production.gateway';
import type { StartProductionDto } from './dto/start-production.dto';
import type { FinishProductionDto } from './dto/finish-production.dto';
import type { PrePrepDto } from './dto/pre-prep.dto';
import type { RecordWasteDto } from '../waste/dto/record-waste.dto';
import { convertQuantity } from '../../common/utils/units.utils';
import { normalizeSku } from '../../common/utils/sku.util';

interface IdempotencyResult {
  isReplay: boolean;
  existing: { id: string; payload?: unknown } | null;
}

export interface LineActual {
  item_id: string;
  item_name?: string;
  actual_quantity: number;
  unit?: string;
  standard_quantity?: number;
  unit_cost?: number;
  line_cost?: number;
  unit_weight?: number;
  weight_unit?: string;
}

export interface StartProductionResult {
  success: boolean;
  productionId?: string;
  eventId?: string;
  message: string;
}

export interface FinishProductionResult {
  success: boolean;
  eventId?: string;
  inputs?: LineActual[];
  outputs?: LineActual[];
  /** Production cost (total) — sum of actual inputs × WAC */
  totalInputCost?: number;
  productionCost?: number;
  /** Unit cost = productionCost ÷ (good + waste) */
  finishedUnitCost?: number;
  goodQuantity?: number;
  wasteQuantity?: number;
  totalMade?: number;
  unaccountedQuantity?: number;
  costReconciliationOk?: boolean;
  varianceBatchId?: string | null;
  varianceFlagged?: boolean;
  actualYieldWeightKg?: number;
  expectedYield?: number;
  yieldVarianceWeightKg?: number | null;
  message: string;
}

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

function weightToKg(
  qty: number,
  unitWeight: number,
  weightUnit: string,
): number {
  const w = qty * unitWeight;
  const u = (weightUnit || 'g').toLowerCase();
  if (u === 'g') return w / 1000;
  if (u === 'kg') return w;
  if (u === 'ml') return w / 1000;
  if (u === 'l') return w;
  return w;
}

/** Total mass of outputs in grams (pieces × unit_weight). 0 if no unit weights. */
function actualYieldMassGrams(
  outputs: Array<{
    actual_quantity: number;
    unit_weight?: number | null;
    weight_unit?: string | null;
  }>,
): number {
  let grams = 0;
  let any = false;
  for (const o of outputs) {
    const qty = Math.max(0, Number(o.actual_quantity) || 0);
    const uw = o.unit_weight != null ? Number(o.unit_weight) : 0;
    if (!(uw > 0) || qty <= 0) continue;
    any = true;
    const u = (o.weight_unit || 'g').toLowerCase();
    const line = qty * uw;
    if (u === 'kg' || u === 'l') grams += line * 1000;
    else grams += line; // g, ml, default
  }
  return any ? grams : 0;
}

/**
 * Convert a quantity into the recipe yield unit for variance scaling.
 * Avoids mixing piece counts with gram yields (Michael: 3 pieces → 3 g bug).
 */
function toRecipeYieldUnit(
  massGrams: number,
  recipeUnit: string | null | undefined,
): number {
  const u = (recipeUnit || 'g').toLowerCase().trim();
  if (u === 'kg' || u === 'l') return massGrams / 1000;
  return massGrams; // g, ml, pcs-as-mass-batch recipes in grams
}

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    private readonly eventStore: EventStoreService,
    private readonly idempotencyService: IdempotencyService,
    private readonly recipeService: RecipeService,
    private readonly wasteService: WasteService,
    private readonly productionGateway: ProductionGateway,
    private readonly varianceService: VarianceService,
    private readonly prisma: PrismaService,
    private readonly fefoStock: FefoStockService,
  ) {}

  async getProductionTrace(productionId: string, shopId: string = '1') {
    const inputs = await this.prisma.productionInput.findMany({
      where: { shop_id: shopId, production_id: productionId },
      orderBy: [{ input_item_id: 'asc' }, { created_at: 'asc' }],
    });
    const batchIds = [...new Set(inputs.map((row) => row.input_batch_id))];
    const outputBatchIds = [...new Set(inputs.map((row) => row.output_batch_id).filter((id): id is string => Boolean(id)))];
    const allBatchIds = [...new Set([...batchIds, ...outputBatchIds])];
    const batches = await this.prisma.inventoryBatch.findMany({
      where: { shop_id: shopId, id: { in: allBatchIds } },
      include: { item: { select: { name: true, unit: true } } },
    });
    const batchById = new Map(batches.map((batch) => [batch.id, batch]));
    return {
      success: true,
      shop_id: shopId,
      production_id: productionId,
      inputs: inputs.map((input) => ({
        ...input,
        input_batch: batchById.get(input.input_batch_id) ?? null,
        output_batch: input.output_batch_id ? batchById.get(input.output_batch_id) ?? null : null,
      })),
    };
  }

  async getRawBatchTrace(batchId: string, shopId: string = '1') {
    const batch = await this.prisma.inventoryBatch.findFirst({
      where: { id: batchId, shop_id: shopId },
      include: { item: { select: { name: true, unit: true } } },
    });
    if (!batch) return { success: false, shop_id: shopId, batch_id: batchId, productions: [] };
    const inputs = await this.prisma.productionInput.findMany({
      where: { shop_id: shopId, input_batch_id: batchId },
      orderBy: { created_at: 'asc' },
    });
    const outputIds = [...new Set(inputs.map((input) => input.output_batch_id).filter((id): id is string => Boolean(id)))];
    const outputBatches = await this.prisma.inventoryBatch.findMany({
      where: { shop_id: shopId, id: { in: outputIds } },
      include: { item: { select: { name: true, unit: true } } },
    });
    const outputById = new Map(outputBatches.map((row) => [row.id, row]));
    return {
      success: true,
      shop_id: shopId,
      raw_batch: batch,
      productions: inputs.map((input) => ({ ...input, output_batch: input.output_batch_id ? outputById.get(input.output_batch_id) ?? null : null })),
    };
  }

  async startProduction(
    dto: StartProductionDto,
    actorUserId: string,
  ): Promise<StartProductionResult> {
    const itemId = normalizeSku(dto.item_id);
    if (!itemId) {
      throw new BadRequestException('item_id is required');
    }

    await this.assertRecipeExists({ ...dto, item_id: itemId });

    const productionId = `PROD-${itemId}-${Date.now().toString(36)}`;
    const idempotencyKey = `prod-start-${productionId}`;

    const result = (await this.idempotencyService.enforce(idempotencyKey, {
      ...dto,
      item_id: itemId,
      production_id: productionId,
    })) as IdempotencyResult;

    if (result.isReplay) {
      const payload = asRecord(result.existing?.payload);
      return {
        success: true,
        productionId:
          asString(payload.production_id) ||
          asString(payload.productionId) ||
          productionId,
        eventId: result.existing?.id,
        message: 'Already processed (idempotent replay)',
      };
    }

    const startedAt = new Date().toISOString();

    const event = await this.eventStore.appendEvent({
      event_type: 'production_started',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      item_id: itemId,
      quantity: dto.planned_quantity,
      payload: {
        productionId,
        production_id: productionId,
        recipe_id: dto.recipe_id,
        recipeId: dto.recipe_id,
        item_id: itemId,
        itemId,
        item_name: dto.item_name,
        itemName: dto.item_name,
        recipe_name: dto.item_name,
        recipeName: dto.item_name,
        planned_quantity: dto.planned_quantity,
        plannedQuantity: dto.planned_quantity,
        batch_size: dto.planned_quantity,
        batchSize: dto.planned_quantity,
        notes: dto.notes,
        status: 'started',
        started_at: startedAt,
        startedAt,
        shop_id: '1',
        shopId: '1',
        ...(dto.payload ?? {}),
      },
    });

    this.productionGateway.broadcastProductionStarted({
      production_id: productionId,
      item_name: dto.item_name,
      planned_quantity: dto.planned_quantity,
      status: 'in_progress',
      timestamp: startedAt,
    });

    return {
      success: true,
      productionId,
      eventId: event.id,
      message: 'Production started successfully',
    };
  }

  async finishProduction(
    dto: FinishProductionDto,
    actorUserId: string,
  ): Promise<FinishProductionResult> {
    const idempotencyKey = `prod-finish-${dto.production_id}`;

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

    const startCtx = await this.resolveStartContext(dto.production_id);

    const itemId =
      normalizeSku(dto.item_id ?? startCtx.itemId ?? '') || 'UNKNOWN';
    const itemName = dto.item_name ?? startCtx.itemName ?? itemId;
    const plannedQuantity =
      dto.planned_quantity ?? startCtx.plannedQuantity ?? 0;
    const shopId = startCtx.shopId || '1';
    const finishedAt = new Date().toISOString();

    let { inputs, outputs } = await this.resolveLines(
      dto,
      startCtx.recipeId,
      itemId,
      itemName,
      plannedQuantity,
    );

    // Multi-output: enforce whole-number piece counts (never auto-fix)
    for (const o of outputs) {
      if (o.unit_weight != null && o.unit_weight > 0) {
        if (!Number.isInteger(o.actual_quantity) || o.actual_quantity < 0) {
          throw new BadRequestException(
            `Output ${o.item_name || o.item_id}: actual quantity must be a whole number`,
          );
        }
      }
    }

    const pieceSum = outputs.reduce(
      (s, o) => s + Math.max(0, o.actual_quantity),
      0,
    );

    // Declare once for header yield + variance (avoids TS2451 redeclare)
    const massGrams = actualYieldMassGrams(outputs);
    const recipeYieldUnit =
      (startCtx as { yieldUnit?: string }).yieldUnit ||
      outputs.find((o) => o.unit_weight != null)?.weight_unit ||
      null;
    const yieldFromMass =
      massGrams > 0 ? toRecipeYieldUnit(massGrams, recipeYieldUnit) : 0;

    let actualQuantityProduced: number;
    if (yieldFromMass > 0) {
      actualQuantityProduced = yieldFromMass;
    } else if (
      dto.actual_quantity_produced != null &&
      dto.actual_quantity_produced > 0
    ) {
      actualQuantityProduced = dto.actual_quantity_produced;
    } else {
      actualQuantityProduced = pieceSum;
    }

    /**
     * Cost / waste semantics (Michael + Oct 3 COG fix):
     * - actualQuantityProduced = GOOD units to stock (UI "Actual yield")
     * - waste_quantity = waste field ONLY (never planned − actual)
     * - totalMade = good + waste
     * - productionCost = Σ(actual inputs × WAC); unitCost = productionCost ÷ totalMade
     * - Stock receives good only; waste never reduces the lot
     */
    const wasteQty = Math.max(0, Number(dto.waste_quantity ?? 0));
    const goodQuantity = Math.max(0, actualQuantityProduced);
    const totalMade = goodQuantity + wasteQty;
    const unaccountedQuantity = Math.max(
      0,
      plannedQuantity - totalMade,
    );

    if (goodQuantity <= 0 && pieceSum <= 0 && wasteQty <= 0) {
      throw new BadRequestException(
        'No positive actual quantity on primary yield or outputs',
      );
    }

    const usableQuantity = goodQuantity; // stock = good only (do NOT subtract waste again)
    const yieldPctUsable =
      plannedQuantity > 0
        ? Math.round((usableQuantity / plannedQuantity) * 1000) / 10
        : null;

    const actualYieldWeightKg = massGrams > 0 ? massGrams / 1000 : 0;
    const expectedYield = plannedQuantity;
    const actualForVariance =
      yieldFromMass > 0 ? yieldFromMass : actualQuantityProduced;
    const yieldVarianceWeightKg =
      expectedYield > 0 && actualForVariance > 0
        ? expectedYield - actualForVariance
        : null;

    const yieldPercentage =
      plannedQuantity > 0
        ? Math.round((actualForVariance / plannedQuantity) * 1000) / 10
        : 100;

    if (inputs.length === 0) {
      this.logger.warn(
        `Production ${dto.production_id}: no input lines — raw materials will not be deducted`,
      );
    }

    inputs = await this.enrichLinesWithUnitCost(shopId, inputs);

    const totalInputCost = inputs.reduce((sum, line) => {
      const qty = Math.max(0, line.actual_quantity);
      const uc = Math.max(0, line.unit_cost ?? 0);
      const lineCost = qty * uc;
      line.line_cost = lineCost;
      return sum + lineCost;
    }, 0);

    // Resolve production cost (TOTAL). Web often sends batch total in unit_cost by mistake.
    const productionCost = this.resolveProductionCost(
      totalInputCost,
      dto.total_cost,
      dto.unit_cost,
      totalMade > 0 ? totalMade : goodQuantity,
    );

    outputs = this.allocateOutputCosts(
      outputs,
      productionCost,
      undefined, // never multiply mislabeled "unit_cost" as unit × qty
      productionCost,
      totalMade > 0 ? totalMade : goodQuantity,
    );

    // Unit cost = production cost ÷ (good + waste). Same unit cost values waste and FG lot.
    const divisor = totalMade > 0 ? totalMade : goodQuantity > 0 ? goodQuantity : 1;
    const finishedUnitCost =
      Math.round((productionCost / divisor) * 1e6) / 1e6;

    // Stamp output lines with the true unit cost for projection
    outputs = outputs.map((o) => {
      const qty = Math.max(0, o.actual_quantity);
      if (qty <= 0) return { ...o, unit_cost: finishedUnitCost, line_cost: 0 };
      return {
        ...o,
        unit_cost: finishedUnitCost,
        line_cost: Math.round(qty * finishedUnitCost * 1e4) / 1e4,
      };
    });

    const finalTotalCost = Math.round(goodQuantity * finishedUnitCost * 1e4) / 1e4;
    const wasteValue = Math.round(wasteQty * finishedUnitCost * 1e4) / 1e4;
    const costReconciliationOk =
      Math.abs(finalTotalCost + wasteValue - productionCost) < 0.02;

    await this.assertSufficientStock(shopId, inputs);

    const stockDeductions = inputs.map((l) => ({
      item_id: normalizeSku(l.item_id) || l.item_id,
      item_name: l.item_name,
      quantity: l.actual_quantity,
      unit: l.unit,
      unit_cost: l.unit_cost ?? 0,
    }));

    const event = await this.eventStore.appendEvent({
      event_type: 'production_finished',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      batch_number: dto.batch_number,
      expiry_date: dto.expiry_date ? new Date(dto.expiry_date) : undefined,
      waste_reason: dto.waste_reason,
      item_id: itemId,
      quantity: usableQuantity,
      unit_cost: finishedUnitCost,
      total_cost: finalTotalCost,
      payload: {
        productionId: dto.production_id,
        production_id: dto.production_id,
        recipe_id: startCtx.recipeId,
        recipeId: startCtx.recipeId,
        item_id: itemId,
        itemId,
        item_name: itemName,
        itemName,
        recipe_name: itemName,
        recipeName: itemName,
        planned_quantity: plannedQuantity,
        plannedQuantity,
        batch_size: plannedQuantity,
        batchSize: plannedQuantity,
        actual_quantity_produced: actualQuantityProduced,
        actualYield: actualQuantityProduced,
        actual_yield: actualQuantityProduced,
        waste_quantity: wasteQty,
        usable_quantity: usableQuantity,
        usableQuantity,
        yield_percentage: yieldPctUsable ?? yieldPercentage,
        expected_yield: expectedYield,
        actual_yield_weight_kg: actualYieldWeightKg || null,
        yield_variance_weight_kg: yieldVarianceWeightKg,
        waste_reason: dto.waste_reason,
        waste_unit: dto.waste_unit,
        batch_number: dto.batch_number,
        expiry_date: dto.expiry_date,
        unit_cost: finishedUnitCost,
        total_cost: finalTotalCost,
        total_input_cost: totalInputCost,
        cost_source: dto.total_cost != null || dto.unit_cost != null ? 'manual_or_override' : 'actual_inputs',
        production_cost: productionCost,
        good_quantity: goodQuantity,
        total_made: totalMade,
        waste_value: wasteValue,
        unaccounted_quantity: unaccountedQuantity,
        cost_reconciliation_ok: costReconciliationOk,
        std_unit_cost: finishedUnitCost,
        notes: dto.notes,
        status: 'finished',
        finishedAt,
        finished_at: finishedAt,
        shop_id: shopId,
        shopId,
        multi_output: outputs.length > 1,
        inputs,
        outputs,
        stock_deductions: stockDeductions,
        ...(dto.payload ?? {}),
      },
    });

    this.productionGateway.broadcastProductionFinished({
      production_id: dto.production_id,
      item_name: itemName,
      actual_quantity: actualQuantityProduced,
      waste_quantity: dto.waste_quantity ?? 0,
      yield_percentage: yieldPercentage,
      status: 'completed',
      timestamp: finishedAt,
    });

    if (wasteQty > 0) {
      const wastePayload: RecordWasteDto = {
        module_source: 'production',
        item_id: itemId || 'UNKNOWN',
        item_name: itemName || 'Production Item',
        batch_number: dto.batch_number || dto.production_id,
        quantity_wasted: wasteQty,
        unit_of_measure: dto.waste_unit || 'units',
        unit_cost: finishedUnitCost,
        total_waste_value: wasteValue,
        waste_type: 'quality_reject',
        waste_reason: dto.waste_reason || 'Production waste',
        root_cause: 'preventable',
        severity: wasteQty > 20 ? 'high' : 'medium',
        payload: {
          production_id: dto.production_id,
          productionId: dto.production_id,
          source: 'production_finish',
        },
      };
      try {
        await this.wasteService.recordWaste(wastePayload, actorUserId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Waste record after production failed: ${message}`);
      }
    }

    // Variance uses same massGrams computed above (do not redeclare).
    let varianceActual = actualQuantityProduced;
    let variancePlanned = plannedQuantity;
    if (massGrams > 0) {
      const recipeUnitHint =
        outputs.find((o) => o.unit_weight != null)?.weight_unit || 'g';
      const plannedLooksLikeGrams =
        plannedQuantity >= 50 &&
        (recipeUnitHint === 'g' || recipeUnitHint === 'ml');
      if (plannedLooksLikeGrams) {
        varianceActual = massGrams;
        variancePlanned = plannedQuantity;
      } else {
        varianceActual = toRecipeYieldUnit(massGrams, recipeUnitHint);
        variancePlanned = plannedQuantity;
      }
      this.logger.log(
        `Variance mass: pieces~=${pieceSum} massG=${massGrams} planned=${variancePlanned} actual=${varianceActual}`,
      );
    }

    let variance: VarianceComputeResult | null = null;
    try {
      variance = await this.varianceService.createFromProductionFinish(
        {
          productionId: dto.production_id,
          shopId,
          itemId,
          itemName,
          plannedQuantity: variancePlanned,
          actualQuantityProduced: varianceActual,
          unitCost: finishedUnitCost,
          wasteQuantity: dto.waste_quantity,
          batchNumber: dto.batch_number,
        },
        actorUserId,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Variance engine failed: ${message}`);
    }

    this.logger.log(
      `Production finished ${dto.production_id}: outputs=${outputs.length} yieldKg=${actualYieldWeightKg.toFixed(3)} varianceKg=${yieldVarianceWeightKg ?? 'n/a'}`,
    );

    return {
      success: true,
      eventId: event.id,
      inputs,
      outputs,
      totalInputCost,
      productionCost,
      finishedUnitCost,
      goodQuantity,
      wasteQuantity: wasteQty,
      totalMade,
      unaccountedQuantity,
      costReconciliationOk,
      varianceBatchId: variance?.batch_id ?? null,
      varianceFlagged: variance?.flagged ?? false,
      actualYieldWeightKg: actualYieldWeightKg || undefined,
      expectedYield,
      yieldVarianceWeightKg,
      message:
        unaccountedQuantity > 0
          ? `Production completed; ${unaccountedQuantity} units unaccounted (planned > good + waste)`
          : 'Production completed successfully',
    };
  }

  /**
   * Production cost (total). Prefers actual input sum.
   * If client sends unit_cost equal to batch total (legacy UI), treat as total not unit.
   */
  private resolveProductionCost(
    totalInputCost: number,
    manualTotal: number | undefined,
    manualUnitOrTotal: number | undefined,
    totalMade: number,
  ): number {
    if (manualTotal != null && Number.isFinite(manualTotal) && manualTotal >= 0) {
      return Math.max(0, manualTotal);
    }
    if (
      manualUnitOrTotal != null &&
      Number.isFinite(manualUnitOrTotal) &&
      manualUnitOrTotal > 0
    ) {
      const v = manualUnitOrTotal;
      // Heuristic: value looks like a batch total (≈ input cost or >> per-unit)
      if (
        totalInputCost > 0 &&
        (Math.abs(v - totalInputCost) / Math.max(totalInputCost, 1e-9) < 0.15 ||
          (totalMade > 1 && v > totalInputCost * 0.5))
      ) {
        return Math.max(0, v);
      }
      // True per-unit override
      if (totalMade > 0) return Math.max(0, v) * totalMade;
      return Math.max(0, v);
    }
    return Math.max(0, totalInputCost);
  }

  private allocateOutputCosts(
    outputs: LineActual[],
    totalInputCost: number,
    manualUnitCost: number | undefined,
    manualTotalCost: number | undefined,
    primaryActual: number,
  ): LineActual[] {
    const positive = outputs.filter((o) => o.actual_quantity > 0);
    const qtySum = positive.reduce((s, o) => s + o.actual_quantity, 0);

    let pool = totalInputCost;
    if (manualTotalCost != null && Number.isFinite(manualTotalCost)) {
      pool = Math.max(0, manualTotalCost);
    } else if (
      manualUnitCost != null &&
      Number.isFinite(manualUnitCost) &&
      primaryActual > 0
    ) {
      // Only treat as true unit when it is small vs pool (legacy safe path)
      const asTotal = Math.max(0, manualUnitCost) * primaryActual;
      if (totalInputCost > 0 && Math.abs(manualUnitCost - totalInputCost) / totalInputCost < 0.15) {
        pool = Math.max(0, manualUnitCost);
      } else {
        pool = asTotal;
      }
    }

    if (qtySum <= 0) {
      return outputs.map((o) => ({
        ...o,
        item_id: normalizeSku(o.item_id) || o.item_id,
        unit_cost: 0,
        line_cost: 0,
      }));
    }

    return outputs.map((o) => {
      const outId = normalizeSku(o.item_id) || o.item_id;
      const qty = Math.max(0, o.actual_quantity);
      if (qty <= 0) {
        return { ...o, item_id: outId, unit_cost: 0, line_cost: 0 };
      }
      if (o.unit_cost != null && o.unit_cost > 0) {
        const lineCost = qty * o.unit_cost;
        return { ...o, item_id: outId, line_cost: lineCost };
      }
      const share = qty / qtySum;
      const lineCost = pool * share;
      const unitCost = lineCost / qty;
      return {
        ...o,
        item_id: outId,
        unit_cost: unitCost,
        line_cost: lineCost,
      };
    });
  }

  private async resolveInventoryUnitCost(
    shopId: string,
    itemId: string,
  ): Promise<number> {
    const sku = normalizeSku(itemId);
    const proj = await this.prisma.inventoryProjection.findUnique({
      where: {
        shop_id_item_id: { shop_id: shopId, item_id: sku },
      },
    });
    if (!proj) return 0;
    // Prefer stored WAC (Michael FEFO/WAC spec)
    let wac = Number(proj.avg_unit_cost ?? 0);
    if (wac > 0 && Number.isFinite(wac)) return wac;
    const stock = Number(proj.available_stock ?? 0);
    const value = Number(proj.total_value ?? 0);
    if (stock > 0 && value > 0) {
      return value / stock;
    }
    return 0;
  }

  private async enrichLinesWithUnitCost(
    shopId: string,
    lines: LineActual[],
  ): Promise<LineActual[]> {
    const out: LineActual[] = [];
    for (const line of lines) {
      const sku = normalizeSku(line.item_id) || line.item_id;
      let unitCost = Math.max(0, line.unit_cost ?? 0);
      if (unitCost <= 0 && sku) {
        unitCost = await this.resolveInventoryUnitCost(shopId, sku);
      }
      const qty = Math.max(0, line.actual_quantity);
      out.push({
        ...line,
        item_id: sku,
        unit_cost: unitCost,
        line_cost: qty * unitCost,
      });
    }
    return out;
  }

  private async assertSufficientStock(
    shopId: string,
    inputs: LineActual[],
  ): Promise<void> {
    const shortages: string[] = [];
    const todayStart = this.shopLocalDayStart(new Date());

    for (const line of inputs) {
      const sku = normalizeSku(line.item_id) || line.item_id;
      if (!sku || line.actual_quantity <= 0) continue;

      // Preserve legacy projection-only stock by creating a single opening lot
      // before checking availability; this does not write off expired stock.
      await this.fefoStock.ensureOpenLots(shopId, sku);
      const proj = await this.prisma.inventoryProjection.findUnique({
        where: { shop_id_item_id: { shop_id: shopId, item_id: sku } },
        include: { item: true },
      });
      const stockUnit = proj?.item?.unit ?? line.unit ?? 'pcs';
      const needUnit = line.unit ?? stockUnit;
      const usableBatches = await this.prisma.inventoryBatch.findMany({
        where: {
          shop_id: shopId,
          item_id: sku,
          qty_remaining: { gt: 0 },
          OR: [{ expiry_date: null }, { expiry_date: { gte: todayStart } }],
        },
        select: { qty_remaining: true },
      });
      const usableBaseQty = usableBatches.reduce((sum, batch) => sum + Number(batch.qty_remaining), 0);
      const usableInNeedUnits = convertQuantity(usableBaseQty, stockUnit, needUnit);
      if (usableInNeedUnits + 1e-9 < line.actual_quantity) {
        shortages.push(`${line.item_name || sku}: need ${line.actual_quantity} ${needUnit}, have ${usableInNeedUnits} ${needUnit} usable (expired batches excluded)`);
      }
    }

    if (shortages.length > 0) {
      throw new BadRequestException(`Insufficient usable stock for production:\n${shortages.join('\n')}`);
    }
  }

  private shopLocalDayStart(now: Date): Date {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const get = (type: string) => parts.find((part) => part.type === type)?.value;
    return new Date(Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))) - 3 * 60 * 60 * 1000);
  }

  private async resolveStartContext(productionId: string): Promise<{
    recipeId?: string;
    itemId?: string;
    itemName?: string;
    plannedQuantity?: number;
    shopId?: string;
  }> {
    const start = await this.prisma.event.findFirst({
      where: {
        event_type: 'production_started',
        OR: [
          { payload: { path: ['production_id'], equals: productionId } },
          { payload: { path: ['productionId'], equals: productionId } },
        ],
      },
      orderBy: { created_at: 'desc' },
    });

    if (!start) {
      return {};
    }

    const p = asRecord(start.payload);

    return {
      recipeId: asString(p.recipe_id) || asString(p.recipeId) || undefined,
      itemId:
        normalizeSku(
          asString(p.item_id) || asString(p.itemId) || asString(start.item_id),
        ) || undefined,
      itemName:
        asString(p.item_name) ||
        asString(p.itemName) ||
        asString(p.recipe_name) ||
        asString(p.recipeName) ||
        undefined,
      plannedQuantity: asNumber(
        p.planned_quantity ??
          p.plannedQuantity ??
          p.batch_size ??
          p.batchSize ??
          start.quantity,
        0,
      ),
      shopId: asString(p.shop_id) || asString(p.shopId) || start.shop_id || '1',
    };
  }

  private async resolveLines(
    dto: FinishProductionDto,
    recipeId: string | undefined,
    itemId: string,
    itemName: string,
    plannedQuantity: number,
  ): Promise<{ inputs: LineActual[]; outputs: LineActual[] }> {
    const mapLine = (l: {
      item_id: string;
      item_name?: string;
      actual_quantity: number;
      unit?: string;
      standard_quantity?: number;
      unit_cost?: number;
      unit_weight?: number;
      weight_unit?: string;
    }): LineActual => ({
      item_id: normalizeSku(l.item_id) || l.item_id,
      item_name: l.item_name,
      actual_quantity: l.actual_quantity,
      unit: l.unit,
      standard_quantity: l.standard_quantity,
      unit_cost: l.unit_cost,
      unit_weight: l.unit_weight,
      weight_unit: l.weight_unit,
    });

    let inputs: LineActual[] = (dto.inputs ?? []).map(mapLine);
    let outputs: LineActual[] = (dto.outputs ?? []).map(mapLine);

    const clientSentOutputs = outputs.length > 0;

    if (recipeId && (inputs.length === 0 || !clientSentOutputs)) {
      try {
        const recipe = await this.recipeService.getRecipeById(recipeId);
        const r = recipe as Record<string, unknown>;
        const standardYield = Math.max(
          asNumber(r.standardYield ?? r.standard_yield, 1),
          0.0001,
        );

        const primaryActual =
          dto.actual_quantity_produced != null &&
          dto.actual_quantity_produced > 0
            ? dto.actual_quantity_produced
            : plannedQuantity > 0
              ? plannedQuantity
              : standardYield;

        const scale = primaryActual / standardYield;

        if (inputs.length === 0) {
          const ingredients = Array.isArray(r.ingredients)
            ? (r.ingredients as Record<string, unknown>[])
            : [];
          inputs = ingredients
            .map((ing) => {
              const perUnit = asNumber(
                ing.quantityPerUnit ?? ing.quantity_per_unit,
                0,
              );
              const std = perUnit * scale;
              const rawId =
                normalizeSku(ing.rawItemId ?? ing.raw_item_id) || '';
              return {
                item_id: rawId,
                item_name: asString(
                  ing.rawItemName ?? ing.raw_item_name ?? ing.name,
                ),
                standard_quantity: std,
                actual_quantity: std,
                unit: asString(ing.unit, 'pcs'),
                unit_cost: asNumber(ing.unitCost ?? ing.unit_cost, 0),
              };
            })
            .filter((l) => l.item_id && l.actual_quantity > 0);
        }

        if (!clientSentOutputs) {
          const outs = Array.isArray(r.outputs)
            ? (r.outputs as Record<string, unknown>[])
            : [];
          if (outs.length > 1) {
            // MULTI-OUTPUT: weights only — actual_quantity stays 0 until client sends counts
            outputs = outs
              .filter((o) => Boolean(o.isActive ?? o.is_active ?? true))
              .map((o) => {
                const outItemId = normalizeSku(o.itemId ?? o.item_id) || itemId;
                const unitWeight = asNumber(o.unitWeight ?? o.unit_weight, 0);
                return {
                  item_id: outItemId,
                  item_name: asString(o.itemName ?? o.item_name, itemName),
                  standard_quantity: 0,
                  actual_quantity: 0,
                  unit: asString(o.unit, 'pcs'),
                  unit_cost: undefined,
                  unit_weight: unitWeight > 0 ? unitWeight : undefined,
                  weight_unit: asString(o.weightUnit ?? o.weight_unit, 'g'),
                };
              })
              .filter((l) => l.item_id);
          } else if (outs.length === 1) {
            const o = outs[0];
            const stdBase = asNumber(
              o.standardQuantity ?? o.standard_quantity,
              standardYield,
            );
            const stdScaled = stdBase * scale;
            const outItemId = normalizeSku(o.itemId ?? o.item_id) || itemId;
            const unitWeight = asNumber(o.unitWeight ?? o.unit_weight, 0);
            outputs = [
              {
                item_id: outItemId,
                item_name: asString(o.itemName ?? o.item_name, itemName),
                standard_quantity: stdScaled,
                actual_quantity: stdScaled,
                unit: asString(o.unit, asString(r.unit, 'pcs')),
                unit_cost: undefined,
                unit_weight: unitWeight > 0 ? unitWeight : undefined,
                weight_unit: asString(o.weightUnit ?? o.weight_unit, 'g'),
              },
            ];
          }
        } else {
          // Client sent outputs — attach weights from recipe when missing
          const outs = Array.isArray(r.outputs)
            ? (r.outputs as Record<string, unknown>[])
            : [];
          const byId = new Map(
            outs.map((o) => [normalizeSku(o.itemId ?? o.item_id) || '', o]),
          );
          outputs = outputs.map((line) => {
            const meta = byId.get(normalizeSku(line.item_id) || line.item_id);
            if (!meta) return line;
            const unitWeight = asNumber(
              meta.unitWeight ?? meta.unit_weight,
              line.unit_weight ?? 0,
            );
            return {
              ...line,
              unit_weight:
                line.unit_weight && line.unit_weight > 0
                  ? line.unit_weight
                  : unitWeight > 0
                    ? unitWeight
                    : undefined,
              weight_unit:
                line.weight_unit ||
                asString(meta.weightUnit ?? meta.weight_unit, 'g'),
            };
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Could not load recipe for prefill: ${message}`);
      }
    }

    if (outputs.length === 0) {
      const qty =
        dto.actual_quantity_produced != null && dto.actual_quantity_produced > 0
          ? dto.actual_quantity_produced
          : plannedQuantity;
      outputs = [
        {
          item_id: itemId,
          item_name: itemName,
          standard_quantity: plannedQuantity || qty,
          actual_quantity: qty,
          unit: 'pcs',
          unit_cost: undefined,
        },
      ];
    }

    return { inputs, outputs };
  }

  private async assertRecipeExists(dto: StartProductionDto): Promise<void> {
    try {
      if (dto.recipe_id) {
        await this.recipeService.getRecipeById(dto.recipe_id);
        return;
      }
      await this.recipeService.getRecipeByItemId(normalizeSku(dto.item_id));
    } catch {
      throw new BadRequestException(
        `No recipe found for "${dto.item_name}" (${dto.item_id}${
          dto.recipe_id ? `, recipe ${dto.recipe_id}` : ''
        }). Create a recipe first.`,
      );
    }
  }
  /**
   * Pre-prep: deduct raw original qty, optional waste for lost, create prepped FG lot.
   * lost = original − yielded (server-only). Cost absorbed into prepped unit cost.
   */
  async prePrep(dto: PrePrepDto, actorUserId: string) {
    const shopId = (dto.shop_id || '1').trim() || '1';
    const rawId = dto.raw_item_id.trim();
    const preppedId = dto.prepped_item_id.trim();
    const originalRaw = Number(dto.original_qty);
    const yieldedRaw = Number(dto.yielded_qty);
    const dtoUnit = (dto.unit && String(dto.unit).trim()) || undefined;

    if (!(originalRaw > 0) || !(yieldedRaw > 0)) {
      throw new BadRequestException('original_qty and yielded_qty must be > 0');
    }
    // Validate input ratio before unit conversion (same dimension)
    if (yieldedRaw > originalRaw) {
      throw new BadRequestException('yielded_qty cannot exceed original_qty');
    }

    const inv = await this.prisma.inventoryProjection.findUnique({
      where: { shop_id_item_id: { shop_id: shopId, item_id: rawId } },
      include: { item: { select: { name: true, unit: true } } },
    });
    if (!inv) {
      throw new BadRequestException(
        `Raw item not in inventory for this shop: ${rawId}. Use the exact Item SKU (item_id).`,
      );
    }
    const onHand = Number(inv.available_stock ?? 0);
    const itemUnit = inv.item?.unit || 'kg';
    // Align to InventoryProjection denomination (Item.unit)
    const original = quantityInItemUnit(
      originalRaw,
      dtoUnit || itemUnit,
      itemUnit,
    );
    const yielded = quantityInItemUnit(
      yieldedRaw,
      dtoUnit || itemUnit,
      itemUnit,
    );
    if (yielded > original) {
      throw new BadRequestException('yielded_qty cannot exceed original_qty');
    }

    const lost = Math.round((original - yielded) * 1000) / 1000;
    const lossPct =
      original > 0 ? Math.round((lost / original) * 1000) / 10 : 0;
    if (lost > 0 && !(dto.loss_reason && dto.loss_reason.trim())) {
      throw new BadRequestException(
        'loss_reason is required when lost weight > 0',
      );
    }

    if (onHand + 1e-9 < original) {
      throw new BadRequestException(
        `Insufficient raw stock for ${rawId}: need ${original}, have ${onHand}`,
      );
    }

    let rawUC = 0;
    const avg = inv.avg_unit_cost != null ? Number(inv.avg_unit_cost) : 0;
    if (avg > 0) {
      rawUC = avg;
    } else if (onHand > 0 && inv.total_value != null) {
      const tv = Number(inv.total_value);
      if (tv > 0) rawUC = tv / onHand;
    }

    const totalRaw = rawUC * original;
    const preppedUC =
      yielded > 0 ? Math.round((totalRaw / yielded) * 10000) / 10000 : 0;
    const unit = (dto.unit && dto.unit.trim()) || inv.item?.unit || 'kg';
    const name =
      (dto.prepped_item_name && dto.prepped_item_name.trim()) || preppedId;
    const note = (dto.note || dto.notes || '').trim() || undefined;
    const batchId = `PREP-${Date.now().toString(36).toUpperCase()}`;
    const idempotencyKey = `pre-prep-${shopId}-${rawId}-${preppedId}-${original}-${yielded}-${actorUserId}`;

    const enforceResult = (await this.idempotencyService.enforce(
      idempotencyKey,
      dto,
    )) as IdempotencyResult;

    if (enforceResult.isReplay && enforceResult.existing) {
      return {
        success: true,
        batchId,
        eventId: enforceResult.existing.id,
        original_qty: original,
        yielded_qty: yielded,
        lost_qty: lost,
        loss_pct: lossPct,
        prepped_unit_cost: preppedUC,
        message: 'Already processed (idempotent replay)',
      };
    }

    const payload: Record<string, unknown> = {
      batch_id: batchId,
      batch_type: 'pre_prep',
      shop_id: shopId,
      shopId,
      raw_item_id: rawId,
      prepped_item_id: preppedId,
      prepped_item_name: name,
      original_qty: original,
      yielded_qty: yielded,
      lost_qty: lost,
      loss_pct: lossPct,
      loss_reason: dto.loss_reason?.trim() || null,
      note: note ?? null,
      method: dto.method?.trim() || null,
      unit,
      raw_unit_cost: rawUC,
      total_raw_cost: totalRaw,
      prepped_unit_cost: preppedUC,
      stock_deductions: [
        { item_id: rawId, quantity: original, unit, unit_cost: rawUC },
      ],
      inputs: [
        {
          item_id: rawId,
          actual_quantity: original,
          quantity: original,
          unit_cost: rawUC,
        },
      ],
      outputs: [
        {
          item_id: preppedId,
          item_name: name,
          quantity: yielded,
          usable_quantity: yielded,
          unit,
          unit_cost: preppedUC,
          total_cost: totalRaw,
          category: 'Finished Goods',
          batch_type: 'pre_prep',
        },
      ],
      status: 'completed',
      completed_at: new Date().toISOString(),
    };

    if (lost > 0) {
      payload.waste = {
        item_id: rawId,
        quantity: lost,
        unit,
        reason: dto.loss_reason?.trim(),
        cause: 'pre_prep',
        value: 0,
        original_qty: original,
        yielded_qty: yielded,
        batch_id: batchId,
      };
    }

    const event = await this.eventStore.appendEvent({
      event_type: 'pre_prep_completed',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      item_id: rawId,
      quantity: original,
      unit_cost: rawUC,
      total_cost: totalRaw,
      batch_number: batchId,
      waste_reason: dto.loss_reason?.trim() || undefined,
      payload,
    });

    return {
      success: true,
      batchId,
      eventId: event.id,
      original_qty: original,
      yielded_qty: yielded,
      lost_qty: lost,
      loss_pct: lossPct,
      prepped_unit_cost: preppedUC,
      total_raw_cost: totalRaw,
      message: 'Pre-prep completed',
    };
  }


}
