import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventStoreService } from '../../core/event-store.service';
import type { AssignableRole } from './dto/change-role.dto';

const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  shop_id: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;

type Actor = {
  id: string;
  email?: string;
  role: string;
  shop_id?: string;
};

const ALL_ROLES: AssignableRole[] = ['ADMIN', 'MANAGER', 'KITCHEN', 'POS'];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventStore: EventStoreService,
  ) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findByEmailSafe(email: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: safeUserSelect,
    });
  }

  async findById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
  }

  async create(data: {
    email: string;
    password: string;
    name: string;
    role?: string;
    shop_id?: string;
  }): Promise<SafeUser> {
    // Public create path: never elevate to ADMIN
    let roleValue: Role = Role.KITCHEN;
    if (data.role === 'MANAGER' || data.role === 'KITCHEN' || data.role === 'POS') {
      roleValue = data.role as Role;
    }
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        password: data.password,
        name: data.name.trim(),
        role: roleValue,
        shop_id: data.shop_id?.trim() || '1',
      },
      select: safeUserSelect,
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<SafeUser> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: safeUserSelect,
      });
    } catch {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async delete(id: string, hardDelete = false): Promise<void> {
    if (hardDelete) {
      await this.prisma.user.delete({ where: { id } });
    } else {
      await this.prisma.user.update({
        where: { id },
        data: { is_active: false },
      });
    }
  }

  async findAll(params?: {
    skip?: number;
    take?: number;
    shopId?: string;
    role?: string;
    search?: string;
  }): Promise<{ items: SafeUser[] }> {
    const where: Prisma.UserWhereInput = {};
    if (params?.shopId) where.shop_id = params.shopId;
    if (params?.role && ALL_ROLES.includes(params.role as AssignableRole)) {
      where.role = params.role as Role;
    }
    if (params?.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.user.findMany({
      where,
      skip: params?.skip,
      take: params?.take ?? 100,
      orderBy: { created_at: 'desc' },
      select: safeUserSelect,
    });
    return { items };
  }

  /**
   * Michael product rule: only ADMIN may change user roles.
   * Route guard is also @Roles('ADMIN'); this is defense in depth.
   */
  canAssignRole(
    actorRole: string,
    _targetCurrentRole: string,
    _newRole: AssignableRole,
  ): boolean {
    return actorRole === 'ADMIN';
  }

  async changeRole(
    targetUserId: string,
    newRole: AssignableRole,
    actor: Actor,
  ): Promise<{
    success: true;
    userId: string;
    email: string;
    oldRole: string;
    newRole: string;
    message: string;
  }> {
    if (!ALL_ROLES.includes(newRole)) {
      throw new BadRequestException(`Invalid role: ${newRole}`);
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException('User not found');

    if (actor.role === 'MANAGER') {
      const actorShop = actor.shop_id || '1';
      if (target.shop_id !== actorShop) {
        throw new ForbiddenException('Cannot change roles for users in another shop');
      }
    }

    if (!this.canAssignRole(actor.role, target.role, newRole)) {
      throw new ForbiddenException(
        `You cannot change role from ${target.role} to ${newRole}`,
      );
    }

    // Disallow self-promotion to ADMIN unless already ADMIN doing a no-op
    if (
      actor.id === target.id &&
      newRole === 'ADMIN' &&
      target.role !== 'ADMIN'
    ) {
      throw new ForbiddenException('You cannot promote yourself to ADMIN');
    }

    if (target.role === newRole) {
      return {
        success: true,
        userId: target.id,
        email: target.email,
        oldRole: target.role,
        newRole,
        message: 'Role unchanged. User must log out and log in again if token is stale.',
      };
    }

    const oldRole = target.role;
    await this.prisma.user.update({
      where: { id: target.id },
      data: { role: newRole as Role },
    });

    try {
      await this.eventStore.appendEvent({
        event_type: 'user_role_changed',
        actor_user_id: actor.id,
        idempotency_key: `user-role-${target.id}-${newRole}-${Date.now()}`,
        payload: {
          shop_id: target.shop_id || '1',
          target_user_id: target.id,
          target_email: target.email,
          old_role: oldRole,
          new_role: newRole,
          actor_user_id: actor.id,
          actor_email: actor.email ?? null,
        },
      });
    } catch {
      // Audit best-effort — role already updated
    }

    return {
      success: true,
      userId: target.id,
      email: target.email,
      oldRole,
      newRole,
      message: 'Role updated. User must log out and log in again.',
    };
  }
}
