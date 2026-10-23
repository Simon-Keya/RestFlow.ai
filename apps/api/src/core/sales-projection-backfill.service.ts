import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toMoneyNumber } from '../common/utils/money.util';

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  if (value && typeof value === 'object' && 'toNumber' in value) {
    try {
      return Number((value as { toNumber(): number }).toNumber());
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Rebuilds SalesProjection from historical pos_sale events only.
 * Safer/faster than full projection rebuild; does not touch inventory/waste.
 */
@Injectable()
export class SalesProjectionBackfillService {
  private readonly logger = new Logger(SalesProjectionBackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  async backfillShop(shopId: string = '1'): Promise<{
    shopId: string;
    eventsProcessed: number;
    periodsWritten: number;
    totalRevenue: number;
    totalOrders: number;
  }> {
    this.logger.log(`Sales projection backfill for shop ${shopId}`);

    await this.prisma.salesProjection.deleteMany({ where: { shop_id: shopId } });

    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: 'pos_sale',
      },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        payload: true,
        total_cost: true,
        created_at: true,
      },
    });

    // Aggregate in memory: period → { sales, orders }
    const byPeriod = new Map<string, { sales: number; orders: number }>();

    for (const ev of events) {
      const payload = asRecord(ev.payload);
      const amount = asNumber(
        payload.total_amount ?? payload.total ?? payload.revenue ?? ev.total_cost,
      );
      if (amount <= 0) continue;

      const period = ev.created_at.toISOString().slice(0, 10);
      const row = byPeriod.get(period) ?? { sales: 0, orders: 0 };
      row.sales += amount;
      row.orders += 1;
      byPeriod.set(period, row);
    }

    let totalRevenue = 0;
    let totalOrders = 0;

    for (const [period, agg] of byPeriod) {
      const avg = agg.orders > 0 ? agg.sales / agg.orders : 0;
      await this.prisma.salesProjection.create({
        data: {
          shop_id: shopId,
          period,
          total_sales: new Prisma.Decimal(toMoneyNumber(agg.sales)),
          total_orders: agg.orders,
          avg_order_value: new Prisma.Decimal(toMoneyNumber(avg)),
        },
      });
      totalRevenue += agg.sales;
      totalOrders += agg.orders;
    }

    this.logger.log(
      `Backfill done shop=${shopId}: ${events.length} events → ${byPeriod.size} periods, revenue=${totalRevenue}`,
    );

    return {
      shopId,
      eventsProcessed: events.length,
      periodsWritten: byPeriod.size,
      totalRevenue: toMoneyNumber(totalRevenue),
      totalOrders,
    };
  }
}
