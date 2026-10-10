'use client';

/**
 * Customer CRM (PHASE 9.7, ТЗ §23): список клиентов с поиском по телефону/имени/
 * email/telegram, агрегаты (заявки, суммы), пагинация; клик — профиль клиента.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/AdminShell';
import { fetchCustomers, type CustomerRow } from '@/lib/api';
import { EmptyState, ErrorBanner, Pagination, SkeletonRows, TextInput } from '@/components/ui';

const money = (n: number) => n.toLocaleString('ru-RU') + ' ₽';

export default function CustomersPage() {
  const [items, setItems] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true);
    setError(null);
    const res = await fetchCustomers({ page: p, perPage: 20, search: s || undefined });
    if (res.ok && res.data) {
      setItems(res.data.items);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } else {
      setError(res.error?.message ?? 'Не удалось загрузить клиентов');
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    void Promise.resolve().then(() => load(page, search));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <AdminShell title="Клиенты (CRM)">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="flex w-full max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            void load(1, search);
          }}
        >
          <TextInput
            placeholder="Телефон, имя, email или @telegram"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Найти
          </button>
        </form>
        <p className="text-sm text-neutral-500">Всего клиентов: {total}</p>
      </div>

      {loading ? (
        <SkeletonRows rows={8} cols={6} />
      ) : items.length === 0 ? (
        <EmptyState title="Клиенты не найдены" description="Клиенты создаются автоматически при оформлении заявки на сайте." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2">Клиент</th>
                <th className="px-4 py-2">Телефон</th>
                <th className="px-4 py-2">Telegram</th>
                <th className="px-4 py-2 text-right">Заявок</th>
                <th className="px-4 py-2 text-right">Сумма всех заявок</th>
                <th className="px-4 py-2">Комментарий</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link href={`/customers/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.lastName} {c.firstName}
                      {c.middleName ? ` ${c.middleName}` : ''}
                    </Link>
                    <p className="text-xs text-neutral-400">{c.email ?? ''}</p>
                  </td>
                  <td className="px-4 py-2">{c.phone}</td>
                  <td className="px-4 py-2">{c.telegramUsername ? `@${c.telegramUsername.replace(/^@/, '')}` : '—'}</td>
                  <td className="px-4 py-2 text-right">{c.bookingsCount}</td>
                  <td className="px-4 py-2 text-right">{money(c.totalAmount)}</td>
                  <td className="max-w-[220px] truncate px-4 py-2 text-neutral-500" title={c.note ?? ''}>
                    {c.note ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-4">
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </div>
      ) : null}
    </AdminShell>
  );
}
