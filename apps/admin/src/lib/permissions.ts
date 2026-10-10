/** Клиентская часть RBAC (ТЗ §7): UI скрывает недоступные действия, но backend всё равно проверяет permissions. */
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CONTENT_MANAGER' | 'VIEWER';

const ALL: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CONTENT_MANAGER', 'VIEWER'];
const EDITORS: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CONTENT_MANAGER'];
const MANAGERS_UP: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
void ALL;

export const canViewBookings: Role[] = MANAGERS_UP;
export const canEditTours: Role[] = EDITORS;
export const canManageUsers: Role[] = ['SUPER_ADMIN', 'ADMIN'];
export const canSeeAuditLog: Role[] = ['SUPER_ADMIN', 'ADMIN'];

export function roleAllows(role: Role | undefined, allowed: Role[]): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

/** Проверка по строковому литералу роли (безопасно к опечаткам — неизвестная роль = false). */
export function roleIs(role: Role | '' | undefined, ...roles: Role[]): boolean {
  return !!role && roles.includes(role);
}
