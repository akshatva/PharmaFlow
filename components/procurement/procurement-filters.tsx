"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function ProcurementFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSearching, startSearchTransition] = useTransition();

  function handleSearch(formData: FormData) {
    const nextQuery = String(formData.get("query") ?? "").trim();
    const nextStatus = String(formData.get("status") ?? "all").trim();
    const params = new URLSearchParams(searchParams.toString());

    if (nextQuery) {
      params.set("query", nextQuery);
    } else {
      params.delete("query");
    }

    if (nextStatus && nextStatus !== "all") {
      params.set("status", nextStatus);
    } else {
      params.delete("status");
    }

    startSearchTransition(() => {
      router.push(`/procurement${params.size ? `?${params.toString()}` : ""}`);
    });
  }

  return (
    <form action={handleSearch} className="flex flex-col gap-2 sm:flex-row">
      <input
        name="query"
        defaultValue={searchParams.get("query") ?? ""}
        placeholder="Search medicine or supplier..."
        className="app-input sm:w-64"
      />
      <select name="status" defaultValue={searchParams.get("status") ?? "all"} className="app-input sm:w-36">
        <option value="all">All statuses</option>
        <option value="pending">Pending</option>
        <option value="ordered">Ordered</option>
        <option value="in_transit">In Transit</option>
        <option value="delivered">Delivered</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <button type="submit" disabled={isSearching} className="app-button-secondary">
        {isSearching ? "Filtering..." : "Filter"}
      </button>
    </form>
  );
}
