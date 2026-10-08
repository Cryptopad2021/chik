import type { Metadata } from 'next';
import Link from 'next/link';
import { ru } from '@/content/ru';

export const metadata: Metadata = {
  title: `${ru.legal.privacyTitle} — ЧиркейТур`,
  description: 'Политика конфиденциальности ЧиркейТур: какие данные собираются и как обрабатываются.',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
};

/** ТЗ §59: не придумывать юридические сведения компании — только placeholder-блоки с понятной структурой */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-emerald-950">{ru.legal.privacyTitle}</h1>
      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {ru.legal.placeholder} Реквизиты оператора персональных данных заполняются компанией в административной панели перед публикацией.
      </p>

      <div className="prose prose-stone mt-8 max-w-none space-y-6 text-stone-700">
        <section>
          <h2 className="text-lg font-semibold text-emerald-950">1. Какие данные мы собираем</h2>
          <p className="mt-2 text-sm leading-relaxed">При бронировании: имя, телефон, при желании — email и Telegram username, данные туристов для заявки. Через сайт также могут собираться обезличенные аналитические события без персональных данных.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-emerald-950">2. Цели обработки</h2>
          <p className="mt-2 text-sm leading-relaxed">Оформление и подтверждение заявки на тур, связь с вами, информирование об изменениях выезда. Мы не передаём данные третьим лицам, кроме случаев, необходимых для оказания услуги.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-emerald-950">3. Хранение и защита</h2>
          <p className="mt-2 text-sm leading-relaxed">Данные хранятся в защищённой базе данных, доступ к нему имеют только сотрудники с соответствующими правами. Все действия сотрудников логируются.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-emerald-950">4. Ваши права</h2>
          <p className="mt-2 text-sm leading-relaxed">Вы можете запросить удаление или уточнение своих персональных данных — напишите нам через раздел <Link href="/contacts" className="underline">{ru.contacts.title.toLowerCase()}</Link>.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-emerald-950">5. Контакты</h2>
          <p className="mt-2 text-sm leading-relaxed">Ответственный за обработку персональных данных указывается компанией.</p>
        </section>
      </div>
    </div>
  );
}
