// apps/api/src/core/idempotency.service.ts
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if an idempotency key already exists.
   */
  async check(key: string) {
    return this.prisma.event.findUnique({
      where: { idempotency_key: key },
      select: { id: true, payload: true, event_type: true },
    });
  }

  /**
   * Enforce idempotency.
   * - If key exists with same payload → safe to continue (caller should return existing result)
   * - If key exists with different payload → throw ConflictException
   * - If key does not exist → safe to proceed
   */
  async enforce(key: string, currentPayload: any): Promise<{ isReplay: boolean; existing?: any }> {
    const existing = await this.check(key);

    if (!existing) {
      return { isReplay: false };
    }

    const existingStr = JSON.stringify(existing.payload);
    const currentStr = JSON.stringify(currentPayload);

    if (existingStr === currentStr) {
      this.logger.debug(`Idempotent replay detected: ${key}`);
      return { isReplay: true, existing };
    }

    throw new ConflictException(
      `Idempotency conflict: key "${key}" already used with a different payload`,
    );
  }
}