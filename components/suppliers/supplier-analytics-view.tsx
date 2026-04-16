"use client";

import { useMemo, useState } from "react";

type SupplierAnalyticsItem = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  totalOrders: number;
  totalItems: number;
  totalQuantityOrdered: number;
  lastOrderDate: string | null;
  insightLabels: string[];
  recentPurchaseOrders: {
    id: string;
    createdAt: string;
    status: "draft" | "placed" | "received";
    itemCount: number;
    totalQuantity: number;
  }[];
  suppliedMedicines: string[];
};

type SupplierAnalyticsViewProps = {
  suppliers: SupplierAnalyticsItem[];
};

type SortOption = "total-orders" | "total-quantity" | "last-order-date" | "supplier-name";
type ActivityFilter = "all" | "active" | "inactive" | "ordered";

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getInsightBadgeClasses(label: string) {
  if (label === "Most used supplier") {
    return "border-teal-200 bg-teal-50 text-teal-700";
  }

  if (label === "Recently active supplier") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (label === "Inactive supplier") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  return "border-slate-200 bg-white text-slate-700";
}

function getStatusClasses(status: "draft" | "placed" | "received") {
  switch (status) {
    case "received":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "placed":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

export function SupplierAnalyticsView({
  suppliers,
}: SupplierAnalyticsViewProps) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("total-orders");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");

  const filteredSuppliers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const visibleSuppliers = suppliers.filter((supplier) => {
      const matchesQuery =
        !normalizedQuery ||
        supplier.name.toLowerCase().includes(normalizedQuery) ||
        supplier.suppliedMedicines.some((medicine) =>
          medicine.toLowerCase().includes(normalizedQuery),
        );

      const matchesFilter =
        activityFilter === "all" ||
        (activityFilter === "active" &&
          supplier.insightLabels.includes("Recently active supplier")) ||
        (activityFilter === "inactive" &&
          supplier.insightLabels.includes("Inactive supplier")) ||
        (activityFilter === "ordered" && supplier.totalOrders > 0);

      return matchesQuery && matchesFilter;
    });

    return visibleSuppliers.sort((first, second) => {
      switch (sortBy) {
        case "supplier-name":
          return first.name.localeCompare(second.name);
        case "total-quantity":
          return second.totalQuantityOrdered - first.totalQuantityOrdered;
        case "last-order-date": {
          const firstTimestamp = first.lastOrderDate
            ? new Date(first.lastOrderDate).getTime()
            : 0;
          const secondTimestamp = second.lastOrderDate
            ? new Date(second.lastOrderDate).getTime()
            : 0;
          return secondTimestamp - firstTimestamp;
        }
        case "total-orders":
        default:
          return second.totalOrders - first.totalOrders;
      }
    });
  }, [activityFilter, query, sortBy, suppliers]);

  const summary = useMemo(() => {
    return suppliers.reduce(
      (accumulator, supplier) => {
        if (supplier.insightLabels.includes("Most used supplier")) {
          accumulator.mostUsed += 1;
        }

        if (supplier.insightLabels.includes("Recently active supplier")) {
          accumulator.recentlyActive += 1;
        }

        if (supplier.insightLabels.includes("Inactive supplier")) {
          accumulator.inactive += 1;
        }

        return accumulator;
      },
      { mostUsed: 0, recentlyActive: 0, inactive: 0 },
    );
  }, [suppliers]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Suppliers
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {suppliers.length}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Most Used
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {summary.mostUsed}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Recently Active
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {summary.recentlyActive}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Inactive
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {summary.inactive}
          </p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Supplier performance</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review supplier usage, recent purchase activity, and medicines supplied by each partner.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:min-w-[720px]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="supplier-analytics-search">
                Search
              </label>
              <input
                id="supplier-analytics-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search supplier or medicine"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="supplier-analytics-filter">
                Filter
              </label>
              <select
                id="supplier-analytics-filter"
                value={activityFilter}
                onChange={(event) => setActivityFilter(event.target.value as ActivityFilter)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
              >
                <option value="all">All suppliers</option>
                <option value="ordered">Has orders</option>
                <option value="active">Recently active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="supplier-analytics-sort">
                Sort by
              </label>
              <select
                id="supplier-analytics-sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
              >
                <option value="total-orders">Total orders</option>
                <option value="total-quantity">Total quantity</option>
                <option value="last-order-date">Last order date</option>
                <option value="supplier-name">Supplier name</option>
              </select>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Showing <span className="font-medium text-slate-900">{filteredSuppliers.length}</span> of{" "}
          <span className="font-medium text-slate-900">{suppliers.length}</span> suppliers.
        </p>

        {suppliers.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No suppliers exist yet. Add suppliers first to unlock analytics.
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No suppliers match your current search or filters.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredSuppliers.map((supplier) => (
              <article
                key={supplier.id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-950">{supplier.name}</h4>
                      <p className="mt-1 text-sm text-slate-600">
                        {supplier.contactPerson || "No contact person"}
                        {supplier.phone ? ` • ${supplier.phone}` : ""}
                        {supplier.email ? ` • ${supplier.email}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {supplier.insightLabels.length ? (
                        supplier.insightLabels.map((label) => (
                          <span
                            key={label}
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getInsightBadgeClasses(
                              label,
                            )}`}
                          >
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                          No insight label yet
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Orders</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {supplier.totalOrders}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">PO items</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {supplier.totalItems}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                        Quantity ordered
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {supplier.totalQuantityOrdered}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                        Last order
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">
                        {formatDate(supplier.lastOrderDate)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h5 className="text-sm font-semibold text-slate-950">Recent purchase orders</h5>
                      <span className="text-xs text-slate-500">
                        {supplier.recentPurchaseOrders.length} shown
                      </span>
                    </div>

                    {supplier.recentPurchaseOrders.length ? (
                      <div className="mt-4 space-y-3">
                        {supplier.recentPurchaseOrders.map((order) => (
                          <div
                            key={order.id}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  PO #{order.id.slice(0, 8)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {formatDate(order.createdAt)}
                                </p>
                              </div>
                              <span
                                className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(
                                  order.status,
                                )}`}
                              >
                                {order.status}
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                              <span>{order.itemCount} item{order.itemCount === 1 ? "" : "s"}</span>
                              <span>Total qty {order.totalQuantity}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        No purchase orders for this supplier yet.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h5 className="text-sm font-semibold text-slate-950">Medicines supplied</h5>
                      <span className="text-xs text-slate-500">
                        {supplier.suppliedMedicines.length} medicine
                        {supplier.suppliedMedicines.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {supplier.suppliedMedicines.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {supplier.suppliedMedicines.map((medicine) => (
                          <span
                            key={medicine}
                            className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                          >
                            {medicine}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        No supplied medicines recorded yet.
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
