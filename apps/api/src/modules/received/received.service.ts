// apps/api/src/modules/received/received.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventStoreService } from '../../core/event-store.service';
import { IdempotencyService } from '../../core/idempotency.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { WasteService } from '../waste/waste.service';
import { normalizeIngredientCategory } from '../../common/constants/ingredient-categories';
import { normalizeSku } from '../../common/utils/sku.util';
import {
  toCanonicalStockQty,
  scaleFactorForUnitChange,
  canonicalStorageUnit,
} from '../../common/utils/stock-units';
import type { ReceiveGoodsDto } from './dto/receive-goods.dto';

interface IdempotencyResult {
  isReplay: boolean;
  existing: { id: string; payload?: unknown } | null;
}

@Injectable()
export class ReceivedService {
  private readonly logger = new Logger(ReceivedService.name);

  constructor(
    private readonly eventStore: EventStoreService,
    private readonly idempotencyService: IdempotencyService,
    private readonly prisma: PrismaService,
    private readonly wasteService: WasteService,
  ) {}

  async receiveGoods(dto: ReceiveGoodsDto, actorUserId: string) {
    const itemId = normalizeSku(dto.item_id);
    if (!itemId) {
      throw new BadRequestException('item_id is required');
    }

    const approvedQuantityRaw = dto.quantity_approved ?? dto.quantity;
    const rejectedQuantityRaw = dto.quantity_rejected ?? 0;
    const inputUnit = dto.units || 'pcs';
    const inputUnitCost = Number(dto.unit_cost) || 0;

    // Canonical storage: kg→g, L→ml (qty ×1000, cost ÷1000); pcs unchanged
    const approvedNorm = toCanonicalStockQty(
      approvedQuantityRaw,
      inputUnit,
      inputUnitCost,
    );
    const rejectedNorm = toCanonicalStockQty(
      rejectedQuantityRaw,
      inputUnit,
      inputUnitCost,
    );
    const approvedQuantity = approvedNorm.quantity;
    const rejectedQuantity = rejectedNorm.quantity;
    const storageUnit = approvedNorm.unit;
    const unitCost = approvedNorm.unitCost;
    const finalTotalCost =
      dto.total_cost ?? approvedQuantity * unitCost;
    const category =
      normalizeIngredientCategory(dto.category) ?? dto.category?.trim();

    const idempotencyKey = `receive-${itemId}-${dto.batch_number}-${dto.date_received}`;

    const result = (await this.idempotencyService.enforce(idempotencyKey, {
      ...dto,
      item_id: itemId,
    })) as IdempotencyResult;

    if (result.isReplay) {
      return {
        success: true,
        eventId: result.existing?.id,
        message: 'Already processed (idempotent replay)',
      };
    }

    await this.ensureItemExists(itemId, dto.item_name, storageUnit, category);

    const event = await this.eventStore.appendEvent({
      event_type: 'received',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      batch_number: dto.batch_number,
      expiry_date: dto.expiry_date ? new Date(dto.expiry_date) : undefined,
      waste_reason: dto.waste_reason,
      waste_photo_url: dto.waste_photo_url,
      item_id: itemId,
      quantity: approvedQuantity,
      unit_cost: unitCost,
      total_cost: finalTotalCost,
      payload: {
        ...(dto.payload && typeof dto.payload === 'object' ? dto.payload : {}),
        item_id: itemId,
        item_name: dto.item_name,
        units: storageUnit,
        units_input: inputUnit,
        category: category ?? null,
        quantity: approvedQuantity,
        quantity_input: dto.quantity,
        quantity_approved: approvedQuantity,
        quantity_rejected: rejectedQuantity,
        date_received: dto.date_received,
        expiry_date: dto.expiry_date,
        unit_cost: unitCost,
        unit_cost_input: inputUnitCost,
        total_cost: finalTotalCost,
        units_normalized: approvedNorm.converted,
        supplier_name: dto.supplier_name,
        supplier_number: dto.supplier_number,
        supplier_id: dto.supplier_id,
        approved_by: dto.approved_by,
        batch_number: dto.batch_number,
        reference: dto.reference,
        waste_reason: dto.waste_reason,
        waste_photo_url: dto.waste_photo_url,
      },
    });

    if (rejectedQuantity > 0) {
      await this.wasteService.recordWaste(
        {
          module_source: 'received',
          item_id: itemId,
          item_name: dto.item_name,
          batch_number: dto.batch_number,
          quantity_wasted: rejectedQuantity,
          unit_of_measure: storageUnit,
          unit_cost: unitCost,
          total_waste_value: rejectedQuantity * unitCost,
          waste_type: 'quality_reject',
          waste_reason: dto.waste_reason || 'Rejected on receipt',
          root_cause: 'external',
          severity: rejectedQuantity > 20 ? 'high' : 'medium',
          photos: dto.waste_photo_url ? [dto.waste_photo_url] : [],
        },
        actorUserId,
      );
    }

    this.logger.log(
      `GRN: ${approvedQuantity} ${storageUnit} of ${dto.item_name}` +
        (category ? ` [${category}]` : ''),
    );

    return {
      success: true,
      eventId: event.id,
      message:
        rejectedQuantity > 0
          ? 'Goods received; rejected quantity recorded as waste'
          : 'Goods received successfully',
    };
  }

