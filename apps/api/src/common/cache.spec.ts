import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cached, invalidateCache, clearCache } from './cache';

describe('query-level кэш (фаза 15.2)', () => {
  beforeEach(() => clearCache());

  it('возвращает закэшированное значение без повторного вызова loader', async () => {
    const loader = vi.fn(async () => Math.random());
    const a = await cached('k1', 60_000, loader);
    const b = await cached('k1', 60_000, loader);
    expect(b).toBe(a);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('ttl <= 0 отключает кэш (каждый раз loader)', async () => {
    const loader = vi.fn(async () => 1);
    await cached('k2', 0, loader);
    await cached('k2', 0, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('срок годности истёк — loader вызывается снова', async () => {
    vi.useFakeTimers();
    try {
      const loader = vi.fn(async () => 42);
      await cached('k3', 1000, loader);
      vi.advanceTimersByTime(1500);
      await cached('k3', 1000, loader);
      expect(loader).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('invalidateCache по префиксу удаляет только совпадающие ключи', async () => {
    await cached('dash:30', 60_000, async () => 1);
    await cached('an:funnel:30', 60_000, async () => 2);
    const removed = invalidateCache('dash:');
    expect(removed).toBe(1);
    const loader = vi.fn(async () => 99);
    await cached('an:funnel:30', 60_000, loader);
    expect(loader).not.toHaveBeenCalled(); // не инвалидирован
    await cached('dash:30', 60_000, loader);
    expect(loader).toHaveBeenCalledTimes(1); // пересчитан
  });

  it('ошибки loader пробрасываются и не кэшируются', async () => {
    const fail = async () => { throw new Error('db down'); };
    await expect(cached('k4', 60_000, fail)).rejects.toThrow('db down');
    const ok = await cached('k4', 60_000, async () => 'fine');
    expect(ok).toBe('fine');
  });
});
