import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MenuProductionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventStoreService } from '../../core/event-store.service';
import { toMoneyNumber } from '../../common/utils/money.util';

@Injectable()
export class CatalogMenuItemService {
  private readonly logger = new Logger(CatalogMenuItemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStoreService,
  ) {}

  async list(shopId: string) {
    const rows = await this.prisma.catalogMenuItem.findMany({
      where: { shop_id: shopId },
      orderBy: { name: 'asc' },
    });
    return {
      success: true,
      items: rows.map((r) => ({
        menuItemId: r.menu_item_id,
        name: r.name,
        productionType: r.production_type,
        recipeId: r.recipe_id,
        stockItemId: r.stock_item_id,
        sellingPrice: Number(r.selling_price),
        active: r.active,
        shopId: r.shop_id,
      })),
      count: rows.length,
    };
  }

  async create(
    dto: {
      menu_item_id?: string;
      name: string;
      production_type: 'recipe' | 'stocked';
      recipe_id?: string;
      stock_item_id?: string;
      selling_price: number;
      shop_id: string;
      active?: boolean;
    },
    actorUserId: string,
  ) {
    const shopId = dto.shop_id;
    const name = String(dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Name is required');

    const productionType = dto.production_type;
    if (productionType !== 'recipe' && productionType !== 'stocked') {
      throw new BadRequestException('production_type must be recipe or stocked');
    }
    if (productionType === 'recipe' && !dto.recipe_id?.trim()) {
      throw new BadRequestException('recipe_id is required for recipe items');
    }
    if (productionType === 'stocked' && !dto.stock_item_id?.trim()) {
      throw new BadRequestException(
        'stock_item_id is required for stocked items',
      );
    }
    if (productionType === 'recipe' && dto.stock_item_id) {
      throw new BadRequestException(
        'stock_item_id must be empty for recipe items',
      );
    }
    if (productionType === 'stocked' && dto.recipe_id) {
      throw new BadRequestException('recipe_id must be empty for stocked items');
    }

    if (productionType === 'recipe' && dto.recipe_id) {
      const recipe = await this.prisma.recipe.findFirst({
        where: {
          OR: [{ id: dto.recipe_id }, { recipe_code: dto.recipe_id }],
        },
      });
      if (!recipe) throw new BadRequestException('Recipe not found');
    }
    if (productionType === 'stocked' && dto.stock_item_id) {
      const item = await this.prisma.item.findFirst({
        where: { item_id: dto.stock_item_id },
      });
      if (!item) throw new BadRequestException('Inventory SKU not found');
    }

    const menuItemId =
      (dto.menu_item_id && dto.menu_item_id.trim()) ||
      `MI-${Date.now().toString(36)}`;
    const price = toMoneyNumber(dto.selling_price);

    const event = await this.eventStore.appendEvent({
      event_type: 'menu_item_created',
      actor_user_id: actorUserId,
      idempotency_key: `catalog-menu-item-${shopId}-${menuItemId}`,
      item_id: menuItemId,
      total_cost: price,
      payload: {
        menu_item_id: menuItemId,
        name,
        production_type: productionType,
        recipe_id: dto.recipe_id ?? null,
        stock_item_id: dto.stock_item_id ?? null,
        selling_price: price,
        shop_id: shopId,
        active: dto.active !== false,
      },
    });

    await this.prisma.catalogMenuItem.upsert({
      where: {
        shop_id_menu_item_id: { shop_id: shopId, menu_item_id: menuItemId },
      },
      create: {
        menu_item_id: menuItemId,
        shop_id: shopId,
        name,
        production_type: productionType as MenuProductionType,
        recipe_id: productionType === 'recipe' ? dto.recipe_id : null,
        stock_item_id: productionType === 'stocked' ? dto.stock_item_id : null,
        selling_price: new Prisma.Decimal(price),
        active: dto.active !== false,
      },
      update: {
        name,
        production_type: productionType as MenuProductionType,
        recipe_id: productionType === 'recipe' ? dto.recipe_id : null,
        stock_item_id: productionType === 'stocked' ? dto.stock_item_id : null,
        selling_price: new Prisma.Decimal(price),
        active: dto.active !== false,
      },
    });

    return {
      success: true,
      menuItemId,
      eventId: event.id,
      name,
      productionType,
      sellingPrice: price,
    };
  }
  async update(
    shopId: string,
    menuItemId: string,
    dto: {
      name?: string;
      selling_price?: number;
      active?: boolean;
      recipe_id?: string | null;
      stock_item_id?: string | null;
      production_type?: 'recipe' | 'stocked';
    },
    actorUserId: string,
  ) {
    const existing = await this.prisma.catalogMenuItem.findFirst({
      where: { shop_id: shopId, menu_item_id: menuItemId },
    });
    if (!existing) {
      throw new NotFoundException(`Catalog item not found: ${menuItemId}`);
    }

    const name =
      dto.name !== undefined ? String(dto.name).trim() : existing.name;
    if (!name) throw new BadRequestException('Name is required');

    const price =
      dto.selling_price !== undefined
        ? toMoneyNumber(dto.selling_price)
        : Number(existing.selling_price);

    const active = dto.active !== undefined ? dto.active : existing.active;
    const productionType = (dto.production_type ??
      existing.production_type) as MenuProductionType;
    const recipeId =
      dto.recipe_id !== undefined ? dto.recipe_id : existing.recipe_id;
    const stockItemId =
      dto.stock_item_id !== undefined
        ? dto.stock_item_id
        : existing.stock_item_id;

    await this.eventStore.appendEvent({
      event_type: 'menu_item_updated',
      actor_user_id: actorUserId,
      idempotency_key: `catalog-menu-item-update-${shopId}-${menuItemId}-${Date.now()}`,
      item_id: menuItemId,
      total_cost: price,
      payload: {
        menu_item_id: menuItemId,
        name,
        selling_price: price,
        active,
        production_type: productionType,
        recipe_id: recipeId,
        stock_item_id: stockItemId,
        shop_id: shopId,
        previous_name: existing.name,
        previous_price: Number(existing.selling_price),
        previous_active: existing.active,
      },
    });

    const row = await this.prisma.catalogMenuItem.update({
      where: { id: existing.id },
      data: {
        name,
        selling_price: new Prisma.Decimal(price),
        active,
        production_type: productionType,
        recipe_id: productionType === 'recipe' ? recipeId : null,
        stock_item_id: productionType === 'stocked' ? stockItemId : null,
      },
    });

    await this.prisma.menuCatalogProjection.updateMany({
      where: { shop_id: shopId, menu_id: menuItemId },
      data: { name, active },
    });

    this.logger.log(
      `Catalog item updated: ${menuItemId} → ${name} @ ${price} active=${active}`,
    );

    return {
      success: true,
      menuItemId: row.menu_item_id,
      name: row.name,
      sellingPrice: Number(row.selling_price),
      active: row.active,
    };
  }

}
