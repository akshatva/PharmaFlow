import Link from "next/link";

import { SectionIntro } from "@/components/layout/section-intro";

const quickActions = [
  {
    href: "/inventory",
    title: "Manage inventory",
    description: "Add batches, fix quantities, and handle daily stock corrections faster.",
  },
  {
    href: "/alerts",
    title: "Review alerts",
    description: "See low stock, near-expiry, and expired items that need attention now.",
  },
  {
    href: "/reorders",
    title: "Handle reorders",
    description: "Turn attention items into tracked reorder decisions and supplier actions.",
  },
  {
    href: "/purchase-orders",
    title: "Receive purchase orders",
    description: "Move placed orders forward and bring received stock directly into batches.",
  },
  {
    href: "/stock-adjustments",
    title: "Audit stock changes",
    description: "Trace manual edits, deletions, and received stock from one clean history view.",
  },
];

const workflowChecks = [
  "Use Inventory for the fastest daily add, edit, and delete workflow on batches.",
  "Use Alerts when you want action-oriented low stock and expiry review instead of raw tables.",
  "Use Reorders and Purchase Orders together when moving from insight to supplier execution.",
  "Use Stock Adjustments when something looks off and you need a trustworthy trail.",
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Overview"
        title="Dashboard"
        description="A clearer operational home for daily pharmacy work, with fast links into the pages your team will use most often."
      />

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Daily workflow
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            Start from the action that is blocking today’s work
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            PharmaFlow already has the core lifecycle in place. This dashboard now works as a quick operational launcher instead of a dead-end placeholder.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-slate-100"
              >
                <p className="text-sm font-semibold text-slate-950">{action.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Operator notes
          </p>
          <h3 className="mt-3 text-lg font-semibold text-slate-950">Keep the day moving</h3>
          <div className="mt-5 space-y-3">
            {workflowChecks.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
