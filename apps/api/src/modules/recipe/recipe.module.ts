// apps/api/src/modules/recipe/recipe.module.ts
import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';
import { RecipeCostingService } from './recipe-costing.service';

@Module({
  imports: [CoreModule, AuthModule, PrismaModule],
  controllers: [RecipeController],
  providers: [RecipeService, RecipeCostingService],
  exports: [RecipeService, RecipeCostingService],
})
export class RecipeModule {}
