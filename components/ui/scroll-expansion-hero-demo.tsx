'use client';

import { Hero } from '@/components/ui/animated-hero';
import ScrollExpandMedia from '@/components/ui/scroll-expansion-hero';

function CommandCenterPreview() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.1)]">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950">
          <div className="border-b border-white/10 bg-slate-900 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Product preview
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  PharmaFlow command center
                </h3>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                One scroll later
              </div>
            </div>
          </div>

          <div className="grid gap-4 bg-slate-950 p-4 xl:grid-cols-[1.4fr_0.95fr]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Low Stock', '14', 'Requires action today'],
                  ['Expiring', '9', 'Within 30 days'],
                  ['Draft POs', '4', 'Pending review'],
                ].map(([label, value, note]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
                    <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
                    <p className="mt-1 text-xs text-slate-400">{note}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white p-4">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Inventory Table
                    </p>
                    <h4 className="mt-1 text-base font-semibold text-slate-950">
                      Batch-aware stock view
                    </h4>
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
                        ['Paracetamol 650', 'PF-2031', '18', '12 Jun 2026', 'Low stock'],
                        ['Amoxicillin 500', 'AM-1182', '62', '04 May 2026', 'Expiring soon'],
                        ['Metformin 500', 'MF-4920', '11', '18 Aug 2026', 'Reorder now'],
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
                <p className="text-sm font-semibold text-white">Needs attention</p>
                <div className="mt-4 space-y-3">
                  {[
                    '2 batches expiring within 15 days',
                    'Metformin 500 will run out in 4.5 days',
                    'Draft purchase order pending supplier confirmation',
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
                <p className="text-sm font-semibold text-white">Reorder Recommendations</p>
                <div className="mt-4 space-y-3">
                  {[
                    { medicine: 'Metformin 500', supplier: 'HealthLine Supply', quantity: '180 units' },
                    { medicine: 'Azithromycin 500', supplier: 'CareBridge Pharma', quantity: '90 units' },
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScrollExpansionHeroDemo() {
  return (
    <section className="border-b border-slate-200 bg-[#f6f7f5]">
      <ScrollExpandMedia
        mediaType="video"
        mediaSrc="/pharmaW.mp4"
        bgImageSrc="https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1920&q=80"
        scrollToExpand="Scroll to view the workspace"
      >
        <div className="pt-28 md:pt-40">
          <div className="mx-auto max-w-5xl">
            <Hero />
          </div>
          <div className="mt-20 md:mt-28">
            <CommandCenterPreview />
          </div>
        </div>
      </ScrollExpandMedia>
    </section>
  );
}
