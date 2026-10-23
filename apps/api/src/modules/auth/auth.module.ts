// apps/api/src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('jwt.secret') ||
          configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('jwt.secret / JWT_SECRET is not configured');
        }
        const expiresIn =
          configService.get<string>('jwt.expiresIn') ||
          configService.get<string>('JWT_EXPIRES_IN') ||
          '7d';
        return {
          secret,
          signOptions: {
            // Nest JWT types are strict; cast keeps '7d' style values valid
            expiresIn: expiresIn as `${number}d` | `${number}h` | number,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService],
  exports: [AuthService, JwtStrategy, JwtModule],
})
export class AuthModule {}