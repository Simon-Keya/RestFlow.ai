// apps/api/src/jobs/expiry-sweep.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Batch-aware expiry monitor. This job only refreshes expiry read-model fields
 * and emits operational warnings; it never writes off stock automatically.
 * Manual confirmation continues through WasteService.writeOffExpired().
 */
@Processor('expiry-sweep')
@Injectable()
export class ExpirySweepProcessor {
  private readonly logger = new Logger(ExpirySweepProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('sweep')
  async handleExpirySweep(job: Job<{ shopId?: string }>) {
    const shopId = job.data?.shopId || '1';
    const todayStart = this.shopLocalDayStart(new Date());
    const inSevenDays = new Date(todayStart.getTime() + 8 * 86400000);
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        shop_id: shopId,
        qty_remaining: { gt: 0 },
        expiry_date: { not: null, lt: inSevenDays },
      },
      include: { item: { select: { name: true, unit: true } } },
      orderBy: [{ expiry_date: 'asc' }, { received_at: 'asc' }, { id: 'asc' }],
      take: 5000,
    });

    const summary = { processed: batches.length, expired: 0, sevenDay: 0, threeDay: 0, oneDay: 0 };
    const touchedItems = new Set<string>();
    for (const batch of batches) {
      if (!batch.expiry_date) continue;
      const expiryDay = this.shopLocalDayStart(batch.expiry_date);
      const daysLeft = Math.floor((expiryDay.getTime() - todayStart.getTime()) / 86400000);
      touchedItems.add(batch.item_id);
      const qty = Number(batch.qty_remaining);
      const value = qty * Number(batch.unit_cost);
      if (daysLeft < 0) {
        summary.expired += 1;
        this.logger.warn(`[EXPIRY_PENDING_WRITE_OFF] shop=${shopId} item=${batch.item_id} batch=${batch.batch_number} qty=${qty} ${batch.item.unit} value=${value.toFixed(2)} expiredDays=${Math.abs(daysLeft)}`);
      } else if (daysLeft <= 7) {
        summary.sevenDay += 1;
        if (daysLeft <= 3) summary.threeDay += 1;
        if (daysLeft <= 1) summary.oneDay += 1;
        this.logger.warn(`[EXPIRY_ALERT] shop=${shopId} item=${batch.item_id} batch=${batch.batch_number} qty=${qty} ${batch.item.unit} value=${value.toFixed(2)} daysLeft=${daysLeft}`);
      }
    }

    // Refresh each affected item's next expiry from actual open batches.
    for (const itemId of touchedItems) {
      const next = await this.prisma.inventoryBatch.findFirst({
        where: { shop_id: shopId, item_id: itemId, qty_remaining: { gt: 0 }, expiry_date: { not: null, gte: todayStart } },
        orderBy: [{ expiry_date: 'asc' }, { received_at: 'asc' }, { id: 'asc' }],
        select: { expiry_date: true },
      });
      const days = next?.expiry_date ? Math.floor((this.shopLocalDayStart(next.expiry_date).getTime() - todayStart.getTime()) / 86400000) : null;
      await this.prisma.inventoryProjection.updateMany({
        where: { shop_id: shopId, item_id: itemId },
        data: { next_expiry_date: next?.expiry_date ?? null, days_to_expiry_min: days },
      });
    }

    this.logger.log(`Batch expiry sweep shop=${shopId}: ${JSON.stringify(summary)}; no stock was written off`);
    return summary;
  }

  private shopLocalDayStart(date: Date): Date {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value;
    return new Date(Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))) - 3 * 60 * 60 * 1000);
  }
}
