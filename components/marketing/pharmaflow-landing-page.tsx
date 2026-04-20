"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, LineChart, SearchCheck } from "lucide-react";
import DotPattern from "@/components/ui/dot-pattern-1";
import { Hero } from "@/components/ui/animated-hero";
import { UpgradeBanner } from "@/components/ui/upgrade-banner";
import { HeroScrollDemo } from "@/components/ui/hero-scroll-demo";

function ProofCard({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 text-center shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
      <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function StepCard({
  step,
  title,
  line,
}: {
  step: string;
  title: string;
  line: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {step}
      </p>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{line}</p>
    </div>
  );
}

function CoreCard({
  icon: Icon,
  title,
  line,
}: {
  icon: typeof AlertTriangle;
  title: string;
  line: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
      <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{line}</p>
    </div>
  );
}

function LayerShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto max-w-[92rem] rounded-[32px] border border-slate-200/80 bg-white/88 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_18px_50px_rgba(15,23,42,0.035)] backdrop-blur-sm ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function ProductGlimpse() {
  return (
    <div className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-950">
        <div className="border-b border-white/10 bg-slate-900 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Product glimpse</p>
              <h3 className="mt-2 text-lg font-semibold text-white">PharmaFlow workspace</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              Live view
            </span>
          </div>
        </div>

        <div className="grid gap-4 bg-slate-950 p-4 xl:grid-cols-[1.3fr_0.85fr]">
          <div className="rounded-3xl border border-white/10 bg-white p-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Inventory</p>
                <h4 className="mt-1 text-base font-semibold text-slate-950">Batch-aware stock</h4>
              </div>
              <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                Updated now
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 font-medium">Medicine</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-medium">Qty</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Paracetamol 650", "18", "Low stock"],
                    ["Amoxicillin 500", "62", "Expiry watch"],
                    ["Metformin 500", "11", "Reorder now"],
                  ].map((row) => (
                    <tr key={row[0]}>
                      <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-900">
                        {row[0]}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-600">{row[1]}</td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                          {row[2]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">Needs attention</p>
              <div className="mt-4 space-y-3">
                {[
                  "2 batches expiring within 15 days",
                  "Metformin 500 will run out in 4.5 days",
                  "1 reorder draft needs review",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-semibold text-white">Suggested reorder</p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-medium text-white">Metformin 500</p>
                <p className="mt-1 text-xs text-slate-400">180 units · HealthLine Supply</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PharmaFlowLandingPage() {
  const router = useRouter();

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

          <div className="flex items-center gap-3">
            <Link
              href="#product-glimpse"
              className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
            >
              View product
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <div className="space-y-6 px-3 py-6 sm:px-4 lg:px-6 lg:py-8">
        <LayerShell>
          <section className="bg-[#f6f7f5]/55">
            <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 lg:px-8 lg:py-20">
              <Hero />
              <UpgradeBanner
                className="mt-4"
                buttonText="See inventory in action"
                description="review the workflow before you upload your first file"
                onClick={() => router.push("/sign-in")}
              />
            </div>
          </section>
        </LayerShell>

        <LayerShell>
          <section className="border-b border-slate-200/70 bg-white">
            <div className="mx-auto max-w-5xl px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
              <div className="grid gap-4 md:grid-cols-3">
                <ProofCard value="Batch-aware" label="Inventory" />
                <ProofCard value="Action-first" label="Alerts" />
                <ProofCard value="14 days" label="Reorder cover" />
              </div>
            </div>
          </section>

          <section id="how-it-works" className="bg-[#f6f7f5]/45">
            <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  How it works
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  One workflow. Three steps.
                </h2>
              </div>

              <div className="mt-10 grid gap-4 lg:grid-cols-3">
                <StepCard
                  step="01"
                  title="Import stock"
                  line="Upload inventory once and keep batch data clean."
                />
                <StepCard
                  step="02"
                  title="See risk"
                  line="Catch low stock and ageing batches before they hurt service."
                />
                <StepCard
                  step="03"
                  title="Act fast"
                  line="Turn the signal into a clear reorder decision."
                />
              </div>
            </div>
          </section>
        </LayerShell>

        <LayerShell>
          <section className="border-b border-slate-200/70 bg-white">
            <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Core capabilities
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Focus on what needs action.
                </h2>
              </div>

              <div className="mt-10 grid gap-4 lg:grid-cols-3">
                <CoreCard
                  icon={AlertTriangle}
                  title="Stockout Risk"
                  line="Know what will run short before it becomes urgent."
                />
                <CoreCard
                  icon={LineChart}
                  title="Expiry Risk"
                  line="See which batches need attention before value is lost."
                />
                <CoreCard
                  icon={SearchCheck}
                  title="Reorder Suggestions"
                  line="Use clear stock-cover logic to decide what to buy next."
                />
              </div>
            </div>
          </section>

          <section id="product-glimpse" className="bg-[#f6f7f5]/45">
            <HeroScrollDemo />
          </section>
        </LayerShell>

        <LayerShell>
          <section className="bg-white">
            <div className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
              <div className="relative mx-auto mb-12 max-w-5xl overflow-hidden rounded-[32px] border border-slate-200 bg-[#f8fafc]">
                <DotPattern width={6} height={6} className="fill-slate-300/70" />
                <div className="absolute -left-1.5 -top-1.5 h-3 w-3 bg-slate-900" />
                <div className="absolute -bottom-1.5 -left-1.5 h-3 w-3 bg-slate-900" />
                <div className="absolute -right-1.5 -top-1.5 h-3 w-3 bg-slate-900" />
                <div className="absolute -bottom-1.5 -right-1.5 h-3 w-3 bg-slate-900" />

                <div className="relative z-10 px-6 py-10 md:px-10 md:py-14">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Clear principle
                  </p>
                  <div className="mt-4 space-y-2 text-left text-3xl font-semibold tracking-[-0.05em] text-slate-950 md:text-5xl">
                    <p>Inventory decisions should be easy to trust.</p>
                    <p className="font-light text-slate-600">Simple signals. Faster action.</p>
                  </div>
                </div>
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Final CTA
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Run pharmacy inventory from one calm system.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Start with inventory. Keep the rest of the workflow in the same place.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/sign-in"
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Get started
                </Link>
              </div>
            </div>
          </section>
        </LayerShell>
      </div>
    </main>
  );
}
