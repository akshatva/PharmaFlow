"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createSupplier,
  deleteSupplier,
  updateSupplier,
} from "@/app/(app)/suppliers/actions";

type Supplier = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
};

type SupplierManagerProps = {
  suppliers: Supplier[];
};

export function SupplierManager({ suppliers }: SupplierManagerProps) {
  const router = useRouter();
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });
  const [isPending, startTransition] = useTransition();

  async function handleCreateSupplier(formData: FormData) {
    startTransition(async () => {
      const result = await createSupplier(formData);
      setFeedback(result);

      if (!result.error) {
        const form = document.getElementById("create-supplier-form") as HTMLFormElement | null;
        form?.reset();
        router.refresh();
      }
    });
  }

  async function handleUpdateSupplier(formData: FormData) {
    startTransition(async () => {
      const result = await updateSupplier(formData);
      setFeedback(result);

      if (!result.error) {
        setActiveEditId(null);
        router.refresh();
      }
    });
  }

  async function handleDeleteSupplier(supplierId: string) {
    const confirmed = window.confirm("Delete this supplier?");

    if (!confirmed) {
      return;
    }

    const formData = new FormData();
    formData.set("supplierId", supplierId);

    startTransition(async () => {
      const result = await deleteSupplier(formData);
      setFeedback(result);

      if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Add supplier</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Keep a simple supplier directory for purchase order creation.
          </p>
        </div>

        {feedback.error ? (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {feedback.error}
          </p>
        ) : null}

        {feedback.success ? (
          <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {feedback.success}
          </p>
        ) : null}

        <form
          id="create-supplier-form"
          action={handleCreateSupplier}
          className="mt-6 grid gap-4 md:grid-cols-2"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="supplier-name">
              Supplier name
            </label>
            <input
              id="supplier-name"
              name="name"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="supplier-contact">
              Contact person
            </label>
            <input
              id="supplier-contact"
              name="contactPerson"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="supplier-phone">
              Phone
            </label>
            <input
              id="supplier-phone"
              name="phone"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="supplier-email">
              Email
            </label>
            <input
              id="supplier-email"
              name="email"
              type="email"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="supplier-notes">
              Notes
            </label>
            <textarea
              id="supplier-notes"
              name="notes"
              rows={3}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Add supplier"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Supplier list</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Keep supplier details current so the purchasing flow stays simple.
          </p>
        </div>

        {suppliers.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No suppliers added yet.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Supplier</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Contact</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Phone</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Email</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Notes</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    {activeEditId === supplier.id ? (
                      <>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <input
                            form={`edit-supplier-${supplier.id}`}
                            name="name"
                            defaultValue={supplier.name}
                            required
                            className="w-full min-w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <input
                            form={`edit-supplier-${supplier.id}`}
                            name="contactPerson"
                            defaultValue={supplier.contactPerson ?? ""}
                            className="w-full min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <input
                            form={`edit-supplier-${supplier.id}`}
                            name="phone"
                            defaultValue={supplier.phone ?? ""}
                            className="w-full min-w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <input
                            form={`edit-supplier-${supplier.id}`}
                            name="email"
                            type="email"
                            defaultValue={supplier.email ?? ""}
                            className="w-full min-w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                          />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <input
                            form={`edit-supplier-${supplier.id}`}
                            name="notes"
                            defaultValue={supplier.notes ?? ""}
                            className="w-full min-w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                          {supplier.name}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {supplier.contactPerson || "—"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {supplier.phone || "—"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {supplier.email || "—"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {supplier.notes || "—"}
                        </td>
                      </>
                    )}

                    <td className="border-b border-slate-100 px-3 py-3">
                      {activeEditId === supplier.id ? (
                        <div className="flex flex-wrap gap-2">
                          <form id={`edit-supplier-${supplier.id}`} action={handleUpdateSupplier}>
                            <input type="hidden" name="supplierId" value={supplier.id} />
                            <button
                              type="submit"
                              disabled={isPending}
                              className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Save
                            </button>
                          </form>
                          <button
                            type="button"
                            onClick={() => setActiveEditId(null)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveEditId(supplier.id)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSupplier(supplier.id)}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
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
