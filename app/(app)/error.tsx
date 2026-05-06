"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  const cleanMessage =
    error.message && error.message.toLowerCase().includes("unable to load")
      ? error.message
      : "Something went wrong loading this page.";

  return (
    <div className="flex h-[50vh] w-full flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertCircle className="h-6 w-6 text-red-600" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">Page Error</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">{cleanMessage}</p>
      <button
        onClick={() => reset()}
        className="mt-6 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Try again
      </button>
    </div>
  );
}
