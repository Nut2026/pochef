import type { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        <main className="flex-1 p-4 md:p-6 pt-14 lg:pt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
