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

type SalesRecord = {
  medicine_id: string;
  quantity_sold: number;
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

export type UrgentReorderRow = {
  medicineId: string;
  medicineName: string;
  currentStock: number;
  recentSales: number;
  daysOfStockLeft: number;
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
  const recentSalesCutoff = new Date();
  recentSalesCutoff.setDate(recentSalesCutoff.getDate() - 30);

  const [
    { data: batchRecords, error: batchError },
    { data: reorderItems, error: reorderError },
    { data: salesRecords, error: salesError },
  ] =
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
      supabase
        .from("sales_records")
        .select("medicine_id, quantity_sold")
        .eq("organization_id", organizationId)
        .gte("sold_at", recentSalesCutoff.toISOString()),
    ]);

  const dataError = batchError ?? reorderError ?? salesError;

  if (dataError) {
    return {
      rows: [] as AlertRow[],
      lowStockRows: [] as AlertRow[],
      nearExpiryRows: [] as AlertRow[],
      expiredRows: [] as AlertRow[],
      urgentReorderRows: [] as UrgentReorderRow[],
      pendingReorderMedicineIds: new Set<string>(),
      batchError,
      reorderError,
      salesError,
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

  const stockByMedicineId = new Map<string, { medicineName: string; currentStock: number }>();
  rows.forEach((row) => {
    const existing = stockByMedicineId.get(row.medicineId);
    stockByMedicineId.set(row.medicineId, {
      medicineName: row.medicineName,
      currentStock: (existing?.currentStock ?? 0) + row.quantity,
    });
  });

  const salesByMedicineId = new Map<string, number>();
  ((salesRecords ?? []) as SalesRecord[]).forEach((sale) => {
    salesByMedicineId.set(
      sale.medicine_id,
      (salesByMedicineId.get(sale.medicine_id) ?? 0) + sale.quantity_sold,
    );
  });

  const urgentReorderRows = Array.from(stockByMedicineId.entries())
    .map(([medicineId, row]) => {
      const recentSales = salesByMedicineId.get(medicineId) ?? 0;
      const dailySalesAverage = recentSales > 0 ? recentSales / 30 : 0;
      const daysOfStockLeft =
        dailySalesAverage > 0 ? row.currentStock / dailySalesAverage : null;

      if (daysOfStockLeft === null || daysOfStockLeft > 7) {
        return null;
      }

      return {
        medicineId,
        medicineName: row.medicineName,
        currentStock: row.currentStock,
        recentSales,
        daysOfStockLeft,
      };
    })
    .filter((row): row is UrgentReorderRow => Boolean(row))
    .sort((first, second) => first.daysOfStockLeft - second.daysOfStockLeft)
    .slice(0, 10);

  return {
    rows,
    lowStockRows,
    nearExpiryRows,
    expiredRows,
    urgentReorderRows,
    pendingReorderMedicineIds,
    batchError,
    reorderError,
    salesError,
    dataError,
  };
}
