import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-panel backdrop-blur md:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden border-r border-slate-200/80 bg-slate-950 px-10 py-12 text-slate-50 md:flex md:flex-col md:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              PharmaFlow
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight">
              Inventory operations for modern pharma teams.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">
              Secure access, a focused workspace, and a clean operating surface for inventory,
              sales, and insight workflows.
            </p>
          </div>
          <p className="text-sm text-slate-400">
            Built for B2B medical inventory teams that need clarity, not clutter.
          </p>
        </section>
        <section className="bg-white px-6 py-8 md:px-10 md:py-12">{children}</section>
      </div>
    </main>
  );
}
