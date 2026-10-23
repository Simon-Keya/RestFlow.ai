// apps/api/src/modules/received/received.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ReceiveGoodsDto } from './dto/receive-goods.dto';
import { ReceiveGoodsSchema } from './dto/receive-goods.dto';
import { ReceivedService } from './received.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('received')
@ApiBearerAuth()
@Controller('received')
@UseGuards(RolesGuard)
export class ReceivedController {
  constructor(private readonly receivedService: ReceivedService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Record Goods Received Note (GRN)',
    description:
      'Append-only event with auto-calculated total_cost = quantity_approved × unit_cost',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        item_id: { type: 'string' },
        item_name: { type: 'string' },
        units: { type: 'string' },
        quantity: { type: 'number' },
        quantity_approved: { type: 'number', nullable: true },
        quantity_rejected: { type: 'number', nullable: true },
        date_received: { type: 'string', format: 'date' },
        expiry_date: { type: 'string', format: 'date' },
        unit_cost: { type: 'number' },
        total_cost: { type: 'number', nullable: true },
        supplier_name: { type: 'string', nullable: true },
        supplier_number: { type: 'string', nullable: true },
        supplier_id: { type: 'string', nullable: true },
        approved_by: { type: 'string', nullable: true },
        batch_number: { type: 'string' },
        payload: { type: 'object', additionalProperties: true, nullable: true },
      },
      required: [
        'item_id',
        'item_name',
        'units',
        'quantity',
        'date_received',
        'expiry_date',
        'unit_cost',
        'batch_number',
      ],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Event recorded successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Idempotency key conflict',
  })
  async receiveGoods(
    @Body(new ZodValidationPipe(ReceiveGoodsSchema)) dto: ReceiveGoodsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.receivedService.receiveGoods(dto, user.id);
  }
}
