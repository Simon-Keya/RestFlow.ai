import { BadRequestException } from '@nestjs/common';
import { FefoStockService } from './fefo-stock.service';

describe('FefoStockService batch allocation', () => {
  const makeService = (rows: Array<Record<string, unknown>>) => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue(rows),
      inventoryBatch: { update: jest.fn().mockResolvedValue({}) },
      inventoryMovement: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      inventoryBatch: {
        count: jest.fn().mockResolvedValue(rows.length),
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryProjection: {
        findUnique: jest.fn().mockResolvedValue({ available_stock: 7, avg_unit_cost: 10, total_value: 70 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    return { service: new FefoStockService(prisma as never), prisma, tx };
  };

  it('allocates across FEFO batches and writes one movement per slice', async () => {
    const { service, tx } = makeService([
      { id: 'batch-a', batch_number: 'A', qty_remaining: 1, unit_cost: 120, expiry_date: new Date('2026-10-16T00:00:00Z'), received_at: new Date('2026-10-01T00:00:00Z') },
      { id: 'batch-b', batch_number: 'B', qty_remaining: 2, unit_cost: 130, expiry_date: new Date('2026-10-22T00:00:00Z'), received_at: new Date('2026-10-02T00:00:00Z') },
    ]);
    const result = await service.consumeStock('1', 'SUGAR', 3, { referenceType: 'pos_sale', referenceId: 'sale-1' });
    expect(result.quantity).toBe(3);
    expect(result.slices.map((slice) => [slice.batchId, slice.quantity])).toEqual([['batch-a', 1], ['batch-b', 2]]);
    expect(tx.inventoryBatch.update).toHaveBeenCalledTimes(2);
    expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(2);
  });

  it('rejects insufficient usable stock before changing any batch', async () => {
    const { service, tx } = makeService([
      { id: 'batch-a', batch_number: 'A', qty_remaining: 1, unit_cost: 120, expiry_date: null, received_at: new Date('2026-10-01T00:00:00Z') },
    ]);
    await expect(service.consumeStock('1', 'SUGAR', 2)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.inventoryBatch.update).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('uses WAC for consumption valuation while retaining per-batch allocation costs in movements', async () => {
    const { service, tx } = makeService([
      { id: 'batch-a', batch_number: 'A', qty_remaining: 2, unit_cost: 120, expiry_date: null, received_at: new Date('2026-10-01T00:00:00Z') },
    ]);
    const result = await service.consumeStock('1', 'SUGAR', 1, { referenceType: 'pos_sale', referenceId: 'sale-2' });
    expect(result.unitCostWac).toBe(10);
    expect(result.value).toBe(10);
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ unit_cost: expect.anything(), quantity: -1 }) }));
  });
});
