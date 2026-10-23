// apps/api/src/common/guards/shop-scope.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  pickClientShopId,
  resolveShopId,
  type ShopScopedUser,
} from '../utils/shop.util';

/**
 * Attaches request.shopId after validating client hints against the user.
 * Public routes are skipped. Apply globally after JwtAuthGuard.
 */
@Injectable()
export class ShopScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: ShopScopedUser;
      shopId?: string;
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
      params?: Record<string, unknown>;
    }>();

    const user = request.user;
    if (!user) {
      // JwtAuthGuard should have run first; if not, deny
      throw new ForbiddenException('User not authenticated');
    }

    const clientShop = pickClientShopId({
      query: request.query,
      body: request.body,
      params: request.params,
    });

    const { shopId, allowed } = resolveShopId(user, clientShop);
    if (!allowed) {
      throw new ForbiddenException(
        `Access denied for shop ${clientShop ?? '(unknown)'}`,
      );
    }

    request.shopId = shopId;
    return true;
  }
}
