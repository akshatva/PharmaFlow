"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createReorderItem } from "@/app/(app)/reorders/actions";

type ReorderButtonProps = {
  medicineId: string;
  reason: string;
  existingPending?: boolean;
};

export function ReorderButton({
  medicineId,
  reason,
  existingPending = false,
}: ReorderButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });

  function handleCreateReorder() {
    const formData = new FormData();
    formData.set("medicineId", medicineId);
    formData.set("reason", reason);

    startTransition(async () => {
      const result = await createReorderItem(formData);
      setFeedback(result);

      if (!result.error) {
        router.refresh();
      }
    });
  }

  if (existingPending) {
    return (
      <div className="space-y-2">
        <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
          In reorder list
        </span>
        {feedback.error ? <p className="text-xs text-red-600">{feedback.error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleCreateReorder}
        disabled={isPending}
        className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {isPending ? "Saving..." : "Reorder"}
      </button>
      {feedback.error ? <p className="text-xs text-red-600">{feedback.error}</p> : null}
      {feedback.success ? <p className="text-xs text-emerald-700">{feedback.success}</p> : null}
    </div>
  );
}
