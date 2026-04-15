"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateReorderStatus } from "@/app/(app)/reorders/actions";

type ReorderStatusFormProps = {
  reorderItemId: string;
  initialStatus: "pending" | "ordered";
};

export function ReorderStatusForm({
  reorderItemId,
  initialStatus,
}: ReorderStatusFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "ordered">(initialStatus);
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const formData = new FormData();
    formData.set("reorderItemId", reorderItemId);
    formData.set("status", status);

    startTransition(async () => {
      const result = await updateReorderStatus(formData);
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
          onChange={(event) => setStatus(event.target.value as "pending" | "ordered")}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100 sm:w-auto"
        >
          <option value="pending">pending</option>
          <option value="ordered">ordered</option>
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
