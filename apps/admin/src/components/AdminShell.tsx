'use client';

/**
 * Каркас защищённых страниц админки: AuthGuard + шапка с пользователем.
 */
import type { ReactNode } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { AdminHeader } from '@/components/AdminHeader';
import { Sidebar } from '@/components/Sidebar';

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-neutral-50">
        <AdminHeader />
        <div className="flex flex-col lg:flex-row">
          <Sidebar />
          <main className="mx-auto w-full max-w-6xl flex-1 p-6">
            <h1 className="mb-4 text-2xl font-bold">{title}</h1>
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
