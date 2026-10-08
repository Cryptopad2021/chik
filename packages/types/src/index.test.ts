import { describe, expect, it } from 'vitest';
import { BOOKING_STATUSES, ERROR_CODES, USER_ROLES } from './index.js';

describe('domain types (smoke)', () => {
  it('has all 5 roles (ТЗ §7)', () => {
    expect(USER_ROLES).toHaveLength(5);
    expect(USER_ROLES).toContain('SUPER_ADMIN');
  });

  it('has all 9 booking statuses (ТЗ §14)', () => {
    expect(BOOKING_STATUSES).toHaveLength(9);
  });

  it('error codes include BOOKING_NOT_FOUND (ТЗ §45)', () => {
    expect(ERROR_CODES).toContain('BOOKING_NOT_FOUND');
  });
});
