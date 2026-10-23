// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { initSentry, flushSentry } from './common/observability/sentry';

/**
 * Render (and most PaaS) inject PORT. Prefer it over config so we never listen
 * on 3000 while the platform health-checks 10000.
 */
function resolvePort(configService?: ConfigService): number {
  const fromEnv = process.env.PORT?.trim();
  if (fromEnv && /^\d+$/.test(fromEnv)) {
    return parseInt(fromEnv, 10);
  }
  const fromConfig = configService?.get<number | string>('port');
  if (fromConfig !== undefined && fromConfig !== null && `${fromConfig}` !== '') {
    const n = parseInt(String(fromConfig), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 3000;
}

async function bootstrap() {
  // Log before Nest boots so Render logs show activity even if AppModule fails.
  const earlyLogger = new Logger('Bootstrap');
  earlyLogger.log(
    `Boot starting (node=${process.version}, PORT=${process.env.PORT ?? 'unset'}, NODE_ENV=${process.env.NODE_ENV ?? 'unset'})`,
  );

  initSentry();

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const corsOriginRaw =
    configService.get<string>('cors.origin') ||
    configService.get<string>('CORS_ORIGIN') ||
    process.env.CORS_ORIGIN ||
    '';

  const corsOrigin =
    !corsOriginRaw || corsOriginRaw.trim() === '*'
      ? true
      : corsOriginRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'Idempotency-Key',
      'X-Request-ID',
    ],
    exposedHeaders: ['Authorization', 'X-Request-ID'],
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('RestFlow API')
    .setDescription('Event-sourced restaurant inventory & POS system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // CRITICAL for Render: process.env.PORT first, then config, then 3000
  const port = resolvePort(configService);

  await app.listen(port, '0.0.0.0');

  logger.log(`Application running on: http://0.0.0.0:${port}`);
  logger.log(`Swagger docs: http://0.0.0.0:${port}/docs`);
  logger.log(
    `CORS origin mode: ${corsOrigin === true ? 'reflect' : (corsOrigin as string[]).join(', ')}`,
  );
  logger.log(
    `Sentry: ${process.env.SENTRY_DSN ? 'enabled' : 'disabled'}; Metrics: ${process.env.METRICS_ENABLED === 'false' ? 'disabled' : 'enabled'}`,
  );

  const shutdown = async (signal: string) => {
    logger.log(`Shutting down (${signal})…`);
    try {
      await flushSentry();
      await app.close();
    } catch (err) {
      logger.error('Error during shutdown', err as Error);
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch(async (err) => {
  const logger = new Logger('Bootstrap');
  logger.error('Bootstrap failed', err instanceof Error ? err.stack : err);
  try {
    await flushSentry();
  } catch {
    /* ignore */
  }
  process.exit(1);
});