  private async ensureItemExists(
    itemId: string,
    itemName: string,
    unit: string,
    category?: string,
  ) {
    const id = normalizeSku(itemId);
    if (!id) {
      throw new BadRequestException('item_id is required');
    }

    const existing = await this.prisma.item.findUnique({
      where: { item_id: id },
    });

    const normalizedCategory =
      (normalizeIngredientCategory(category) ?? category?.trim()) || undefined;

    if (!existing) {
      if (!normalizedCategory) {
        throw new BadRequestException(
          'Category is required when creating a new item on receive',
        );
      }

      await this.prisma.item.create({
        data: {
          item_id: id,
          name: itemName,
          unit: unit || 'units',
          category: normalizedCategory,
        },
      });

      this.logger.log(
        `Auto-created Item: ${id} - ${itemName} (${normalizedCategory})`,
      );
      return;
    }

    const data: {
      name?: string;
      unit?: string;
      category?: string;
    } = {};

    if (itemName && itemName !== existing.name) {
      data.name = itemName;
    }
    if (unit && unit !== existing.unit) {
      data.unit = unit;
      // Scale on-hand when moving kg→g or L→ml so physical stock is unchanged
      const factor = scaleFactorForUnitChange(existing.unit, unit);
      if (factor !== 1) {
        await this.scaleAllProjectionsForItem(id, factor, unit);
      }
    }
    if (
      normalizedCategory &&
      (!existing.category ||
        existing.category === 'General' ||
        existing.category !== normalizedCategory)
    ) {
      data.category = normalizedCategory;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.item.update({
        where: { item_id: id },
        data,
      });
    }
  }
  /**
   * When Item.unit changes kg→g (×1000) or L→ml (×1000), scale every shop's
   * InventoryProjection for that SKU. total_value unchanged; avg_unit_cost ÷ factor.
   */
  private async scaleAllProjectionsForItem(
    itemId: string,
    factor: number,
    newUnit: string,
  ): Promise<void> {
    if (!(factor > 0) || factor === 1) return;
    const rows = await this.prisma.inventoryProjection.findMany({
      where: { item_id: itemId },
    });
    for (const row of rows) {
      const prevQty = Number(row.available_stock ?? 0);
      const prevVal = Number(row.total_value ?? 0);
      const nextQty = prevQty * factor;
      let nextAvg: number | undefined;
      if (nextQty > 0 && prevVal > 0) {
        nextAvg = prevVal / nextQty;
      } else if (row.avg_unit_cost != null) {
        nextAvg = Number(row.avg_unit_cost) / factor;
      }
      await this.prisma.inventoryProjection.update({
        where: {
          shop_id_item_id: { shop_id: row.shop_id, item_id: itemId },
        },
        data: {
          available_stock: nextQty,
          ...(nextAvg != null && Number.isFinite(nextAvg)
            ? { avg_unit_cost: nextAvg }
            : {}),
        },
      });
      this.logger.log(
        `Scaled projection ${itemId}@${row.shop_id}: ${prevQty} → ${nextQty} (${newUnit})`,
      );
    }
  }

}
