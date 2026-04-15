import type { SupabaseClient } from "@supabase/supabase-js";

export type AlertBatchRecord = {
  id: string;
  medicine_id: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
  created_at: string;
  medicines:
    | {
        name: string;
        sku: string | null;
        category: string | null;
      }
    | {
        name: string;
        sku: string | null;
        category: string | null;
      }[]
    | null;
};

type ReorderRecord = {
  medicine_id: string;
  status: string;
};

export type AlertRow = {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  sku: string | null;
  category: string | null;
};

export function formatAlertDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getDaysUntilExpiry(expiryDate: string) {
  const today = getTodayStart();
  const expiry = new Date(expiryDate);
  const expiryStart = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());

  return Math.ceil((expiryStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function mapAlertRows(records: AlertBatchRecord[]): AlertRow[] {
  return records.map((record) => {
    const medicine = Array.isArray(record.medicines) ? record.medicines[0] : record.medicines;

    return {
      id: record.id,
      medicineId: record.medicine_id,
      medicineName: medicine?.name ?? "Unknown medicine",
      batchNumber: record.batch_number,
      quantity: record.quantity,
      expiryDate: record.expiry_date,
      sku: medicine?.sku ?? null,
      category: medicine?.category ?? null,
    };
  });
}

export async function getAlertsSnapshotForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const [{ data: batchRecords, error: batchError }, { data: reorderItems, error: reorderError }] =
    await Promise.all([
      supabase
        .from("inventory_batches")
        .select(
          "id, medicine_id, batch_number, quantity, expiry_date, created_at, medicines(name, sku, category)",
        )
        .eq("organization_id", organizationId)
        .order("expiry_date", { ascending: true }),
      supabase
        .from("reorder_items")
        .select("medicine_id, status")
        .eq("organization_id", organizationId)
        .eq("status", "pending"),
    ]);

  const dataError = batchError ?? reorderError;

  if (dataError) {
    return {
      rows: [] as AlertRow[],
      lowStockRows: [] as AlertRow[],
      nearExpiryRows: [] as AlertRow[],
      expiredRows: [] as AlertRow[],
      pendingReorderMedicineIds: new Set<string>(),
      batchError,
      reorderError,
      dataError,
    };
  }

  const rows = mapAlertRows((batchRecords ?? []) as AlertBatchRecord[]);
  const pendingReorderMedicineIds = new Set(
    ((reorderItems ?? []) as ReorderRecord[]).map((item) => item.medicine_id),
  );

  const lowStockRows = rows.filter((row) => row.quantity < 20);
  const nearExpiryRows = rows.filter((row) => {
    const daysUntilExpiry = getDaysUntilExpiry(row.expiryDate);
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 90;
  });
  const expiredRows = rows.filter((row) => getDaysUntilExpiry(row.expiryDate) < 0);

  return {
    rows,
    lowStockRows,
    nearExpiryRows,
    expiredRows,
    pendingReorderMedicineIds,
    batchError,
    reorderError,
    dataError,
  };
}
