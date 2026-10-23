// apps/api/src/modules/refill/refill.controller.ts
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
import {
  RefillRequestSchema,
  type RefillRequestDto,
} from './dto/refill-request.dto';
import { RefillIssueSchema, type RefillIssueDto } from './dto/refill-issue.dto';
import { RefillService } from './refill.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('refill')
@ApiBearerAuth()
@Controller('refill')
@UseGuards(RolesGuard)
export class RefillController {
  constructor(private readonly refillService: RefillService) {}

  @Get('pending')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'List pending refill requests + low-stock suggestions',
  })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async getPending(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    return await this.refillService.getPending(scopedShop);
  }

  @Get('requests/:requestId')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Refill request detail and timeline' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  async getDetail(
    @CurrentShop() scopedShop: string,
    @Param('requestId') requestId: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    return await this.refillService.getDetail(
      requestId,
      scopedShop,
    );
  }

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Request a refill' })
  @UsePipes(new ZodValidationPipe(RefillRequestSchema))
  async request(
    @Body() dto: RefillRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.refillService.requestRefill(dto, user.id);
  }

  @Post('issue')
  @HttpCode(HttpStatus.OK)
  @Roles('MANAGER', 'ADMIN', 'KITCHEN')
  @ApiOperation({ summary: 'Issue a refill (fulfill request or suggestion)' })
  @UsePipes(new ZodValidationPipe(RefillIssueSchema))
  async issue(
    @Body() dto: RefillIssueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return await this.refillService.issueRefill(dto, user.id);
  }
}
