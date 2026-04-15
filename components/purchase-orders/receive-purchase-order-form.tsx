"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { receivePurchaseOrder } from "@/app/(app)/purchase-orders/actions";

type PurchaseOrderItemInput = {
  id: string;
  medicineName: string;
  quantity: number;
};

type ReceivePurchaseOrderFormProps = {
  purchaseOrderId: string;
  items: PurchaseOrderItemInput[];
  disabled?: boolean;
};

export function ReceivePurchaseOrderForm({
  purchaseOrderId,
  items,
  disabled = false,
}: ReceivePurchaseOrderFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await receivePurchaseOrder(formData);
      setFeedback(result);

      if (!result.error) {
        setIsOpen(false);
        router.refresh();
      }
    });
  }

  if (!items.length) {
    return <p className="text-xs text-slate-500">Add items to this purchase order before receiving stock.</p>;
  }

  if (disabled) {
    return <p className="text-xs font-medium text-emerald-700">Inventory already received for this purchase order.</p>;
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          setFeedback({ error: null, success: null });
          setIsOpen((current) => !current);
        }}
        className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
      >
        {isOpen ? "Close receiving form" : "Mark as Received"}
      </button>

      {isOpen ? (
        <form action={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
          <input type="hidden" name="itemIdsJson" value={JSON.stringify(items.map((item) => item.id))} />

          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{item.medicineName}</p>
                    <p className="text-xs text-slate-500">Quantity to receive: {item.quantity}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="block font-medium">Batch number</span>
                    <input
                      name={`batchNumber:${item.id}`}
                      type="text"
                      required
                      placeholder="e.g. BATCH-001"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                    />
                  </label>

                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="block font-medium">Expiry date</span>
                    <input
                      name={`expiryDate:${item.id}`}
                      type="date"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isPending ? "Receiving..." : "Confirm receipt"}
            </button>

            <p className="text-xs text-slate-500">
              This will create inventory batch rows and move the purchase order to received.
            </p>
          </div>

          {feedback.error ? <p className="text-sm text-red-600">{feedback.error}</p> : null}
          {feedback.success ? <p className="text-sm text-emerald-700">{feedback.success}</p> : null}
        </form>
      ) : null}

      {!isOpen && feedback.error ? <p className="text-xs text-red-600">{feedback.error}</p> : null}
      {!isOpen && feedback.success ? <p className="text-xs text-emerald-700">{feedback.success}</p> : null}
    </div>
  );
}
