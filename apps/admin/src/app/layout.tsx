import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'ЧиркейТур — Админ-панель',
  robots: { index: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {/* AuthProvider живёт весь жизненный цикл SPA-навигации (PHASE 4) */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
