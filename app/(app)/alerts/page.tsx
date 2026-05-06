import Link from "next/link";
import { redirect } from "next/navigation";

import { ReorderButton } from "@/components/reorders/reorder-button";
import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import {
  formatAlertDate,
  getAlertsSnapshotForOrganization,
  getDaysUntilExpiry,
  type AlertRow,
} from "@/lib/alerts";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function AlertsSection({
  title,
  description,
  emptyTitle,
  emptyDescription,
  rows,
  renderReason,
  pendingReorderMedicineIds,
  showExpiry,
  showDaysLeft,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  rows: AlertRow[];
  renderReason: (row: AlertRow) => string;
  pendingReorderMedicineIds: Set<string>;
  showExpiry?: boolean;
  showDaysLeft?: boolean;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {rows.length} item{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="app-empty-state mt-6">
          <h4 className="app-empty-title">{emptyTitle}</h4>
          <p className="app-empty-copy">{emptyDescription}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-4 lg:hidden">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-base font-semibold text-slate-950">{row.medicineName}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Batch {row.batchNumber}
                      {row.sku ? ` • SKU ${row.sku}` : ""}
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    Qty {row.quantity}
                  </span>
                </div>

                {(showExpiry || showDaysLeft) ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {showExpiry ? (
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Expiry date</p>
                        <p className="mt-1 text-sm text-slate-700">{formatAlertDate(row.expiryDate)}</p>
                      </div>
                    ) : null}
                    {showDaysLeft ? (
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Days left</p>
                        <p className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          {getDaysUntilExpiry(row.expiryDate)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Reason</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{renderReason(row)}</p>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <ReorderButton
                    medicineId={row.medicineId}
                    reason={renderReason(row)}
                    existingPending={pendingReorderMedicineIds.has(row.medicineId)}
                  />
                  <Link
                    href="/inventory"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    View in inventory
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="app-table-shell mt-6 hidden overflow-x-auto lg:block">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch</th>
                  <th>Quantity</th>
                  {showExpiry ? (
                    <th>Expiry Date</th>
                  ) : null}
                  {showDaysLeft ? (
                    <th>Days Left</th>
                  ) : null}
                  {!showExpiry ? (
                    <th>SKU</th>
                  ) : null}
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium text-slate-900">
                      {row.medicineName}
                    </td>
                    <td className="text-slate-700">
                      {row.batchNumber}
                    </td>
                    <td>
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        Qty {row.quantity}
                      </span>
                    </td>
                    {showExpiry ? (
                      <td className="text-slate-700">
                        {formatAlertDate(row.expiryDate)}
                      </td>
                    ) : null}
                    {showDaysLeft ? (
                      <td>
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          {getDaysUntilExpiry(row.expiryDate)}
                        </span>
                      </td>
                    ) : null}
                    {!showExpiry ? (
                      <td className="text-slate-700">
                        {row.sku || "—"}
                      </td>
                    ) : null}
                    <td className="max-w-[300px]">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                        {renderReason(row)}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-3">
                        <ReorderButton
                          medicineId={row.medicineId}
                          reason={renderReason(row)}
                          existingPending={pendingReorderMedicineIds.has(row.medicineId)}
                        />
                        <Link
                          href="/inventory"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          View in inventory
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default async function AlertsPage() {
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

  const snapshot = await getAlertsSnapshotForOrganization(
    supabase,
    membership.organization_id,
  );

  if (snapshot.dataError) {
    if (isMissingRelationError(snapshot.reorderError, "reorder_items")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Attention"
            title="Alerts"
            description="Stock and expiry items that need review."
          />
          <SetupNotice
            title="Reorders not ready"
            description="Apply the reorder migration and refresh."
          />
        </div>
      );
    }

    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load alerts: ${snapshot.dataError.message}`
        : "Unable to load alerts.",
    );
  }

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Attention"
        title="Alerts"
        description="Stock and expiry items that need review."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Low Stock
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-amber-950">
            {snapshot.lowStockRows.length}
          </p>
        </div>
        <div className="rounded-3xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Near Expiry
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-blue-950">
            {snapshot.nearExpiryRows.length}
          </p>
        </div>
        <div className="rounded-3xl border border-red-200 bg-red-50/60 p-5 shadow-sm sm:col-span-2 xl:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
            Expired
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-red-950">
            {snapshot.expiredRows.length}
          </p>
        </div>
      </div>

      <AlertsSection
        title="Low stock items"
        description="Batches below the reorder attention threshold."
        emptyTitle="Healthy stock levels"
        emptyDescription="No batches are currently below their minimum threshold."
        rows={snapshot.lowStockRows}
        renderReason={(row) => `Low stock: batch ${row.batchNumber} is below threshold`}
        pendingReorderMedicineIds={snapshot.pendingReorderMedicineIds}
      />

      <AlertsSection
        title="Near expiry items"
        description="Batches approaching expiry."
        emptyTitle="No expiry risks"
        emptyDescription="All batches have healthy shelf lives remaining."
        rows={snapshot.nearExpiryRows}
        renderReason={(row) =>
          `Near expiry: batch ${row.batchNumber} expires on ${formatAlertDate(row.expiryDate)}`
        }
        pendingReorderMedicineIds={snapshot.pendingReorderMedicineIds}
        showExpiry
        showDaysLeft
      />

      <AlertsSection
        title="Expired items"
        description="Batches past expiry."
        emptyTitle="No expired stock"
        emptyDescription="There are no expired batches in your inventory."
        rows={snapshot.expiredRows}
        renderReason={(row) =>
          `Expired stock: batch ${row.batchNumber} expired on ${formatAlertDate(row.expiryDate)}`
        }
        pendingReorderMedicineIds={snapshot.pendingReorderMedicineIds}
        showExpiry
      />
    </div>
  );
}
