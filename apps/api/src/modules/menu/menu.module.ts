import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CoreModule } from '../../core/core.module';
import { AuthModule } from '../auth/auth.module';
import { FinishedGoodsModule } from '../finished-goods/finished-goods.module';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { MenuGateway } from './menu.gateway';
import { SellableResolutionService } from './sellable-resolution.service';
import { MenuCategoryService } from './menu-category.service';
import { ComboService } from './combo.service';
import { CatalogMenuItemService } from './catalog-menu-item.service';

@Module({
  imports: [
    CoreModule,
    AuthModule,
    FinishedGoodsModule,
    JwtModule.register({}),
  ],
  controllers: [MenuController],
  providers: [
    MenuService,
    MenuGateway,
    SellableResolutionService,
    MenuCategoryService,
    ComboService,
    CatalogMenuItemService,
  ],
  exports: [
    MenuService,
    SellableResolutionService,
    MenuCategoryService,
    ComboService,
    CatalogMenuItemService,
  ],
})
export class MenuModule {}
