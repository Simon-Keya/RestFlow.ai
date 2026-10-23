// apps/api/src/core/test.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventStoreService } from './event-store.service';

@ApiTags('test')
@Controller('test')
export class TestController {
  constructor(private readonly eventStore: EventStoreService) {}

  @Post('append-event')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Temporary: Append a test event (for debugging)' })
  @ApiResponse({ status: 201, description: 'Event appended successfully' })
  async appendTestEvent(@Body() body: any) {
    const event = await this.eventStore.appendEvent({
      event_type: body.event_type || 'test_event',
      actor_user_id: 'test-user',
      idempotency_key: body.idempotency_key || Date.now().toString(),
      batch_number: body.batch_number,
      expiry_date: body.expiry_date ? new Date(body.expiry_date) : undefined,
      waste_reason: body.waste_reason,
      waste_photo_url: body.waste_photo_url,
      payload: body.payload || { message: 'This is a test payload' },
    });

    return {
      status: 'success',
      eventId: event.id,
      createdAt: event.created_at,
    };
  }
}
