import Link from "next/link";
import {
  Boxes,
  Bell,
  ClipboardList,
  FileSpreadsheet,
  History,
  ArrowRight,
} from "lucide-react";

import { SectionIntro } from "@/components/layout/section-intro";

const quickActions = [
  {
    href: "/inventory",
    title: "Manage inventory",
    description: "Add batches, fix quantities, and handle daily stock corrections.",
    icon: Boxes,
  },
  {
    href: "/alerts",
    title: "Review alerts",
    description: "Low stock, near-expiry, and expired items needing attention.",
    icon: Bell,
  },
  {
    href: "/reorders",
    title: "Handle reorders",
    description: "Turn insights into tracked reorder decisions and supplier actions.",
    icon: ClipboardList,
  },
  {
    href: "/purchase-orders",
    title: "Receive purchase orders",
    description: "Move placed orders forward and bring received stock into batches.",
    icon: FileSpreadsheet,
  },
  {
    href: "/stock-adjustments",
    title: "Audit stock changes",
    description: "Trace manual edits, deletions, and received stock history.",
    icon: History,
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
    <div className="space-y-8">
      <SectionIntro
        eyebrow="Overview"
        title="Dashboard"
        description="Operational home for daily pharmacy work. Jump directly into the action that matters most right now."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group app-card p-5 transition-colors hover:border-slate-300"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-blue-500" />
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{action.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="app-card p-6">
        <h3 className="text-sm font-semibold text-slate-900">Workflow guide</h3>
        <p className="mt-1 text-sm text-slate-500">How each section fits into the daily operating rhythm.</p>
        <div className="mt-4 space-y-2">
          {workflowChecks.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600"
            >
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                {index + 1}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
