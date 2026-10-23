// apps/api/src/core/advisory-lock.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdvisoryLockService {
  private readonly logger = new Logger(AdvisoryLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  async acquireShopLock(shopId: string): Promise<boolean> {
    const lockKey1 = 123456789;
    const lockKey2 = this.hashStringToInt(shopId);

    try {
      await this.prisma.$executeRaw`
        SELECT pg_advisory_xact_lock(${lockKey1}, ${lockKey2})
      `;
      this.logger.debug(`Advisory lock acquired for shop ${shopId}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to acquire advisory lock for shop ${shopId}`, err);
      return false;
    }
  }

  async releaseShopLock(shopId: string): Promise<void> {
    this.logger.debug(`Advisory lock released for shop ${shopId} (transaction end)`);
  }

  private hashStringToInt(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }
}