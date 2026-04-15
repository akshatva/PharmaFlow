import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateMedicineFromScanForm } from "@/components/scan/create-medicine-from-scan-form";
import { BarcodeScanner } from "@/components/scan/barcode-scanner";
import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ScanPageProps = {
  searchParams?: Promise<{
    code?: string;
  }>;
};

type MedicineRecord = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  unit: string | null;
  created_at: string;
};

type InventoryBatchRecord = {
  id: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function ScanPage({ searchParams }: ScanPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const scannedCode = (resolvedSearchParams.code ?? "").trim();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  let barcodeColumnMissing = false;
  let matchedMedicine: MedicineRecord | null = null;
  let matchedBy: "barcode" | "sku" | null = null;
  let medicineLookupError: string | null = null;
  let recentBatches: InventoryBatchRecord[] = [];
  let currentStock = 0;

  if (scannedCode) {
    const [
      { data: barcodeMatches, error: barcodeError },
      { data: skuMatches, error: skuError },
    ] = await Promise.all([
      supabase
        .from("medicines")
        .select("id, name, sku, barcode, category, unit, created_at")
        .eq("organization_id", membership.organization_id)
        .eq("barcode", scannedCode)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("medicines")
        .select("id, name, sku, barcode, category, unit, created_at")
        .eq("organization_id", membership.organization_id)
        .eq("sku", scannedCode)
        .limit(1)
        .maybeSingle(),
    ]);

    if (barcodeError?.message?.toLowerCase().includes("barcode")) {
      barcodeColumnMissing = true;
    } else if (barcodeError) {
      medicineLookupError = barcodeError.message;
    }

    if (!medicineLookupError && skuError) {
      medicineLookupError = skuError.message;
    }

    matchedMedicine = (barcodeMatches as MedicineRecord | null) ?? (skuMatches as MedicineRecord | null);
    matchedBy = barcodeMatches ? "barcode" : skuMatches ? "sku" : null;

    if (matchedMedicine && !medicineLookupError) {
      const { data: batches, error: batchError } = await supabase
        .from("inventory_batches")
        .select("id, batch_number, quantity, expiry_date, created_at")
        .eq("organization_id", membership.organization_id)
        .eq("medicine_id", matchedMedicine.id)
        .order("created_at", { ascending: false });

      if (batchError) {
        medicineLookupError = batchError.message;
      } else {
        recentBatches = ((batches ?? []) as InventoryBatchRecord[]).slice(0, 5);
        currentStock = ((batches ?? []) as InventoryBatchRecord[]).reduce(
          (sum, batch) => sum + batch.quantity,
          0,
        );
      }
    }
  }

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Scan"
        title="Barcode scanner"
        description="Use your device camera to scan a barcode, match medicines quickly, and jump straight into inventory work."
      />

      <BarcodeScanner initialCode={scannedCode} />

      {barcodeColumnMissing ? (
        <SetupNotice
          title="Barcode column needs database setup"
          description="The `medicines.barcode` column is not available in your connected Supabase project yet. Run the SQL below, reload the schema, and then barcode matches and medicine creation from scan will work cleanly."
        />
      ) : null}

      {scannedCode ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Last scanned code
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">{scannedCode}</h3>
            </div>

            <Link
              href="/scan"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear result
            </Link>
          </div>

          {medicineLookupError ? (
            <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {process.env.NODE_ENV === "development"
                ? `Unable to load medicine for scan: ${medicineLookupError}`
                : "Unable to load medicine for this scan."}
            </p>
          ) : matchedMedicine ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Medicine</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{matchedMedicine.name}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Matched by</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{matchedBy}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Current stock</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{currentStock}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Identifiers</p>
                  <p className="mt-2 text-sm text-slate-700">
                    SKU: {matchedMedicine.sku || "—"}
                    <br />
                    Barcode: {matchedMedicine.barcode || "—"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href={`/inventory?query=${encodeURIComponent(matchedMedicine.name)}`}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Adjust stock
                </Link>
                <Link
                  href={`/inventory?medicineId=${encodeURIComponent(matchedMedicine.id)}&query=${encodeURIComponent(matchedMedicine.name)}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Add batch
                </Link>
                <Link
                  href={`/inventory?query=${encodeURIComponent(matchedMedicine.name)}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  View inventory
                </Link>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-slate-950">Recent batches</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Most recent inventory batches linked to this medicine.
                </p>

                {recentBatches.length ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="border-b border-slate-200 px-3 py-3 font-medium">Batch</th>
                          <th className="border-b border-slate-200 px-3 py-3 font-medium">Quantity</th>
                          <th className="border-b border-slate-200 px-3 py-3 font-medium">Expiry</th>
                          <th className="border-b border-slate-200 px-3 py-3 font-medium">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBatches.map((batch) => (
                          <tr key={batch.id}>
                            <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                              {batch.batch_number}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                              {batch.quantity}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                              {formatDate(batch.expiry_date)}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                              {formatDate(batch.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                    This medicine exists, but no batches have been added yet.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                <h4 className="text-base font-semibold text-amber-900">Medicine not found</h4>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  No medicine matched this code in your organization by barcode or SKU. You can create a new medicine with this barcode prefilled.
                </p>
              </div>

              <CreateMedicineFromScanForm barcode={scannedCode} />
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-semibold text-slate-950">How scan v1 works</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Scan a barcode using the device camera or paste it manually.
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              PharmaFlow checks the code against <code>medicines.barcode</code> and <code>medicines.sku</code>.
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              If a medicine is found, jump straight into inventory actions. If not, create it from the scan.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
