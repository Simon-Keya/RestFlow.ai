// apps/api/src/modules/refill/refill.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventStoreService } from '../../core/event-store.service';
import { IdempotencyService } from '../../core/idempotency.service';
import { RefillGateway } from './refill.gateway';
import type { RefillRequestDto } from './dto/refill-request.dto';
import type { RefillIssueDto } from './dto/refill-issue.dto';

interface IdempotencyResult {
  isReplay: boolean;
  existing: { id: string } | null;
}

const DEFAULT_REORDER_POINT = 10;

function asDisplayString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value == null) return fallback;
  return fallback;
}

@Injectable()
export class RefillService {
  private readonly logger = new Logger(RefillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStoreService,
    private readonly idempotencyService: IdempotencyService,
    private readonly refillGateway: RefillGateway,
  ) {}

  async getPending(shopId: string = '1') {
    const events = await this.eventStore.getAllEvents({ take: 2000 });
    const pendingMap = new Map<string, Record<string, unknown>>();
    /** Suggestion ids already fulfilled — do not show again as pending */
    const issuedSuggestionIds = new Set<string>();

    for (const e of events) {
      if (e.shop_id && e.shop_id !== shopId) continue;

      const payload = (e.payload ?? {}) as Record<string, unknown>;
      const requestId =
        typeof payload.request_id === 'string'
          ? payload.request_id
          : typeof payload.requestId === 'string'
            ? payload.requestId
            : undefined;
      if (!requestId) continue;

      if (e.event_type === 'refill_requested') {
        const qty = Number(
          payload.requested_qty ?? payload.quantity ?? e.quantity ?? 0,
        );
        const itemName = asDisplayString(
          payload.item_name ?? payload.itemName,
          '',
        );

        pendingMap.set(requestId, {
          request_id: requestId,
          requestId,
          item_id: e.item_id ?? payload.item_id ?? null,
          item_name: itemName,
          itemName,
          requested_qty: qty,
          quantity: qty,
          unit: asDisplayString(payload.units ?? payload.unit, 'pcs'),
          status: 'pending',
          source: 'request',
          requestedBy: asDisplayString(payload.requested_by, 'staff'),
          requestedAt: e.created_at,
          created_at: e.created_at,
        });
      }

      if (e.event_type === 'refill_issued') {
        pendingMap.delete(requestId);
        if (requestId.startsWith('SUGGEST-')) {
          issuedSuggestionIds.add(requestId);
        }
      }

      if (e.event_type === 'refill_cancelled') {
        pendingMap.delete(requestId);
      }
    }

    const items = Array.from(pendingMap.values());

    const pendingItemIds = new Set(
      items
        .map((i) => {
          const itemId = i.item_id ?? i.itemId;
          return typeof itemId === 'string' || typeof itemId === 'number'
            ? String(itemId)
            : '';
        })
        .filter(Boolean),
    );

    const stockRows = await this.prisma.inventoryProjection.findMany({
      where: { shop_id: shopId },
      include: {
        item: {
          select: {
            name: true,
            unit: true,
            reorder_point: true,
          },
        },
      },
      orderBy: { available_stock: 'asc' },
      take: 200,
    });

    const suggestions: Record<string, unknown>[] = [];

    for (const row of stockRows) {
      const available = Number(row.available_stock ?? 0);
      const reorder =
        row.item?.reorder_point != null && Number(row.item.reorder_point) > 0
          ? Number(row.item.reorder_point)
          : DEFAULT_REORDER_POINT;

      if (available > reorder) continue;
      if (pendingItemIds.has(row.item_id)) continue;

      const suggestId = `SUGGEST-${row.item_id}`;
      if (issuedSuggestionIds.has(suggestId)) continue;

      const suggestedQty = Math.max(1, Math.ceil(reorder * 2 - available));
      const name = row.item?.name ?? row.item_id;
      const unit = row.item?.unit ?? 'pcs';

      suggestions.push({
        request_id: suggestId,
        requestId: suggestId,
        item_id: row.item_id,
        item_name: name,
        itemName: name,
        requested_qty: suggestedQty,
        quantity: suggestedQty,
        unit,
        status: 'suggested',
        source: 'low_stock',
        available_stock: available,
        reorder_point: reorder,
        requestedBy: 'system',
        requestedAt: row.updated_at,
        created_at: row.updated_at,
      });
    }

    const all = [...items, ...suggestions];

    return {
      success: true,
      items: all,
      data: all,
      count: all.length,
      pendingCount: items.length,
      suggestedCount: suggestions.length,
    };
  }

