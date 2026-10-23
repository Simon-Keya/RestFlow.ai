// apps/api/src/modules/recipe/recipe.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
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
import type { CreateRecipeDto } from './dto/create-recipe.dto';
import { CreateRecipeSchema } from './dto/create-recipe.dto';
import type { RecipeIngredientDto } from './dto/recipe-ingredient.dto';
import { RecipeIngredientSchema } from './dto/recipe-ingredient.dto';
import type { RecipeOutputDto } from './dto/recipe-output.dto';
import { RecipeOutputSchema } from './dto/recipe-output.dto';
import type { UpdateRecipeDto } from './dto/update-recipe.dto';
import { UpdateRecipeSchema } from './dto/update-recipe.dto';
import { RecipeService } from './recipe.service';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

@ApiTags('recipe')
@ApiBearerAuth()
@Controller('recipe')
@UseGuards(RolesGuard)
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @Get()
  @Roles('KITCHEN', 'MANAGER', 'ADMIN', 'POS')
  @ApiOperation({
    summary: 'List recipes (optional category filter + stock availability)',
  })
  @ApiQuery({ name: 'shopId', required: false })
  @ApiQuery({ name: 'shop_id', required: false })
  @ApiQuery({ name: 'category', required: false })
  async listRecipes(
    @CurrentShop() scopedShop: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
    @Query('category') category?: string,
  ) {
    return this.recipeService.listRecipes(scopedShop, category);
  }

  @Get('categories')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN', 'POS')
  @ApiOperation({
    summary: 'Distinct recipe categories (suggestions for free-type category)',
  })
  async listCategories() {
    return this.recipeService.listCategories();
  }

  @Get('item/:itemId')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN')
  @ApiOperation({ summary: 'Get recipe by finished item ID / SKU' })
  @ApiQuery({ name: 'shopId', required: false })
  async getByItemId(
    @CurrentShop() scopedShop: string,
    @Param('itemId') itemId: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    return this.recipeService.getRecipeByItemId(
      itemId,
      scopedShop,
    );
  }

  @Get(':recipeId/availability')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN', 'POS')
  @ApiOperation({ summary: 'Max portions available from current stock' })
  @ApiQuery({ name: 'shopId', required: false })
  async availability(
    @CurrentShop() scopedShop: string,
    @Param('recipeId') recipeId: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    return this.recipeService.getAvailability(
      recipeId,
      scopedShop,
    );
  }

  @Get(':recipeId')
  @Roles('KITCHEN', 'MANAGER', 'ADMIN', 'POS')
  @ApiOperation({
    summary: 'Get one recipe (ingredients + outputs + availability)',
  })
  @ApiQuery({ name: 'shopId', required: false })
  async getById(
    @CurrentShop() scopedShop: string,
    @Param('recipeId') recipeId: string,
    @Query('shopId') shopId?: string,
    @Query('shop_id') shop_id?: string,
  ) {
    return this.recipeService.getRecipeById(recipeId, scopedShop);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create recipe with optional multi-output sizes' })
  async createRecipe(
    @Body(new ZodValidationPipe(CreateRecipeSchema)) dto: CreateRecipeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recipeService.createRecipe(dto, user.id);
  }

  @Post('ingredient')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Add ingredient to a recipe' })
  async addIngredient(
    @Body(new ZodValidationPipe(RecipeIngredientSchema))
    dto: RecipeIngredientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recipeService.addIngredient(dto, user.id);
  }

  @Post(':recipeId/outputs')
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Add an output size to a recipe' })
  async addOutput(
    @Param('recipeId') recipeId: string,
    @Body(new ZodValidationPipe(RecipeOutputSchema)) dto: RecipeOutputDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recipeService.addOutput(
      { ...dto, recipe_id: recipeId },
      user.id,
    );
  }

  @Put(':recipeId')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update recipe header' })
  async updateRecipe(
    @Param('recipeId') recipeId: string,
    @Body(new ZodValidationPipe(UpdateRecipeSchema)) dto: UpdateRecipeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recipeService.updateRecipe(recipeId, dto, user.id);
  }
}
