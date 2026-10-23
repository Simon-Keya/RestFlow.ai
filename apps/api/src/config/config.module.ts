// apps/api/src/config/config.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from './configuration';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
      // configuration() already throws in production if JWT_SECRET missing
      expandVariables: true,
    }),
  ],
})
export class ConfigModule {}