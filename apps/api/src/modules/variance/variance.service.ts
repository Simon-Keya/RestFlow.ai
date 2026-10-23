// apps/api/src/modules/variance/variance.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventStoreService } from '../../core/event-store.service';
import type { SubmitReasonDto } from './dto/submit-reason.dto';
import type { FlagBatchDto } from './dto/flag-batch.dto';
import {
  VarianceEngineService,
  type ProductionFinishInput,
  type VarianceComputeResult,
} from './variance-engine.service';

function asString(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

/** Spec: round to 2dp; if 0.00 it is not a variance and must be hidden. */
function isMaterialVariance(qty: number, value?: number): boolean {
  const q = Math.round((Number(qty) || 0) * 100) / 100;
  if (Math.abs(q) >= 0.01) return true;
  if (value != null) {
    const v = Math.round((Number(value) || 0) * 100) / 100;
    return Math.abs(v) >= 0.01;
  }
  return false;
}

@Injectable()
export class VarianceService {
  private readonly logger = new Logger(VarianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStoreService,
    private readonly varianceEngine: VarianceEngineService,
  ) {}

  async createFromProductionFinish(
    input: ProductionFinishInput,
    actorUserId?: string,
  ): Promise<VarianceComputeResult> {
    const computed =
      await this.varianceEngine.computeFromProductionFinish(input);

    const idempotencyKey = `variance-batch-${computed.batch_id}`;

    await this.eventStore.appendEvent({
      event_type: 'variance_batch',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      item_id: computed.product_item_id,
      quantity: computed.variance_qty,
      total_cost: computed.value_affected,
      payload: {
        ...computed,
        lines: computed.lines.map((l) => ({
          ...l,
          itemId: l.item_id,
          itemName: l.item_name,
          expectedQuantity: l.expected_quantity,
          countedQuantity: l.actual_quantity,
          actualQuantity: l.actual_quantity,
          varianceQuantity: l.variance_quantity,
          varianceValue: l.variance_value,
          reasonCode: null,
        })),
        items_counted: computed.lines.length,
        items_flagged: computed.flagged
          ? computed.lines.filter((l) => l.variance_quantity !== 0).length
          : 0,
        total_variance_value: computed.value_affected,
        batch_id: computed.batch_id,
        status: computed.status,
      },
    });

    this.logger.log(
      `Variance batch stored batch_id=${computed.batch_id} flagged=${computed.flagged}`,
    );

    return computed;
  }

  async listBatches(opts: { shopId: string; page: number; pageSize: number }) {
    const take = Math.min(Math.max(opts.pageSize || 25, 1), 100);
    const skip = (Math.max(opts.page || 1, 1) - 1) * take;

    // Prefer dedicated variance_batch events (newest first)
    const events = await this.prisma.event.findMany({
      where: {
        shop_id: opts.shopId,
        event_type: {
          in: [
            'variance_batch',
            'closing_stock_counted',
            'stock_count_completed',
            'VARIANCE_WRITEOFF',
          ],
        },
      },
      select: {
        id: true,
        event_type: true,
        total_cost: true,
        created_at: true,
        payload: true,
        actor: { select: { name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
      take: Math.min(100, skip + take + 20),
    });

    const batches = new Map<string, Record<string, unknown>>();

    for (const e of events) {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const batchId = asString(p.batch_id ?? p.batchId, String(e.id));
      if (batches.has(batchId)) continue;

      const lines = Array.isArray(p.lines) ? p.lines : [];
      const flagged =
        p.flagged === true ||
        lines.some((l) => {
          const row = l as Record<string, unknown>;
          return (
            Number(
              row.varianceQuantity ??
                row.variance_quantity ??
                row.variance_qty ??
                0,
            ) !== 0
          );
        });

      batches.set(batchId, {
        batchId,
        countedBy: e.actor?.name || e.actor?.email || 'system',
        countedAt: e.created_at.toISOString(),
        status: asString(p.status, 'completed'),
        itemsCounted: lines.length || Number(p.items_counted ?? 0),
        itemsFlagged: Number(p.items_flagged ?? (flagged ? 1 : 0)),
        totalVarianceValue: Number(
          p.value_affected ??
            p.total_variance_value ??
            p.totalVarianceValue ??
            e.total_cost ??
            0,
        ),
        variancePct: Number(p.variance_pct ?? 0),
        flagged: Boolean(p.flagged ?? flagged),
        source: asString(p.source, e.event_type),
        productName: asString(p.product_name ?? p.item_name, '') || null,
      });
    }

    // Spec fix #5: hide batches whose variance rounds to 0.00
    const all = Array.from(batches.values()).filter((b) => {
      const vq = Number(b.variancePct ?? 0);
      const vv = Number(b.totalVarianceValue ?? 0);
      // Keep if any material value OR explicitly flagged with non-zero lines
      if (isMaterialVariance(vq, vv)) return true;
      if (b.flagged === true && isMaterialVariance(0, vv)) return true;
      // Keep production variance rows with material qty encoded in totalVarianceValue
      return isMaterialVariance(0, vv);
    });
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

  async getBatch(batchId: string) {
    const events = await this.prisma.event.findMany({
      where: {
        OR: [
          { id: batchId },
          { payload: { path: ['batch_id'], equals: batchId } },
          { payload: { path: ['production_id'], equals: batchId } },
        ],
      },
      select: {
        id: true,
        event_type: true,
        total_cost: true,
        created_at: true,
        payload: true,
        actor: { select: { name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    const e =
      events.find((ev) => ev.event_type === 'variance_batch') || events[0];

    if (!e) {
      throw new NotFoundException(`Batch ${batchId} not found`);
    }

    const p = (e.payload ?? {}) as Record<string, unknown>;
    const lines = Array.isArray(p.lines) ? p.lines : [];

    return {
      batchId: asString(p.batch_id, batchId),
      countedBy: e.actor?.name || e.actor?.email || 'system',
      countedAt: e.created_at.toISOString(),
      status: asString(p.status, 'completed'),
      itemsCounted: lines.length,
      itemsFlagged: Number(p.items_flagged ?? 0),
      totalVarianceValue: Number(
        p.value_affected ?? p.total_variance_value ?? e.total_cost ?? 0,
      ),
      variancePct: Number(p.variance_pct ?? 0),
      flagged: Boolean(p.flagged ?? false),
      reasonCode: (p.reason_code as string) ?? null,
      source: asString(p.source, e.event_type),
      productName: (p.product_name as string) ?? null,
      lines: lines.map((l) => {
        const row = l as Record<string, unknown>;
        return {
          itemId: asString(row.itemId ?? row.item_id),
          itemName: asString(row.itemName ?? row.item_name),
          unit: asString(row.unit, 'pcs'),
          expectedQuantity: Number(
            row.expectedQuantity ?? row.expected_quantity ?? 0,
          ),
          countedQuantity: Number(
            row.countedQuantity ??
              row.actual_quantity ??
              row.actualQuantity ??
              row.counted_qty ??
              0,
          ),
          varianceQuantity: Number(
            row.varianceQuantity ??
              row.variance_quantity ??
              row.variance_qty ??
              0,
          ),
          varianceValue: Number(row.varianceValue ?? row.variance_value ?? 0),
          reasonCode: (row.reasonCode ?? row.reason_code ?? null) as
            | string
            | null,
        };
      }),
    };
  }

  async submitReason(
    batchId: string,
    dto: SubmitReasonDto,
    actorUserId: string,
  ) {
    const event = await this.eventStore.appendEvent({
      event_type: 'variance_reason_submitted',
      actor_user_id: actorUserId,
      idempotency_key: `variance-reason-${batchId}-${dto.itemId}-${dto.reasonCode}`,
      item_id: dto.itemId,
      payload: {
        batch_id: batchId,
        item_id: dto.itemId,
        reason_code: dto.reasonCode,
        note: dto.note ?? null,
        submitted_at: new Date().toISOString(),
      },
    });

    return {
      success: true,
      eventId: event.id,
      batchId,
      itemId: dto.itemId,
      reasonCode: dto.reasonCode,
    };
  }

  async flagBatch(batchId: string, dto: FlagBatchDto, actorUserId: string) {
    const event = await this.eventStore.appendEvent({
      event_type: 'variance_flagged',
      actor_user_id: actorUserId,
      idempotency_key: `variance-flag-${batchId}-${dto.flagged}`,
      payload: {
        batch_id: batchId,
        flagged: dto.flagged,
        note: dto.note ?? null,
        flagged_at: new Date().toISOString(),
      },
    });

    return {
      success: true,
      eventId: event.id,
      batchId,
      flagged: dto.flagged,
    };
  }
}
