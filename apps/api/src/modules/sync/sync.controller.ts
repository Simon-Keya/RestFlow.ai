// apps/api/src/modules/sync/sync.controller.ts
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
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SyncService, SyncAction } from './sync.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
@UseGuards(RolesGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @Roles('KITCHEN', 'POS', 'MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Bulk acknowledge offline actions',
    description:
      'Optional batch ACK for mobile queues. Domain writes should still use /received, /pos/order, etc.',
  })
  async bulkSync(
    @Body() body: { actions: SyncAction[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const actions = Array.isArray(body?.actions) ? body.actions : [];
    return this.syncService.bulkSync(actions, user.id);
  }
}