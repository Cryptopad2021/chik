// Полноценный дашборд строится в PHASE 9 (ТЗ §19). Каркас Phase 1: редирект на /login.
import { redirect } from 'next/navigation';

export default function AdminIndex() {
  redirect('/login');
}
