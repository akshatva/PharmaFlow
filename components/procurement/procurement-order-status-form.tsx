"use client";

import { useState, useTransition } from "react";
import { updateProcurementOrderStatus } from "@/app/(app)/procurement/actions";

type ProcurementOrderStatusFormProps = {
  orderId: string;
  initialStatus: string;
};

export function ProcurementOrderStatusForm({
  orderId,
  initialStatus,
}: ProcurementOrderStatusFormProps) {
  const [status, setStatus] = useState(initialStatus);
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });
  const [isPending, startTransition] = useTransition();

  async function handleStatusChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = event.target.value;
    setStatus(newStatus);
    setFeedback({ error: null, success: null });

    startTransition(async () => {
      const formData = new FormData();
      formData.append("orderId", orderId);
      formData.append("status", newStatus);

      const result = await updateProcurementOrderStatus(formData);
      setFeedback(result);

      if (result.error) {
        setStatus(initialStatus);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          value={status}
          onChange={handleStatusChange}
          disabled={isPending}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100 disabled:opacity-60"
        >
          <option value="pending">Pending</option>
          <option value="ordered">Ordered</option>
          <option value="in_transit">In Transit</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {isPending && <span className="text-xs text-slate-500">Saving...</span>}
      </div>
      {feedback.error ? <p className="text-xs text-red-600">{feedback.error}</p> : null}
      {feedback.success ? <p className="text-xs text-emerald-700">{feedback.success}</p> : null}
    </div>
  );
}
