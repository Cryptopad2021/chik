// Полноценный дашборд строится в PHASE 9 (ТЗ §19). PHASE 4: страница за авторизацией.
import { AdminShell } from '@/components/AdminShell';

export default function DashboardPage() {
  return (
    <AdminShell title="Дашборд">
      <p className="text-neutral-600">
        Разделы админ-панели (туры, выезды, брони, пользователи) подключаются в PHASE 5–9.
      </p>
    </AdminShell>
  );
}
