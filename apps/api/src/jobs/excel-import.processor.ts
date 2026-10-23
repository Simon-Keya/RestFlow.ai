// apps/api/src/jobs/excel-import.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import * as ExcelJS from 'exceljs';
import { EventStoreService } from '../core/event-store.service';

@Processor('excel-import')
@Injectable()
export class ExcelImportProcessor {
  private readonly logger = new Logger(ExcelImportProcessor.name);

  constructor(private readonly eventStore: EventStoreService) {}

  @Process('import-raos-excel')
  async handleExcelImport(job: Job<{ filePath: string }>) {
    const { filePath } = job.data;
    this.logger.log(`Excel import: ${filePath}`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet('Received');
    if (!worksheet) {
      throw new Error('Worksheet "Received" not found');
    }

    let imported = 0;

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const itemId = row.getCell(1).value?.toString()?.trim();
      const quantity = Number(row.getCell(4).value || 0);
      const unitCost = Number(row.getCell(9).value || 0);
      const expiryDateRaw = row.getCell(8).value;

      if (!itemId || quantity <= 0) continue;

      let expiryDate: Date | undefined;
      if (typeof expiryDateRaw === 'number') {
        // Excel serial date → JS Date
        expiryDate = new Date((expiryDateRaw - 25569) * 86400 * 1000);
      } else if (typeof expiryDateRaw === 'string') {
        expiryDate = new Date(expiryDateRaw);
      }

      // Stable key — re-import of same file is safe
      const idempotencyKey = `excel-import-${itemId}-row-${rowNumber}`;

      await this.eventStore.appendEvent({
        event_type: 'received',
        actor_user_id: 'system-import',
        idempotency_key: idempotencyKey,
        batch_number: `IMPORT-ROW-${rowNumber}`,
        expiry_date: expiryDate,
        payload: {
          item_id: itemId,
          quantity,
          quantity_approved: quantity,
          unit_cost: unitCost,
          total_cost: quantity * unitCost,
          source: 'excel-import',
          row: rowNumber,
        },
      });

      imported += 1;
    }

    this.logger.log(`Excel import done — ${imported} rows`);
    return { imported };
  }
}