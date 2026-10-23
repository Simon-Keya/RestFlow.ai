// apps/api/src/modules/finished-goods/finished-goods.controller.ts
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
import type { CreateFinishedGoodDto } from './dto/create-finished-good.dto';
import { CreateFinishedGoodSchema } from './dto/create-finished-good.dto';
import type { AdjustFinishedGoodDto } from './dto/adjust-finished-good.dto';
import { AdjustFinishedGoodSchema } from './dto/adjust-finished-good.dto';
import { FinishedGoodsService } from './finished-goods.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('finished-goods')
@ApiBearerAuth()
@Controller('finished-goods')
@UseGuards(RolesGuard)
export class FinishedGoodsController {
  constructor(private readonly finishedGoodsService: FinishedGoodsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Add finished goods from production' })
  @UsePipes(new ZodValidationPipe(CreateFinishedGoodSchema))
  async addFinishedGoods(
    @Body() dto: CreateFinishedGoodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finishedGoodsService.addFinishedGoods(dto, user.id);
  }

  @Post('adjust')
  @HttpCode(HttpStatus.OK)
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Adjust finished goods stock (damage, sale deduction, etc.)',
  })
  @UsePipes(new ZodValidationPipe(AdjustFinishedGoodSchema))
  async adjustStock(
    @Body() dto: AdjustFinishedGoodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finishedGoodsService.adjustStock(dto, user.id);
  }
}