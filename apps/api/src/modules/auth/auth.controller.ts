// apps/api/src/modules/auth/auth.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import type { LoginDto } from './dto/login.dto';
import { LoginSchema, LoginSwaggerSchema } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { RegisterSchema, RegisterSwaggerSchema } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login user and return JWT token' })
  @ApiBody({ schema: LoginSwaggerSchema })
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register new user and return JWT token' })
  @ApiBody({ schema: RegisterSwaggerSchema })
  @UsePipes(new ZodValidationPipe(RegisterSchema))
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}
