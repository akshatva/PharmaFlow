import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildProductForecastRows,
  getForecastAwareReorderDecision,
  type ProductForecastRecord,
  type ProductForecastRow,
} from "@/lib/forecasting/product";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { getRulesBasedReorderDecision } from "@/services/inventory";

type RouteOrganizationContextResult = {
  supabase: SupabaseClient;
  userId: string;
  organizationId: string;
} | {
  errorResponse: NextResponse;
};

type CsvRow = Record<string, string | number | null>;

type InventoryBatchRecord = {
  id: string;
  medicine_id: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
  purchase_price: number | null;
  selling_price: number | null;
  medicines:
    | {
        name: string;
        sku: string | null;
        category: string | null;
        unit: string | null;
      }
    | {
        name: string;
        sku: string | null;
        category: string | null;
        unit: string | null;
      }[]
    | null;
};

type MedicineRecord = {
  id: string;
  name: string;
};

type SalesRecord = {
  medicine_id: string;
  quantity_sold: number;
};

type ReorderItemRecord = {
  id: string;
  medicine_id: string;
  reason: string;
  status: "pending" | "ordered";
  created_at: string;
  medicines:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getDaysUntilExpiry(expiryDate: string) {
  const today = getTodayStart();
  const expiry = new Date(expiryDate);
  const expiryStart = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());

  return Math.ceil((expiryStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function escapeCsvValue(value: string | number | null) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function buildCsvContent(rows: CsvRow[]) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const headerRow = headers.map((header) => escapeCsvValue(header)).join(",");
  const bodyRows = rows.map((row) =>
    headers.map((header) => escapeCsvValue(row[header] ?? null)).join(","),
  );

  return [headerRow, ...bodyRows].join("\n");
}

export function createCsvDownloadResponse({
  filename,
  rows,
}: {
  filename: string;
  rows: CsvRow[];
}) {
  const csvContent = buildCsvContent(rows);

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function resolveRouteOrganizationContext(
  supabase: SupabaseClient,
): Promise<RouteOrganizationContextResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return {
      errorResponse: NextResponse.json(
        {
          error:
            process.env.NODE_ENV === "development"
              ? `Unable to resolve your organization: ${membershipError?.message ?? "No membership found."}`
              : "Unable to resolve your organization.",
        },
        { status: 400 },
      ),
    };
  }

  return {
    supabase,
    userId: user.id,
    organizationId: membership.organization_id,
  };
}

export async function getInventoryExportRows(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("inventory_batches")
    .select(
      "id, medicine_id, batch_number, quantity, expiry_date, purchase_price, selling_price, medicines(name, sku, category, unit)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as InventoryBatchRecord[]).map((record) => {
    const medicine = Array.isArray(record.medicines) ? record.medicines[0] : record.medicines;

    return {
      medicine_name: medicine?.name ?? "Unknown medicine",
      batch_number: record.batch_number,
      quantity: record.quantity,
      expiry_date: record.expiry_date,
      purchase_price: record.purchase_price,
      selling_price: record.selling_price,
      sku: medicine?.sku ?? null,
      category: medicine?.category ?? null,
      unit: medicine?.unit ?? null,
    };
  });
}

