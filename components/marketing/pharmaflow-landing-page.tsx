"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, LineChart, SearchCheck, FlaskConical } from "lucide-react";
import DotPattern from "@/components/ui/dot-pattern-1";
import { Hero } from "@/components/ui/animated-hero";
import { UpgradeBanner } from "@/components/ui/upgrade-banner";
import { HeroScrollDemo } from "@/components/ui/hero-scroll-demo";
import { CircularRevealHeading } from "@/components/ui/circular-reveal-heading";


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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="min-h-screen bg-[#f6f7f5] text-slate-950">
      {/* ── FLOATING GLASSMORPHIC NAVBAR ── */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
        <div
          className={`mx-auto flex max-w-5xl items-center justify-between rounded-2xl px-4 py-3 transition-all duration-500 ${
            scrolled
              ? "bg-[#111111]/30 backdrop-blur-3xl saturate-150 shadow-[0_8px_40px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-white/10"
              : "bg-[#111111]/20 backdrop-blur-2xl saturate-150 ring-1 ring-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
          }`}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.1)] border border-slate-400/30">
              <FlaskConical className="h-4 w-4 text-slate-800" />
            </div>
            <span className="bg-gradient-to-b from-slate-950 to-slate-700 bg-clip-text text-[14px] font-bold tracking-tight text-transparent">
              PharmaFlow
            </span>
          </Link>

          {/* Centre nav links */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {[
              { label: "Home", href: "/" },
              { label: "Features", href: "#capabilities" },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="rounded-full px-3.5 py-1.5 text-sm font-bold text-slate-800 transition-colors hover:bg-black/5 hover:text-black"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right CTA */}
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="hidden text-sm font-semibold text-slate-600 transition hover:text-slate-950 sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-slate-50 via-slate-200 to-slate-300 px-4 py-2 text-sm font-bold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_4px_rgba(0,0,0,0.1)] transition hover:from-white hover:to-slate-200 active:scale-95 border border-slate-400/40"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <div className="space-y-6 px-3 pt-24 pb-6 sm:px-4 lg:px-6 lg:pb-8">
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

          <section id="capabilities" className="bg-[#f6f7f5]/45">
            <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-2xl text-center mb-20">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Capabilities & Workflow
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  One workflow. Total control.
                </h2>
                <p className="mt-4 text-slate-600">
                  Hover over the segments to explore how PharmaFlow unifies stock management, risk detection, and reordering.
                </p>
              </div>

              <div className="flex justify-center">
                <CircularRevealHeading
                  size="md"
                  centerText={
                    <div className="flex flex-col items-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-slate-200 bg-white text-xl font-bold text-slate-950 shadow-sm">
                        PF
                      </div>
                      <p className="mt-4 text-sm font-semibold text-slate-950">PharmaFlow</p>
                    </div>
                  }
                  items={[
                    {
                      text: "Import Stock",
                      image: "https://images.unsplash.com/photo-1512678080530-7760d81faba6?auto=format&fit=crop&q=80&w=800"
                    },
                    {
                      text: "See Risk",
                      image: "https://images.unsplash.com/photo-1587854680352-936b22b91030?auto=format&fit=crop&q=80&w=800"
                    },
                    {
                      text: "Act Fast",
                      image: "https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&q=80&w=800"
                    },
                    {
                      text: "Stockout Risk",
                      image: "https://images.unsplash.com/photo-1584017947282-2c836a928271?auto=format&fit=crop&q=80&w=800"
                    },
                    {
                      text: "Expiry Risk",
                      image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800"
                    },
                    {
                      text: "Reorder Logic",
                      image: "https://images.unsplash.com/photo-1563213126-a4273aed9016?auto=format&fit=crop&q=80&w=800"
                    }
                  ]}
                />
              </div>
            </div>
          </section>
        </LayerShell>

        <LayerShell>
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
