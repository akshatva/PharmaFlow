import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { SignOutButton } from "@/components/auth/sign-out-button";

type AppShellProps = {
  children: ReactNode;
  userEmail: string;
};

export function AppShell({ children, userEmail }: AppShellProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <AppSidebar />

      <div className="flex min-h-screen min-w-0 flex-col bg-background">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-3 lg:px-8">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-slate-900">
                PharmaFlow
              </h1>
              <p className="text-xs text-slate-500">
                Inventory operations platform
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs text-slate-500">Signed in as</p>
                <p className="max-w-[200px] truncate text-sm font-medium text-slate-700">{userEmail}</p>
              </div>
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
