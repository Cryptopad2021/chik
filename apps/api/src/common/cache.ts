/**
 * Query-level кэш (ТЗ §15/§60, фаза 15.2).
 * Простейший in-memory TTL-кэш поверх дорогих агрегатных запросов (dashboard, аналитика).
 * Redis подключается через env REDIS_URL — при его отсутствии используется эта реализация
 * (деградация по памяти процесса приемлема для одного инстанса API; см. отклонение #8 в docs/PLAN.md).
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

/** Возвращает закэшированный результат или вычисляет через loader. ttlMs <= 0 — кэш отключён. */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return loader();
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;
  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** Инвалидация по префиксу (например, после изменения туров — «dash:», «an:»). */
export function invalidateCache(prefix?: string): number {
  let removed = 0;
  for (const k of store.keys()) {
    if (!prefix || k.startsWith(prefix)) {
      store.delete(k);
      removed++;
    }
  }
  return removed;
}

/** Полный сброс (для тестов). */
export function clearCache(): void {
  store.clear();
}
