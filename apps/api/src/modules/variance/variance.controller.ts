// apps/api/src/modules/variance/variance.controller.ts
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
import type { SubmitReasonDto } from './dto/submit-reason.dto';
import { SubmitReasonSchema } from './dto/submit-reason.dto';
import type { FlagBatchDto } from './dto/flag-batch.dto';
import { FlagBatchSchema } from './dto/flag-batch.dto';
import { VarianceService } from './variance.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('variance')
@ApiBearerAuth()
@Controller('variance')
@UseGuards(RolesGuard)
export class VarianceController {
  constructor(private readonly varianceService: VarianceService) {}

  @Get('batches')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'List variance batches' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async listBatches(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return await this.varianceService.listBatches({
      shopId: scopedShop,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
    });
  }

  @Get('batches/:batchId')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get variance batch detail with lines' })
  async getBatch(@Param('batchId') batchId: string) {
    return await this.varianceService.getBatch(batchId);
  }

  @Post('batches/:batchId/reason')
  @HttpCode(HttpStatus.OK)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Assign reason code' })
  @UsePipes(new ZodValidationPipe(SubmitReasonSchema))
  async submitReason(
    @Param('batchId') batchId: string,
    @Body() body: SubmitReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.varianceService.submitReason(batchId, body, user.id);
  }

  @Post('batches/:batchId/flag')
  @HttpCode(HttpStatus.OK)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Flag or unflag a variance batch' })
  @UsePipes(new ZodValidationPipe(FlagBatchSchema))
  async flagBatch(
    @Param('batchId') batchId: string,
    @Body() body: FlagBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.varianceService.flagBatch(batchId, body, user.id);
  }
}
