import { redirect } from "next/navigation";

import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import { CreatePoFromReorderForm } from "@/components/purchase-orders/create-po-from-reorder-form";
import { ReorderStatusForm } from "@/components/reorders/reorder-status-form";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ReorderItemRecord = {
  id: string;
  medicine_id: string;
  reason: string;
  status: "pending" | "ordered";
  created_at: string;
  medicines:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

type BatchRecord = {
  medicine_id: string;
  quantity: number;
};

type SalesRecord = {
  medicine_id: string;
  quantity_sold: number;
};

type SupplierRecord = {
  id: string;
  name: string;
};

type PurchaseOrderRecord = {
  reorder_source_id: string | null;
};

type ReorderRow = {
  id: string;
  medicineId: string;
  medicineName: string;
  currentStock: number;
  recentSales: number;
  reason: string;
  status: "pending" | "ordered";
  createdAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function ReordersPage() {
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

  const recentSalesCutoff = new Date();
  recentSalesCutoff.setDate(recentSalesCutoff.getDate() - 30);

  const [
    { data: reorderItems, error: reorderError },
    { data: batchRecords, error: batchError },
    { data: salesRecords, error: salesError },
    { data: suppliers, error: suppliersError },
    { data: purchaseOrders, error: purchaseOrdersError },
  ] = await Promise.all([
    supabase
      .from("reorder_items")
      .select("id, medicine_id, reason, status, created_at, medicines(name)")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("inventory_batches")
      .select("medicine_id, quantity")
      .eq("organization_id", membership.organization_id),
    supabase
      .from("sales_records")
      .select("medicine_id, quantity_sold")
      .eq("organization_id", membership.organization_id)
      .gte("sold_at", recentSalesCutoff.toISOString()),
    supabase
      .from("suppliers")
      .select("id, name")
      .eq("organization_id", membership.organization_id)
      .order("name", { ascending: true }),
    supabase
      .from("purchase_orders")
      .select("reorder_source_id")
      .eq("organization_id", membership.organization_id),
  ]);

  const dataError =
    reorderError ?? batchError ?? salesError ?? suppliersError ?? purchaseOrdersError;

  if (dataError) {
    if (isMissingRelationError(reorderError, "reorder_items")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Action"
            title="Reorders"
            description="Simple reorder workflow for medicines that need attention, with clear reasons, supplier selection, and lightweight purchasing follow-through."
          />
          <SetupNotice
            title="Reorder workflow needs database setup"
            description="The `reorder_items` table is missing in your connected Supabase project. Run the reorder_items SQL in Supabase, reload the schema, and refresh the app."
          />
        </div>
      );
    }

    if (isMissingRelationError(suppliersError, "suppliers")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Action"
            title="Reorders"
            description="Simple reorder workflow for medicines that need attention, with clear reasons, supplier selection, and lightweight purchasing follow-through."
          />
          <SetupNotice
            title="Supplier workflow needs database setup"
            description="The `suppliers` table is missing in your connected Supabase project. Run the supplier and purchase order SQL in Supabase, reload the schema, and refresh the app."
          />
        </div>
      );
    }

    if (isMissingRelationError(purchaseOrdersError, "purchase_orders")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Action"
            title="Reorders"
            description="Simple reorder workflow for medicines that need attention, with clear reasons, supplier selection, and lightweight purchasing follow-through."
          />
          <SetupNotice
            title="Purchase order workflow needs database setup"
            description="The `purchase_orders` table is missing in your connected Supabase project. Run the supplier and purchase order SQL in Supabase, reload the schema, and refresh the app."
          />
        </div>
      );
    }

    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load reorders: ${dataError.message}`
        : "Unable to load reorders.",
    );
  }

  const stockByMedicine = new Map<string, number>();
  const salesByMedicine = new Map<string, number>();
  const purchaseOrderSourceIds = new Set<string>();

  ((batchRecords ?? []) as BatchRecord[]).forEach((batch) => {
    stockByMedicine.set(
      batch.medicine_id,
      (stockByMedicine.get(batch.medicine_id) ?? 0) + batch.quantity,
    );
  });

  ((salesRecords ?? []) as SalesRecord[]).forEach((sale) => {
    salesByMedicine.set(
      sale.medicine_id,
      (salesByMedicine.get(sale.medicine_id) ?? 0) + sale.quantity_sold,
    );
  });

  ((purchaseOrders ?? []) as PurchaseOrderRecord[]).forEach((purchaseOrder) => {
    if (purchaseOrder.reorder_source_id) {
      purchaseOrderSourceIds.add(purchaseOrder.reorder_source_id);
    }
  });

  const rows: ReorderRow[] = ((reorderItems ?? []) as ReorderItemRecord[]).map((item) => {
    const medicine = Array.isArray(item.medicines) ? item.medicines[0] : item.medicines;

    return {
      id: item.id,
      medicineId: item.medicine_id,
      medicineName: medicine?.name ?? "Unknown medicine",
      currentStock: stockByMedicine.get(item.medicine_id) ?? 0,
      recentSales: salesByMedicine.get(item.medicine_id) ?? 0,
      reason: item.reason,
      status: item.status,
      createdAt: item.created_at,
    };
  });

  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const orderedCount = rows.filter((row) => row.status === "ordered").length;

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Action"
        title="Reorders"
        description="Simple reorder workflow for medicines that need attention, with clear reasons, supplier selection, and lightweight purchasing follow-through."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Total Reorders
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{rows.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Pending
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{pendingCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Ordered
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{orderedCount}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Reorder list</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Medicines flagged for replenishment, with supplier-driven purchase order creation.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No reorder items yet. Create them from Alerts or Insights when something needs action.
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-4 lg:hidden">
              {rows.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-950">{row.medicineName}</p>
                      <p className="mt-1 text-sm text-slate-500">Created {formatDate(row.createdAt)}</p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <ReorderStatusForm reorderItemId={row.id} initialStatus={row.status} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Current stock</p>
                      <p className="mt-1 text-sm text-slate-700">{row.currentStock}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Recent sales (30d)</p>
                      <p className="mt-1 text-sm text-slate-700">{row.recentSales}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    {row.reason}
                  </div>

                  <div className="mt-4">
                    <CreatePoFromReorderForm
                      reorderItemId={row.id}
                      suggestedQuantity={Math.max(row.recentSales, 1)}
                      suppliers={(suppliers ?? []) as SupplierRecord[]}
                      disabled={purchaseOrderSourceIds.has(row.id)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 hidden overflow-x-auto lg:block">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Medicine</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Current Stock</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Recent Sales (30d)</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Reason</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Created</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Status</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Create PO</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                        {row.medicineName}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                        {row.currentStock}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                        {row.recentSales}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                        {row.reason}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <ReorderStatusForm reorderItemId={row.id} initialStatus={row.status} />
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <CreatePoFromReorderForm
                          reorderItemId={row.id}
                          suggestedQuantity={Math.max(row.recentSales, 1)}
                          suppliers={(suppliers ?? []) as SupplierRecord[]}
                          disabled={purchaseOrderSourceIds.has(row.id)}
                        />
                      </td>
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
