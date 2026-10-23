// apps/api/src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { captureException } from '../observability/sentry';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<
      Request & { requestId?: string; user?: { id?: string; shopId?: string } }
    >();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorName = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as { message?: string | string[]; error?: string };
        message = b.message ?? message;
        errorName = b.error ?? HttpStatus[status] ?? errorName;
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    const requestId = request.requestId || '';
    const path = request.url;
    const method = request.method;

    this.logger.error(
      `${method} ${path} failed: ${Array.isArray(message) ? message.join(', ') : message} request_id=${requestId}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    if (status >= 500) {
      captureException(exception, {
        path: path?.split('?')[0] || '',
        method: method || '',
        request_id: requestId,
        shop_id: request.user?.shopId || '',
        user_id: request.user?.id || '',
      });
    }

    if (!response.headersSent) {
      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path,
        method,
        message,
        error: errorName,
        requestId: requestId || undefined,
      });
    }
  }
}
