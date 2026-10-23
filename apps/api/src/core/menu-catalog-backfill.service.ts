// apps/api/src/core/menu-catalog-backfill.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

/**
 * One-shot / on-demand backfill of MenuCatalogProjection, MenuCategory, Combo
 * from historical events so listMenus/listCombos cold paths never fold events.
 */
@Injectable()
export class MenuCatalogBackfillService {
  private readonly logger = new Logger(MenuCatalogBackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  async backfillShop(shopId: string = '1'): Promise<{
    shopId: string;
    menusUpserted: number;
    categoriesUpserted: number;
    combosUpserted: number;
    eventsScanned: number;
  }> {
    this.logger.log(`Menu catalog backfill for shop ${shopId}`);

    const events = await this.prisma.event.findMany({
      where: {
        shop_id: shopId,
        event_type: {
          in: [
            'menu_created',
            'menu_item_added',
            'menu_category_created',
            'menu_category_updated',
            'combo_created',
            'combo_updated',
          ],
        },
      },
      orderBy: { created_at: 'asc' },
      take: 5000,
      select: {
        id: true,
        event_type: true,
        item_id: true,
        payload: true,
        shop_id: true,
        created_at: true,
      },
    });

    let menusUpserted = 0;
    let categoriesUpserted = 0;
    let combosUpserted = 0;

    const db = this.prisma as any;

    for (const e of events) {
      const p = asRecord(e.payload);
      const sid = asString(e.shop_id || p.shop_id || p.shopId, shopId);

      if (
        e.event_type === 'menu_created' ||
        e.event_type === 'menu_item_added'
      ) {
        const menuId = asString(p.menu_id ?? p.menuId ?? e.item_id);
        if (!menuId) continue;
        const name = asString(p.name, menuId);
        const payload = {
          ...p,
          menu_id: menuId,
          menuId,
          shop_id: sid,
          event_type: e.event_type,
        };
        await db.menuCatalogProjection.upsert({
          where: {
            shop_id_menu_id: { shop_id: sid, menu_id: menuId },
          },
          create: {
            shop_id: sid,
            menu_id: menuId,
            name,
            payload,
            active: p.is_available !== false && p.isAvailable !== false,
          },
          update: {
            name,
            payload,
            active: p.is_available !== false && p.isAvailable !== false,
          },
        });
        menusUpserted += 1;
      }

      if (
        e.event_type === 'menu_category_created' ||
        e.event_type === 'menu_category_updated'
      ) {
        const categoryId = asString(
          p.category_id ?? p.categoryId ?? e.item_id,
        );
        if (!categoryId) continue;
        const name = asString(p.name, categoryId);
        await db.menuCategory.upsert({
          where: {
            shop_id_category_id: { shop_id: sid, category_id: categoryId },
          },
          create: {
            shop_id: sid,
            category_id: categoryId,
            name,
            active: true,
          },
          update: { name, active: true },
        });
        categoriesUpserted += 1;
      }

      if (
        e.event_type === 'combo_created' ||
        e.event_type === 'combo_updated'
      ) {
        const comboId = asString(p.combo_id ?? p.comboId ?? e.item_id);
        if (!comboId) continue;
        const name = asString(p.name, comboId);
        const price = Number(p.selling_price ?? p.sellingPrice ?? 0) || 0;
        await db.combo.upsert({
          where: {
            shop_id_combo_id: { shop_id: sid, combo_id: comboId },
          },
          create: {
            shop_id: sid,
            combo_id: comboId,
            name,
            selling_price: price,
            active: true,
          },
          update: {
            name,
            selling_price: price,
            active: true,
          },
        });
        combosUpserted += 1;
      }
    }

    this.logger.log(
      `Menu catalog backfill done shop=${shopId} menus=${menusUpserted} cats=${categoriesUpserted} combos=${combosUpserted} events=${events.length}`,
    );

    return {
      shopId,
      menusUpserted,
      categoriesUpserted,
      combosUpserted,
      eventsScanned: events.length,
    };
  }

  /** Backfill every distinct shop_id present on menu-related events. */
  async backfillAllShops(): Promise<{
    shops: number;
    totals: {
      menusUpserted: number;
      categoriesUpserted: number;
      combosUpserted: number;
      eventsScanned: number;
    };
  }> {
    const rows = await this.prisma.event.findMany({
      where: {
        event_type: {
          in: [
            'menu_created',
            'menu_item_added',
            'menu_category_created',
            'menu_category_updated',
            'combo_created',
            'combo_updated',
          ],
        },
      },
      distinct: ['shop_id'],
      select: { shop_id: true },
      take: 100,
    });

    const shopIds = [
      ...new Set(rows.map((r) => r.shop_id || '1').filter(Boolean)),
    ];
    if (shopIds.length === 0) shopIds.push('1');

    const totals = {
      menusUpserted: 0,
      categoriesUpserted: 0,
      combosUpserted: 0,
      eventsScanned: 0,
    };

    for (const shopId of shopIds) {
      const r = await this.backfillShop(shopId);
      totals.menusUpserted += r.menusUpserted;
      totals.categoriesUpserted += r.categoriesUpserted;
      totals.combosUpserted += r.combosUpserted;
      totals.eventsScanned += r.eventsScanned;
    }

    return { shops: shopIds.length, totals };
  }
}