  async getDetail(requestId: string, shopId: string = '1') {
    const isSuggestion = requestId.startsWith('SUGGEST-');
    const events = await this.eventStore.getAllEvents({ take: 3000 });

    const timeline: Array<{
      type: string;
      at: string;
      actorUserId: string | null;
      quantity: number | null;
      batchNumber: string | null;
      expiryDate: string | null;
      notes: string | null;
    }> = [];

    let itemId: string | null = isSuggestion
      ? requestId.replace(/^SUGGEST-/, '')
      : null;
    let itemName = '';
    let unit = 'pcs';
    let status: 'pending' | 'issued' | 'cancelled' | 'suggested' = isSuggestion
      ? 'suggested'
      : 'pending';
    let requestedQty: number | null = null;
    let issuedQty: number | null = null;
    let batchNumber: string | null = null;
    let expiryDate: string | null = null;
    let source = isSuggestion ? 'low_stock' : 'request';

    for (const e of events) {
      if (e.shop_id && e.shop_id !== shopId) continue;
      const payload = (e.payload ?? {}) as Record<string, unknown>;
      const rid =
        typeof payload.request_id === 'string'
          ? payload.request_id
          : typeof payload.requestId === 'string'
            ? payload.requestId
            : undefined;
      if (rid !== requestId) continue;

      const qty = Number(
        payload.issued_qty ??
          payload.requested_qty ??
          payload.quantity ??
          e.quantity ??
          0,
      );

      timeline.push({
        type: e.event_type,
        at: e.created_at.toISOString(),
        actorUserId: e.actor_user_id ?? null,
        quantity: Number.isFinite(qty) && qty > 0 ? qty : null,
        batchNumber:
          typeof payload.batch_number === 'string'
            ? payload.batch_number
            : (e.batch_number ?? null),
        expiryDate:
          typeof payload.expiry_date === 'string'
            ? payload.expiry_date
            : e.expiry_date
              ? e.expiry_date.toISOString().slice(0, 10)
              : null,
        notes: typeof payload.notes === 'string' ? payload.notes : null,
      });

      if (e.event_type === 'refill_requested') {
        itemId = (e.item_id ?? payload.item_id ?? itemId) as string | null;
        itemName = asDisplayString(
          payload.item_name ?? payload.itemName,
          itemName,
        );
        unit = asDisplayString(payload.units ?? payload.unit, unit);
        requestedQty = qty > 0 ? qty : requestedQty;
        status = 'pending';
        source = 'request';
      }
      if (e.event_type === 'refill_issued') {
        itemId = (e.item_id ?? payload.item_id ?? itemId) as string | null;
        itemName = asDisplayString(
          payload.item_name ?? payload.itemName,
          itemName,
        );
        issuedQty = qty > 0 ? qty : issuedQty;
        batchNumber =
          typeof payload.batch_number === 'string'
            ? payload.batch_number
            : (e.batch_number ?? batchNumber);
        expiryDate =
          typeof payload.expiry_date === 'string'
            ? payload.expiry_date
            : e.expiry_date
              ? e.expiry_date.toISOString().slice(0, 10)
              : expiryDate;
        status = 'issued';
      }
      if (e.event_type === 'refill_cancelled') {
        status = 'cancelled';
      }
    }

    if (itemId) {
      const item = await this.prisma.item.findUnique({
        where: { item_id: itemId },
        select: { name: true, unit: true },
      });
      if (item) {
        if (!itemName) itemName = item.name;
        unit = item.unit || unit;
      }
    }

    if (isSuggestion && status === 'suggested' && itemId) {
      requestedQty = await this.suggestQtyForItem(itemId, shopId);
      if (!itemName) itemName = itemId;
    }

    let availableStock: number | null = null;
    let unitCost = 0;
    let totalValue = 0;
    let nextExpiryDate: string | null = null;
    let daysToExpiryMin: number | null = null;

    if (itemId) {
      const proj = await this.prisma.inventoryProjection.findUnique({
        where: {
          shop_id_item_id: { shop_id: shopId, item_id: itemId },
        },
      });
      availableStock = proj ? Number(proj.available_stock ?? 0) : null;
      totalValue = Number(proj?.total_value ?? 0);
      const stock = Number(proj?.available_stock ?? 0);
      if (stock > 0 && totalValue > 0) unitCost = totalValue / stock;
      if (proj?.next_expiry_date) {
        nextExpiryDate = proj.next_expiry_date.toISOString().slice(0, 10);
      }
      if (
        proj?.days_to_expiry_min !== null &&
        proj?.days_to_expiry_min !== undefined
      ) {
        daysToExpiryMin = Number(proj.days_to_expiry_min);
      }
    }

    timeline.sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );

