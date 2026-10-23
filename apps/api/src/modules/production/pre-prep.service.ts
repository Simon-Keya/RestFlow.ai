// apps/api/src/modules/production/pre-prep.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { EventStoreService } from '../../core/event-store.service';
import { PrismaService } from '../../../prisma/prisma.service';

export type PrePrepLossReason =
  | 'thaw_drip'
  | 'peel'
  | 'trim'
  | 'bone_skin'
  | 'spoiled_on_prep'
  | 'other';

export interface PrePrepInput {
  shop_id?: string;
  raw_item_id: string;
  prepped_item_id: string;
  prepped_item_name?: string;
  original_qty: number;
  yielded_qty: number;
  loss_reason?: PrePrepLossReason;
  note?: string;
  unit?: string;
  method?: string;
}

@Injectable()
export class PrePrepService {
  private readonly logger = new Logger(PrePrepService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStoreService,
  ) {}

  async run(dto: PrePrepInput, actorUserId: string) {
    const shopId = (dto.shop_id || '1').trim();
    const rawId = dto.raw_item_id?.trim();
    const preppedId = dto.prepped_item_id?.trim();
    const original = Number(dto.original_qty);
    const yielded = Number(dto.yielded_qty);

    if (!rawId || !preppedId) {
      throw new BadRequestException('raw_item_id and prepped_item_id are required');
    }
    if (!(original > 0) || !(yielded > 0)) {
      throw new BadRequestException('original_qty and yielded_qty must be > 0');
    }
    if (yielded > original) {
      throw new BadRequestException('yielded_qty cannot exceed original_qty');
    }

    const lost = Math.round((original - yielded) * 1000) / 1000;
    const lossPct = original > 0 ? Math.round((lost / original) * 1000) / 10 : 0;

    if (lost > 0 && !dto.loss_reason) {
      throw new BadRequestException(
        'loss_reason is required when lost weight > 0',
      );
    }

    const inv = await this.prisma.inventoryProjection.findUnique({
      where: { shop_id_item_id: { shop_id: shopId, item_id: rawId } },
    });
    const onHand = Number(inv?.available_stock ?? 0);
    if (onHand + 1e-9 < original) {
      throw new BadRequestException(
        `Insufficient raw stock for ${rawId}: need ${original}, have ${onHand}`,
      );
    }

    let rawUnitCost = Number(inv?.avg_unit_cost ?? 0);
    if (!(rawUnitCost > 0) && onHand > 0) {
      rawUnitCost = Number(inv?.total_value ?? 0) / onHand;
    }
    const totalRawCost = rawUnitCost * original;
    const preppedUnitCost =
      yielded > 0 ? Math.round((totalRawCost / yielded) * 10000) / 10000 : 0;

    const batchId = `PREP-${Date.now().toString(36).toUpperCase()}`;
    const unit = dto.unit || 'kg';
    const idem = `pre-prep-${shopId}-${rawId}-${preppedId}-${original}-${yielded}-${actorUserId}`;

    const payload = {
      batch_id: batchId,
      batch_type: 'pre_prep',
      shop_id: shopId,
      raw_item_id: rawId,
      prepped_item_id: preppedId,
      prepped_item_name: dto.prepped_item_name || preppedId,
      original_qty: original,
      yielded_qty: yielded,
      lost_qty: lost,
      loss_pct: lossPct,
      loss_reason: dto.loss_reason ?? null,
      note: dto.note ?? null,
      method: dto.method ?? null,
      unit,
      raw_unit_cost: rawUnitCost,
      total_raw_cost: totalRawCost,
      prepped_unit_cost: preppedUnitCost,
      stock_deductions: [
        { item_id: rawId, quantity: original, unit, unit_cost: rawUnitCost },
      ],
      outputs: [
        {
          item_id: preppedId,
          item_name: dto.prepped_item_name || preppedId,
          quantity: yielded,
          unit,
          unit_cost: preppedUnitCost,
          total_cost: totalRawCost,
          category: 'Finished Goods',
          batch_type: 'pre_prep',
        },
      ],
      waste:
        lost > 0
          ? {
              item_id: rawId,
              quantity: lost,
              unit,
              reason: dto.loss_reason,
              cause: 'pre_prep',
              value: 0,
              original_qty: original,
              yielded_qty: yielded,
              batch_id: batchId,
            }
          : null,
      status: 'completed',
      completed_at: new Date().toISOString(),
    };

    const event = await this.eventStore.appendEvent({
      event_type: 'pre_prep_completed',
      actor_user_id: actorUserId,
      idempotency_key: idem,
      item_id: rawId,
      quantity: original,
      unit_cost: rawUnitCost,
      total_cost: totalRawCost,
      batch_number: batchId,
      waste_reason: dto.loss_reason,
      payload,
    });

    this.logger.log(
      `Pre-prep ${batchId}: ${rawId} -${original} → ${preppedId} +${yielded} (lost ${lost})`,
    );

    return {
      success: true,
      batchId,
      eventId: event.id,
      original_qty: original,
      yielded_qty: yielded,
      lost_qty: lost,
      loss_pct: lossPct,
      prepped_unit_cost: preppedUnitCost,
      total_raw_cost: totalRawCost,
      message: 'Pre-prep completed',
    };
  }
}
