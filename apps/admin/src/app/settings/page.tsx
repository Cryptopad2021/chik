'use client';

/**
 * Настройки сайта (PHASE 9.9, ТЗ §56–57): контакты, SEO по умолчанию, hero-блок,
 * флаги бронирования и Telegram-уведомления. Доступ — SUPER_ADMIN/ADMIN.
 */
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { AuthGuard } from '@/components/AuthGuard';
import { Button, ErrorBanner, Field, Select, SkeletonRows, SuccessBanner, TextArea, TextInput, useAsyncAction } from '@/components/ui';
import { fetchSiteSettings, updateSiteSettings, type SiteSettingsRow } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { roleIs } from '@/lib/permissions';

const jsonToStr = (v: unknown): string => {
  if (v == null) return '';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return '';
  }
};

/** Тип «редактируемого» draft: JSON-поля хранятся как текст для TextArea. */
type Draft = Omit<Partial<SiteSettingsRow>, 'advantages' | 'howItWorks' | 'managerTelegramChatIds' | 'featureFlags'> & {
  advantages?: string;
  howItWorks?: string;
  managerTelegramChatIds?: string;
  featureFlags?: string;
};

const toDraft = (s: SiteSettingsRow): Draft => ({
  ...s,
  advantages: jsonToStr(s.advantages),
  howItWorks: jsonToStr(s.howItWorks),
  managerTelegramChatIds: Array.isArray(s.managerTelegramChatIds) ? s.managerTelegramChatIds.join(', ') : jsonToStr(s.managerTelegramChatIds),
  featureFlags: jsonToStr(s.featureFlags),
});

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsInner />
    </AuthGuard>
  );
}

