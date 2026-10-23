// apps/api/src/modules/production/production.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Param,
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
import type { StartProductionDto } from './dto/start-production.dto';
import { StartProductionSchema } from './dto/start-production.dto';
import type { FinishProductionDto } from './dto/finish-production.dto';
import { FinishProductionSchema } from './dto/finish-production.dto';
import type { PrePrepDto } from './dto/pre-prep.dto';
import { PrePrepSchema } from './dto/pre-prep.dto';
import {
  ProductionService,
  type FinishProductionResult,
  type StartProductionResult,
} from './production.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('production')
@ApiBearerAuth()
@Controller('production')
@UseGuards(RolesGuard)
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Get('trace/raw-batch/:batchId')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Trace finished goods produced from a raw stock batch' })
  rawBatchTrace(@CurrentShop() scopedShop: string, @Param('batchId') batchId: string) {
    return this.productionService.getRawBatchTrace(batchId, scopedShop);
  }

  @Get('trace')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Trace raw batch inputs and finished batch for a production run' })
  async productionTrace(@CurrentShop() scopedShop: string, @Query('productionId') productionId?: string) {
    if (!productionId) return { success: false, message: 'productionId is required' };
    return this.productionService.getProductionTrace(productionId, scopedShop);
  }

  @Get('history')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Finished production history' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  @ApiQuery({ name: 'limit', required: false })
  history(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
    @Query('limit') _limit?: string,
  ) {
    return {
      success: true,
      shop_id: scopedShop,
      items: [],
      history: [],
      count: 0,
    };
  }

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Start a new production run' })
  @UsePipes(new ZodValidationPipe(StartProductionSchema))
  async startProduction(
    @Body() dto: StartProductionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StartProductionResult> {
    return await this.productionService.startProduction(dto, user.id);
  }

  @Post('pre-prep')
  @HttpCode(HttpStatus.CREATED)
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({
    summary:
      'Pre-prep: raw → prepped FG; lost = original − yielded (system-calculated)',
  })
  @UsePipes(new ZodValidationPipe(PrePrepSchema))
  async prePrep(
    @Body() dto: PrePrepDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.productionService.prePrep(dto, user.id);
  }

  @Post('finish')
  @HttpCode(HttpStatus.CREATED)
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Finish production and record output + waste' })
  @UsePipes(new ZodValidationPipe(FinishProductionSchema))
  async finishProduction(
    @Body() dto: FinishProductionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FinishProductionResult> {
    return await this.productionService.finishProduction(dto, user.id);
  }
}
