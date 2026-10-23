import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CoreModule } from '../core/core.module';
import { ExpirySweepProcessor } from './expiry-sweep.processor';
import { ProjectionRebuildProcessor } from './projection-rebuild.processor';
import { ExcelImportProcessor } from './excel-import.processor';
import { JobsSchedulerService } from './jobs-schedular.service';

@Module({
  imports: [
    CoreModule,
    ConfigModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: Number(config.get<string>('REDIS_PORT') || 6379),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: 'expiry-sweep' },
      { name: 'projection-rebuild' },
      { name: 'excel-import' },
    ),
  ],
  providers: [
    ExpirySweepProcessor,
    ProjectionRebuildProcessor,
    ExcelImportProcessor,
    JobsSchedulerService,
  ],
  exports: [BullModule],
})
export class JobsModule {}