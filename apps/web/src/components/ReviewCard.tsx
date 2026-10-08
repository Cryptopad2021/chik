import type { ReviewInfo } from '../lib/api';
import { formatDate } from '../lib/format';

export function ReviewCard({ review }: { review: ReviewInfo }) {
  const name = review.customer ? `${review.customer.firstName}${review.customer.lastName ? ' ' + review.customer.lastName[0] + '.' : ''}` : 'Путешественник';
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="text-amber-500" aria-label={`Оценка ${review.rating} из 5`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
      <p className="mt-2 text-sm leading-relaxed text-stone-700">«{review.text}»</p>
      <footer className="mt-3 text-xs text-stone-500">
        {name} · {formatDate(review.createdAt)}{review.tour ? ` · ${review.tour.title}` : ''}
      </footer>
    </article>
  );
}
