import Link from "next/link";
import { redirect } from "next/navigation";

import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import { SupplierAnalyticsView } from "@/components/suppliers/supplier-analytics-view";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupplierRecord = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
};

type PurchaseOrderRecord = {
  id: string;
  supplier_id: string;
  status: "draft" | "placed" | "received";
  created_at: string;
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

function getDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.getTime();
}

export default async function SupplierAnalyticsPage() {
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
    { data: suppliers, error: suppliersError },
    { data: purchaseOrders, error: purchaseOrdersError },
  ] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name, contact_person, phone, email")
      .eq("organization_id", membership.organization_id)
      .order("name", { ascending: true }),
    supabase
      .from("purchase_orders")
      .select("id, supplier_id, status, created_at")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false }),
  ]);

  const baseError = suppliersError ?? purchaseOrdersError;

  if (baseError) {
    if (isMissingRelationError(suppliersError, "suppliers")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Procurement"
            title="Supplier Analytics"
            description="Review supplier usage, order activity, and medicine coverage for your organization."
          />
          <SetupNotice
            title="Supplier table not available yet"
            description="The `suppliers` table is missing in your connected Supabase project. Run the supplier and purchase order SQL in Supabase, reload the schema, and refresh the app."
          />
        </div>
      );
    }

    if (isMissingRelationError(purchaseOrdersError, "purchase_orders")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Procurement"
            title="Supplier Analytics"
            description="Review supplier usage, order activity, and medicine coverage for your organization."
          />
          <SetupNotice
            title="Purchase order table not available yet"
            description="The `purchase_orders` table is missing in your connected Supabase project. Run the supplier and purchase order SQL in Supabase, reload the schema, and refresh the app."
          />
        </div>
      );
    }

    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load supplier analytics: ${baseError.message}`
        : "Unable to load supplier analytics.",
    );
  }

  const orderIds = ((purchaseOrders ?? []) as PurchaseOrderRecord[]).map((order) => order.id);

  const { data: purchaseOrderItems, error: itemsError } = orderIds.length
    ? await supabase
        .from("purchase_order_items")
        .select("id, purchase_order_id, quantity, medicines(name)")
        .in("purchase_order_id", orderIds)
    : { data: [], error: null };

  if (itemsError) {
    if (isMissingRelationError(itemsError, "purchase_order_items")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Procurement"
            title="Supplier Analytics"
            description="Review supplier usage, order activity, and medicine coverage for your organization."
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
        ? `Unable to load supplier analytics items: ${itemsError.message}`
        : "Unable to load supplier analytics items.",
    );
  }

  const ordersBySupplierId = new Map<string, PurchaseOrderRecord[]>();

  ((purchaseOrders ?? []) as PurchaseOrderRecord[]).forEach((order) => {
    const currentOrders = ordersBySupplierId.get(order.supplier_id) ?? [];
    currentOrders.push(order);
    ordersBySupplierId.set(order.supplier_id, currentOrders);
  });

  const itemsByOrderId = new Map<string, PurchaseOrderItemRecord[]>();

  ((purchaseOrderItems ?? []) as PurchaseOrderItemRecord[]).forEach((item) => {
    const currentItems = itemsByOrderId.get(item.purchase_order_id) ?? [];
    currentItems.push(item);
    itemsByOrderId.set(item.purchase_order_id, currentItems);
  });

  const mostOrders = Math.max(
    0,
    ...Array.from(ordersBySupplierId.values()).map((orders) => orders.length),
  );
  const recentActivityCutoff = getDaysAgo(30);
  const inactiveCutoff = getDaysAgo(60);

  const analyticsRows = ((suppliers ?? []) as SupplierRecord[]).map((supplier) => {
    const supplierOrders = [...(ordersBySupplierId.get(supplier.id) ?? [])].sort(
      (first, second) =>
        new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
    );
    const lastOrderDate = supplierOrders[0]?.created_at ?? null;
    const totalItems = supplierOrders.reduce((sum, order) => {
      return sum + (itemsByOrderId.get(order.id)?.length ?? 0);
    }, 0);
    const totalQuantityOrdered = supplierOrders.reduce((sum, order) => {
      return (
        sum +
        (itemsByOrderId.get(order.id) ?? []).reduce(
          (itemSum, item) => itemSum + item.quantity,
          0,
        )
      );
    }, 0);

    const suppliedMedicines = Array.from(
      new Set(
        supplierOrders.flatMap((order) =>
          (itemsByOrderId.get(order.id) ?? []).map((item) => {
            const medicine = Array.isArray(item.medicines)
              ? item.medicines[0]
              : item.medicines;

            return medicine?.name ?? "Unknown medicine";
          }),
        ),
      ),
    ).sort((first, second) => first.localeCompare(second));

    const insightLabels: string[] = [];

    if (supplierOrders.length > 0 && supplierOrders.length === mostOrders) {
      insightLabels.push("Most used supplier");
    }

    if (
      lastOrderDate &&
      new Date(lastOrderDate).getTime() >= recentActivityCutoff
    ) {
      insightLabels.push("Recently active supplier");
    }

    if (
      !lastOrderDate ||
      new Date(lastOrderDate).getTime() < inactiveCutoff
    ) {
      insightLabels.push("Inactive supplier");
    }

    return {
      id: supplier.id,
      name: supplier.name,
      contactPerson: supplier.contact_person,
      phone: supplier.phone,
      email: supplier.email,
      totalOrders: supplierOrders.length,
      totalItems,
      totalQuantityOrdered,
      lastOrderDate,
      insightLabels,
      recentPurchaseOrders: supplierOrders.slice(0, 3).map((order) => {
        const items = itemsByOrderId.get(order.id) ?? [];

        return {
          id: order.id,
          createdAt: order.created_at,
          status: order.status,
          itemCount: items.length,
          totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        };
      }),
      suppliedMedicines,
    };
  });

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Procurement"
        title="Supplier Analytics"
        description="Review supplier usage, order activity, and medicine coverage for your organization."
      />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/suppliers"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Back to suppliers
        </Link>
        <Link
          href="/purchase-orders"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          View purchase orders
        </Link>
      </div>

      <SupplierAnalyticsView suppliers={analyticsRows} />
    </div>
  );
}
