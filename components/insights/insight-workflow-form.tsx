"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateInsightWorkflowStatus } from "@/app/(app)/insights/actions";
import {
  getInsightWorkflowStatusLabel,
  type InsightWorkflowStatus,
  type InsightWorkflowType,
} from "@/services/insights";

type InsightWorkflowFormProps = {
  insightKey: string;
  insightType: InsightWorkflowType;
  initialStatus: InsightWorkflowStatus;
  medicineId?: string | null;
  inventoryBatchId?: string | null;
};

export function InsightWorkflowForm({
  insightKey,
  insightType,
  initialStatus,
  medicineId,
  inventoryBatchId,
}: InsightWorkflowFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<InsightWorkflowStatus>(initialStatus);
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const formData = new FormData();
    formData.set("insightKey", insightKey);
    formData.set("insightType", insightType);
    formData.set("status", status);

    if (medicineId) {
      formData.set("medicineId", medicineId);
    }

    if (inventoryBatchId) {
      formData.set("inventoryBatchId", inventoryBatchId);
    }

    startTransition(async () => {
      const result = await updateInsightWorkflowStatus(formData);
      setFeedback(result);

      if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as InsightWorkflowStatus)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100 sm:w-auto"
        >
          {(["open", "reviewed", "needs_reorder", "monitor"] as InsightWorkflowStatus[]).map(
            (option) => (
              <option key={option} value={option}>
                {getInsightWorkflowStatusLabel(option)}
              </option>
            ),
          )}
        </select>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isPending ? "Saving..." : "Update"}
        </button>
      </div>

      {feedback.error ? <p className="text-xs text-red-600">{feedback.error}</p> : null}
      {feedback.success ? <p className="text-xs text-emerald-700">{feedback.success}</p> : null}
    </div>
  );
}
