import { redirect } from "next/navigation";

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
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getTrendClasses(trendDirection: ProductForecastRow["trendDirection"]) {
  switch (trendDirection) {
    case "increasing":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "decreasing":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
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
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Medicines</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{rows.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">High Risk</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{highRiskCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Medium Risk</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{mediumRiskCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Safe</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{safeCount}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Forecast table</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Critical items appear first. Forecast rows show current stock, predicted demand,
            stock coverage, selected model, confidence, and a short explanation.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No saved forecast output is available yet. Generate forecasts after you have medicine
            and sales data, then refresh this page.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Medicine</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Current Stock</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Forecast 7d</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Forecast 30d</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Days Left</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Risk</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Trend</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Confidence</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Model</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.medicineId}>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{row.medicineName}</p>
                        <p className="text-xs leading-5 text-slate-500">{row.explainabilityNote}</p>
                        <p className="text-xs leading-5 text-slate-500">{row.confidenceNote}</p>
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                      {row.currentStock}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                      {formatDecimal(row.forecast7d)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                      {formatDecimal(row.forecast30d)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                      {formatDaysOfStockLeft(row.daysOfStockLeft)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getRiskClasses(
                          row.stockRisk,
                        )}`}
                      >
                        {row.stockRisk}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getTrendClasses(
                          row.trendDirection,
                        )}`}
                      >
                        {row.trendDirection}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getConfidenceClasses(
                          row.confidenceLevel,
                        )}`}
                      >
                        {row.confidenceLevel ?? "none"}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
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
