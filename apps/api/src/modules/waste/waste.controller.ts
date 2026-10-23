// apps/api/src/modules/waste/waste.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentShop } from '../../common/decorators/current-shop.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { RecordWasteDto } from './dto/record-waste.dto';
import { RecordWasteSchema } from './dto/record-waste.dto';
import { WasteService } from './waste.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

/** Date-only (YYYY-MM-DD) → inclusive UTC day bounds */
function parseStartDate(value: string): Date {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00.000Z`);
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setUTCDate(fallback.getUTCDate() - 30);
    fallback.setUTCHours(0, 0, 0, 0);
    return fallback;
  }
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseEndDate(value: string): Date {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T23:59:59.999Z`);
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    return new Date();
  }
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

@ApiTags('waste')
@ApiBearerAuth()
@Controller('waste')
@UseGuards(RolesGuard)
export class WasteController {
  constructor(private readonly wasteService: WasteService) {}

  @Post('record')
  @HttpCode(HttpStatus.CREATED)
  @Roles('MANAGER', 'KITCHEN', 'ADMIN')
  @ApiOperation({ summary: 'Record waste event from any module' })
  @UsePipes(new ZodValidationPipe(RecordWasteSchema))
  async recordWaste(
    @Body() dto: RecordWasteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wasteService.recordWaste(dto, user.id);
  }

  @Post('write-off-expired')
  @HttpCode(HttpStatus.OK)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Write off expired stock as waste (one item or whole shop)',
  })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async writeOffExpired(
    @CurrentShop() scopedShop: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
    @Body() body?: { item_id?: string; itemId?: string },
  ) {
    return this.wasteService.writeOffExpired({
      shopId: scopedShop,
      actorUserId: user.id,
      itemId: body?.item_id ?? body?.itemId,
    });
  }

  @Get('expired-candidates')
  @Roles('MANAGER', 'ADMIN', 'KITCHEN')
  @ApiOperation({ summary: 'List items eligible for expired write-off' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async expiredCandidates(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    return this.wasteService.listExpiredCandidates(scopedShop);
  }

  @Get('analytics')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get waste analytics' })
  @ApiQuery({ name: 'start_date', required: false })
  @ApiQuery({ name: 'end_date', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'shopId', required: false })
  async getAnalytics(
    @CurrentShop() scopedShop: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('shopId') shopId?: string,
  ) {
    const start = startDate || from;
    const end = endDate || to;

    return this.wasteService.getWasteAnalytics({
      start_date: start ? parseStartDate(start) : this.defaultStart(),
      end_date: end ? parseEndDate(end) : new Date(),
      shop_id: scopedShop,
    });
  }

  @Get('events')
  @Roles('MANAGER', 'ADMIN', 'KITCHEN')
  @ApiOperation({ summary: 'Paginated waste events' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async listEvents(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.wasteService.listEvents({
      shopId: scopedShop,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
      from: from ? parseStartDate(from) : undefined,
      to: to ? parseEndDate(to) : undefined,
    });
  }

  @Get('events/:eventId')
  @Roles('MANAGER', 'ADMIN', 'KITCHEN')
  @ApiOperation({ summary: 'Get one waste event' })
  async getEvent(@Param('eventId') eventId: string) {
    return this.wasteService.getEvent(eventId);
  }

  private defaultStart(): Date {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
}
