// apps/api/src/modules/notifications/notifications.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { CreateNotificationDto } from './dto/create-notification.dto';
import { CreateNotificationSchema } from './dto/create-notification.dto';
import { NotificationsService } from './notifications.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Send notification to user' })
  @UsePipes(new ZodValidationPipe(CreateNotificationSchema))
  async createNotification(
    @Body() dto: CreateNotificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.createNotification(dto, user.id);
  }
}