function SettingsInner() {
  const { user } = useAuth();
  const canEdit = roleIs(user?.role, 'SUPER_ADMIN', 'ADMIN');
  const { busy, run } = useAsyncAction();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await fetchSiteSettings();
      if (!alive) return;
      if (res.ok && res.data) setDraft(toDraft(res.data));
      else setError(res.error?.message ?? 'Не удалось загрузить настройки');
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setNotice(null);
  };

  const save = () => {
    if (!draft) return;
    run(async () => {
      // JSON-поля редактируются как текст: парсим, при невалидном JSON — ошибка в баннер.
      const parseJson = (raw: unknown, label: string): unknown => {
        if (raw == null || typeof raw !== 'string') return raw ?? null;
        const t = raw.trim();
        if (!t) return null;
        try {
          return JSON.parse(t);
        } catch {
          throw new Error(`Поле «${label}» должно содержать корректный JSON или быть пустым`);
        }
      };
      let body: Partial<SiteSettingsRow>;
      try {
        const chatIdsRaw = draft.managerTelegramChatIds?.trim();
        body = {
          ...draft,
          advantages: parseJson(draft.advantages, 'Преимущества') as never,
          howItWorks: parseJson(draft.howItWorks, 'Как это работает') as never,
          featureFlags: parseJson(draft.featureFlags, 'Feature flags') as never,
          managerTelegramChatIds: (chatIdsRaw
            ? chatIdsRaw.split(',').map((x) => x.trim()).filter(Boolean)
            : []) as never,
        };
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Некорректный JSON');
        return;
      }
      delete (body as Record<string, unknown>).id;
      delete (body as Record<string, unknown>).updatedAt;
      const res = await updateSiteSettings(body);
      if (res.ok && res.data) {
        setDraft(toDraft(res.data));
        setError(null);
        setNotice('Настройки сохранены');
      } else {
        setError(res.error?.message ?? 'Ошибка сохранения');
      }
    });
  };

  if (loading) {
    return (
      <AdminShell title="Настройки сайта">
        <SkeletonRows rows={8} cols={2} />
      </AdminShell>
    );
  }

  if (!draft) {
    return (
      <AdminShell title="Настройки сайта">
        <ErrorBanner message={error ?? 'Настройки недоступны'} />
      </AdminShell>
    );
  }

  const jsonField = (key: 'advantages' | 'howItWorks' | 'featureFlags' | 'socialLinks', label: string, hint?: string) => (
    <Field label={label} hint={hint} error={undefined}>
      <TextArea
        rows={4}
        spellCheck={false}
        value={jsonToStr(draft[key])}
        disabled={!canEdit}
        onChange={(e) => set(key, e.target.value)}
      />
    </Field>
  );

  return (
    <AdminShell title="Настройки сайта">
      <div className="max-w-3xl space-y-6 pb-24">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        {notice && <SuccessBanner message={notice} />}
        {!canEdit && <ErrorBanner message="Редактирование настроек доступно только администраторам." />}

        <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold">Контакты (§56)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Название компании">
              <TextInput value={draft.companyName ?? ''} disabled={!canEdit} onChange={(e) => set('companyName', e.target.value)} />
            </Field>
            <Field label="Телефон">
              <TextInput value={draft.phone ?? ''} disabled={!canEdit} onChange={(e) => set('phone', e.target.value)} placeholder="+996 ..." />
            </Field>
            <Field label="Email">
              <TextInput type="email" value={draft.email ?? ''} disabled={!canEdit} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Адрес">
              <TextInput value={draft.address ?? ''} disabled={!canEdit} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <Field label="Telegram-канал (URL)">
              <TextInput value={draft.telegramUrl ?? ''} disabled={!canEdit} onChange={(e) => set('telegramUrl', e.target.value)} placeholder="https://t.me/..." />
            </Field>
            <Field label="Telegram-бот (URL)">
              <TextInput value={draft.telegramBotUrl ?? ''} disabled={!canEdit} onChange={(e) => set('telegramBotUrl', e.target.value)} placeholder="https://t.me/...bot" />
            </Field>
          </div>
          {jsonField('socialLinks', 'Соцсети (JSON)', 'Напр.: {"instagram":"https://instagram.com/..."}')}
          <Field label="Текст в подвале">
            <TextArea value={draft.footerText ?? ''} disabled={!canEdit} onChange={(e) => set('footerText', e.target.value)} />
          </Field>
        </section>

        <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold">Главная страница</h2>
          <Field label="Заголовок hero">
            <TextInput value={draft.heroTitle ?? ''} disabled={!canEdit} onChange={(e) => set('heroTitle', e.target.value)} />
          </Field>
          <Field label="Описание hero">
            <TextArea value={draft.heroDescription ?? ''} disabled={!canEdit} onChange={(e) => set('heroDescription', e.target.value)} />
          </Field>
          {jsonField('advantages', 'Преимущества (JSON-массив)', '[{"icon":"⭐","title":"...","text":"..."}]')}
          {jsonField('howItWorks', 'Как это работает (JSON-массив)', '[{"title":"...","text":"..."}]')}
          <Field label="Логотип (URL)">
            <TextInput value={draft.logoUrl ?? ''} disabled={!canEdit} onChange={(e) => set('logoUrl', e.target.value)} />
          </Field>
          <Field label="Favicon (URL)">
            <TextInput value={draft.faviconUrl ?? ''} disabled={!canEdit} onChange={(e) => set('faviconUrl', e.target.value)} />
          </Field>
        </section>

        <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold">SEO по умолчанию (§30)</h2>
          <Field label="Title по умолчанию">
            <TextInput value={draft.seoDefaultTitle ?? ''} disabled={!canEdit} onChange={(e) => set('seoDefaultTitle', e.target.value)} maxLength={70} />
          </Field>
          <Field label="Description по умолчанию">
            <TextArea value={draft.seoDefaultDescription ?? ''} disabled={!canEdit} onChange={(e) => set('seoDefaultDescription', e.target.value)} maxLength={180} />
          </Field>
        </section>

        <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="font-semibold">Бронирование и уведомления (§57)</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Приём заявок">
              <Select value={draft.bookingEnabled ? '1' : '0'} disabled={!canEdit} onChange={(e) => set('bookingEnabled', e.target.value === '1')}>
                <option value="1">Включён</option>
                <option value="0">Выключен (технические работы)</option>
              </Select>
            </Field>
            <Field label="Автоподтверждение">
              <Select value={draft.autoConfirmEnabled ? '1' : '0'} disabled={!canEdit} onChange={(e) => set('autoConfirmEnabled', e.target.value === '1')}>
                <option value="0">Выключено</option>
                <option value="1">Включено</option>
              </Select>
            </Field>
            <Field label="Telegram о новых заявках">
              <Select value={draft.notifyNewBookingTelegram ? '1' : '0'} disabled={!canEdit} onChange={(e) => set('notifyNewBookingTelegram', e.target.value === '1')}>
                <option value="0">Выключено</option>
                <option value="1">Включено</option>
              </Select>
            </Field>
          </div>
          <Field label="ID менеджеров для уведомлений" hint="Через запятую">
            <TextInput
              value={draft.managerTelegramChatIds ?? ''}
              disabled={!canEdit}
              onChange={(e) => set('managerTelegramChatIds', e.target.value)}
              placeholder="123456, 789012"
            />
          </Field>
          <Field label="Канал для постов (chat_id)">
            <TextInput value={draft.telegramChannelId ?? ''} disabled={!canEdit} onChange={(e) => set('telegramChannelId', e.target.value)} />
          </Field>
          <Field label="Шаблон поста в канал">
            <TextArea rows={4} value={draft.telegramPostTemplate ?? ''} disabled={!canEdit} onChange={(e) => set('telegramPostTemplate', e.target.value)} />
          </Field>
          {jsonField('featureFlags', 'Feature flags (JSON)', '{"newCheckout": false}')}
        </section>

        {canEdit && (
          <div className="fixed bottom-0 right-0 z-40 flex items-center gap-3 border-t border-neutral-200 bg-white/95 px-6 py-3 backdrop-blur lg:left-60">
            <span className="text-xs text-neutral-500">Последнее обновление: {draft.updatedAt ? new Date(draft.updatedAt).toLocaleString('ru-RU') : '—'}</span>
            <Button onClick={save} busy={busy}>
              Сохранить настройки
            </Button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
