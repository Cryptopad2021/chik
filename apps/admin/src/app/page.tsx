// PHASE 4: после входа открываем дашборд; сам дашборд (§19) строится в PHASE 9.
import { redirect } from 'next/navigation';

export default function AdminIndex() {
  redirect('/dashboard');
}
