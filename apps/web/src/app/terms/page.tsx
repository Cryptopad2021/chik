import type { Metadata } from 'next';
import { ru } from '@/content/ru';

export const metadata: Metadata = {
  title: `${ru.legal.termsTitle} — ЧиркейТур`,
  description: 'Пользовательское соглашение сайта ЧиркейТур.',
  alternates: { canonical: '/terms' },
};

/** ТЗ §59: без вымышленных юридических данных — структура + placeholder для заполнения компанией */
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-bold text-emerald-950">{ru.legal.termsTitle}</h1>
      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {ru.legal.placeholder} Условия оказания услуг, порядок отмены и возврата заполняются компанией.
      </p>

      <div className="mt-8 space-y-6 text-stone-700">
        <section>
          <h2 className="text-lg font-semibold text-emerald-950">1. Общие положения</h2>
          <p className="mt-2 text-sm leading-relaxed">Настоящее соглашение регулирует использование сайта ЧиркейТур и оформление заявок на туры. Факт отправки заявки означает согласие с условиями, которые будут уточнены менеджером.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-emerald-950">2. Заявка и бронирование</h2>
          <p className="mt-2 text-sm leading-relaxed">Отправка формы создаёт заявку со статусом «Новая». Бронирование считается подтверждённым только после подтверждения менеджером. Наличие свободных мест проверяется автоматически на момент отправки.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-emerald-950">3. Оплата</h2>
          <p className="mt-2 text-sm leading-relaxed">Способы оплаты, размеры предоплаты и порядок возвратов указываются компанией в договоре оферты.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-emerald-950">4. Ответственность</h2>
          <p className="mt-2 text-sm leading-relaxed">Информация на сайте носит справочный характер; программа тура и цены могут меняться — актуальные данные подтверждаются при бронировании.</p>
        </section>
      </div>
    </div>
  );
}
