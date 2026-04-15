"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createMedicineFromScan,
  type CreateMedicineFromScanResult,
} from "@/app/(app)/scan/actions";

export function CreateMedicineFromScanForm({ barcode }: { barcode: string }) {
  const router = useRouter();
  const [result, setResult] = useState<CreateMedicineFromScanResult>({
    error: null,
    success: null,
  });
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const response = await createMedicineFromScan(formData);
      setResult(response);

      if (!response.error) {
        router.push(`/scan?code=${encodeURIComponent(barcode)}`);
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
      <input type="hidden" name="barcode" value={barcode} />

      <div className="space-y-2 md:col-span-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="scan-medicine-name">
          Medicine name
        </label>
        <input
          id="scan-medicine-name"
          name="name"
          required
          placeholder="e.g. Paracetamol 650"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="scan-medicine-sku">
          SKU
        </label>
        <input
          id="scan-medicine-sku"
          name="sku"
          placeholder="Optional SKU"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="scan-medicine-unit">
          Unit
        </label>
        <input
          id="scan-medicine-unit"
          name="unit"
          placeholder="Optional unit"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="scan-medicine-category">
          Category
        </label>
        <input
          id="scan-medicine-category"
          name="category"
          placeholder="Optional category"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
        />
      </div>

      <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Creating medicine..." : "Create medicine"}
        </button>
        <p className="text-sm text-slate-500">Barcode: <span className="font-medium text-slate-900">{barcode}</span></p>
      </div>

      {result.error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:col-span-2">
          {result.error}
        </p>
      ) : null}

      {result.success ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 md:col-span-2">
          {result.success}
        </p>
      ) : null}
    </form>
  );
}
