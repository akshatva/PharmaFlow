import { redirect } from "next/navigation";

import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import { ProcurementFilters } from "@/components/procurement/procurement-filters";
import { ProcurementOrderStatusForm } from "@/components/procurement/procurement-order-status-form";
import { CopySupplierMessageButton } from "@/components/procurement/copy-supplier-message-button";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProcurementOrderRecord = {
  id: string;
  supplier_id: string | null;
  medicine_name: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  status: "pending" | "ordered" | "in_transit" | "delivered" | "cancelled";
  expected_delivery_date: string | null;
  notes: string | null;
  created_at: string;
  distributors:
    | {
        distributor_name: string;
      }
    | {
        distributor_name: string;
      }[]
    | null;
  organizations?:
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

function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function getStatusBadgeClasses(status: string) {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ordered":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "in_transit":
      return "border-purple-200 bg-purple-50 text-purple-700";
    case "delivered":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

type ProcurementPageProps = {
  searchParams?: Promise<{
    query?: string;
    status?: string;
  }>;
};

export default async function ProcurementPage({ searchParams }: ProcurementPageProps) {
  const params = await searchParams;
  const query = String(params?.query ?? "").trim().toLowerCase();
  const statusFilter = String(params?.status ?? "all").trim();

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

  const { data: procurementOrders, error: procurementOrdersError } = await supabase
    .from("procurement_orders")
    .select("id, supplier_id, medicine_name, quantity, unit_price, total_price, status, expected_delivery_date, notes, created_at, distributors(distributor_name), organizations(name)")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false });

  if (procurementOrdersError) {
    if (isMissingRelationError(procurementOrdersError, "procurement_orders")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Operations"
            title="Procurement"
            description="Track and manage your procurement orders."
          />
          <SetupNotice
            title="Procurement table not available yet"
            description="The `procurement_orders` table is missing in your connected Supabase project. Run the procurement SQL in Supabase, reload the schema, and refresh the app."
          />
        </div>
      );
    }

    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load procurement orders: ${procurementOrdersError.message}`
        : "Unable to load procurement orders.",
    );
  }

  const rows = ((procurementOrders ?? []) as any[]).map((order) => {
    const distributor = Array.isArray(order.distributors) ? order.distributors[0] : order.distributors;
    const org = Array.isArray(order.organizations) ? order.organizations[0] : order.organizations;

    return {
      id: order.id,
      supplierName: distributor?.distributor_name ?? "No supplier selected",
      medicineName: order.medicine_name,
      quantity: order.quantity,
      unitPrice: order.unit_price,
      totalPrice: order.total_price,
      status: order.status,
      expectedDeliveryDate: order.expected_delivery_date,
      notes: order.notes,
      createdAt: order.created_at,
      organizationName: org?.name ?? "Your Pharmacy",
    };
  }).filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) {
      return false;
    }

    if (query) {
      const searchTerms = [row.medicineName, row.supplierName, row.notes]
        .filter(Boolean)
        .map((s) => s!.toLowerCase());
      if (!searchTerms.some((term) => term.includes(query))) {
        return false;
      }
    }

    return true;
  });

  const needsFollowUpCount = rows.filter((row) => row.status === "pending" || row.status === "ordered" || row.status === "cancelled").length;
  const upcomingCount = rows.filter((row) => row.status === "in_transit").length;
  const deliveredCount = rows.filter((row) => row.status === "delivered").length;

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Operations"
        title="Procurement"
        description="Track and manage your procurement orders from suppliers."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Total Orders
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{rows.length}</p>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Needs Follow-up
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-amber-900">{needsFollowUpCount}</p>
        </div>
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Upcoming
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-blue-900">{upcomingCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Delivered
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{deliveredCount}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Procurement Orders</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              View the status of your orders, expected delivery dates, and update workflows.
            </p>
          </div>
          <ProcurementFilters />
        </div>

        {rows.length === 0 ? (
          <div className="p-5 sm:p-6">
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500 text-center">
              No procurement orders yet. Create them from the Reorders page based on recommendations.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Medicine</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Supplier</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Qty / Price</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Created</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs">Status</th>
                  <th className="px-6 py-4 font-medium uppercase tracking-wider text-xs text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{row.medicineName}</div>
                      <div className="text-xs text-slate-500 mt-1">ID: {row.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {row.supplierName}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="font-medium text-slate-900">{row.quantity} units</div>
                      {row.totalPrice !== null ? (
                        <div className="text-xs text-slate-500 mt-1">
                          {formatCurrency(row.totalPrice)} total ({formatCurrency(row.unitPrice)}/u)
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 mt-1">Price unavailable</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div>{formatDate(row.createdAt)}</div>
                      {row.expectedDeliveryDate && (
                        <div className="text-xs text-amber-600 mt-1">
                          Expected: {formatDate(row.expectedDeliveryDate)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusBadgeClasses(
                          row.status,
                        )}`}
                      >
                        {row.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <ProcurementOrderStatusForm
                          orderId={row.id}
                          initialStatus={row.status}
                        />
                        <CopySupplierMessageButton
                          supplierName={row.supplierName}
                          medicineName={row.medicineName}
                          quantity={row.quantity}
                          unitPrice={row.unitPrice}
                          expectedDeliveryDate={row.expectedDeliveryDate}
                          organizationName={row.organizationName}
                        />
                        <a
                          href={`/api/exports/procurement/${row.id}`}
                          className="app-button-secondary py-1.5 px-3 text-xs whitespace-nowrap"
                        >
                          Export PO
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
