import { describe, expect, it } from 'vitest';
import { createBookingSchema, phoneSchema } from './index.js';

const valid = {
  departureId: '8f14e45f-3e2c-4b6a-9d0e-1a2b3c4d5e6f',
  departureCityId: '7b2e6f14-3e2c-4b6a-9d0e-1a2b3c4d5e60',
  adults: 2,
  children10to14: 1,
  childrenUnder10: 0,
  contact: { firstName: 'Иван', lastName: 'Петров', phone: '+7 900 123-45-67' },
};

describe('createBookingSchema (ТЗ §14–16)', () => {
  it('accepts valid booking payload', () => {
    const r = createBookingSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it('rejects zero tourists', () => {
    const r = createBookingSchema.safeParse({ ...valid, adults: 0, children10to14: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects invalid uuid / phone', () => {
    expect(createBookingSchema.safeParse({ ...valid, departureId: 'nope' }).success).toBe(false);
    expect(phoneSchema.safeParse('abc').success).toBe(false);
  });
});
