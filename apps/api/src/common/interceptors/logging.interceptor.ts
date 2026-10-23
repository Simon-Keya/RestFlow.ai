// apps/api/src/common/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import {
  httpInFlight,
  metricsEnabled,
  recordHttp,
} from '../observability/metrics';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{
      method: string;
      url: string;
      headers: Record<string, string | string[] | undefined>;
      requestId?: string;
    }>();
    const response = http.getResponse<{
      statusCode: number;
      setHeader: (k: string, v: string) => void;
    }>();

    const method = request.method;
    const url = request.url;
    const now = Date.now();

    const incoming = request.headers['x-request-id'];
    const requestId =
      (typeof incoming === 'string' && incoming) ||
      (Array.isArray(incoming) && incoming[0]) ||
      randomUUID();
    request.requestId = requestId;
    response.setHeader('X-Request-ID', requestId);

    if (metricsEnabled() && url.split('?')[0] !== '/metrics') {
      httpInFlight.inc();
    }

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - now;
        const status = response.statusCode || 200;
        this.logLine(method, url, status, durationMs, requestId);
        this.record(method, url, status, durationMs);
      }),
      catchError((err) => {
        const durationMs = Date.now() - now;
        const status =
          typeof err?.status === 'number'
            ? err.status
            : typeof err?.getStatus === 'function'
              ? err.getStatus()
              : 500;
        this.logLine(method, url, status, durationMs, requestId);
        this.record(method, url, status, durationMs);
        throw err;
      }),
    );
  }

  private record(
    method: string,
    url: string,
    status: number,
    durationMs: number,
  ) {
    if (!metricsEnabled() || url.split('?')[0] === '/metrics') return;
    httpInFlight.dec();
    recordHttp(method, url, status, durationMs / 1000);
  }

  private logLine(
    method: string,
    url: string,
    status: number,
    durationMs: number,
    requestId: string,
  ) {
    const msg = `${method} ${url} ${status} ${durationMs}ms request_id=${requestId}`;
    if (status >= 500) {
      this.logger.error(msg);
    } else if (status >= 400) {
      this.logger.warn(msg);
    } else {
      this.logger.log(msg);
    }
  }
}
