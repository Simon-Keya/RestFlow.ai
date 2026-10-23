import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Shop id attached by ShopScopeGuard after server-side resolution.
 * Prefer this over reading @Query('shopId') in controllers.
 */
export const CurrentShop = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{
      shopId?: string;
      user?: { shopId?: string; shop_id?: string };
    }>();
    if (typeof request.shopId === 'string' && request.shopId.trim()) {
      return request.shopId.trim();
    }
    const u = request.user;
    if (u?.shopId) return String(u.shopId);
    if (u?.shop_id) return String(u.shop_id);
    return '1';
  },
);
