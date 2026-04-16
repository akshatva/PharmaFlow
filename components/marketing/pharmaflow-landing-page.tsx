"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  BellRing,
  Boxes,
  ClipboardList,
  LineChart,
  PackageCheck,
  SearchCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  note: string;
};

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
};

type FeatureCardProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
};

type CapabilityRowProps = {
  title: string;
  description: string;
};

function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{description}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
      <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function StatCard({ label, value, note }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{note}</p>
    </div>
  );
}

function CapabilityRow({ title, description }: CapabilityRowProps) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950">
        <div className="border-b border-white/10 bg-slate-900 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operations Overview</p>
              <h3 className="mt-2 text-lg font-semibold text-white">PharmaFlow Console</h3>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              Live inventory state
            </div>
          </div>
        </div>

        <div className="grid gap-4 bg-slate-950 p-4 xl:grid-cols-[1.4fr_0.95fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Low Stock</p>
                <p className="mt-3 text-2xl font-semibold text-white">14</p>
                <p className="mt-1 text-xs text-slate-400">Requires action today</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Expiring</p>
                <p className="mt-3 text-2xl font-semibold text-white">9</p>
                <p className="mt-1 text-xs text-slate-400">Within 30 days</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Draft POs</p>
                <p className="mt-3 text-2xl font-semibold text-white">4</p>
                <p className="mt-1 text-xs text-slate-400">Pending review</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white p-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Inventory Table</p>
                  <h4 className="mt-1 text-base font-semibold text-slate-950">Batch-aware stock view</h4>
                </div>
                <div className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                  Updated 2 min ago
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3 font-medium">Medicine</th>
                      <th className="border-b border-slate-200 px-4 py-3 font-medium">Batch</th>
                      <th className="border-b border-slate-200 px-4 py-3 font-medium">Qty</th>
                      <th className="border-b border-slate-200 px-4 py-3 font-medium">Expiry</th>
                      <th className="border-b border-slate-200 px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Paracetamol 650", "PF-2031", "18", "12 Jun 2026", "Low stock"],
                      ["Amoxicillin 500", "AM-1182", "62", "04 May 2026", "Expiring soon"],
                      ["Metformin 500", "MF-4920", "11", "18 Aug 2026", "Reorder now"],
                    ].map((row) => (
                      <tr key={row[0]}>
                        <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-900">
                          {row[0]}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-slate-600">{row[1]}</td>
                        <td className="border-b border-slate-100 px-4 py-3 text-slate-600">{row[2]}</td>
                        <td className="border-b border-slate-100 px-4 py-3 text-slate-600">{row[3]}</td>
                        <td className="border-b border-slate-100 px-4 py-3">
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                            {row[4]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Alerts</p>
                  <p className="text-xs text-slate-400">Operational signals requiring attention</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  "2 batches expiring within 15 days",
                  "Metformin 500 will run out in 4.5 days",
                  "Draft purchase order pending supplier confirmation",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">Reorder Recommendations</p>
              <div className="mt-4 space-y-3">
                {[
                  { medicine: "Metformin 500", supplier: "HealthLine Supply", quantity: "180 units" },
                  { medicine: "Azithromycin 500", supplier: "CareBridge Pharma", quantity: "90 units" },
                ].map((item) => (
                  <div key={item.medicine} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-sm font-medium text-white">{item.medicine}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.supplier}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                      Suggested quantity
                    </p>
                    <p className="mt-1 text-sm text-slate-200">{item.quantity}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">Supplier Workflow</p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">PO-2026-014</p>
                    <p className="mt-1 text-xs text-slate-400">HealthLine Supply</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                    Draft
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-200">
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                    3 line items
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                    Receiving pending
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PharmaFlowLandingPage() {
  return (
    <main className="min-h-screen bg-[#f6f7f5] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f6f7f5]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-950">
              PF
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">PharmaFlow</p>
              <p className="text-xs text-slate-500">Pharmacy operations system</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a href="#problem" className="transition hover:text-slate-950">
              Problem
            </a>
            <a href="#solution" className="transition hover:text-slate-950">
              Solution
            </a>
            <a href="#capabilities" className="transition hover:text-slate-950">
              Capabilities
            </a>
            <a href="#trust" className="transition hover:text-slate-950">
              Trust
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="#product-preview"
              className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white sm:inline-flex"
            >
              View Demo
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-200">
        <div className="mx-auto grid max-w-7xl gap-16 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Operational clarity for modern pharmacy teams
            </p>
            <h1 className="mt-6 text-5xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-6xl">
              Run inventory, purchasing, and pharmacy workflows from one system.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              PharmaFlow replaces spreadsheets and fragmented tools with a single operating layer
              for stock control, expiry visibility, reorder decisions, supplier management, and
              day-to-day pharmacy execution.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Get Started
              </Link>
              <a
                href="#product-preview"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                View Demo
              </a>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Inventory"
                value="Batch-aware"
                note="Track quantities, batches, expiry dates, and stock health from one view."
              />
              <StatCard
                label="Procurement"
                value="Connected"
                note="Move from reorder signals into supplier workflows and purchase orders without handoffs."
              />
              <StatCard
                label="Visibility"
                value="Operational"
                note="Surface alerts, forecasts, and daily actions before they become costly gaps."
              />
            </div>
          </div>

          <div className="lg:pt-4">
            <HeroMockup />
          </div>
        </div>
      </section>

      <section id="problem" className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="Problem"
            title="Pharmacy operations break when inventory is tracked manually."
            description="When stock, expiry, purchasing, and daily actions live across spreadsheets, calls, and disconnected tools, teams lose time and control where it matters most."
          />

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              {
                title: "Stockouts",
                description: "Critical items run out because visibility arrives too late and reorder decisions are reactive.",
              },
              {
                title: "Expiry losses",
                description: "Batches expire in the background when teams cannot see ageing inventory clearly enough to act early.",
              },
              {
                title: "Disconnected purchasing",
                description: "Supplier follow-through slows down when reorders and purchase orders are managed outside the stock workflow.",
              },
              {
                title: "Poor visibility",
                description: "Leaders lack a reliable operational picture across stock levels, alerts, demand, and supplier activity.",
              },
              {
                title: "Slow manual workflows",
                description: "Routine tasks such as receiving stock, checking batches, and reconciling shortages take more effort than they should.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-[28px] border border-slate-200 bg-[#f8f8f6] p-6">
                <p className="text-lg font-semibold text-slate-950">{item.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="solution" className="border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="Solution"
            title="One system for the full pharmacy workflow."
            description="PharmaFlow connects inventory control, alerts, reordering, suppliers, purchase orders, and operational forecasting in a single workflow that teams can use every day."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            <FeatureCard
              icon={Boxes}
              title="Inventory control"
              description="Manage stock with batch-level visibility, receiving flows, and a clean operational inventory view."
            />
            <FeatureCard
              icon={BellRing}
              title="Alerts and expiry visibility"
              description="Spot low stock, near-expiry items, and operational risk before it disrupts service."
            />
            <FeatureCard
              icon={SearchCheck}
              title="Reorder intelligence"
              description="Turn movement signals and demand forecasts into clearer reorder recommendations."
            />
            <FeatureCard
              icon={Truck}
              title="Suppliers and purchase orders"
              description="Keep supplier activity and purchasing decisions close to the inventory events that trigger them."
            />
            <FeatureCard
              icon={LineChart}
              title="Forecasting and visibility"
              description="Use simple, explainable demand visibility to understand stock cover and upcoming pressure points."
            />
          </div>
        </div>
      </section>

      <section id="capabilities" className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="Capabilities"
            title="Built to support the work pharmacy teams actually do."
            description="PharmaFlow is designed around operational tasks, not generic inventory features. It helps teams maintain control across the full movement of stock."
          />

          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <CapabilityRow
              title="Track batches and expiry"
              description="Maintain visibility into batch numbers, expiry dates, and stock condition so the right inventory moves first."
            />
            <CapabilityRow
              title="Monitor low stock"
              description="Surface shortage risks clearly so replenishment decisions can happen before service is affected."
            />
            <CapabilityRow
              title="Act on reorder suggestions"
              description="Use operational signals and forecast-informed recommendations to decide what needs attention now."
            />
            <CapabilityRow
              title="Manage suppliers and purchase orders"
              description="Keep supplier history, draft purchase orders, and procurement actions connected to the medicine workflow."
            />
            <CapabilityRow
              title="Receive stock and update inventory"
              description="Bring incoming stock into the system cleanly so physical receipt and system state stay aligned."
            />
            <CapabilityRow
              title="Forecast demand"
              description="Use recent sales activity to estimate near-term demand and understand days of stock left."
            />
            <CapabilityRow
              title="Use barcode and OCR workflows"
              description="Support faster operational handling with scanning and recognition workflows where manual entry slows teams down."
            />
            <CapabilityRow
              title="Give operations leaders visibility"
              description="Create a shared picture of stock health, expiry exposure, reorders, and supplier progress in one place."
            />
          </div>
        </div>
      </section>

      <section id="product-preview" className="border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="Product Preview"
            title="A clean operational workspace, designed for action."
            description="The product experience prioritizes clarity over clutter, with real workflow surfaces for inventory, alerts, reorders, and supplier follow-through."
          />

          <div className="mt-12 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Inventory Workspace</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950">Daily stock and batch execution</h3>
                </div>
                <div className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-600">
                  Single operational view
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                <div className="rounded-[24px] border border-slate-200 bg-[#f8f8f6] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-950">Inventory table</p>
                    <span className="text-xs text-slate-500">Batch-aware</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      {
                        medicine: "Paracetamol 650",
                        batch: "PF-2031",
                        meta: "18 units · expires 12 Jun 2026",
                      },
                      {
                        medicine: "Cefixime 200",
                        batch: "CF-8841",
                        meta: "42 units · expires 06 Sep 2026",
                      },
                      {
                        medicine: "Metformin 500",
                        batch: "MF-4920",
                        meta: "11 units · expires 18 Aug 2026",
                      },
                    ].map((row) => (
                      <div key={row.batch} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-sm font-medium text-slate-950">{row.medicine}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.batch} · {row.meta}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[24px] border border-slate-200 bg-[#f8f8f6] p-4">
                    <p className="text-sm font-semibold text-slate-950">Alerts queue</p>
                    <div className="mt-4 space-y-3">
                      {[
                        "Amoxicillin batch expires in 15 days",
                        "Metformin 500 below reorder threshold",
                        "2 pending receiving tasks need review",
                      ].map((item) => (
                        <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-[#f8f8f6] p-4">
                    <p className="text-sm font-semibold text-slate-950">Reorder draft</p>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-medium text-slate-950">HealthLine Supply</p>
                      <p className="mt-1 text-xs text-slate-500">2 recommended medicines · draft PO ready</p>
                      <div className="mt-4 grid gap-2 text-sm text-slate-700">
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                          <span>Metformin 500</span>
                          <span>180</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                          <span>Azithromycin 500</span>
                          <span>90</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <ClipboardList className="h-5 w-5 text-slate-700" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-950">Structured around daily work</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Inventory actions, reorder follow-up, and purchasing tasks stay in one operating
                  rhythm instead of jumping between files and chats.
                </p>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <PackageCheck className="h-5 w-5 text-slate-700" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-950">Operational visibility that stays usable</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Teams can see what needs attention now, what is coming next, and what has already
                  moved through the workflow without digging.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="trust" className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
          <SectionHeading
            eyebrow="Trust"
            title="Built to feel dependable in real pharmacy operations."
            description="Rather than relying on hype, PharmaFlow is positioned around operational reliability, workflow fit, and clarity in the places pharmacy teams actually need it."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <FeatureCard
              icon={ShieldCheck}
              title="Built for real pharmacy workflows"
              description="The product is structured around how stock, expiry, receiving, and purchasing actually happen on the ground."
            />
            <FeatureCard
              icon={Boxes}
              title="Batch-aware inventory management"
              description="Inventory is not reduced to a flat count. Batch and expiry context stays visible where decisions are made."
            />
            <FeatureCard
              icon={AlertTriangle}
              title="Designed to reduce expiry losses and stockouts"
              description="Alerts, stock coverage, and reorder visibility help teams act sooner and with better context."
            />
            <FeatureCard
              icon={Truck}
              title="One operational system instead of fragmented tools"
              description="PharmaFlow brings stock movement, purchasing follow-through, and operational visibility into one environment."
            />
          </div>
        </div>
      </section>

      <section className="bg-[#f6f7f5]">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Final CTA</p>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Bring pharmacy operations into a clearer, more controlled system.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Replace manual inventory tracking and fragmented purchasing workflows with a single
            operating layer built for pharmacy teams that need better visibility every day.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Get Started
            </Link>
            <a
              href="#product-preview"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              View Demo
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-sm text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>PharmaFlow</p>
          <p>Inventory, procurement, and operational visibility for pharmacy teams.</p>
        </div>
      </footer>
    </main>
  );
}
