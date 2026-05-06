"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createProcurementOrder } from "@/app/(app)/procurement/actions";

type SupplierOption = {
  id: string;
  name: string;
};

type CreateProcurementFromReorderFormProps = {
  reorderItemId: string;
  medicineId: string;
  medicineName: string;
  suggestedQuantity: number;
  suppliers: SupplierOption[];
  suggestedSupplierId?: string | null;
  suggestedSupplierName?: string | null;
  suggestedUnitPrice?: number | null;
  recommendation?: string;
  supplierSuggestionNote?: string | null;
  disabled?: boolean;
};

export function CreateProcurementFromReorderForm({
  reorderItemId,
  medicineId,
  medicineName,
  suggestedQuantity,
  suppliers,
  suggestedSupplierId = null,
  suggestedSupplierName = null,
  suggestedUnitPrice = null,
  recommendation,
  supplierSuggestionNote = null,
  disabled = false,
}: CreateProcurementFromReorderFormProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createProcurementOrder(formData);
      setFeedback(result);

      if (!result.error) {
        router.refresh();
        router.push("/procurement");
      }
    });
  }

  if (disabled) {
    return <p className="text-xs text-teal-700">Procurement order already created for this reorder.</p>;
  }

  return (
    <div className="space-y-2">
      {suggestedSupplierName ? (
        <p className="text-xs text-slate-500">
          Suggested supplier: <span className="font-medium text-slate-700">{suggestedSupplierName}</span>
          {recommendation ? ` • ${recommendation}` : ""}
        </p>
      ) : supplierSuggestionNote ? (
        <p className="text-xs text-slate-500">{supplierSuggestionNote}</p>
      ) : null}

      <form action={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input type="hidden" name="reorderItemId" value={reorderItemId} />
        <input type="hidden" name="medicineId" value={medicineId} />
        <input type="hidden" name="medicineName" value={medicineName} />
        {suggestedUnitPrice !== null && (
          <input type="hidden" name="unitPrice" value={suggestedUnitPrice} />
        )}

        <select
          name="supplierId"
          defaultValue={suggestedSupplierId ?? ""}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100 sm:w-auto sm:min-w-[180px]"
        >
          <option value="">
            Select supplier (Optional)
          </option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>

        <input
          name="quantity"
          type="number"
          min="1"
          required
          defaultValue={Math.max(suggestedQuantity, 1)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100 sm:w-24"
        />

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isPending ? "Creating..." : "Create Order"}
        </button>
      </form>

      {feedback.error ? <p className="text-xs text-red-600">{feedback.error}</p> : null}
      {feedback.success ? <p className="text-xs text-emerald-700">{feedback.success}</p> : null}
    </div>
  );
}
