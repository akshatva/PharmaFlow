"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createInventoryBatch,
  deleteInventoryBatch,
  updateInventoryBatch,
} from "@/app/(app)/inventory/actions";

export type InventoryTableRow = {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  purchasePrice: number | null;
  sellingPrice: number | null;
  sku: string | null;
  category: string | null;
  unit: string | null;
  createdAt: string;
};

type InventoryTableProps = {
  rows: InventoryTableRow[];
  medicineOptions: {
    id: string;
    name: string;
  }[];
  initialQuery?: string;
  initialMedicineId?: string;
};

type StatusFilter = "all" | "low-stock" | "near-expiry" | "expired";
type SortOption = "newest" | "oldest" | "expiry-date" | "quantity" | "medicine-name";
type InventoryStatus = "Expired" | "Expiring Soon" | "Low Stock" | "Healthy";

type EnrichedInventoryRow = InventoryTableRow & {
  status: InventoryStatus;
  expiryTimestamp: number;
  createdTimestamp: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function toDateInputValue(value: string) {
  return value.slice(0, 10);
}

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getInventoryStatus(row: InventoryTableRow) {
  const today = getTodayStart();
  const expiry = new Date(row.expiryDate);
  const expiryStart = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const diffInDays = Math.ceil(
    (expiryStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffInDays < 0) {
    return "Expired";
  }

  if (diffInDays <= 90) {
    return "Expiring Soon";
  }

  if (row.quantity < 20) {
    return "Low Stock";
  }

  return "Healthy";
}

function getStatusClasses(status: InventoryStatus) {
  switch (status) {
    case "Expired":
      return "border-red-200 bg-red-50 text-red-700";
    case "Expiring Soon":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Low Stock":
      return "border-orange-200 bg-orange-50 text-orange-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function SortButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function Toast({
  tone,
  message,
  onClose,
}: {
  tone: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div className="fixed right-4 top-4 z-50 max-w-sm">
      <div className={`rounded-2xl border px-4 py-3 shadow-lg ${toneClasses}`}>
        <div className="flex items-start gap-3">
          <p className="flex-1 text-sm font-medium leading-6">{message}</p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70 transition hover:opacity-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ClearInventoryModal({
  batchCount,
  confirmationText,
  onConfirmationTextChange,
  isPending,
  onCancel,
  onConfirm,
}: {
  batchCount: number;
  confirmationText: string;
  onConfirmationTextChange: (value: string) => void;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const canConfirm = confirmationText.trim() === "DELETE" && !isPending;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h3 className="text-xl font-semibold text-slate-950">Clear Inventory</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Are you sure? This will delete all inventory batches.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This action only clears inventory batch rows for your organization. Medicines, suppliers,
          and purchase orders will stay untouched.
        </p>
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {batchCount} batch{batchCount === 1 ? "" : "es"} will be deleted. Type <span className="font-semibold">DELETE</span> to confirm.
        </p>

        <div className="mt-5 space-y-2">
          <label className="text-sm font-medium text-slate-800" htmlFor="clear-inventory-confirmation">
            Confirmation
          </label>
          <input
            id="clear-inventory-confirmation"
            type="text"
            value={confirmationText}
            onChange={(event) => onConfirmationTextChange(event.target.value)}
            placeholder="Type DELETE"
            disabled={isPending}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            No, keep inventory
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Clearing..." : "Yes, clear inventory"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InventoryEditFields({
  row,
  formId,
}: {
  row: InventoryTableRow;
  formId: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-2 text-sm text-slate-700">
        <span className="block font-medium">Quantity</span>
        <input
          form={formId}
          name="quantity"
          type="number"
          min="0"
          required
          defaultValue={row.quantity}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
        />
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span className="block font-medium">Expiry date</span>
        <input
          form={formId}
          name="expiryDate"
          type="date"
          required
          defaultValue={toDateInputValue(row.expiryDate)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
        />
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span className="block font-medium">Purchase price</span>
        <input
          form={formId}
          name="purchasePrice"
          type="number"
          min="0"
          step="0.01"
          defaultValue={row.purchasePrice ?? ""}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
        />
      </label>

      <label className="space-y-2 text-sm text-slate-700">
        <span className="block font-medium">Selling price</span>
        <input
          form={formId}
          name="sellingPrice"
          type="number"
          min="0"
          step="0.01"
          defaultValue={row.sellingPrice ?? ""}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
        />
      </label>
    </div>
  );
}

export function InventoryTable({
  rows,
  medicineOptions,
  initialQuery = "",
  initialMedicineId = "",
}: InventoryTableProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [selectedMedicineId, setSelectedMedicineId] = useState(initialMedicineId);
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [showClearInventoryModal, setShowClearInventoryModal] = useState(false);
  const [clearInventoryConfirmationText, setClearInventoryConfirmationText] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setSelectedMedicineId(initialMedicineId);
  }, [initialMedicineId]);

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((row) => row.category)
          .filter((category): category is string => Boolean(category)),
      ),
    ).sort((first, second) => first.localeCompare(second));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const enrichedRows: EnrichedInventoryRow[] = rows.map((row) => ({
      ...row,
      status: getInventoryStatus(row),
      expiryTimestamp: new Date(row.expiryDate).getTime(),
      createdTimestamp: new Date(row.createdAt).getTime(),
    }));

    const visibleRows = enrichedRows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        row.medicineName.toLowerCase().includes(normalizedQuery) ||
        row.batchNumber.toLowerCase().includes(normalizedQuery) ||
        row.sku?.toLowerCase().includes(normalizedQuery);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "low-stock" && row.status === "Low Stock") ||
        (statusFilter === "near-expiry" && row.status === "Expiring Soon") ||
        (statusFilter === "expired" && row.status === "Expired");

      const matchesCategory =
        categoryFilter === "all" ||
        (row.category ?? "").toLowerCase() === categoryFilter.toLowerCase();

      return matchesQuery && matchesStatus && matchesCategory;
    });

    return visibleRows.sort((first, second) => {
      switch (sortBy) {
        case "oldest":
          return first.createdTimestamp - second.createdTimestamp;
        case "expiry-date":
          return first.expiryTimestamp - second.expiryTimestamp;
        case "quantity":
          return second.quantity - first.quantity;
        case "medicine-name":
          return first.medicineName.localeCompare(second.medicineName);
        case "newest":
        default:
          return second.createdTimestamp - first.createdTimestamp;
      }
    });
  }, [categoryFilter, query, rows, sortBy, statusFilter]);

  const filterCounts = useMemo(() => {
    return rows.reduce(
      (counts, row) => {
        const status = getInventoryStatus(row);

        if (status === "Low Stock") {
          counts.lowStock += 1;
        }

        if (status === "Expiring Soon") {
          counts.nearExpiry += 1;
        }

        if (status === "Expired") {
          counts.expired += 1;
        }

        return counts;
      },
      { lowStock: 0, nearExpiry: 0, expired: 0 },
    );
  }, [rows]);

  async function handleCreateBatch(formData: FormData) {
    startTransition(async () => {
      const result = await createInventoryBatch(formData);
      setFeedback(result);

      if (!result.error) {
        const form = document.getElementById("create-inventory-batch-form") as HTMLFormElement | null;
        form?.reset();
        router.refresh();
      }
    });
  }

  async function handleUpdateBatch(formData: FormData) {
    startTransition(async () => {
      const result = await updateInventoryBatch(formData);
      setFeedback(result);

      if (!result.error) {
        setActiveEditId(null);
        router.refresh();
      }
    });
  }

  async function handleDeleteBatch(batchId: string) {
    const confirmed = window.confirm("Delete this inventory batch permanently?");

    if (!confirmed) {
      return;
    }

    const formData = new FormData();
    formData.set("batchId", batchId);

    startTransition(async () => {
      const result = await deleteInventoryBatch(formData);
      setFeedback(result);

      if (!result.error) {
        router.refresh();
      }
    });
  }

  function closeClearInventoryModal() {
    if (isPending) {
      return;
    }

    setShowClearInventoryModal(false);
    setClearInventoryConfirmationText("");
  }

  function handleOpenClearInventoryModal() {
    setFeedback({ error: null, success: null });
    setToast(null);
    setShowClearInventoryModal(true);
    setClearInventoryConfirmationText("");
  }

  async function handleClearInventory() {
    startTransition(async () => {
      setFeedback({ error: null, success: null });
      setToast(null);

      try {
        const response = await fetch("/api/inventory/clear", {
          method: "POST",
        });
        const payload = (await response.json()) as {
          error?: string;
          success?: boolean;
          message?: string;
          deleted_count?: number;
        };

        if (!response.ok) {
          const errorMessage = payload.error ?? "Unable to clear inventory.";
          console.error("[inventory-clear] request failed", payload);
          setFeedback({ error: errorMessage, success: null });
          setToast({ tone: "error", message: errorMessage });
          return;
        }

        const successMessage =
          payload.deleted_count && payload.deleted_count > 0
            ? `Inventory cleared successfully. ${payload.deleted_count} batch${payload.deleted_count === 1 ? "" : "es"} deleted.`
            : payload.message ?? "Inventory cleared successfully.";

        console.info("[inventory-clear] request succeeded", payload);
        setFeedback({ error: null, success: successMessage });
        setToast({
          tone: "success",
          message:
            payload.deleted_count && payload.deleted_count > 0
              ? "Inventory cleared successfully"
              : "No inventory batches were deleted",
        });
        setShowClearInventoryModal(false);
        setClearInventoryConfirmationText("");
        router.refresh();
      } catch {
        console.error("[inventory-clear] request threw unexpectedly");
        setFeedback({
          error: "Unable to clear inventory.",
          success: null,
        });
        setToast({
          tone: "error",
          message: "Unable to clear inventory.",
        });
      }
    });
  }

  function resetInventoryView() {
    setQuery("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setSortBy("newest");
  }

  return (
    <section className="space-y-6">
      {toast ? (
        <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} />
      ) : null}

      {showClearInventoryModal ? (
        <ClearInventoryModal
          batchCount={rows.length}
          confirmationText={clearInventoryConfirmationText}
          onConfirmationTextChange={setClearInventoryConfirmationText}
          isPending={isPending}
          onCancel={closeClearInventoryModal}
          onConfirm={handleClearInventory}
        />
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-slate-950">Add inventory batch</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Create a new batch manually without re-uploading a CSV file.
            </p>
          </div>

          {medicineOptions.length ? (
            <p className="text-sm text-slate-500">
              Tip: press Enter inside a field to submit once the form is complete.
            </p>
          ) : null}
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
          id="create-inventory-batch-form"
          action={handleCreateBatch}
          className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="medicineId">
              Medicine
            </label>
            <select
              id="medicineId"
              name="medicineId"
              required
              disabled={!medicineOptions.length}
              value={selectedMedicineId}
              onChange={(event) => setSelectedMedicineId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="" disabled>
                {medicineOptions.length ? "Select medicine" : "No medicines available yet"}
              </option>
              {medicineOptions.map((medicine) => (
                <option key={medicine.id} value={medicine.id}>
                  {medicine.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="batchNumber">
              Batch number
            </label>
            <input
              id="batchNumber"
              name="batchNumber"
              type="text"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="quantity">
              Quantity
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="0"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="expiryDate">
              Expiry date
            </label>
            <input
              id="expiryDate"
              name="expiryDate"
              type="date"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="purchasePrice">
              Purchase price
            </label>
            <input
              id="purchasePrice"
              name="purchasePrice"
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="sellingPrice">
              Selling price
            </label>
            <input
              id="sellingPrice"
              name="sellingPrice"
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="submit"
              disabled={isPending || !medicineOptions.length}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Add batch"}
            </button>
            {!medicineOptions.length ? (
              <span className="text-sm text-slate-500">
                Add medicines through inventory import before creating manual batches.
              </span>
            ) : null}
          </div>
        </form>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Inventory table</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Search, filter, and sort batches quickly for daily stock operations.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 xl:max-w-xl">
              <label className="text-sm font-medium text-slate-800" htmlFor="inventory-search">
                Search
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="inventory-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by medicine, batch number, or SKU"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                />
                <button
                  type="button"
                  onClick={handleOpenClearInventoryModal}
                  disabled={isPending || rows.length === 0}
                  className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending && showClearInventoryModal ? "Clearing..." : "Clear Inventory"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap gap-2">
              <SortButton
                active={statusFilter === "all"}
                label={`All (${rows.length})`}
                onClick={() => setStatusFilter("all")}
              />
              <SortButton
                active={statusFilter === "low-stock"}
                label={`Low stock (${filterCounts.lowStock})`}
                onClick={() => setStatusFilter("low-stock")}
              />
              <SortButton
                active={statusFilter === "near-expiry"}
                label={`Near expiry (${filterCounts.nearExpiry})`}
                onClick={() => setStatusFilter("near-expiry")}
              />
              <SortButton
                active={statusFilter === "expired"}
                label={`Expired (${filterCounts.expired})`}
                onClick={() => setStatusFilter("expired")}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800" htmlFor="inventory-category-filter">
                  Category
                </label>
                <select
                  id="inventory-category-filter"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                >
                  <option value="all">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-800" htmlFor="inventory-sort-by">
                  Sort by
                </label>
                <select
                  id="inventory-sort-by"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="expiry-date">Expiry date</option>
                  <option value="quantity">Quantity</option>
                  <option value="medicine-name">Medicine name</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={resetInventoryView}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 xl:w-auto"
                >
                  Reset view
                </button>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-900">{filteredRows.length}</span> of{" "}
              <span className="font-medium text-slate-900">{rows.length}</span> batch
              {rows.length === 1 ? "" : "es"}.
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No inventory has been imported yet. Upload a CSV file above to create your first batch records.
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            <p>No inventory rows match your current search, filters, or sorting view.</p>
            <button
              type="button"
              onClick={resetInventoryView}
              className="mt-4 inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-4 lg:hidden">
              {filteredRows.map((row) => {
                const formId = `edit-batch-${row.id}`;

                return (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-950">{row.medicineName}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Batch {row.batchNumber}
                          {row.sku ? ` • SKU ${row.sku}` : ""}
                        </p>
                      </div>
                      <span
                        className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(
                          row.status,
                        )}`}
                      >
                        {row.status}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Quantity</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{row.quantity}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Expiry</p>
                        <p className="mt-1 text-sm text-slate-700">{formatDate(row.expiryDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Purchase</p>
                        <p className="mt-1 text-sm text-slate-700">{formatCurrency(row.purchasePrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Selling</p>
                        <p className="mt-1 text-sm text-slate-700">{formatCurrency(row.sellingPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Category</p>
                        <p className="mt-1 text-sm text-slate-700">{row.category || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Unit</p>
                        <p className="mt-1 text-sm text-slate-700">{row.unit || "—"}</p>
                      </div>
                    </div>

                    {activeEditId === row.id ? (
                      <div className="mt-4 space-y-4">
                        <InventoryEditFields row={row} formId={formId} />
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <form id={formId} action={handleUpdateBatch} className="sm:w-auto">
                            <input type="hidden" name="batchId" value={row.id} />
                            <button
                              type="submit"
                              disabled={isPending}
                              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Save changes
                            </button>
                          </form>
                          <button
                            type="button"
                            onClick={() => setActiveEditId(null)}
                            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => setActiveEditId(row.id)}
                          className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Edit batch
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBatch(row.id)}
                          className="inline-flex w-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-100"
                        >
                          Delete batch
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 hidden overflow-x-auto lg:block">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Medicine</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Batch</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Status</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Quantity</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Expiry</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Purchase</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Selling</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">SKU</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Category</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Unit</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Imported</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const formId = `desktop-edit-batch-${row.id}`;

                    return (
                      <tr key={row.id} className="align-top">
                        <td className="border-b border-slate-100 px-3 py-4">
                          <div className="font-medium text-slate-900">{row.medicineName}</div>
                          {row.sku ? <div className="mt-1 text-xs text-slate-500">SKU {row.sku}</div> : null}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                          {row.batchNumber}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusClasses(
                              row.status,
                            )}`}
                          >
                            {row.status}
                          </span>
                        </td>

                        {activeEditId === row.id ? (
                          <>
                            <td className="border-b border-slate-100 px-3 py-4">
                              <input
                                form={formId}
                                name="quantity"
                                type="number"
                                min="0"
                                required
                                defaultValue={row.quantity}
                                className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                              />
                            </td>
                            <td className="border-b border-slate-100 px-3 py-4">
                              <input
                                form={formId}
                                name="expiryDate"
                                type="date"
                                required
                                defaultValue={toDateInputValue(row.expiryDate)}
                                className="w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                              />
                            </td>
                            <td className="border-b border-slate-100 px-3 py-4">
                              <input
                                form={formId}
                                name="purchasePrice"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={row.purchasePrice ?? ""}
                                className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                              />
                            </td>
                            <td className="border-b border-slate-100 px-3 py-4">
                              <input
                                form={formId}
                                name="sellingPrice"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={row.sellingPrice ?? ""}
                                className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                              {row.quantity}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                              {formatDate(row.expiryDate)}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                              {formatCurrency(row.purchasePrice)}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                              {formatCurrency(row.sellingPrice)}
                            </td>
                          </>
                        )}

                        <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                          {row.sku || "—"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                          {row.category || "—"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                          {row.unit || "—"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-4">
                          {activeEditId === row.id ? (
                            <div className="flex flex-wrap gap-2">
                              <form id={formId} action={handleUpdateBatch}>
                                <input type="hidden" name="batchId" value={row.id} />
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
                                onClick={() => setActiveEditId(row.id)}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBatch(row.id)}
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </section>
  );
}
