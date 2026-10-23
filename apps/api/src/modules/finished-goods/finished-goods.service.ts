// apps/api/src/modules/finished-goods/finished-goods.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventStoreService } from '../../core/event-store.service';
import { IdempotencyService } from '../../core/idempotency.service';
import { WasteService } from '../waste/waste.service';
import { FinishedGoodsGateway } from './finished-goods.gateway';
import type { CreateFinishedGoodDto } from './dto/create-finished-good.dto';
import type { AdjustFinishedGoodDto } from './dto/adjust-finished-good.dto';
import type { RecordWasteDto } from '../waste/dto/record-waste.dto';

@Injectable()
export class FinishedGoodsService {
  private readonly logger = new Logger(FinishedGoodsService.name);

  constructor(
    private readonly eventStore: EventStoreService,
    private readonly idempotencyService: IdempotencyService,
    private readonly wasteService: WasteService,
    private readonly finishedGoodsGateway: FinishedGoodsGateway,
  ) {}

  async addFinishedGoods(dto: CreateFinishedGoodDto, actorUserId: string) {
    const idempotencyKey = `fg-add-${dto.item_id}-${dto.batch_number}`;

    const { isReplay, existing } =
      await this.idempotencyService.enforce(idempotencyKey, dto);

    if (isReplay) {
      return {
        success: true,
        eventId: existing?.id,
        message: 'Already processed (idempotent replay)',
      };
    }

    const event = await this.eventStore.appendEvent({
      event_type: 'finished_good_added',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      batch_number: dto.batch_number,
      expiry_date: dto.expiry_date ? new Date(dto.expiry_date) : undefined,
      item_id: dto.item_id,
      quantity: dto.quantity,
      unit_cost: dto.unit_cost,
      total_cost: dto.total_cost ?? dto.quantity * dto.unit_cost,
      payload: {
        ...dto,
        status: 'available',
      },
    });

    this.finishedGoodsGateway.broadcastStockUpdate(
      dto.item_id,
      dto.quantity,
      dto.batch_number,
    );

    this.logger.log(
      `Finished goods added: ${dto.quantity} of ${dto.item_name} (Batch: ${dto.batch_number})`,
    );

    return {
      success: true,
      eventId: event.id,
      message: 'Finished goods recorded successfully',
    };
  }

  async adjustStock(dto: AdjustFinishedGoodDto, actorUserId: string) {
    const idempotencyKey = `fg-adjust-${dto.item_id}-${dto.batch_number}-${dto.reason}-${dto.adjustment_quantity}`;

    const { isReplay, existing } =
      await this.idempotencyService.enforce(idempotencyKey, dto);

    if (isReplay) {
      return {
        success: true,
        eventId: existing?.id,
        message: 'Already processed (idempotent replay)',
      };
    }

    const event = await this.eventStore.appendEvent({
      event_type: 'finished_good_adjusted',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      batch_number: dto.batch_number,
      item_id: dto.item_id,
      quantity: dto.adjustment_quantity,
      payload: { ...dto },
    });

    const wasteReasons = [
      'damage',
      'spoilage',
      'expired',
      'theft',
      'shrinkage',
      'quality_reject',
    ];

    if (
      wasteReasons.includes(dto.reason.toLowerCase()) &&
      dto.adjustment_quantity < 0
    ) {
      const wasteQuantity = Math.abs(dto.adjustment_quantity);
      const unitCost =
        (dto as AdjustFinishedGoodDto & { unit_cost?: number }).unit_cost ?? 0;
      const itemName =
        (dto as AdjustFinishedGoodDto & { item_name?: string }).item_name ||
        dto.item_id;

      const wastePayload: RecordWasteDto = {
        module_source: 'finished_goods',
        item_id: dto.item_id,
        item_name: itemName,
        batch_number: dto.batch_number,
        quantity_wasted: wasteQuantity,
        unit_of_measure: 'units',
        unit_cost: unitCost,
        total_waste_value: wasteQuantity * unitCost,
        waste_type: this.mapReasonToWasteType(dto.reason),
        waste_reason: dto.notes || dto.reason,
        root_cause:
          dto.reason.toLowerCase() === 'theft' ? 'external' : 'preventable',
        severity: wasteQuantity > 50 ? 'high' : 'medium',
        photos: [], // required by inferred Zod output type
      };

      await this.wasteService.recordWaste(wastePayload, actorUserId);
    }

    this.finishedGoodsGateway.broadcastStockUpdate(
      dto.item_id,
      dto.adjustment_quantity,
      dto.batch_number,
    );

    return {
      success: true,
      eventId: event.id,
      message: 'Stock adjusted successfully',
    };
  }

  private mapReasonToWasteType(
    reason: string,
  ): RecordWasteDto['waste_type'] {
    const lower = reason.toLowerCase();
    if (lower.includes('spoil') || lower.includes('expire')) return 'spoilage';
    if (lower.includes('damage')) return 'damage';
    if (lower.includes('theft')) return 'theft';
    if (lower.includes('shrink')) return 'shrinkage';
    return 'quality_reject';
  }
}