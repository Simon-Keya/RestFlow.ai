import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
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
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  ChangeRoleSchema,
  type ChangeRoleDto,
} from './dto/change-role.dto';
import { UsersService } from './users.service';

interface AuthUser {
  id: string;
  email?: string;
  role: string;
  shop_id?: string;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getCurrentUser(@CurrentUser() user: AuthUser) {
    const userData = await this.usersService.findById(user.id);
    if (!userData) throw new NotFoundException('User not found');
    return userData;
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List users (ADMIN / MANAGER)' })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'search', required: false })
  async listUsers(
    @CurrentUser() actor: AuthUser,
    @Query('shopId') shopId?: string,
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    const effectiveShop =
      actor.role === 'ADMIN' ? shopId || undefined : actor.shop_id || shopId || '1';
    return this.usersService.findAll({
      shopId: effectiveShop,
      role,
      search,
      take: 200,
    });
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUserById(@Param('id') id: string) {
    const userData = await this.usersService.findById(id);
    if (!userData) throw new NotFoundException('User not found');
    return userData;
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Change user role (permission matrix enforced)' })
  @UsePipes(new ZodValidationPipe(ChangeRoleSchema))
  async changeRole(
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.usersService.changeRole(id, dto.role, {
      id: actor.id,
      email: actor.email,
      role: actor.role,
      shop_id: actor.shop_id,
    });
  }
}
