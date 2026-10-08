import type { Metadata } from 'next';
import { ru } from '@/content/ru';
import { apiGet, type SiteSettingsInfo } from '../../lib/api';
import { ContactForm } from '../../components/ContactForm';

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${ru.contacts.title} — ЧиркейТур`,
    description: 'Контакты ЧиркейТур: телефон, email, Telegram. Задайте вопрос — менеджер ответит.',
    alternates: { canonical: '/contacts' },
  };
}

export default async function ContactsPage() {
  const s = await apiGet<SiteSettingsInfo>('settings/public', 300);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-emerald-950 sm:text-4xl">{ru.contacts.title}</h1>

      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <div>
          <dl className="space-y-4 text-stone-700">
            <div>
              <dt className="text-sm font-medium uppercase tracking-wide text-stone-500">Телефон</dt>
              <dd className="mt-1">
                {s?.phone ? <a href={`tel:${s.phone}`} className="text-lg font-semibold text-emerald-900 hover:underline">{s.phone}</a> : <span className="text-stone-400">Указывается администратором</span>}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium uppercase tracking-wide text-stone-500">Email</dt>
              <dd className="mt-1">
                {s?.email ? <a href={`mailto:${s.email}`} className="text-lg font-semibold text-emerald-900 hover:underline">{s.email}</a> : <span className="text-stone-400">Указывается администратором</span>}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium uppercase tracking-wide text-stone-500">Telegram</dt>
              <dd className="mt-1">
                {s?.telegramUrl ? (
                  <a href={s.telegramUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
                    ✈️ {ru.common.telegramCta}
                  </a>
                ) : <span className="text-stone-400">Ссылка появится в настройках</span>}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium uppercase tracking-wide text-stone-500">Адрес</dt>
              <dd className="mt-1">{s?.address ?? <span className="text-stone-400">Указывается администратором</span>}</dd>
            </div>
          </dl>
        </div>

        <section aria-labelledby="contact-form-title">
          <h2 id="contact-form-title" className="text-xl font-semibold text-emerald-950">{ru.contacts.formTitle}</h2>
          <ContactForm />
        </section>
      </div>
    </div>
  );
}
