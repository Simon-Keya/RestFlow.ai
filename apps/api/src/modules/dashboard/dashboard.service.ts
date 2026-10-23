// apps/api/src/modules/dashboard/dashboard.service.ts
import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryGateway } from '../inventory/inventory.gateway';
import { ConsumptionService } from '../consumption/consumption.service';

function payloadIsRejected(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    p.rejected === true ||
    p.rejected === 'true' ||
    p.approval_status === 'rejected'
  );
}

const APPROVAL_EVENT_TYPES = [
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
] as const;

export interface ShopSummary {
  shopId: string;
  shopName: string;
  /** Revenue for the selected period (not only calendar today). */
  todayRevenue: number;
  todayOrders: number;
  averageOrderValue: number;
  periodFrom: string;
  periodTo: string;
  periodLabel?: string;
  openApprovals: number;
  lowStockCount: number;
  nearExpiryCount: number;
  /** Finished goods stock value (qty × WAC) */
  finishedGoodsValue: number;
  /** Inventory SKUs with on-hand qty but no WAC */
  costMissingCount: number;
}

export interface DashboardKpis {
  foodCostPercent: number | null;
  grossMarginPercent: number | null;
  inventoryTurnover: number | null;
  wasteValue: number;
  inventoryAccuracyPercent: number | null;
  periodRevenue: number;
  periodCogs: number;
  finishedGoodsValue: number;
  rawInventoryValue: number;
}

export interface DashboardAlert {
  id: string;
  type: 'low_stock' | 'near_expiry' | 'variance' | 'approval' | 'cost';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  href?: string;
  createdAt: string;
}

