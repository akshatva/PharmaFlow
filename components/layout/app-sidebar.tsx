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
  Lightbulb,
} from "lucide-react";

import { appNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const icons: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  forecast: BarChart3,
  scan: ScanLine,
  inventory: Boxes,
  sales: ShoppingCart,
  insights: Lightbulb,
  alerts: Bell,
  reorders: ClipboardList,
  stockAdjustments: History,
  suppliers: Truck,
  purchaseOrders: FileSpreadsheet,
  settings: Settings,
};

const navGroups = [
  {
    label: "Overview",
    items: ["dashboard", "forecast", "insights"],
  },
  {
    label: "Operations",
    items: ["inventory", "scan", "sales", "alerts"],
  },
  {
    label: "Supply Chain",
    items: ["reorders", "stockAdjustments", "suppliers", "purchaseOrders"],
  },
  {
    label: "System",
    items: ["settings"],
  },
];

const navItemsByIcon = new Map(
  appNavigation.map((item) => [item.icon, item]),
);

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile nav */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
            PF
          </div>
          <span className="text-sm font-semibold text-slate-900">PharmaFlow</span>
        </Link>

        <nav className="-mx-4 mt-3 overflow-x-auto px-4 pb-1">
          <div className="flex w-max gap-1.5">
            {appNavigation.map((item) => {
              const Icon = icons[item.icon] ?? LayoutDashboard;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden h-screen flex-col border-r border-slate-800/50 bg-sidebar lg:sticky lg:top-0 lg:flex">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 px-5 py-5 transition-opacity hover:opacity-80">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm">
            PF
          </div>
          <div>
            <p className="text-sm font-semibold text-white">PharmaFlow</p>
            <p className="text-[11px] text-slate-400">Pharmacy operations</p>
          </div>
        </Link>

        <div className="mx-4 border-t border-sidebar-border" />

        {/* Navigation groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => {
            const groupNavItems = group.items
              .map((iconKey) => navItemsByIcon.get(iconKey as typeof appNavigation[number]["icon"]))
              .filter(Boolean) as typeof appNavigation[number][];

            if (groupNavItems.length === 0) return null;

            return (
              <div key={group.label} className="mb-5">
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {groupNavItems.map((item) => {
                    const Icon = icons[item.icon] ?? LayoutDashboard;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                          isActive
                            ? "bg-sidebar-active text-white"
                            : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mx-4 border-t border-sidebar-border" />
        <div className="px-5 py-4">
          <p className="text-[11px] text-slate-500">
            © PharmaFlow
          </p>
        </div>
      </aside>
    </>
  );
}
