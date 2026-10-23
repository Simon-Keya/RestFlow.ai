// apps/mobile/src/hooks/useRole.ts
import { useAuthStore } from '../features/auth/authStore';
import { ROLES } from '../lib/constants';

export const useRole = () => {
  const { user } = useAuthStore();
  const role = user?.role;

  const isAdmin = role === ROLES.ADMIN || role === 'ADMIN';
  const isManager = role === ROLES.MANAGER;
  const isKitchen = role === ROLES.KITCHEN;
  const isPos = role === ROLES.POS;

  /** Michael: KITCHEN never uses POS */
  const canUsePos =
    isAdmin || isManager || isPos || role === 'ADMIN' || role === 'MANAGER' || role === 'POS';

  /** Michael: only ADMIN mutates menu */
  const canEditMenu = isAdmin || role === 'ADMIN';

  /** Michael: only ADMIN changes user roles */
  const canChangeUserRole = isAdmin || role === 'ADMIN';

  return {
    isAdmin,
    isManager,
    isKitchen,
    isPos,
    canUsePos,
    canEditMenu,
    canChangeUserRole,
    role,
    hasRole: (requiredRole: string) => role === requiredRole,
    canAccess: (allowedRoles: string[]) =>
      allowedRoles.includes(role || ''),
  };
};
