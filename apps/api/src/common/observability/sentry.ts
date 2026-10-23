// apps/api/src/common/observability/sentry.ts
import * as Sentry from '@sentry/node';

let initialized = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ||
      process.env.NODE_ENV ||
      process.env.APP_ENV ||
      'development',
    release:
      process.env.SENTRY_RELEASE || process.env.RENDER_GIT_COMMIT || undefined,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['Authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['Cookie'];
      }
      return event;
    },
  });
  initialized = true;
}

export function isSentryEnabled(): boolean {
  return initialized;
}

export function captureException(
  error: unknown,
  tags?: Record<string, string>,
): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (tags) {
      for (const [k, v] of Object.entries(tags)) {
        scope.setTag(k, v);
      }
    }
    Sentry.captureException(error);
  });
}

export function captureMessage(
  message: string,
  tags?: Record<string, string>,
): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (tags) {
      for (const [k, v] of Object.entries(tags)) {
        scope.setTag(k, v);
      }
    }
    Sentry.captureMessage(message);
  });
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!initialized) return;
  await Sentry.flush(timeoutMs);
}
