import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [CoreModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
