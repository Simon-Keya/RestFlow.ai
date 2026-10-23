import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventStoreService } from '../../core/event-store.service';
import { toMoneyNumber } from '../../common/utils/money.util';

@Injectable()
export class ComboService {
  private readonly logger = new Logger(ComboService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStoreService,
  ) {}

  async list(shopId: string) {
    const rows = await this.prisma.combo.findMany({
      where: { shop_id: shopId },
      include: {
        groups: {
          include: { menuCategory: true },
          orderBy: { group_index: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    if (rows.length === 0) {
      return { success: true, items: [], count: 0, source: 'db' as const };
    }
    return {
      success: true,
      items: rows.map((r) => ({
        comboId: r.combo_id,
        name: r.name,
        sellingPrice: Number(r.selling_price),
        active: r.active,
        shopId: r.shop_id,
        selectionGroups: r.groups.map((g) => ({
          groupIndex: g.group_index,
          menuCategoryId: g.menuCategory.category_id,
          menuCategoryName: g.menuCategory.name,
          quantity: g.quantity,
        })),
        updatedAt: r.updated_at.toISOString(),
      })),
      count: rows.length,
      source: 'db' as const,
    };
  }

  async create(
    dto: {
      combo_id?: string;
      name: string;
      selling_price: number;
      selection_groups: Array<{
        menu_category_id: string;
        menu_category_name?: string;
        quantity: number;
      }>;
      shop_id: string;
      notes?: string;
    },
    actorUserId: string,
  ) {
    const shopId = dto.shop_id;
    const name = String(dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Combo name is required');
    const price = toMoneyNumber(dto.selling_price);
    if (price < 0) throw new BadRequestException('Invalid selling price');

    const groups = (dto.selection_groups ?? []).map((g, idx) => ({
      group_index: idx,
      menu_category_id: String(g.menu_category_id ?? '').trim(),
      menu_category_name: g.menu_category_name,
      quantity: Math.max(1, Number(g.quantity ?? 1)),
    }));
    if (!groups.length) {
      throw new BadRequestException('At least one selection group is required');
    }
    for (const g of groups) {
      if (!g.menu_category_id) {
        throw new BadRequestException('Each group needs menu_category_id');
      }
    }

    const comboId =
      (dto.combo_id && dto.combo_id.trim()) ||
      `COMBO-${Date.now().toString(36)}`;

    const event = await this.eventStore.appendEvent({
      event_type: 'combo_created',
      actor_user_id: actorUserId,
      idempotency_key: `combo-${shopId}-${comboId}`,
      item_id: comboId,
      total_cost: price,
      payload: {
        combo_id: comboId,
        name,
        selling_price: price,
        selection_groups: groups,
        shop_id: shopId,
        notes: dto.notes ?? null,
      },
    });

    const combo = await this.prisma.combo.upsert({
      where: { shop_id_combo_id: { shop_id: shopId, combo_id: comboId } },
      create: {
        combo_id: comboId,
        shop_id: shopId,
        name,
        selling_price: new Prisma.Decimal(price),
        active: true,
      },
      update: {
        name,
        selling_price: new Prisma.Decimal(price),
        active: true,
      },
    });

    // Replace groups
    await this.prisma.comboSelectionGroup.deleteMany({
      where: { combo_id: combo.id },
    });

    for (const g of groups) {
      const cat = await this.prisma.menuCategory.findUnique({
        where: {
          shop_id_category_id: {
            shop_id: shopId,
            category_id: g.menu_category_id,
          },
        },
      });
      if (!cat) {
        throw new BadRequestException(
          `Menu category not found in shop: ${g.menu_category_id}`,
        );
      }
      await this.prisma.comboSelectionGroup.create({
        data: {
          combo_id: combo.id,
          group_index: g.group_index,
          menu_category_id: cat.id,
          quantity: g.quantity,
        },
      });
    }

    return {
      success: true,
      comboId,
      eventId: event.id,
      name,
      sellingPrice: price,
      selectionGroups: groups,
    };
  }
  async update(
    shopId: string,
    comboId: string,
    dto: { name?: string; selling_price?: number; active?: boolean },
    actorUserId: string,
  ) {
    const existing = await this.prisma.combo.findFirst({
      where: { shop_id: shopId, combo_id: comboId },
    });
    if (!existing) {
      throw new NotFoundException(`Combo not found: ${comboId}`);
    }

    const name =
      dto.name !== undefined ? String(dto.name).trim() : existing.name;
    if (!name) throw new BadRequestException('Name is required');

    const price =
      dto.selling_price !== undefined
        ? toMoneyNumber(dto.selling_price)
        : Number(existing.selling_price);
    const active = dto.active !== undefined ? dto.active : existing.active;

    await this.eventStore.appendEvent({
      event_type: 'combo_updated',
      actor_user_id: actorUserId,
      idempotency_key: `combo-update-${shopId}-${comboId}-${Date.now()}`,
      item_id: comboId,
      total_cost: price,
      payload: {
        combo_id: comboId,
        name,
        selling_price: price,
        active,
        shop_id: shopId,
        previous_name: existing.name,
        previous_price: Number(existing.selling_price),
        previous_active: existing.active,
      },
    });

    const row = await this.prisma.combo.update({
      where: { id: existing.id },
      data: {
        name,
        selling_price: new Prisma.Decimal(price),
        active,
      },
    });

    this.logger.log(
      `Combo updated: ${comboId} → ${name} @ ${price} active=${active}`,
    );

    return {
      success: true,
      comboId: row.combo_id,
      name: row.name,
      sellingPrice: Number(row.selling_price),
      active: row.active,
    };
  }

}
