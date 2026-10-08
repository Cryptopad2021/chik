import { describe, it, expect } from 'vitest';
import { roleAllows, canEditTours, canManageUsers, canViewBookings } from './permissions';

describe('roleAllows (client-side RBAC)', () => {
  it('VIEWER не может редактировать туры', () => {
    expect(roleAllows('VIEWER', canEditTours)).toBe(false);
  });
  it('CONTENT_MANAGER может редактировать туры', () => {
    expect(roleAllows('CONTENT_MANAGER', canEditTours)).toBe(true);
  });
  it('MANAGER видит заявки', () => {
    expect(roleAllows('MANAGER', canViewBookings)).toBe(true);
    expect(roleAllows('CONTENT_MANAGER', canViewBookings)).toBe(false);
  });
  it('undefined роль — отказ', () => {
    expect(roleAllows(undefined, canManageUsers)).toBe(false);
  });
});
