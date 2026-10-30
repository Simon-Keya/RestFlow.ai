// apps/api/src/jobs/projection-rebuild.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectionEngineService } from '../core/projection-engine.service';

@Processor('projection-rebuild')
@Injectable()
export class ProjectionRebuildProcessor {
  private readonly logger = new Logger(ProjectionRebuildProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectionEngine: ProjectionEngineService,
  ) {}

  @Process('rebuild-all')
  async handleRebuildAll(job: Job<{ shopId?: string }>) {
    const { shopId = '1' } = job.data || {};

    // SAFETY: updateProjections can consume physical FEFO batches.
    // Replaying historical events through it is not a read-model-only rebuild.
    // Fail closed BEFORE deleting projections or processing any events.
    this.logger.error(
      `Projection rebuild refused for shop ${shopId}: replay may mutate physical stock. No data was changed by this job.`,
    );
    throw new Error(
      'Full projection rebuild is disabled until stock mutations are separated from projection replay.',
    );

    // The legacy implementation below is intentionally unreachable.
    this.logger.log(`Full projection rebuild for shop ${shopId}`);

    try {
      await this.prisma.inventoryProjection.deleteMany({
        where: { shop_id: shopId },
      });
      await this.prisma.wasteProjection.deleteMany({
        where: { shop_id: shopId },
      });
      await this.prisma.salesProjection.deleteMany({
        where: { shop_id: shopId },
      });

      const events = await this.prisma.event.findMany({
        where: { shop_id: shopId },
        orderBy: { created_at: 'asc' },
      });

      if (events.length === 0) {
        this.logger.log('No events â€” nothing to rebuild');
        return;
      }

      this.logger.log(`Replaying ${events.length} events`);

      for (const event of events) {
        await this.projectionEngine.updateProjections(event);
      }

      this.logger.log(`Rebuild complete (${events.length} events)`);
    } catch (error) {
      this.logger.error('Projection rebuild failed', error);
      throw error;
    }
  }
}
