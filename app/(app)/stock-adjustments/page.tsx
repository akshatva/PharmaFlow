import Link from "next/link";
import { redirect } from "next/navigation";

import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StockAdjustmentLogRecord = {
  id: string;
  medicine_id: string | null;
  inventory_batch_id: string | null;
  user_id: string | null;
  action_type:
    | "batch_created"
    | "batch_updated"
    | "batch_deleted"
    | "stock_received"
    | "manual_adjustment";
  previous_quantity: number | null;
  new_quantity: number | null;
  quantity_change: number | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type MedicineRecord = {
  id: string;
  name: string;
};

type BatchRecord = {
  id: string;
  batch_number: string;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
  email: string;
};

type StockAdjustmentRow = {
  id: string;
  medicineName: string;
  batchNumber: string;
  actionType: StockAdjustmentLogRecord["action_type"];
  previousQuantity: number | null;
  newQuantity: number | null;
  quantityChange: number | null;
  note: string | null;
  actorLabel: string;
  createdAt: string;
};

type StockAdjustmentsPageProps = {
  searchParams?: Promise<{
    actionType?: string;
    query?: string;
  }>;
};

const actionTypeLabels: Record<StockAdjustmentLogRecord["action_type"], string> = {
  batch_created: "Batch Created",
  batch_updated: "Batch Updated",
  batch_deleted: "Batch Deleted",
  stock_received: "Stock Received",
  manual_adjustment: "Manual Adjustment",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatQuantityChange(value: number | null) {
  if (value === null) {
    return "—";
  }

  if (value === 0) {
    return "0";
  }

  return value > 0 ? `+${value}` : `${value}`;
}

function getMetadataBatchNumber(metadata: Record<string, unknown> | null) {
  const rawBatchNumber = metadata?.batch_number;
  return typeof rawBatchNumber === "string" ? rawBatchNumber : "";
}

export default async function StockAdjustmentsPage({
  searchParams,
}: StockAdjustmentsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const actionTypeFilter = (resolvedSearchParams.actionType ?? "").trim();
  const query = (resolvedSearchParams.query ?? "").trim().toLowerCase();

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

  const { data: logs, error: logsError } = await supabase
    .from("stock_adjustment_logs")
    .select(
      "id, medicine_id, inventory_batch_id, user_id, action_type, previous_quantity, new_quantity, quantity_change, note, metadata, created_at",
    )
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false });

  if (logsError) {
    if (isMissingRelationError(logsError, "stock_adjustment_logs")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Traceability"
            title="Stock adjustments"
            description="Track manual inventory edits, deletions, and received stock so every quantity change has a visible history."
          />
          <SetupNotice
            title="Stock adjustment logging needs database setup"
            description="The `stock_adjustment_logs` table is missing in your connected Supabase project. Run the stock adjustment log SQL, reload the schema, and refresh the app."
          />
        </div>
      );
    }

    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load stock adjustments: ${logsError.message}`
        : "Unable to load stock adjustments.",
    );
  }

  const logRecords = (logs ?? []) as StockAdjustmentLogRecord[];
  const medicineIds = Array.from(
    new Set(logRecords.map((log) => log.medicine_id).filter((value): value is string => Boolean(value))),
  );
  const batchIds = Array.from(
    new Set(
      logRecords
        .map((log) => log.inventory_batch_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const userIds = Array.from(
    new Set(logRecords.map((log) => log.user_id).filter((value): value is string => Boolean(value))),
  );

  const [
    { data: medicines, error: medicinesError },
    { data: batches, error: batchesError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    medicineIds.length
      ? supabase.from("medicines").select("id, name").in("id", medicineIds)
      : Promise.resolve({ data: [], error: null }),
    batchIds.length
      ? supabase.from("inventory_batches").select("id, batch_number").in("id", batchIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const lookupError = medicinesError ?? batchesError ?? profilesError;

  if (lookupError) {
    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load stock adjustment references: ${lookupError.message}`
        : "Unable to load stock adjustment references.",
    );
  }

  const medicineMap = new Map(
    ((medicines ?? []) as MedicineRecord[]).map((medicine) => [medicine.id, medicine.name]),
  );
  const batchMap = new Map(
    ((batches ?? []) as BatchRecord[]).map((batch) => [batch.id, batch.batch_number]),
  );
  const profileMap = new Map(
    ((profiles ?? []) as ProfileRecord[]).map((profile) => [
      profile.id,
      profile.full_name?.trim() || profile.email,
    ]),
  );

  const rows: StockAdjustmentRow[] = logRecords
    .map((log) => ({
      id: log.id,
      medicineName: log.medicine_id
        ? (medicineMap.get(log.medicine_id) ?? "Unknown medicine")
        : "Unknown medicine",
      batchNumber:
        (log.inventory_batch_id ? batchMap.get(log.inventory_batch_id) : null) ??
        getMetadataBatchNumber(log.metadata) ??
        "—",
      actionType: log.action_type,
      previousQuantity: log.previous_quantity,
      newQuantity: log.new_quantity,
      quantityChange: log.quantity_change,
      note: log.note,
      actorLabel: log.user_id ? (profileMap.get(log.user_id) ?? "Unknown user") : "System",
      createdAt: log.created_at,
    }))
    .filter((row) => {
      const matchesAction = !actionTypeFilter || row.actionType === actionTypeFilter;
      const matchesQuery =
        !query ||
        row.medicineName.toLowerCase().includes(query) ||
        row.batchNumber.toLowerCase().includes(query);

      return matchesAction && matchesQuery;
    });

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Traceability"
        title="Stock adjustments"
        description="Track manual inventory edits, deletions, and received stock so every quantity change has a visible history."
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Adjustment history</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Filter by action type or search by medicine and batch number to quickly inspect recent changes.
            </p>
          </div>
          <Link
            href="/inventory"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            View inventory
          </Link>
        </div>

        <form className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="query">
              Search
            </label>
            <input
              id="query"
              name="query"
              defaultValue={resolvedSearchParams.query ?? ""}
              placeholder="Search by medicine or batch number"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="actionType">
              Action type
            </label>
            <select
              id="actionType"
              name="actionType"
              defaultValue={actionTypeFilter}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
            >
              <option value="">All actions</option>
              <option value="batch_created">Batch Created</option>
              <option value="batch_updated">Batch Updated</option>
              <option value="manual_adjustment">Manual Adjustment</option>
              <option value="batch_deleted">Batch Deleted</option>
              <option value="stock_received">Stock Received</option>
            </select>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <button
              type="submit"
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 md:w-auto"
            >
              Apply filters
            </button>
            <Link
              href="/stock-adjustments"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50 md:w-auto"
            >
              Reset
            </Link>
          </div>
        </form>

        {logRecords.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No stock adjustment history yet. Create, edit, delete, or receive inventory to start building an audit trail.
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No adjustment logs match your current filters. Try clearing the search or selecting a different action type.
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-4 lg:hidden">
              {rows.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-950">{row.medicineName}</p>
                      <p className="mt-1 text-sm text-slate-500">Batch {row.batchNumber || "—"}</p>
                    </div>
                    <span className="inline-flex w-fit rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {actionTypeLabels[row.actionType]}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Time</p>
                      <p className="mt-1 text-sm text-slate-700">{formatDateTime(row.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">User</p>
                      <p className="mt-1 text-sm text-slate-700">{row.actorLabel}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Previous</p>
                      <p className="mt-1 text-sm text-slate-700">{row.previousQuantity ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">New</p>
                      <p className="mt-1 text-sm text-slate-700">{row.newQuantity ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Change</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {formatQuantityChange(row.quantityChange)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    {row.note ?? "No extra note recorded."}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 hidden overflow-x-auto lg:block">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Medicine</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Previous</th>
                    <th className="px-4 py-3">New</th>
                    <th className="px-4 py-3">Change</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top text-slate-700">
                      <td className="px-4 py-4 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                      <td className="px-4 py-4 font-medium text-slate-950">{row.medicineName}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{row.batchNumber || "—"}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                          {actionTypeLabels[row.actionType]}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">{row.previousQuantity ?? "—"}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{row.newQuantity ?? "—"}</td>
                      <td className="px-4 py-4 whitespace-nowrap font-medium text-slate-950">
                        {formatQuantityChange(row.quantityChange)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">{row.actorLabel}</td>
                      <td className="px-4 py-4 text-slate-600">{row.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
