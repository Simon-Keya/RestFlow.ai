// apps/api/src/common/pipes/zod-validation.pipe.ts
import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    // Only validate request body when used at method level
    if (metadata.type && metadata.type !== 'body') {
      return value;
    }

    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
        }));

        // eslint-disable-next-line no-console
        console.error(
          '[ZodValidationPipe]',
          JSON.stringify({ body: value, issues }, null, 2),
        );

        throw new BadRequestException({
          message: 'Validation failed',
          errors: issues,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