export async function getLowStockExportRows(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const [{ data: medicines, error: medicinesError }, { data: inventoryBatches, error: inventoryError }] =
    await Promise.all([
      supabase
        .from("medicines")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true }),
      supabase
        .from("inventory_batches")
        .select("medicine_id, quantity")
        .eq("organization_id", organizationId),
    ]);

  const dataError = medicinesError ?? inventoryError;
  if (dataError) {
    throw dataError;
  }

  const stockByMedicine = new Map<string, number>();
  ((inventoryBatches ?? []) as { medicine_id: string; quantity: number }[]).forEach((batch) => {
    stockByMedicine.set(
      batch.medicine_id,
      (stockByMedicine.get(batch.medicine_id) ?? 0) + batch.quantity,
    );
  });

  return ((medicines ?? []) as MedicineRecord[])
    .map((medicine) => {
      const currentStock = stockByMedicine.get(medicine.id) ?? 0;

      if (currentStock >= 20) {
        return null;
      }

      const status =
        currentStock <= 0
          ? "Out of Stock"
          : currentStock <= 7
            ? "Critical Low Stock"
            : "Low Stock";

      const recommendation =
        currentStock <= 0 || currentStock <= 7 ? "Reorder Now" : "Reorder Soon";

      return {
        medicine_name: medicine.name,
        current_stock: currentStock,
        status,
        recommendation,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((first, second) => first.current_stock - second.current_stock);
}

export async function getExpiryExportRows(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("inventory_batches")
    .select("id, medicine_id, batch_number, quantity, expiry_date, medicines(name)")
    .eq("organization_id", organizationId)
    .gt("quantity", 0)
    .order("expiry_date", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as (InventoryBatchRecord & {
    medicines:
      | { name: string }
      | { name: string }[]
      | null;
  })[])
    .map((record) => {
      const daysUntilExpiry = getDaysUntilExpiry(record.expiry_date);
      const medicine = Array.isArray(record.medicines) ? record.medicines[0] : record.medicines;

      if (daysUntilExpiry < 0) {
        return {
          medicine_name: medicine?.name ?? "Unknown medicine",
          batch_number: record.batch_number,
          expiry_date: record.expiry_date,
          quantity: record.quantity,
          status: "Expired",
        };
      }

      if (daysUntilExpiry <= 90) {
        return {
          medicine_name: medicine?.name ?? "Unknown medicine",
          batch_number: record.batch_number,
          expiry_date: record.expiry_date,
          quantity: record.quantity,
          status: "Expiring Soon",
        };
      }

      return null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

function getFallbackReorderDecision({
  currentStock,
  recentSales,
}: {
  currentStock: number;
  recentSales: number;
}) {
  const decision = getRulesBasedReorderDecision({
    currentStock,
    recentSales30d: recentSales,
  });

  return {
    daysOfStockLeft: decision.daysOfStockLeft,
    recommendation: decision.recommendation,
    priority: decision.priority,
    suggestedQuantity: decision.recommendedReorderQuantity ?? 0,
    explainabilityNote: decision.explainabilityNote,
    confidenceNote: decision.confidenceNote,
  };
}

export async function getReorderExportRows(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const recentSalesCutoff = new Date();
  recentSalesCutoff.setDate(recentSalesCutoff.getDate() - 30);

  const [
    { data: reorderItems, error: reorderError },
    { data: batchRecords, error: batchError },
    { data: salesRecords, error: salesError },
    { data: forecastResults, error: forecastError },
  ] = await Promise.all([
    supabase
      .from("reorder_items")
      .select("id, medicine_id, reason, status, created_at, medicines(name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("inventory_batches")
      .select("medicine_id, quantity")
      .eq("organization_id", organizationId),
    supabase
      .from("sales_records")
      .select("medicine_id, quantity_sold")
      .eq("organization_id", organizationId)
      .gte("sold_at", recentSalesCutoff.toISOString()),
    supabase
      .from("forecast_results")
      .select(
        "medicine_id, model_name, forecast_7d, forecast_30d, daily_demand_avg, confidence_level, error_metric_name, error_metric_value, history_days_used, generated_at",
      )
      .eq("organization_id", organizationId),
  ]);

  const forecastUnavailable = Boolean(
    forecastError && isMissingRelationError(forecastError, "forecast_results"),
  );
  const dataError = reorderError ?? batchError ?? salesError ?? (forecastUnavailable ? null : forecastError);
  if (dataError) {
    throw dataError;
  }

  const stockByMedicine = new Map<string, number>();
  ((batchRecords ?? []) as { medicine_id: string; quantity: number }[]).forEach((batch) => {
    stockByMedicine.set(
      batch.medicine_id,
      (stockByMedicine.get(batch.medicine_id) ?? 0) + batch.quantity,
    );
  });

  const recentSalesByMedicine = new Map<string, number>();
  ((salesRecords ?? []) as SalesRecord[]).forEach((sale) => {
    recentSalesByMedicine.set(
      sale.medicine_id,
      (recentSalesByMedicine.get(sale.medicine_id) ?? 0) + sale.quantity_sold,
    );
  });

  const forecastByMedicine = new Map<string, ProductForecastRecord>(
    (forecastUnavailable
      ? []
      : ((forecastResults ?? []) as ProductForecastRecord[]).map((row) => [row.medicine_id, row])),
  );

  const forecastRows = buildProductForecastRows({
    medicines: ((reorderItems ?? []) as ReorderItemRecord[]).map((item) => {
      const medicine = Array.isArray(item.medicines) ? item.medicines[0] : item.medicines;
      return {
        id: item.medicine_id,
        name: medicine?.name ?? "Unknown medicine",
      };
    }),
    currentStockByMedicine: stockByMedicine,
    recentSalesByMedicine,
    forecastByMedicine,
  });

  const forecastRowsByMedicine = new Map<string, ProductForecastRow>(
    forecastRows.map((row) => [row.medicineId, row]),
  );

  return ((reorderItems ?? []) as ReorderItemRecord[]).map((item) => {
    const medicine = Array.isArray(item.medicines) ? item.medicines[0] : item.medicines;
    const currentStock = stockByMedicine.get(item.medicine_id) ?? 0;
    const recentSales = recentSalesByMedicine.get(item.medicine_id) ?? 0;
    const forecastRow = forecastRowsByMedicine.get(item.medicine_id) ?? null;
    const fallbackDecision = getFallbackReorderDecision({
      currentStock,
      recentSales,
    });
    const decision = getForecastAwareReorderDecision({
      forecastRow,
      fallbackDecision,
    });

    return {
      medicine_name: medicine?.name ?? "Unknown medicine",
      current_stock: currentStock,
      forecast_30d: forecastRow?.forecast30d ?? null,
      recent_sales_30d: recentSales,
      recommendation: decision.recommendation,
      suggested_quantity: decision.suggestedQuantity,
    };
  });
}
