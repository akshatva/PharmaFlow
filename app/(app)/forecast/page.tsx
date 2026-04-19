import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";

import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import {
  buildProductForecastRows,
  type ProductForecastRecord,
  type ProductForecastRow,
} from "@/lib/forecasting/product";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MedicineRecord = {
  id: string;
  name: string;
};

type InventoryBatchRecord = {
  medicine_id: string;
  quantity: number;
};

type SalesRecord = {
  medicine_id: string;
  quantity_sold: number;
};

function formatDecimal(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
}

function formatDaysOfStockLeft(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${formatDecimal(value)} days`;
}

function getRiskClasses(risk: ProductForecastRow["stockRisk"]) {
  switch (risk) {
    case "High risk":
      return "border-red-200 bg-red-50 text-red-700";
    case "Medium":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function getConfidenceClasses(confidenceLevel: ProductForecastRow["confidenceLevel"]) {
  switch (confidenceLevel) {
    case "high":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "medium":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "low":
      return "border-slate-200 bg-slate-100 text-slate-600";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

function getTrendClasses(trendDirection: ProductForecastRow["trendDirection"]) {
  switch (trendDirection) {
    case "increasing":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "decreasing":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getRiskIcon(risk: ProductForecastRow["stockRisk"]) {
  switch (risk) {
    case "High risk":
      return AlertTriangle;
    case "Medium":
      return TrendingUp;
    default:
      return CheckCircle2;
  }
}

export default async function ForecastPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const recentSalesCutoff = new Date();
  recentSalesCutoff.setDate(recentSalesCutoff.getDate() - 30);

  const [
    { data: medicines, error: medicinesError },
    { data: inventoryBatches, error: inventoryError },
    { data: salesRecords, error: salesError },
    { data: forecastResults, error: forecastError },
  ] = await Promise.all([
    supabase
      .from("medicines")
      .select("id, name")
      .eq("organization_id", membership.organization_id)
      .order("name", { ascending: true }),
    supabase
      .from("inventory_batches")
      .select("medicine_id, quantity")
      .eq("organization_id", membership.organization_id),
    supabase
      .from("sales_records")
      .select("medicine_id, quantity_sold")
      .eq("organization_id", membership.organization_id)
      .gte("sold_at", recentSalesCutoff.toISOString()),
    supabase
      .from("forecast_results")
      .select(
        "medicine_id, model_name, forecast_7d, forecast_30d, daily_demand_avg, confidence_level, error_metric_name, error_metric_value, history_days_used, generated_at",
      )
      .eq("organization_id", membership.organization_id),
  ]);

  const dataError = medicinesError ?? inventoryError ?? salesError ?? forecastError;

  if (dataError) {
    if (isMissingRelationError(forecastError, "forecast_results")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Forecasting"
            title="Demand Forecast"
            description="Review predicted demand, stock coverage, selected models, and confidence before acting on replenishment decisions."
          />
          <SetupNotice
            title="Forecasting is not set up in Supabase yet"
            description="This workspace is missing the `forecast_results` table, so PharmaFlow cannot show saved forecast output yet. Apply the forecast migration, generate forecasts, and refresh this page. Until then, the rest of the app will continue using the existing rules-based inventory and reorder logic."
          />
        </div>
      );
    }

    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load forecast page: ${dataError.message}`
        : "Unable to load forecast page.",
    );
  }

  const currentStockByMedicine = new Map<string, number>();
  ((inventoryBatches ?? []) as InventoryBatchRecord[]).forEach((batch) => {
    currentStockByMedicine.set(
      batch.medicine_id,
      (currentStockByMedicine.get(batch.medicine_id) ?? 0) + batch.quantity,
    );
  });

  const recentSalesByMedicine = new Map<string, number>();
  ((salesRecords ?? []) as SalesRecord[]).forEach((sale) => {
    recentSalesByMedicine.set(
      sale.medicine_id,
      (recentSalesByMedicine.get(sale.medicine_id) ?? 0) + sale.quantity_sold,
    );
  });

  const forecastByMedicine = new Map(
    ((forecastResults ?? []) as ProductForecastRecord[]).map((result) => [result.medicine_id, result]),
  );

  const rows = buildProductForecastRows({
    medicines: (medicines ?? []) as MedicineRecord[],
    currentStockByMedicine,
    recentSalesByMedicine,
    forecastByMedicine,
  });

  const highRiskCount = rows.filter((row) => row.stockRisk === "High risk").length;
  const mediumRiskCount = rows.filter((row) => row.stockRisk === "Medium").length;
  const safeCount = rows.filter((row) => row.stockRisk === "Safe").length;

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Forecasting"
        title="Demand Forecast"
        description="Review predicted demand, stock coverage, selected models, and confidence before acting on replenishment decisions."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="app-stat-card">
          <p className="app-stat-eyebrow">Medicines</p>
          <p className="app-stat-value">{rows.length}</p>
        </div>
        <div className="app-stat-card border-l-2 border-l-red-400">
          <p className="app-stat-eyebrow">High risk</p>
          <p className="app-stat-value text-red-700">{highRiskCount}</p>
        </div>
        <div className="app-stat-card border-l-2 border-l-amber-400">
          <p className="app-stat-eyebrow">Medium risk</p>
          <p className="app-stat-value text-amber-700">{mediumRiskCount}</p>
        </div>
        <div className="app-stat-card border-l-2 border-l-emerald-400">
          <p className="app-stat-eyebrow">Safe</p>
          <p className="app-stat-value text-emerald-700">{safeCount}</p>
        </div>
      </div>

      <section className="app-card">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h3 className="text-sm font-semibold text-slate-900">Forecast table</h3>
          <p className="mt-1 text-sm text-slate-500">
            Critical items appear first. Shows current stock, predicted demand, stock coverage, selected model, and confidence.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-12 sm:px-6">
            <div className="app-empty-state">
              No saved forecast output is available yet. Generate forecasts after you have medicine
              and sales data, then refresh this page.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Current Stock</th>
                  <th>Forecast 7d</th>
                  <th>Forecast 30d</th>
                  <th>Days Left</th>
                  <th>Risk</th>
                  <th>Trend</th>
                  <th>Confidence</th>
                  <th>Model</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.medicineId}>
                    <td>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{row.medicineName}</p>
                        <p className="text-xs leading-5 text-slate-400">{row.explainabilityNote}</p>
                        <p className="text-xs leading-5 text-slate-400">{row.confidenceNote}</p>
                      </div>
                    </td>
                    <td className="font-medium tabular-nums">
                      {row.currentStock}
                    </td>
                    <td className="tabular-nums">
                      {formatDecimal(row.forecast7d)}
                    </td>
                    <td className="tabular-nums">
                      {formatDecimal(row.forecast30d)}
                    </td>
                    <td className="tabular-nums">
                      {formatDaysOfStockLeft(row.daysOfStockLeft)}
                    </td>
                    <td>
                      <span
                        className={`app-badge ${getRiskClasses(row.stockRisk)}`}
                      >
                        {row.stockRisk}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`app-badge capitalize ${getTrendClasses(row.trendDirection)}`}
                      >
                        {row.trendDirection}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`app-badge capitalize ${getConfidenceClasses(row.confidenceLevel)}`}
                      >
                        {row.confidenceLevel ?? "none"}
                      </span>
                    </td>
                    <td className="text-slate-500">
                      {row.modelName ?? "No model"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
