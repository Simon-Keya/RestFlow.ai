import { toMoneyNumber } from '../../common/utils/money.util';
// apps/api/src/modules/approvals/approvals.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventStoreService } from '../../core/event-store.service';

export type ApprovalType =
  | 'receiving'
  | 'waste_writeoff'
  | 'stock_adjustment'
  | 'variance_writeoff'
  | 'refund';

export interface PendingApproval {
  id: string;
  type: ApprovalType;
  summary: string;
  amount: number;
  requestedBy: string;
  requestedAt: string;
  itemId?: string | null;
}

export interface ApprovalDetail extends PendingApproval {
  status: 'pending' | 'approved' | 'rejected';
  eventType: string;
  quantity: number | null;
  note?: string | null;
  reason?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
}


/** True only when payload explicitly marks rejection. */
function isRejectedPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  if (p.rejected === true) return true;
  if (p.rejected === 'true') return true;
  if (p.approval_status === 'rejected') return true;
  return false;
}

const PENDING_EVENT_TYPES: string[] = [
  'WASTE_RECORDED',
  'waste_recorded',
  'waste',
  'STOCK_ADJUSTMENT',
  'finished_good_adjusted',
  'RECEIVING',
  'received',
  'VARIANCE_WRITEOFF',
  'REFUND',
  'refill_requested',
];

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStoreService,
  ) {}

  async getPending(
    shopId: string = '1',
    typeFilter?: string,
  ): Promise<PendingApproval[]> {
    // Avoid Prisma JSON path NOT { rejected: true } — drops rows missing the key.
    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId || '1',
        approved_by_id: null,
        event_type: { in: PENDING_EVENT_TYPES },
      },
      select: {
        id: true,
        event_type: true,
        item_id: true,
        quantity: true,
        total_cost: true,
        created_at: true,
        payload: true,
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    let items = events
      .filter((e) => !isRejectedPayload(e.payload))
      .map((e) => this.toPendingApproval(e));

    if (typeFilter) {
      const t = typeFilter.toLowerCase();
      items = items.filter((i) => i.type === t);
    }

    return items;
  }

  async getHistory(shopId: string = '1', limit = 50) {
    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: { in: PENDING_EVENT_TYPES },
        OR: [
          { approved_by_id: { not: null } },
          { payload: { path: ['rejected'], equals: true } },
        ],
      },
      select: {
        id: true,
        event_type: true,
        item_id: true,
        quantity: true,
        total_cost: true,
        created_at: true,
        updated_at: true,
        approved_by_id: true,
        payload: true,
        actor: { select: { name: true, email: true } },
        approvedBy: { select: { name: true, email: true } },
      },
      orderBy: { updated_at: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    return events.map((e) => this.toApprovalDetail(e));
  }

  async getById(approvalId: string): Promise<ApprovalDetail> {
    const event = await this.prisma.event.findUnique({
      where: { id: approvalId },
      include: {
        actor: { select: { name: true, email: true } },
        approvedBy: { select: { name: true, email: true } },
      },
    });

    if (!event) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }

    return this.toApprovalDetail(event);
  }

  async approve(approvalId: string, actorUserId: string, note?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: approvalId },
    });

    if (!event) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }

    const payload = (event.payload ?? {}) as Record<string, unknown>;
    if (payload.rejected === true) {
      throw new BadRequestException('This request was already rejected');
    }
    if (event.approved_by_id) {
      return {
        success: true,
        message: 'Already approved',
        approvalId,
      };
    }

    const nextPayload: Prisma.InputJsonValue = {
      ...payload,
      approval_status: 'approved',
      approval_note: note ?? null,
      approved_at: new Date().toISOString(),
      approved_by: actorUserId,
    };

    await this.prisma.event.update({
      where: { id: approvalId },
      data: {
        approved_by_id: actorUserId,
        payload: nextPayload,
      },
    });

    try {
      await this.eventStore.appendEvent({
        event_type: 'approval_granted',
        actor_user_id: actorUserId,
        idempotency_key: `approval-granted-${approvalId}`,
        item_id: event.item_id ?? undefined,
        payload: {
          source_event_id: approvalId,
          source_event_type: event.event_type,
          note: note ?? null,
          shop_id: event.shop_id,
        },
      });
    } catch {
      // non-fatal
    }

    this.logger.log(`Approval ${approvalId} approved by ${actorUserId}`);

    return {
      success: true,
      message: 'Approved',
      approvalId,
    };
  }

  async reject(approvalId: string, actorUserId: string, reason: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: approvalId },
    });

    if (!event) {
      throw new NotFoundException(`Approval ${approvalId} not found`);
    }

    if (event.approved_by_id) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      if (payload.rejected !== true) {
        throw new BadRequestException('This request was already approved');
      }
      return {
        success: true,
        message: 'Already rejected',
        approvalId,
      };
    }

    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const nextPayload: Prisma.InputJsonValue = {
      ...payload,
      rejected: true,
      approval_status: 'rejected',
      rejection_reason: reason,
      rejected_at: new Date().toISOString(),
      rejected_by: actorUserId,
    };

    await this.prisma.event.update({
      where: { id: approvalId },
      data: {
        approved_by_id: actorUserId,
        payload: nextPayload,
      },
    });

    try {
      await this.eventStore.appendEvent({
        event_type: 'approval_rejected',
        actor_user_id: actorUserId,
        idempotency_key: `approval-rejected-${approvalId}`,
        item_id: event.item_id ?? undefined,
        payload: {
          source_event_id: approvalId,
          source_event_type: event.event_type,
          reason,
          shop_id: event.shop_id,
        },
      });
    } catch {
      // non-fatal
    }

    this.logger.log(`Approval ${approvalId} rejected by ${actorUserId}`);

    return {
      success: true,
      message: 'Rejected',
      approvalId,
    };
  }

  private toPendingApproval(e: {
    id: string;
    event_type: string;
    item_id: string | null;
    quantity: number | null;
    total_cost: number | null | { toNumber(): number };
    created_at: Date;
    payload: Prisma.JsonValue;
    actor?: { name: string | null; email: string } | null;
  }): PendingApproval {
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    const type = this.mapEventType(e.event_type);
    const amount = Number(
      e.total_cost ??
        payload.total_cost ??
        payload.total_waste_value ??
        payload.amount ??
        0,
    );
    const itemId = e.item_id ?? (payload.item_id as string | undefined) ?? null;
    const itemName =
      (payload.item_name as string | undefined) || itemId || 'item';

    return {
      id: e.id,
      type,
      summary: this.buildSummary(type, itemName, e.quantity, amount),
      amount,
      requestedBy: e.actor?.name || e.actor?.email || 'Unknown',
      requestedAt: e.created_at.toISOString(),
      itemId,
    };
  }

  private toApprovalDetail(e: {
    id: string;
    event_type: string;
    item_id: string | null;
    quantity: number | null;
    total_cost: number | null | { toNumber(): number };
    created_at: Date;
    updated_at?: Date;
    approved_by_id: string | null;
    payload: Prisma.JsonValue;
    actor?: { name: string | null; email: string } | null;
    approvedBy?: { name: string | null; email: true | string } | null;
  }): ApprovalDetail {
    const base = this.toPendingApproval({
      ...e,
      actor: e.actor
        ? {
            name: e.actor.name,
            email:
              typeof e.actor.email === 'string'
                ? e.actor.email
                : String(e.actor.email ?? ''),
          }
        : null,
    });
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    const rejected = payload.rejected === true;

    let status: ApprovalDetail['status'] = 'pending';
    if (rejected) status = 'rejected';
    else if (e.approved_by_id) status = 'approved';

    return {
      ...base,
      status,
      eventType: e.event_type,
      quantity: e.quantity,
      note: (payload.approval_note as string) ?? null,
      reason: (payload.rejection_reason as string) ?? null,
      decidedBy:
        (e.approvedBy &&
          ((e.approvedBy as { name?: string | null }).name ||
            (e.approvedBy as { email?: string }).email)) ||
        (payload.approved_by as string) ||
        (payload.rejected_by as string) ||
        null,
      decidedAt:
        (payload.approved_at as string) ||
        (payload.rejected_at as string) ||
        (e.updated_at ? e.updated_at.toISOString() : null),
    };
  }

  private mapEventType(eventType: string): ApprovalType {
    const t = eventType.toLowerCase();
    if (t.includes('waste')) return 'waste_writeoff';
    if (t.includes('receiv')) return 'receiving';
    if (t.includes('variance')) return 'variance_writeoff';
    if (t.includes('refund')) return 'refund';
    if (t.includes('adjust') || t.includes('refill')) return 'stock_adjustment';
    return 'stock_adjustment';
  }

  private buildSummary(
    type: ApprovalType,
    itemName: string,
    quantity: number | null,
    amount: number,
  ): string {
    const qty = quantity != null ? ` × ${quantity}` : '';
    const amt = amount > 0 ? ` (${amount.toFixed(2)})` : '';
    switch (type) {
      case 'waste_writeoff':
        return `Waste write-off: ${itemName}${qty}${amt}`;
      case 'receiving':
        return `Receiving: ${itemName}${qty}${amt}`;
      case 'stock_adjustment':
        return `Stock adjustment: ${itemName}${qty}${amt}`;
      case 'variance_writeoff':
        return `Variance write-off: ${itemName}${qty}${amt}`;
      case 'refund':
        return `Refund: ${itemName}${amt}`;
      default:
        return `Pending: ${itemName}${qty}${amt}`;
    }
  }
}
