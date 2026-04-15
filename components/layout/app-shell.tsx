import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { SignOutButton } from "@/components/auth/sign-out-button";

type AppShellProps = {
  children: ReactNode;
  userEmail: string;
};

export function AppShell({ children, userEmail }: AppShellProps) {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
        <AppSidebar />

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-white/80 bg-white/85 backdrop-blur">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                  PharmaFlow
                </p>
                <h1 className="mt-1 text-base font-semibold text-slate-950 sm:text-lg">
                  Operational workspace
                </h1>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-left sm:text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Signed in as</p>
                  <p className="mt-1 truncate text-sm font-medium text-slate-700">{userEmail}</p>
                </div>
                <SignOutButton />
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="min-h-[calc(100vh-8rem)] rounded-[1.75rem] border border-white/70 bg-white/85 p-4 shadow-panel backdrop-blur sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
