import { UsersService } from './users.service';

describe('UsersService role matrix', () => {
  const svc = Object.create(UsersService.prototype) as UsersService;

  it('ADMIN can assign any role', () => {
    expect(svc.canAssignRole('ADMIN', 'KITCHEN', 'MANAGER')).toBe(true);
    expect(svc.canAssignRole('ADMIN', 'MANAGER', 'ADMIN')).toBe(true);
  });

  it('MANAGER cannot assign ADMIN or MANAGER', () => {
    expect(svc.canAssignRole('MANAGER', 'KITCHEN', 'ADMIN')).toBe(false);
    expect(svc.canAssignRole('MANAGER', 'KITCHEN', 'MANAGER')).toBe(false);
    expect(svc.canAssignRole('MANAGER', 'KITCHEN', 'POS')).toBe(true);
  });

  it('MANAGER cannot change an ADMIN target', () => {
    expect(svc.canAssignRole('MANAGER', 'ADMIN', 'KITCHEN')).toBe(false);
  });

  it('KITCHEN cannot assign', () => {
    expect(svc.canAssignRole('KITCHEN', 'POS', 'MANAGER')).toBe(false);
  });
});