function shopPath(shopId: string, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/shop/${shopId}/dashboard${clean}`;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly consumptionService: ConsumptionService,
    @Optional() private readonly inventoryGateway?: InventoryGateway,
  ) {}

  async getSummary(
    shopId: string = '1',
    from?: string,
    to?: string,
  ): Promise<ShopSummary> {
    const fromDate = this.parseDateInput(from) ?? this.startOfUtcDay(new Date());
    const toDate = this.parseDateInput(to) ?? this.startOfUtcDay(new Date());
    const periodKeys = this.buildPeriodKeys(fromDate, toDate);
    const periodFrom = periodKeys[0] ?? fromDate.toISOString().slice(0, 10);
    const periodTo =
      periodKeys[periodKeys.length - 1] ?? toDate.toISOString().slice(0, 10);

    const [
      salesRows,
      lowStockCount,
      nearExpiryCount,
      openApprovals,
      inventoryValueSplit,
    ] = await Promise.all([
        this.prisma.salesProjection.findMany({
          where: {
            shop_id: shopId,
            period: { in: periodKeys },
          },
          select: { total_sales: true, total_orders: true },
        }),
        this.countLowStockItems(shopId),
        this.prisma.inventoryProjection.count({
          where: {
            shop_id: shopId,
            days_to_expiry_min: { lte: 3, not: null },
          },
        }),
        this.countOpenApprovals(shopId),
        this.splitInventoryValues(shopId),
      ]);

    return {
      shopId,
      shopName: `Shop ${shopId}`,
      todayRevenue: salesRows.reduce((s, r) => s + Number(r.total_sales ?? 0), 0),
      todayOrders: salesRows.reduce((s, r) => s + Number(r.total_orders ?? 0), 0),
      averageOrderValue: (() => {
        const rev = salesRows.reduce((s, r) => s + Number(r.total_sales ?? 0), 0);
        const ord = salesRows.reduce((s, r) => s + Number(r.total_orders ?? 0), 0);
        return ord > 0 ? Math.round((rev / ord) * 100) / 100 : 0;
      })(),
      periodFrom,
      periodTo,
      openApprovals,
      lowStockCount,
      nearExpiryCount,
      finishedGoodsValue: inventoryValueSplit.finishedGoodsValue,
      costMissingCount: inventoryValueSplit.costMissingCount,
    };
  }

  async getKpis(
    shopId: string = '1',
    from?: string,
    to?: string,
  ): Promise<DashboardKpis> {
    const fromDate =
      this.parseDateInput(from) ?? this.startOfUtcDay(this.daysAgo(30));
    const toDate = this.parseDateInput(to) ?? this.startOfUtcDay(new Date());
    const periods = this.buildPeriodKeys(fromDate, toDate);

    const fromIso = periods[0] ?? fromDate.toISOString().slice(0, 10);
    const toIso =
      periods[periods.length - 1] ?? toDate.toISOString().slice(0, 10);

    const rangeStart = this.startOfUtcDay(fromDate);
    const rangeEnd = this.endOfUtcDay(toDate);

    const [salesRows, wasteValue, inventoryAgg, accuracy, consumption] =
      await Promise.all([
        this.prisma.salesProjection.findMany({
          where: {
            shop_id: shopId,
            period: { in: periods },
          },
          select: { total_sales: true },
        }),
        // Period-scoped waste (NOT lifetime WasteProjection totals)
        this.sumWasteValueInRange(shopId, rangeStart, rangeEnd),
        this.prisma.inventoryProjection.aggregate({
          where: { shop_id: shopId },
          _sum: { total_value: true },
        }),
        this.computeInventoryAccuracy(shopId),
        this.consumptionService.getSummary(shopId, fromIso, toIso),
      ]);

    const periodRevenue = salesRows.reduce(
      (sum, r) => sum + Number(r.total_sales ?? 0),
      0,
    );

    const inventoryValue = Number(inventoryAgg._sum.total_value ?? 0);

    const consumptionValue = Number(consumption.totalConsumedValue ?? 0);
    const periodCogs = consumptionValue > 0 ? consumptionValue : wasteValue;

    const foodCostPercent =
      periodRevenue >= 1
        ? Math.min(999.9, (periodCogs / periodRevenue) * 100)
        : null;

    const grossMarginPercent =
      periodRevenue >= 1
        ? Math.max(-999.9, Math.min(999.9, ((periodRevenue - periodCogs) / periodRevenue) * 100))
        : null;

    const inventoryTurnover =
      inventoryValue > 0 ? periodRevenue / inventoryValue : null;

        const invSplit = await this.splitInventoryValues(shopId);

    return {
      foodCostPercent: foodCostPercent !== null ? round(foodCostPercent) : null,
      grossMarginPercent:
        grossMarginPercent !== null ? round(grossMarginPercent) : null,
      inventoryTurnover:
        inventoryTurnover !== null ? round(inventoryTurnover, 2) : null,
      wasteValue: round(wasteValue),
      inventoryAccuracyPercent: accuracy,
      periodRevenue: round(periodRevenue),
      periodCogs: round(periodCogs),
      finishedGoodsValue: invSplit.finishedGoodsValue,
      rawInventoryValue: invSplit.rawInventoryValue,
    };
  }

  private async computeInventoryAccuracy(
    shopId: string,
  ): Promise<number | null> {
    const event = await this.prisma.event.findFirst({
      where: {
        shop_id: shopId,
        event_type: {
          in: ['closing_stock_counted', 'stock_count_completed'],
        },
      },
      select: { payload: true },
      orderBy: { created_at: 'desc' },
    });

    if (!event) return null;

    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    if (lines.length === 0) return null;

    let weightedError = 0;
    let counted = 0;

    for (const raw of lines) {
      const line = raw as Record<string, unknown>;
      const systemQty = Number(
        line.system_qty ?? line.expected_quantity ?? line.expectedQuantity ?? 0,
      );
      const varianceQty = Math.abs(
        Number(
          line.variance_qty ??
            line.variance_quantity ??
            line.varianceQuantity ??
            0,
        ),
      );
      if (systemQty <= 0) continue;
      weightedError += (varianceQty / systemQty) * 100;
      counted += 1;
    }

    if (counted === 0) return 100;
    const accuracy = Math.max(0, 100 - weightedError / counted);
    return round(accuracy, 1);
  }

  async getAlerts(shopId: string = '1'): Promise<DashboardAlert[]> {
    const [lowStock, nearExpiry, pendingApprovals] = await Promise.all([
      this.findLowStockRows(shopId, 15),
      this.prisma.inventoryProjection.findMany({
        where: {
          shop_id: shopId,
          days_to_expiry_min: { lte: 3, not: null },
        },
        include: {
          item: { select: { name: true } },
        },
        orderBy: { days_to_expiry_min: 'asc' },
        take: 15,
      }),
      this.findPendingApprovalEvents(shopId, 10),
    ]);

    const alerts: DashboardAlert[] = [];

    for (const row of lowStock) {
      const stock = Number(row.available_stock ?? 0);
      alerts.push({
        id: `low-${row.item_id}`,
        type: 'low_stock',
        severity: stock <= 3 ? 'critical' : 'warning',
        message: `Low stock: ${row.item?.name ?? row.item_id} (${stock} left)`,
        href: shopPath(
          shopId,
          `/inventory?highlight=${encodeURIComponent(row.item_id)}`,
        ),
        createdAt: row.updated_at.toISOString(),
      });
    }

    for (const row of nearExpiry) {
      const days = row.days_to_expiry_min ?? 0;
      alerts.push({
        id: `expiry-${row.item_id}`,
        type: 'near_expiry',
        severity: days <= 1 ? 'critical' : 'warning',
        message: `Near expiry: ${row.item?.name ?? row.item_id} (${days} day${
          days === 1 ? '' : 's'
        } left)`,
        href: shopPath(
          shopId,
          `/inventory?highlight=${encodeURIComponent(row.item_id)}`,
        ),
        createdAt: row.updated_at.toISOString(),
      });
    }

    for (const ev of pendingApprovals) {
      alerts.push({
        id: `approval-${ev.id}`,
        type: 'approval',
        severity: 'info',
        message: `Pending approval: ${ev.event_type
          .replace(/_/g, ' ')
          .toLowerCase()}`,
        href: shopPath(shopId, '/approvals'),
        createdAt: ev.created_at.toISOString(),
      });
    }

    // COG Phase 6: cost-missing stock (qty on hand, no WAC)
    const costMissingRows = await this.prisma.inventoryProjection.findMany({
      where: {
        shop_id: shopId,
        available_stock: { gt: 0 },
      },
      include: { item: { select: { name: true, category: true } } },
      take: 50,
    });
    for (const row of costMissingRows) {
      const qty = Number(row.available_stock ?? 0);
      let wac = Number(row.avg_unit_cost ?? 0);
      const tv = Number(row.total_value ?? 0);
      if (!(wac > 0) && qty > 0 && tv > 0) wac = tv / qty;
      if (qty > 0 && !(wac > 0) && !(tv > 0)) {
        alerts.push({
          id: `cost-missing-${row.item_id}`,
          type: 'cost',
          severity: 'warning',
          message: `Cost missing: ${row.item?.name ?? row.item_id} has stock but no unit cost (receive with unit cost)`,
          href: shopPath(
            shopId,
            `/inventory?highlight=${encodeURIComponent(row.item_id)}`,
          ),
          createdAt: row.updated_at.toISOString(),
        });
      }
    }

    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      const s = severityOrder[a.severity] - severityOrder[b.severity];
      if (s !== 0) return s;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return alerts;
  }

  emitAlert(alert: {
    id: string;
    type: 'low_stock' | 'near_expiry' | 'variance' | 'approval' | 'cost';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    href?: string;
    shop_id: string;
    item_id?: string;
  }): void {
    if (!this.inventoryGateway) {
      this.logger.debug('InventoryGateway not available – skipping alert emit');
      return;
    }

    const shopId = alert.shop_id || '1';
    let href = alert.href;
    if (!href) {
      if (alert.type === 'approval') {
        href = shopPath(shopId, '/approvals');
      } else if (alert.type === 'variance') {
        href = shopPath(shopId, '/variance');
      } else {
        const q = alert.item_id
          ? `?highlight=${encodeURIComponent(alert.item_id)}`
          : '';
        href = shopPath(shopId, `/inventory${q}`);
      }
    } else if (!href.startsWith('/shop/')) {
      href = shopPath(shopId, href.replace(/^\/dashboard/, ''));
    }

    this.inventoryGateway.broadcastDashboardAlert({
      ...alert,
      href,
      shop_id: shopId,
    });
  }


  /**
   * Sum waste monetary value from events in [from, to] inclusive.
   * WasteProjection is lifetime-only — must not drive the period KPI tile.
   */
  private async sumWasteValueInRange(
    shopId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: {
          in: ['waste_recorded', 'waste', 'WASTE_RECORDED'],
        },
        created_at: {
          gte: from,
          lte: to,
        },
      },
      select: {
        total_cost: true,
        quantity: true,
        unit_cost: true,
        payload: true,
      },
      take: 5000,
    });

    let total = 0;
    for (const e of events) {
      const payload =
        e.payload && typeof e.payload === 'object' && !Array.isArray(e.payload)
          ? (e.payload as Record<string, unknown>)
          : {};

      if (payload.rejected === true || payload.approval_status === 'rejected') {
        continue;
      }

      let value = this.asMoney(e.total_cost ?? payload.total_waste_value);
      const qty = this.asNum(e.quantity ?? payload.quantity_wasted);
      const unitCost = this.asNum(e.unit_cost ?? payload.unit_cost);
      if (value <= 0 && unitCost > 0 && qty > 0) {
        value = unitCost * qty;
      }
      total += value;
    }
    return total;
  }

  private asNum(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value && typeof value === 'object' && 'toNumber' in value) {
      try {
        const n = (value as { toNumber: () => number }).toNumber();
        return Number.isFinite(n) ? n : fallback;
      } catch {
        return fallback;
      }
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    }
    return fallback;
  }

  private asMoney(value: unknown): number {
    return Math.round(this.asNum(value) * 100) / 100;
  }

  private endOfUtcDay(d: Date): Date {
    const s = this.startOfUtcDay(d);
    return new Date(s.getTime() + 24 * 60 * 60 * 1000 - 1);
  }


  /** Count SKUs where on-hand <= per-item reorder_point (not a global 10). */

  /**
   * Pending approvals without Prisma JSON-path NOT filter.
   * That filter drops rows where payload.rejected is absent (normal receives).
   */
  private async countOpenApprovals(shopId: string): Promise<number> {
    const rows = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        approved_by_id: null,
        event_type: { in: [...APPROVAL_EVENT_TYPES] },
      },
      select: { payload: true },
      take: 500,
    });
    return rows.filter((r) => !payloadIsRejected(r.payload)).length;
  }

  private async findPendingApprovalEvents(
    shopId: string,
    take: number,
  ): Promise<
    Array<{ id: string; event_type: string; created_at: Date }>
  > {
    const rows = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        approved_by_id: null,
        event_type: { in: [...APPROVAL_EVENT_TYPES] },
      },
      select: {
        id: true,
        event_type: true,
        created_at: true,
        payload: true,
      },
      orderBy: { created_at: 'desc' },
      take: Math.max(take * 3, 30),
    });
    return rows
      .filter((r) => !payloadIsRejected(r.payload))
      .slice(0, take)
      .map(({ id, event_type, created_at }) => ({ id, event_type, created_at }));
  }

  private async countLowStockItems(shopId: string): Promise<number> {
    const rows = await this.prisma.inventoryProjection.findMany({
      where: { shop_id: shopId },
      select: {
        available_stock: true,
        item: { select: { reorder_point: true, category: true } },
      },
      take: 5000,
    });
    let n = 0;
    for (const row of rows) {
      const cat = (row.item?.category ?? '').toLowerCase();
      if (/finished|production|fg\b/.test(cat)) continue;
      const threshold = Number(row.item?.reorder_point ?? 0);
      if (!(threshold > 0)) continue;
      if (Number(row.available_stock ?? 0) <= threshold) n += 1;
    }
    return n;
  }

  private async findLowStockRows(shopId: string, take: number) {
    const rows = await this.prisma.inventoryProjection.findMany({
      where: { shop_id: shopId },
      include: {
        item: { select: { name: true, reorder_point: true, category: true } },
      },
      orderBy: { available_stock: 'asc' },
      take: 500,
    });
    return rows
      .filter((row) => {
        const cat = (row.item?.category ?? '').toLowerCase();
        if (/finished|production|fg\b/.test(cat)) return false;
        const threshold = Number(row.item?.reorder_point ?? 0);
        if (!(threshold > 0)) return false;
        return Number(row.available_stock ?? 0) <= threshold;
      })
      .slice(0, take);
  }


  /** Split inventory value into raw vs finished goods; count cost-missing rows. */
  private async splitInventoryValues(shopId: string): Promise<{
    finishedGoodsValue: number;
    rawInventoryValue: number;
    costMissingCount: number;
  }> {
    const rows = await this.prisma.inventoryProjection.findMany({
      where: { shop_id: shopId },
      include: {
        item: { select: { category: true, name: true } },
      },
    });

    let finishedGoodsValue = 0;
    let rawInventoryValue = 0;
    let costMissingCount = 0;
    const fgRe = /finished|production|fg\b|complete recipe/i;

    for (const row of rows) {
      const qty = Number(row.available_stock ?? 0);
      let value = Number(row.total_value ?? 0);
      let wac = Number(row.avg_unit_cost ?? 0);
      if (!(wac > 0) && qty > 0 && value > 0) wac = value / qty;
      if (!(value > 0) && qty > 0 && wac > 0) value = qty * wac;

      const cat = String(row.item?.category ?? '');
      if (fgRe.test(cat)) finishedGoodsValue += value;
      else rawInventoryValue += value;

      if (qty > 0 && !(wac > 0) && !(value > 0)) {
        costMissingCount += 1;
      }
    }

    return {
      finishedGoodsValue: Math.round(finishedGoodsValue * 100) / 100,
      rawInventoryValue: Math.round(rawInventoryValue * 100) / 100,
      costMissingCount,
    };
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }


  private parseDateInput(value?: string): Date | null {
    if (!value || !String(value).trim()) return null;
    const s = String(value).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) {
      return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : this.startOfUtcDay(d);
  }

  private startOfUtcDay(d: Date): Date {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  /**
   * Build YYYY-MM-DD keys without local-timezone drift.
   * Using setHours(0)+toISOString() in UTC+ offsets can shift the calendar day.
   */
  private buildPeriodKeys(from: Date, to: Date): string[] {
    const keys: string[] = [];
    const start = this.toDateOnlyUtc(from);
    const end = this.toDateOnlyUtc(to);
    const cur = new Date(start.getTime());
    while (cur.getTime() <= end.getTime()) {
      keys.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return keys;
  }

  private toDateOnlyUtc(d: Date): Date {
    if (Number.isNaN(d.getTime())) {
      const n = new Date();
      return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
    }
    // If constructed from YYYY-MM-DD, getUTC* matches the intended calendar day
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
}

function round(n: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