    return {
      requestId,
      shopId,
      status,
      source,
      itemId,
      itemName,
      unit,
      requestedQty,
      issuedQty,
      batchNumber,
      expiryDate,
      availableStock,
      totalValue,
      unitCost,
      nextExpiryDate,
      daysToExpiryMin,
      timeline,
    };
  }

  async requestRefill(dto: RefillRequestDto, actorUserId: string) {
    const requestId = `REF-${dto.item_id}-${Date.now().toString(36)}`;
    const idempotencyKey = `refill-request-${dto.item_id}-${dto.requested_qty}-${actorUserId}-${Date.now().toString(36)}`;

    const result = (await this.idempotencyService.enforce(
      idempotencyKey,
      dto,
    )) as IdempotencyResult;

    if (result.isReplay && result.existing) {
      return {
        success: true,
        requestId,
        eventId: result.existing.id,
        message: 'Already processed (idempotent replay)',
      };
    }

    const event = await this.eventStore.appendEvent({
      event_type: 'refill_requested',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      item_id: dto.item_id,
      quantity: dto.requested_qty,
      payload: {
        request_id: requestId,
        item_id: dto.item_id,
        item_name: dto.item_name,
        units: dto.units,
        requested_qty: dto.requested_qty,
        notes: dto.notes,
        ...(dto.payload ?? {}),
      },
    });

    this.logger.log(
      `Refill requested ${dto.item_name} qty=${dto.requested_qty}`,
    );

    return {
      success: true,
      requestId,
      eventId: event.id,
      message: 'Refill requested',
    };
  }

  async issueRefill(dto: RefillIssueDto, actorUserId: string) {
    const shopId = dto.shop_id || '1';
    const isSuggestion = dto.request_id.startsWith('SUGGEST-');
    const pending = isSuggestion
      ? null
      : await this.findPendingRequest(dto.request_id);

    let itemId =
      (pending?.item_id as string | undefined) ??
      (typeof pending?.itemId === 'string' ? pending.itemId : undefined);

    if (!itemId && isSuggestion) {
      itemId = dto.request_id.replace(/^SUGGEST-/, '');
    }

    let approvedQty = Number(
      dto.approved_qty ??
        dto.issued_qty ??
        pending?.requested_qty ??
        pending?.quantity ??
        0,
    );

    if ((!Number.isFinite(approvedQty) || approvedQty <= 0) && itemId) {
      approvedQty = await this.suggestQtyForItem(itemId, shopId);
    }

    if (!Number.isFinite(approvedQty) || approvedQty <= 0) {
      throw new BadRequestException(
        'approved_qty is required (or pending request must have a quantity)',
      );
    }

    if (!itemId) {
      throw new BadRequestException(
        'Could not resolve item_id for this refill request',
      );
    }

    const issuedQty = Number(
      dto.issued_qty != null && Number(dto.issued_qty) > 0
        ? dto.issued_qty
        : approvedQty,
    );
    const lostWeight = dto.lost_weight ?? 0;

    const batchNumber =
      dto.batch_number?.trim() ||
      `REFILL-${dto.request_id.slice(-8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const expirySource = dto.expiry_date;
    if (
      expirySource == null ||
      (typeof expirySource === 'string' && !expirySource.trim())
    ) {
      throw new BadRequestException(
        'expiry_date is required (YYYY-MM-DD) when issuing a refill',
      );
    }

    let expiryDate: Date;
    if (expirySource instanceof Date) {
      expiryDate = expirySource;
    } else {
      expiryDate = new Date(expirySource);
    }
    if (Number.isNaN(expiryDate.getTime())) {
      throw new BadRequestException('Invalid expiry_date');
    }

    const expiryStr = expiryDate.toISOString().slice(0, 10);
    const idempotencyKey = `refill-issue-${dto.request_id}`;

    const result = (await this.idempotencyService.enforce(
      idempotencyKey,
      dto,
    )) as IdempotencyResult;

    if (result.isReplay && result.existing) {
      return {
        success: true,
        eventId: result.existing.id,
        message: 'Already processed (idempotent replay)',
      };
    }

    const itemRow = await this.prisma.item.findUnique({
      where: { item_id: itemId },
      select: { name: true, unit: true },
    });

    const itemName =
      asDisplayString(pending?.item_name ?? pending?.itemName) ||
      itemRow?.name ||
      itemId;

    const units = itemRow?.unit || 'pcs';

    let unitCost =
      dto.unit_cost != null && Number.isFinite(Number(dto.unit_cost))
        ? Number(dto.unit_cost)
        : 0;

    if (unitCost <= 0) {
      const proj = await this.prisma.inventoryProjection.findUnique({
        where: {
          shop_id_item_id: { shop_id: shopId, item_id: itemId },
        },
      });
      const stock = Number(proj?.available_stock ?? 0);
      const value = Number(proj?.total_value ?? 0);
      if (stock > 0 && value > 0) {
        unitCost = value / stock;
      }
    }

    const totalCost = unitCost > 0 ? unitCost * issuedQty : 0;

    const event = await this.eventStore.appendEvent({
      event_type: 'refill_issued',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      item_id: itemId,
      batch_number: batchNumber,
      expiry_date: expiryDate,
      quantity: issuedQty,
      unit_cost: unitCost > 0 ? unitCost : undefined,
      total_cost: totalCost > 0 ? totalCost : undefined,
      payload: {
        request_id: dto.request_id,
        item_id: itemId,
        item_name: itemName,
        approved_qty: approvedQty,
        issued_qty: issuedQty,
        lost_weight: lostWeight,
        unit_cost: unitCost,
        total_cost: totalCost,
        variance_reason: dto.variance_reason,
        batch_number: batchNumber,
        expiry_date: expiryStr,
        notes: dto.notes,
        source: isSuggestion ? 'low_stock_suggestion' : 'request',
        quantity: issuedQty,
        units,
        shop_id: shopId,
        ...(dto.payload ?? {}),
      },
    });

    try {
      this.refillGateway.broadcastRefillIssued({
        request_id: dto.request_id,
        issued_qty: issuedQty,
        lost_weight: lostWeight,
        status: 'issued',
        timestamp: new Date().toISOString(),
      });
    } catch {
      // gateway optional
    }

    this.logger.log(
      `Refill issued request=${dto.request_id} item=${itemId} qty=${issuedQty} unit_cost=${unitCost} batch=${batchNumber}`,
    );

    return {
      success: true,
      eventId: event.id,
      item_id: itemId,
      batch_number: batchNumber,
      issued_qty: issuedQty,
      unit_cost: unitCost,
      total_cost: totalCost,
      message: 'Refill issued successfully',
    };
  }

  private async suggestQtyForItem(
    itemId: string,
    shopId: string,
  ): Promise<number> {
    const row = await this.prisma.inventoryProjection.findUnique({
      where: {
        shop_id_item_id: { shop_id: shopId, item_id: itemId },
      },
      include: {
        item: { select: { reorder_point: true } },
      },
    });

    const available = Number(row?.available_stock ?? 0);
    const reorder =
      row?.item?.reorder_point != null && Number(row.item.reorder_point) > 0
        ? Number(row.item.reorder_point)
        : DEFAULT_REORDER_POINT;

    return Math.max(1, Math.ceil(reorder * 2 - available));
  }

  private async findPendingRequest(
    requestId: string,
  ): Promise<Record<string, unknown> | null> {
    const events = await this.eventStore.getAllEvents({ take: 2000 });
    let found: Record<string, unknown> | null = null;

    for (const e of events) {
      const payload = (e.payload ?? {}) as Record<string, unknown>;
      const rid =
        typeof payload.request_id === 'string'
          ? payload.request_id
          : typeof payload.requestId === 'string'
            ? payload.requestId
            : undefined;
      if (rid !== requestId) continue;

      if (e.event_type === 'refill_requested') {
        found = {
          request_id: requestId,
          item_id: e.item_id ?? payload.item_id,
          item_name: asDisplayString(payload.item_name ?? payload.itemName, ''),
          requested_qty: Number(
            payload.requested_qty ?? payload.quantity ?? e.quantity ?? 0,
          ),
          quantity: Number(
            payload.requested_qty ?? payload.quantity ?? e.quantity ?? 0,
          ),
        };
      }
      if (
        e.event_type === 'refill_issued' ||
        e.event_type === 'refill_cancelled'
      ) {
        found = null;
      }
    }

    return found;
  }
}
