"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createCatalogItem,
  updateCatalogItem,
  updateDistributor,
} from "@/app/(app)/distributors/actions";

export type DistributorDetail = {
  id: string;
  distributorName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
  createdAt: string;
};

export type DistributorCatalogItem = {
  id: string;
  medicineName: string;
  sku: string | null;
  category: string | null;
  unitPrice: number;
  availableQuantity: number | null;
  leadTimeDays: number | null;
  active: boolean;
  createdAt: string;
};

type DistributorCatalogManagerProps = {
  distributor: DistributorDetail;
  catalogItems: DistributorCatalogItem[];
  query: string;
  status: "all" | "active" | "inactive";
  basePath?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatLocation(distributor: DistributorDetail) {
  const parts = [distributor.city, distributor.state].filter(Boolean);
  return parts.length ? parts.join(", ") : "No location";
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "app-badge border-emerald-200 bg-emerald-50 text-emerald-700"
          : "app-badge border-slate-200 bg-slate-50 text-slate-600"
      }
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function DistributorCatalogManager({
  distributor,
  catalogItems,
  query,
  status,
  basePath = "/suppliers",
}: DistributorCatalogManagerProps) {
  const router = useRouter();
  const [editingDistributor, setEditingDistributor] = useState(false);
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSearching, startSearchTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });

  async function handleUpdateDistributor(formData: FormData) {
    startTransition(async () => {
      const result = await updateDistributor(formData);
      setFeedback(result);

      if (!result.error) {
        setEditingDistributor(false);
        router.refresh();
      }
    });
  }

  async function handleCreateCatalogItem(formData: FormData) {
    startTransition(async () => {
      const result = await createCatalogItem(formData);
      setFeedback(result);

      if (!result.error) {
        const form = document.getElementById("create-catalog-item-form") as HTMLFormElement | null;
        form?.reset();
        router.refresh();
      }
    });
  }

  async function handleUpdateCatalogItem(formData: FormData) {
    startTransition(async () => {
      const result = await updateCatalogItem(formData);
      setFeedback(result);

      if (!result.error) {
        setEditingCatalogId(null);
        router.refresh();
      }
    });
  }

  function handleSearch(formData: FormData) {
    const nextQuery = String(formData.get("query") ?? "").trim();
    const nextStatus = String(formData.get("status") ?? "all").trim();
    const params = new URLSearchParams();

    if (nextQuery) {
      params.set("query", nextQuery);
    }

    if (nextStatus && nextStatus !== "all") {
      params.set("status", nextStatus);
    }

    startSearchTransition(() => {
      router.push(
        params.size
          ? `${basePath}/${distributor.id}?${params.toString()}`
          : `${basePath}/${distributor.id}`,
      );
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={basePath} className="app-button-secondary">
          Back to suppliers
        </Link>
      </div>

      {feedback.error ? (
        <p className="app-panel-danger">{feedback.error}</p>
      ) : null}

      {feedback.success ? (
        <p className="app-panel-success">{feedback.success}</p>
      ) : null}

      <section className="app-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="app-kicker">Supplier Detail</p>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                {distributor.distributorName}
              </h3>
              <StatusBadge active={distributor.active} />
            </div>
            <p className="text-sm text-slate-500">{formatLocation(distributor)}</p>
          </div>

          <button
            type="button"
            onClick={() => setEditingDistributor((current) => !current)}
            className="app-button-secondary"
          >
            {editingDistributor ? "Close edit" : "Edit profile"}
          </button>
        </div>

        {editingDistributor ? (
          <form action={handleUpdateDistributor} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <input type="hidden" name="distributorId" value={distributor.id} />
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Supplier name</span>
              <input
                name="distributorName"
                defaultValue={distributor.distributorName}
                required
                className="app-input"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Contact name</span>
              <input name="contactName" defaultValue={distributor.contactName ?? ""} className="app-input" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Phone</span>
              <input name="phone" defaultValue={distributor.phone ?? ""} className="app-input" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Email</span>
              <input name="email" type="email" defaultValue={distributor.email ?? ""} className="app-input" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">City</span>
              <input name="city" defaultValue={distributor.city ?? ""} className="app-input" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">State</span>
              <input name="state" defaultValue={distributor.state ?? ""} className="app-input" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Status</span>
              <select name="active" defaultValue={String(distributor.active)} className="app-input">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={isPending} className="app-button-primary">
                {isPending ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="app-card-muted p-4">
              <p className="app-stat-eyebrow">Contact</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{distributor.contactName ?? "—"}</p>
            </div>
            <div className="app-card-muted p-4">
              <p className="app-stat-eyebrow">Phone</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{distributor.phone ?? "—"}</p>
            </div>
            <div className="app-card-muted p-4">
              <p className="app-stat-eyebrow">Email</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{distributor.email ?? "—"}</p>
            </div>
            <div className="app-card-muted p-4">
              <p className="app-stat-eyebrow">Catalog Items</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{catalogItems.length}</p>
            </div>
          </div>
        )}
      </section>

      <section className="app-card p-5 sm:p-6">
        <div className="space-y-2">
          <p className="app-kicker">Add Item</p>
          <h3 className="app-section-title">Catalog item</h3>
          <p className="app-section-copy">Track supplier pricing and availability.</p>
        </div>

        <form
          id="create-catalog-item-form"
          action={handleCreateCatalogItem}
          className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <input type="hidden" name="distributorId" value={distributor.id} />
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Medicine name</span>
            <input name="medicineName" required className="app-input" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">SKU</span>
            <input name="sku" className="app-input" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Category</span>
            <input name="category" className="app-input" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Unit price</span>
            <input name="unitPrice" type="number" min="0.01" step="0.01" required className="app-input" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Available quantity</span>
            <input name="availableQuantity" type="number" min="0" step="1" className="app-input" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Lead time days</span>
            <input name="leadTimeDays" type="number" min="0" step="1" className="app-input" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Status</span>
            <select name="active" defaultValue="true" className="app-input">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={isPending} className="app-button-primary">
              {isPending ? "Saving..." : "Add item"}
            </button>
          </div>
        </form>
      </section>

      <section className="app-card">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="app-kicker">Catalog</p>
            <h3 className="mt-1 app-section-title">Supplier catalog</h3>
          </div>

          <form action={handleSearch} className="flex flex-col gap-2 sm:flex-row">
            <input
              name="query"
              defaultValue={query}
              placeholder="Search catalog"
              className="app-input sm:w-64"
            />
            <select name="status" defaultValue={status} className="app-input sm:w-36">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button type="submit" disabled={isSearching} className="app-button-secondary">
              {isSearching ? "Searching..." : "Search"}
            </button>
          </form>
        </div>

        {catalogItems.length === 0 ? (
          <div className="p-5 sm:p-6">
            <div className="app-empty-state">
              <p className="app-empty-title">No catalog items found.</p>
              <p className="app-empty-copy">Add medicines this supplier can supply.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Unit Price</th>
                  <th>Available</th>
                  <th>Lead Time</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {catalogItems.map((item) => (
                  <tr key={item.id}>
                    {editingCatalogId === item.id ? (
                      <>
                        <td>
                          <input
                            form={`edit-catalog-${item.id}`}
                            name="medicineName"
                            defaultValue={item.medicineName}
                            required
                            className="app-input min-w-44"
                          />
                        </td>
                        <td>
                          <input
                            form={`edit-catalog-${item.id}`}
                            name="sku"
                            defaultValue={item.sku ?? ""}
                            className="app-input min-w-32"
                          />
                        </td>
                        <td>
                          <input
                            form={`edit-catalog-${item.id}`}
                            name="category"
                            defaultValue={item.category ?? ""}
                            className="app-input min-w-36"
                          />
                        </td>
                        <td>
                          <input
                            form={`edit-catalog-${item.id}`}
                            name="unitPrice"
                            type="number"
                            min="0.01"
                            step="0.01"
                            defaultValue={item.unitPrice}
                            required
                            className="app-input min-w-28"
                          />
                        </td>
                        <td>
                          <input
                            form={`edit-catalog-${item.id}`}
                            name="availableQuantity"
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={item.availableQuantity ?? ""}
                            className="app-input min-w-28"
                          />
                        </td>
                        <td>
                          <input
                            form={`edit-catalog-${item.id}`}
                            name="leadTimeDays"
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={item.leadTimeDays ?? ""}
                            className="app-input min-w-28"
                          />
                        </td>
                        <td>
                          <select
                            form={`edit-catalog-${item.id}`}
                            name="active"
                            defaultValue={String(item.active)}
                            className="app-input min-w-28"
                          >
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                          </select>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="font-medium text-slate-900">{item.medicineName}</td>
                        <td>{item.sku ?? "—"}</td>
                        <td>{item.category ?? "—"}</td>
                        <td>{formatCurrency(item.unitPrice)}</td>
                        <td>{item.availableQuantity ?? "—"}</td>
                        <td>{item.leadTimeDays === null ? "—" : `${item.leadTimeDays}d`}</td>
                        <td>
                          <StatusBadge active={item.active} />
                        </td>
                      </>
                    )}
                    <td>
                      {editingCatalogId === item.id ? (
                        <div className="flex flex-wrap gap-2">
                          <form id={`edit-catalog-${item.id}`} action={handleUpdateCatalogItem}>
                            <input type="hidden" name="distributorId" value={distributor.id} />
                            <input type="hidden" name="catalogItemId" value={item.id} />
                            <button type="submit" disabled={isPending} className="app-button-primary py-2 text-xs">
                              Save
                            </button>
                          </form>
                          <button
                            type="button"
                            onClick={() => setEditingCatalogId(null)}
                            className="app-button-secondary py-2 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingCatalogId(item.id)}
                          className="app-button-secondary py-2 text-xs"
                        >
                          Edit
                        </button>
                      )}
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
