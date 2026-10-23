// apps/api/src/modules/approvals/approvals.controller.ts
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
import type { ApproveApprovalDto } from './dto/approve-approval.dto';
import { ApproveApprovalSchema } from './dto/approve-approval.dto';
import type { RejectApprovalDto } from './dto/reject-approval.dto';
import { RejectApprovalSchema } from './dto/reject-approval.dto';
import { ApprovalsService } from './approvals.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('approvals')
@ApiBearerAuth()
@Controller('approvals')
@UseGuards(RolesGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('pending')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'List pending approvals for a shop' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  @ApiQuery({ name: 'type', required: false })
  async getPending(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
    @Query('type') type?: string,
  ) {
    return await this.approvalsService.getPending(
      scopedShop,
      type,
    );
  }

  @Get('history')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'List recently decided approvals' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getHistory(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.approvalsService.getHistory(
      scopedShop,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get(':approvalId')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get one approval by event id' })
  async getOne(@Param('approvalId') approvalId: string) {
    return await this.approvalsService.getById(approvalId);
  }

  @Post(':approvalId/approve')
  @HttpCode(HttpStatus.OK)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Approve a pending request' })
  @UsePipes(new ZodValidationPipe(ApproveApprovalSchema))
  async approve(
    @Param('approvalId') approvalId: string,
    @Body() body: ApproveApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.approvalsService.approve(approvalId, user.id, body.note);
  }

  @Post(':approvalId/reject')
  @HttpCode(HttpStatus.OK)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Reject a pending request' })
  @UsePipes(new ZodValidationPipe(RejectApprovalSchema))
  async reject(
    @Param('approvalId') approvalId: string,
    @Body() body: RejectApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.approvalsService.reject(approvalId, user.id, body.reason);
  }
}
