import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventStoreService } from '../../core/event-store.service';

type CategoryRow = {
  categoryId: string;
  name: string;
  active: boolean;
  shopId: string;
  menuItemIds: string[];
  menuItems: Array<{
    menuItemId: string;
    name: string;
    productionType?: string;
    sellingPrice?: number;
  }>;
  updatedAt: string;
};

@Injectable()
export class MenuCategoryService {
  private readonly logger = new Logger(MenuCategoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStoreService,
  ) {}

  /**
   * Membership is stored on the event payload (works for multi-component menu IDs).
   * CatalogMenuItem links are optional enrichment when those rows exist.
   */
  async list(shopId: string): Promise<{
    success: true;
    items: CategoryRow[];
    count: number;
    source: 'db' | 'events' | 'merged';
  }> {
    const fromEvents = await this.listFromEvents(shopId);
    const rows = await this.prisma.menuCategory.findMany({
      where: { shop_id: shopId },
      include: { items: { include: { menuItem: true } } },
      orderBy: { name: 'asc' },
    });

    if (rows.length === 0 && fromEvents.length === 0) {
      return { success: true, items: [], count: 0, source: 'db' };
    }

    const eventById = new Map(fromEvents.map((c) => [c.categoryId, c]));
    const nameLookup = await this.buildMenuNameLookup(shopId);

    if (rows.length === 0) {
      return {
        success: true,
        items: fromEvents.map((c) => this.withNames(c, nameLookup)),
        count: fromEvents.length,
        source: 'events',
      };
    }

    const items: CategoryRow[] = rows.map((r) => {
      const linkedIds = r.items.map((i) => i.menuItem.menu_item_id);
      const fromEv = eventById.get(r.category_id);
      const menuItemIds =
        linkedIds.length > 0 ? linkedIds : (fromEv?.menuItemIds ?? []);
      const base: CategoryRow = {
        categoryId: r.category_id,
        name: r.name || fromEv?.name || r.category_id,
        active: r.active,
        shopId: r.shop_id,
        menuItemIds,
        menuItems: r.items.map((i) => ({
          menuItemId: i.menuItem.menu_item_id,
          name: i.menuItem.name,
          productionType: i.menuItem.production_type,
          sellingPrice: Number(i.menuItem.selling_price),
        })),
        updatedAt: r.updated_at.toISOString(),
      };
      return this.withNames(base, nameLookup);
    });

    for (const ev of fromEvents) {
      if (!items.some((i) => i.categoryId === ev.categoryId)) {
        items.push(this.withNames(ev, nameLookup));
      }
    }

    items.sort((a, b) => a.name.localeCompare(b.name));
    return {
      success: true,
      items,
      count: items.length,
      source: 'merged',
    };
  }

  async create(
    dto: {
      category_id?: string;
      name: string;
      menu_item_ids?: string[];
      shop_id: string;
      notes?: string;
    },
    actorUserId: string,
  ) {
    const shopId = dto.shop_id;
    const name = String(dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Category name is required');

    const menuItemIds = (dto.menu_item_ids ?? [])
      .map((id) => String(id).trim())
      .filter(Boolean);

    const categoryId =
      (dto.category_id && dto.category_id.trim()) ||
      `MCAT-${Date.now().toString(36)}`;

    const idempotencyKey = `menu-category-${shopId}-${categoryId}-${Date.now().toString(36)}`;

    const event = await this.eventStore.appendEvent({
      event_type: 'menu_category_created',
      actor_user_id: actorUserId,
      idempotency_key: idempotencyKey,
      item_id: categoryId,
      payload: {
        category_id: categoryId,
        name,
        menu_item_ids: menuItemIds,
        shop_id: shopId,
        notes: dto.notes ?? null,
      },
    });

    const row = await this.prisma.menuCategory.upsert({
      where: {
        shop_id_category_id: { shop_id: shopId, category_id: categoryId },
      },
      create: {
        category_id: categoryId,
        shop_id: shopId,
        name,
        active: true,
      },
      update: { name, active: true },
    });

    await this.prisma.menuCategoryItem.deleteMany({
      where: { category_id: row.id },
    });
    for (const mid of menuItemIds) {
      const mi = await this.prisma.catalogMenuItem.findUnique({
        where: {
          shop_id_menu_item_id: { shop_id: shopId, menu_item_id: mid },
        },
      });
      if (!mi) continue;
      await this.prisma.menuCategoryItem.create({
        data: { category_id: row.id, menu_item_id: mi.id },
      });
    }

    this.logger.log(
      `Category ${categoryId} saved with ${menuItemIds.length} member id(s)`,
    );

    return {
      success: true,
      categoryId,
      eventId: event.id,
      name,
      menuItemIds,
    };
  }

  private async listFromEvents(shopId: string): Promise<CategoryRow[]> {
    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: 'menu_category_created',
      },
      orderBy: { created_at: 'asc' },
      take: 2000,
    });

    const map = new Map<string, CategoryRow>();
    for (const e of events) {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const categoryId = String(
        p.category_id ?? p.categoryId ?? e.item_id ?? '',
      ).trim();
      if (!categoryId) continue;
      const menuItemIds = Array.isArray(p.menu_item_ids)
        ? (p.menu_item_ids as unknown[])
            .map((x) => String(x).trim())
            .filter(Boolean)
        : Array.isArray(p.menuItemIds)
          ? (p.menuItemIds as unknown[])
              .map((x) => String(x).trim())
              .filter(Boolean)
          : [];
      map.set(categoryId, {
        categoryId,
        name: String(p.name ?? categoryId),
        active: true,
        shopId,
        menuItemIds,
        menuItems: [],
        updatedAt: e.created_at.toISOString(),
      });
    }
    return Array.from(map.values());
  }

  private async buildMenuNameLookup(
    shopId: string,
  ): Promise<Map<string, string>> {
    const lookup = new Map<string, string>();

    const menuEvents = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: { in: ['menu_created', 'menu_item_added'] },
      },
      orderBy: { created_at: 'asc' },
      take: 3000,
    });
    for (const e of menuEvents) {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const id = String(p.menu_id ?? p.menuId ?? e.item_id ?? '').trim();
      const name = String(p.name ?? p.menu_name ?? '').trim();
      if (id && name) lookup.set(id, name);
      const code = String(p.menu_code ?? p.menuCode ?? '').trim();
      if (code && name) lookup.set(code, name);
    }

    const catalog = await this.prisma.catalogMenuItem.findMany({
      where: { shop_id: shopId },
    });
    for (const c of catalog) {
      lookup.set(c.menu_item_id, c.name);
    }

    return lookup;
  }

  private withNames(
    row: CategoryRow,
    lookup: Map<string, string>,
  ): CategoryRow {
    const menuItems =
      row.menuItems.length > 0
        ? row.menuItems.map((m) => ({
            ...m,
            name: m.name || lookup.get(m.menuItemId) || m.menuItemId,
          }))
        : row.menuItemIds.map((id) => ({
            menuItemId: id,
            name: lookup.get(id) || id,
          }));
    return { ...row, menuItems };
  }
}
