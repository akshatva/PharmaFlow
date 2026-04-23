import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 sm:py-14">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-panel md:grid-cols-[1.02fr_0.98fr]">
        <section className="hidden border-r border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.08),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-10 py-12 md:flex md:flex-col md:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-500">
              PharmaFlow
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight text-slate-950">
              Inventory operations for modern pharma teams.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">
              Secure access, a focused workspace, and a clean operating surface for inventory,
              sales, and insight workflows.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Built for B2B medical inventory teams that need clarity, not clutter.
          </p>
        </section>
        <section className="bg-white px-6 py-8 md:px-12 md:py-14">{children}</section>
      </div>
    </main>
  );
}
