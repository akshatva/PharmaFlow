import { redirect } from "next/navigation";

import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import { ReceivePurchaseOrderForm } from "@/components/purchase-orders/receive-purchase-order-form";
import { PurchaseOrderStatusForm } from "@/components/purchase-orders/purchase-order-status-form";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PurchaseOrderRecord = {
  id: string;
  supplier_id: string;
  status: "draft" | "placed" | "received";
  created_at: string;
  reorder_source_id: string | null;
  suppliers:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

type PurchaseOrderItemRecord = {
  id: string;
  purchase_order_id: string;
  quantity: number;
  medicines:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function PurchaseOrdersPage() {
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

  const [
    { data: purchaseOrders, error: purchaseOrdersError },
    { data: purchaseOrderItems, error: itemsError },
  ] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id, supplier_id, status, created_at, reorder_source_id, suppliers(name)")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false }),
    supabase.from("purchase_order_items").select("id, purchase_order_id, quantity, medicines(name)"),
  ]);

  const dataError = purchaseOrdersError ?? itemsError;

  if (dataError) {
    if (isMissingRelationError(purchaseOrdersError, "purchase_orders")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Procurement"
            title="Purchase Orders"
            description="Track basic purchase orders created from reorder decisions, with simple supplier and status management."
          />
          <SetupNotice
            title="Purchase order table not available yet"
            description="The `purchase_orders` table is missing in your connected Supabase project. Run the supplier and purchase order SQL in Supabase, reload the schema, and refresh the app."
          />
        </div>
      );
    }

    if (isMissingRelationError(itemsError, "purchase_order_items")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Procurement"
            title="Purchase Orders"
            description="Track basic purchase orders created from reorder decisions, with simple supplier and status management."
          />
          <SetupNotice
            title="Purchase order items table not available yet"
            description="The `purchase_order_items` table is missing in your connected Supabase project. Run the supplier and purchase order SQL in Supabase, reload the schema, and refresh the app."
          />
        </div>
      );
    }

    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load purchase orders: ${dataError.message}`
        : "Unable to load purchase orders.",
    );
  }

  const orderIds = new Set(((purchaseOrders ?? []) as PurchaseOrderRecord[]).map((order) => order.id));
  const itemsByOrderId = new Map<string, { id: string; medicineName: string; quantity: number }[]>();

  ((purchaseOrderItems ?? []) as PurchaseOrderItemRecord[])
    .filter((item) => orderIds.has(item.purchase_order_id))
    .forEach((item) => {
      const medicine = Array.isArray(item.medicines) ? item.medicines[0] : item.medicines;
      const currentItems = itemsByOrderId.get(item.purchase_order_id) ?? [];

      currentItems.push({
        id: item.id,
        medicineName: medicine?.name ?? "Unknown medicine",
        quantity: item.quantity,
      });

      itemsByOrderId.set(item.purchase_order_id, currentItems);
    });

  const rows = ((purchaseOrders ?? []) as PurchaseOrderRecord[]).map((order) => {
    const supplier = Array.isArray(order.suppliers) ? order.suppliers[0] : order.suppliers;

    return {
      id: order.id,
      supplierName: supplier?.name ?? "Unknown supplier",
      status: order.status,
      createdAt: order.created_at,
      reorderSourceId: order.reorder_source_id,
      items: itemsByOrderId.get(order.id) ?? [],
    };
  });

  const receivedCount = rows.filter((row) => row.status === "received").length;
  const placedCount = rows.filter((row) => row.status === "placed").length;

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Procurement"
        title="Purchase Orders"
        description="Track basic purchase orders created from reorder decisions, with simple supplier and status management."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Total Orders
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{rows.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Placed
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{placedCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Received
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{receivedCount}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Purchase order list</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Lightweight purchase orders showing supplier, item count, and current workflow state.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No purchase orders yet. Create them from the Reorders page.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <h4 className="text-base font-semibold text-slate-950">{row.supplierName}</h4>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                      <span>Created {formatDate(row.createdAt)}</span>
                      <span>{row.items.length} item{row.items.length === 1 ? "" : "s"}</span>
                      <span>PO #{row.id.slice(0, 8)}</span>
                    </div>
                  </div>

                  <div className="w-full xl:w-auto">
                    <PurchaseOrderStatusForm
                      purchaseOrderId={row.id}
                      initialStatus={row.status}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {row.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-slate-900">{item.medicineName}</span>
                      <span className="text-slate-600">Quantity {item.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4">
                  <ReceivePurchaseOrderForm
                    purchaseOrderId={row.id}
                    items={row.items}
                    disabled={row.status === "received"}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
