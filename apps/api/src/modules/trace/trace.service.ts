import { toMoneyNumber } from '../../common/utils/money.util';
// apps/api/src/modules/trace/trace.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface TraceEventNode {
  id: string;
  eventType: string;
  shopId: string;
  itemId: string | null;
  itemName: string | null;
  batchNumber: string | null;
  quantity: number | null;
  totalCost: number | null;
  actorName: string | null;
  createdAt: string;
  summary: string;
  payload: Record<string, unknown>;
}

export interface TraceItemResult {
  itemId: string;
  itemName: string | null;
  unit: string | null;
  currentStock: number | null;
  events: TraceEventNode[];
  batches: string[];
  relatedItemIds: string[];
}

export interface TraceSearchResult {
  query: string;
  shopId: string;
  eventType: string | null;
  items: Array<{
    itemId: string;
    itemName: string | null;
    eventCount: number;
    lastEventAt: string | null;
    batches: string[];
  }>;
  events: TraceEventNode[];
  totalEvents: number;
}

type EventRow = Prisma.EventGetPayload<{
  include: {
    actor: { select: { name: true; email: true } };
    item: { select: { name: true; unit: true } };
  };
}>;

@Injectable()
export class TraceService {
  private readonly logger = new Logger(TraceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(opts: {
    shopId?: string;
    q?: string;
    itemId?: string;
    batchNumber?: string;
    eventType?: string;
    limit?: number;
  }): Promise<TraceSearchResult> {
    const shopId = opts.shopId || '1';
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const eventTypeFilter = (opts.eventType || '').trim();
    const searchTerm = (opts.q || opts.itemId || '').trim();
    const batchNumber = (opts.batchNumber || '').trim().replace(/^#+/, '');

    this.logger.log(
      `🔍 SEARCH: shopId=${shopId}, term="${searchTerm}", batch="${batchNumber}"`,
    );

    const hasType =
      eventTypeFilter.length > 0 && eventTypeFilter.toLowerCase() !== 'any';

    if (!searchTerm && !batchNumber && !hasType) {
      return {
        query: '',
        shopId,
        eventType: null,
        items: [],
        events: [],
        totalEvents: 0,
      };
    }

    // Catalog IDs by name / sku (best effort — may be empty)
    const resolvedIds = searchTerm ? await this.resolveItemIds(searchTerm) : [];

    this.logger.log(`🔍 Resolved IDs:`, resolvedIds);

    // Prefer DB narrowing when we have concrete item ids or batch
    const where: Prisma.EventWhereInput = { shop_id: shopId };
    if (hasType) {
      where.event_type = { in: this.eventTypeAliases(eventTypeFilter) };
    }

    const or: Prisma.EventWhereInput[] = [];
    if (resolvedIds.length > 0) {
      or.push({ item_id: { in: resolvedIds } });
    }
    if (searchTerm) {
      or.push({ item_id: { contains: searchTerm, mode: 'insensitive' } });
    }
    if (batchNumber) {
      or.push(
        { batch_number: { contains: batchNumber, mode: 'insensitive' } },
        { batch_number: batchNumber },
      );
    }

    // Always pull a shop window so payload/name matches work in memory
    // even when Item catalog or JSON path filters miss.
    let candidates: EventRow[] = [];
    try {
      this.logger.log(`🔍 Querying with OR:`, JSON.stringify(or, null, 2));
      candidates = await this.prisma.event.findMany({
        where: or.length > 0 ? { ...where, OR: or } : where,
        include: {
          actor: { select: { name: true, email: true } },
          item: { select: { name: true, unit: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 1500,
      });
      this.logger.log(`🔍 Found ${candidates.length} candidates from DB`);
    } catch (err) {
      this.logger.warn(
        `Trace DB filter failed, falling back to shop scan: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      candidates = [];
    }

    // Fallback: full recent shop scan (reliable for name search)
    if (candidates.length === 0 || (searchTerm && resolvedIds.length === 0)) {
      this.logger.log(`🔍 Running fallback shop scan...`);
      const scan = await this.prisma.event.findMany({
        where: {
          shop_id: shopId,
          ...(hasType
            ? { event_type: { in: this.eventTypeAliases(eventTypeFilter) } }
            : {}),
        },
        include: {
          actor: { select: { name: true, email: true } },
          item: { select: { name: true, unit: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 2000,
      });
      // Merge unique by id
      const seen = new Set(candidates.map((e) => e.id));
      for (const e of scan) {
        if (!seen.has(e.id)) candidates.push(e);
      }
      this.logger.log(`🔍 After fallback, ${candidates.length} candidates`);
    }

    const termLower = searchTerm.toLowerCase();
    const batchLower = batchNumber.toLowerCase();
    const resolvedSet = new Set(resolvedIds.map((id) => id.toLowerCase()));

    this.logger.log(`🔍 Filtering ${candidates.length} candidates...`);

    const filtered = candidates
      .filter((e) => {
        if (hasType && !this.eventTypeMatches(e.event_type, eventTypeFilter)) {
          return false;
        }

        const p = (e.payload ?? {}) as Record<string, unknown>;
        const hay = this.buildHaystack(e, p);

        if (batchLower) {
          const batchHay = [
            e.batch_number,
            p.batch_number,
            p.batch_id,
            p.display_batch_code,
            p.production_id,
          ]
            .filter((v): v is string => typeof v === 'string')
            .map((v) => v.toLowerCase().replace(/^#+/, ''));
          if (
            !batchHay.some(
              (b) =>
                b === batchLower ||
                b.includes(batchLower) ||
                batchLower.includes(b),
            )
          ) {
            // batch required but no match — unless also matching item and batch empty intent
            if (batchNumber) return false;
          }
        }

        if (!termLower) {
          return batchLower ? true : true;
        }

        // Name / id / sku match in memory
        if (hay.includes(termLower)) {
          this.logger.debug(
            `✅ Match found: ${e.id} - ${hay.substring(0, 50)}...`,
          );
          return true;
        }
        if (e.item_id && resolvedSet.has(e.item_id.toLowerCase())) {
          this.logger.debug(`✅ Match by resolved ID: ${e.item_id}`);
          return true;
        }

        return false;
      })
      .slice(0, limit);

    this.logger.log(`🔍 Filtered to ${filtered.length} events`);

    const nodes = filtered.map((e) => this.toNode(e));

    const byItem = new Map<
      string,
      {
        itemId: string;
        itemName: string | null;
        eventCount: number;
        lastEventAt: string | null;
        batches: Set<string>;
      }
    >();

    for (const n of nodes) {
      const id = n.itemId || 'unknown';
      const prev = byItem.get(id);
      if (!prev) {
        byItem.set(id, {
          itemId: id,
          itemName: n.itemName,
          eventCount: 1,
          lastEventAt: n.createdAt,
          batches: new Set(n.batchNumber ? [n.batchNumber] : []),
        });
      } else {
        prev.eventCount += 1;
        if (n.createdAt > (prev.lastEventAt || '')) {
          prev.lastEventAt = n.createdAt;
        }
        if (n.batchNumber) prev.batches.add(n.batchNumber);
        if (!prev.itemName && n.itemName) prev.itemName = n.itemName;
      }
    }

    return {
      query: searchTerm || batchNumber || '',
      shopId,
      eventType: hasType ? eventTypeFilter : null,
      items: Array.from(byItem.values()).map((i) => ({
        itemId: i.itemId,
        itemName: i.itemName,
        eventCount: i.eventCount,
        lastEventAt: i.lastEventAt,
        batches: Array.from(i.batches),
      })),
      events: nodes,
      totalEvents: nodes.length,
    };
  }

  async forItem(
    itemId: string,
    shopId: string = '1',
  ): Promise<TraceItemResult> {
    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        OR: [
          { item_id: itemId },
          { payload: { path: ['item_id'], equals: itemId } },
          { payload: { path: ['raw_item_id'], equals: itemId } },
          { payload: { path: ['finished_item_id'], equals: itemId } },
        ],
      },
      include: {
        actor: { select: { name: true, email: true } },
        item: { select: { name: true, unit: true } },
      },
      orderBy: { created_at: 'asc' },
      take: 500,
    });

    // Memory-broaden if path filters miss
    let merged = events;
    if (events.length === 0) {
      const scan = await this.prisma.event.findMany({
        where: { shop_id: shopId },
        include: {
          actor: { select: { name: true, email: true } },
          item: { select: { name: true, unit: true } },
        },
        orderBy: { created_at: 'asc' },
        take: 2000,
      });
      const idLower = itemId.toLowerCase();
      merged = scan.filter((e) => {
        const p = (e.payload ?? {}) as Record<string, unknown>;
        return this.buildHaystack(e, p).includes(idLower);
      });
    }

    if (merged.length === 0) {
      const stock = await this.prisma.inventoryProjection.findUnique({
        where: {
          shop_id_item_id: { shop_id: shopId, item_id: itemId },
        },
        include: { item: true },
      });
      if (!stock) {
        throw new NotFoundException(`No trace history for item ${itemId}`);
      }
      return {
        itemId,
        itemName: stock.item?.name ?? null,
        unit: stock.item?.unit ?? null,
        currentStock: Number(stock.available_stock ?? 0),
        events: [],
        batches: [],
        relatedItemIds: [],
      };
    }

    const nodes = merged.map((e) => this.toNode(e));
    const batches = Array.from(
      new Set(
        nodes
          .map((n) => n.batchNumber)
          .filter((b): b is string => typeof b === 'string' && b.length > 0),
      ),
    );
    const relatedItemIds: string[] = Array.from(
      new Set(
        nodes
          .map((n) => n.itemId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0 && id !== itemId),
      ),
    );

    const stock = await this.prisma.inventoryProjection.findUnique({
      where: {
        shop_id_item_id: { shop_id: shopId, item_id: itemId },
      },
      include: { item: true },
    });
    const firstWithName = merged.find((e) => e.item?.name);

    return {
      itemId,
      itemName: stock?.item?.name ?? firstWithName?.item?.name ?? null,
      unit: stock?.item?.unit ?? firstWithName?.item?.unit ?? null,
      currentStock: stock != null ? Number(stock.available_stock ?? 0) : null,
      events: nodes,
      batches,
      relatedItemIds,
    };
  }

  private async resolveItemIds(token: string): Promise<string[]> {
    const t = token.trim();
    if (!t) return [];

    this.logger.log(`🔍 Resolving item IDs for: "${t}"`);

    const fromItems = await this.prisma.item.findMany({
      where: {
        OR: [
          { item_id: { contains: t, mode: 'insensitive' } },
          { name: { contains: t, mode: 'insensitive' } },
        ],
      },
      select: { item_id: true },
      take: 50,
    });

    this.logger.log(
      `🔍 Found ${fromItems.length} items:`,
      fromItems.map((r) => r.item_id),
    );

    const fromStock = await this.prisma.inventoryProjection.findMany({
      where: {
        OR: [
          { item_id: { contains: t, mode: 'insensitive' } },
          { item: { name: { contains: t, mode: 'insensitive' } } },
        ],
      },
      select: { item_id: true },
      take: 50,
    });

    this.logger.log(
      `🔍 Found ${fromStock.length} from stock:`,
      fromStock.map((r) => r.item_id),
    );

    const result = Array.from(
      new Set([
        ...fromItems.map((r) => r.item_id),
        ...fromStock.map((r) => r.item_id),
      ]),
    );

    this.logger.log(`🔍 Total resolved IDs:`, result);

    return result;
  }

  private buildHaystack(
    e: {
      item_id: string | null;
      batch_number: string | null;
      event_type: string;
      item?: { name: string | null } | null;
    },
    p: Record<string, unknown>,
  ): string {
    return [
      e.item_id,
      e.item?.name,
      e.batch_number,
      e.event_type,
      p.item_id,
      p.item_name,
      p.itemName,
      p.raw_item_id,
      p.raw_item_name,
      p.finished_item_id,
      p.batch_number,
      p.batch_id,
      p.display_batch_code,
      p.production_id,
      p.name,
    ]
      .filter((v) => typeof v === 'string' && v.length > 0)
      .join(' ')
      .toLowerCase();
  }

  private eventTypeAliases(raw: string): string[] {
    const t = raw.trim().toLowerCase().replace(/\s+/g, '_');
    const map: Record<string, string[]> = {
      received: ['received', 'RECEIVING', 'goods_received'],
      receiving: ['received', 'RECEIVING', 'goods_received'],
      waste_recorded: ['waste_recorded', 'WASTE_RECORDED', 'waste'],
      waste: ['waste_recorded', 'WASTE_RECORDED', 'waste'],
      production_finished: ['production_finished'],
      production_started: ['production_started'],
      pos_sale: [
        'pos_sale',
        'pos_order_created',
        'ORDER_PAID',
        'sale_completed',
      ],
      sale: ['pos_sale', 'pos_order_created', 'ORDER_PAID', 'sale_completed'],
      refill_issued: ['refill_issued'],
      refill_requested: ['refill_requested'],
      finished_good_adjusted: ['finished_good_adjusted', 'STOCK_ADJUSTMENT'],
      closing_stock_counted: ['closing_stock_counted', 'stock_count_completed'],
      stock_count: ['closing_stock_counted', 'stock_count_completed'],
      variance: [
        'variance_batch',
        'VARIANCE_WRITEOFF',
        'variance_reason_submitted',
        'variance_flagged',
        'closing_stock_counted',
        'stock_count_completed',
      ],
    };
    return map[t] ?? [raw.trim()];
  }

  private eventTypeMatches(actual: string, filter: string): boolean {
    if (!filter || filter.toLowerCase() === 'any') return true;
    return this.eventTypeAliases(filter)
      .map((a) => a.toLowerCase())
      .includes(actual.toLowerCase());
  }

  private toNode(e: EventRow): TraceEventNode {
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    const itemId =
      e.item_id ||
      (typeof payload.item_id === 'string' ? payload.item_id : null) ||
      (typeof payload.raw_item_id === 'string' ? payload.raw_item_id : null);

    const itemName =
      e.item?.name ||
      (typeof payload.item_name === 'string' ? payload.item_name : null) ||
      (typeof payload.itemName === 'string' ? payload.itemName : null);

    const batchNumber =
      e.batch_number ||
      (typeof payload.display_batch_code === 'string'
        ? payload.display_batch_code
        : null) ||
      (typeof payload.batch_number === 'string'
        ? payload.batch_number
        : null) ||
      (typeof payload.batch_id === 'string' ? payload.batch_id : null);

    return {
      id: e.id,
      eventType: e.event_type,
      shopId: e.shop_id,
      itemId,
      itemName,
      batchNumber,
      quantity: e.quantity,
      totalCost: e.total_cost == null ? null : toMoneyNumber(e.total_cost),
      actorName: e.actor?.name || e.actor?.email || null,
      createdAt: e.created_at.toISOString(),
      summary: this.buildSummary(
        e.event_type,
        itemName || itemId,
        e.quantity,
        payload,
      ),
      payload,
    };
  }

  private buildSummary(
    eventType: string,
    nameOrId: string | null,
    quantity: number | null,
    payload: Record<string, unknown>,
  ): string {
    const name = nameOrId || 'item';
    const qty = quantity != null ? ` × ${quantity}` : '';
    const t = eventType.toLowerCase();

    if (t.includes('receiv')) return `Received ${name}${qty}`;
    if (t.includes('production_started')) {
      return `Production started: ${name}${qty}`;
    }
    if (t.includes('production_finished')) {
      return `Production finished: ${name}${qty}`;
    }
    if (t.includes('waste')) return `Waste: ${name}${qty}`;
    if (t.includes('pos') || t.includes('sale') || t.includes('order')) {
      return `Sale / order: ${name}${qty}`;
    }
    if (t.includes('refill_issued')) return `Refill issued: ${name}${qty}`;
    if (t.includes('refill')) return `Refill: ${name}${qty}`;
    if (t.includes('closing') || t.includes('stock_count')) {
      const code =
        (typeof payload.display_batch_code === 'string' &&
          payload.display_batch_code) ||
        (typeof payload.batch_id === 'string' && payload.batch_id) ||
        '';
      return `Stock count${code ? ` #${code}` : ''}: ${name}`;
    }
    if (t.includes('variance')) return `Variance: ${name}${qty}`;
    if (t.includes('adjust')) return `Adjustment: ${name}${qty}`;
    return `${eventType}: ${name}${qty}`;
  }
}
