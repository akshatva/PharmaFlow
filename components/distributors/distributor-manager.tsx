"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createDistributor } from "@/app/(app)/distributors/actions";

export type DistributorListItem = {
  id: string;
  distributorName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
  catalogCount: number;
  createdAt: string;
};

type DistributorManagerProps = {
  distributors: DistributorListItem[];
  query: string;
  status: "all" | "active" | "inactive";
  basePath?: string;
};

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

function formatLocation(city: string | null, state: string | null) {
  const parts = [city, state].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export function DistributorManager({
  distributors,
  query,
  status,
  basePath = "/suppliers",
}: DistributorManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSearching, startSearchTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });

  async function handleCreateDistributor(formData: FormData) {
    startTransition(async () => {
      const result = await createDistributor(formData);
      setFeedback(result);

      if (!result.error) {
        const form = document.getElementById("create-distributor-form") as HTMLFormElement | null;
        form?.reset();
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
      router.push(params.size ? `${basePath}?${params.toString()}` : basePath);
    });
  }

  return (
    <div className="space-y-6">
      <section className="app-card p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <p className="app-kicker">Add Supplier</p>
          <h3 className="app-section-title">Supplier profile</h3>
          <p className="app-section-copy">Create a clean supplier record for catalog tracking.</p>
        </div>

        {feedback.error ? (
          <p className="mt-5 app-panel-danger">{feedback.error}</p>
        ) : null}

        {feedback.success ? (
          <p className="mt-5 app-panel-success">{feedback.success}</p>
        ) : null}

        <form
          id="create-distributor-form"
          action={handleCreateDistributor}
          className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Supplier name</span>
            <input name="distributorName" required className="app-input" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Contact name</span>
            <input name="contactName" className="app-input" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Phone</span>
            <input name="phone" className="app-input" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Email</span>
            <input name="email" type="email" className="app-input" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">City</span>
            <input name="city" className="app-input" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">State</span>
            <input name="state" className="app-input" />
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
              {isPending ? "Saving..." : "Add supplier"}
            </button>
          </div>
        </form>
      </section>

      <section className="app-card">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="app-kicker">Directory</p>
            <h3 className="mt-1 app-section-title">Suppliers</h3>
          </div>

          <form action={handleSearch} className="flex flex-col gap-2 sm:flex-row">
            <input
              name="query"
              defaultValue={query}
              placeholder="Search suppliers"
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

        {distributors.length === 0 ? (
          <div className="p-5 sm:p-6">
            <div className="app-empty-state">
              <p className="app-empty-title">No suppliers found.</p>
              <p className="app-empty-copy">Add a supplier to start building catalog coverage.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact</th>
                  <th>Location</th>
                  <th>Catalog</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {distributors.map((distributor) => (
                  <tr key={distributor.id}>
                    <td>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{distributor.distributorName}</p>
                        <p className="text-xs text-slate-500">{distributor.email ?? "No email"}</p>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <p>{distributor.contactName ?? "—"}</p>
                        <p className="text-xs text-slate-500">{distributor.phone ?? "No phone"}</p>
                      </div>
                    </td>
                    <td>{formatLocation(distributor.city, distributor.state)}</td>
                    <td>{distributor.catalogCount}</td>
                    <td>
                      <StatusBadge active={distributor.active} />
                    </td>
                    <td>
                      <Link href={`${basePath}/${distributor.id}`} className="app-button-secondary py-2 text-xs">
                        Open
                      </Link>
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
