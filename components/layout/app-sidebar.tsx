"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Truck,
  FileSpreadsheet,
  History,
  ScanLine,
} from "lucide-react";

import { appNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const icons = {
  dashboard: LayoutDashboard,
  forecast: BarChart3,
  scan: ScanLine,
  inventory: Boxes,
  sales: ShoppingCart,
  insights: BarChart3,
  alerts: Bell,
  reorders: ClipboardList,
  stockAdjustments: History,
  suppliers: Truck,
  purchaseOrders: FileSpreadsheet,
  settings: Settings,
};

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-4 py-4 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-600/15 text-sm font-semibold text-teal-700">
            PF
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">PharmaFlow</p>
            <p className="text-xs text-slate-500">Daily operations</p>
          </div>
        </div>

        <nav className="-mx-4 mt-4 overflow-x-auto px-4 pb-1">
          <div className="flex w-max gap-2">
            {appNavigation.map((item) => {
              const Icon = icons[item.icon];
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition",
                    isActive
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <aside className="hidden border-r border-white/80 bg-slate-950 px-5 py-6 text-slate-100 lg:block">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600/15 text-sm font-semibold text-teal-300">
            PF
          </div>
          <div>
            <p className="text-sm font-semibold">PharmaFlow</p>
            <p className="text-xs text-slate-400">B2B Inventory SaaS</p>
          </div>
        </div>

        <nav className="mt-10 space-y-2">
          {appNavigation.map((item) => {
            const Icon = icons[item.icon];
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  isActive
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
