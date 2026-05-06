import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import type { ProductForecastRecord } from "@/lib/forecasting/product";
import { formatDemandCategoryLabel } from "@/services/inventory";
import { isMissingColumnError, isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MedicineRecord = {
  id: string;
  name: string;
  demand_category: string | null;
};

type InventoryBatchRecord = {
  medicine_id: string;
  quantity: number;
};

type SalesRecord = {
  medicine_id: string;
  quantity_sold: number;
};

type ForecastPageRow = {
  medicineId: string;
  medicineName: string;
  demandCategory: string | null;
  baselineDailyDemand: number;
  activeUpliftPercentage: number;
  adjustedDailyDemand: number;
  forecast7d: number;
  currentStock: number;
  daysOfStockLeft: number | null;
  confidenceLevel: ProductForecastRecord["confidence_level"];
  signalTitle: string | null;
  signalExplanation: string | null;
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

function getRiskClasses(daysOfStockLeft: number | null) {
  if (daysOfStockLeft !== null && daysOfStockLeft <= 7) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (daysOfStockLeft !== null && daysOfStockLeft <= 15) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getRiskLabel(daysOfStockLeft: number | null) {
  if (daysOfStockLeft !== null && daysOfStockLeft <= 7) {
    return "High risk";
  }

  if (daysOfStockLeft !== null && daysOfStockLeft <= 15) {
    return "Medium";
  }

  return "Safe";
}

function getRiskIcon(daysOfStockLeft: number | null) {
  if (daysOfStockLeft !== null && daysOfStockLeft <= 7) {
    return AlertTriangle;
  }

  return CheckCircle2;
}

function getConfidenceClasses(confidenceLevel: ProductForecastRecord["confidence_level"]) {
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

function calculateDaysOfStockLeft({
  currentStock,
  adjustedDailyDemand,
}: {
  currentStock: number;
  adjustedDailyDemand: number;
}) {
  if (adjustedDailyDemand <= 0) {
    return null;
  }

  return Number((currentStock / adjustedDailyDemand).toFixed(2));
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
    forecastQuery,
  ] = await Promise.all([
    supabase
      .from("medicines")
      .select("id, name, demand_category")
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
        "medicine_id, model_name, forecast_7d, forecast_30d, daily_demand_avg, baseline_daily_demand, active_uplift_percentage, demand_signal_title, signal_explanation, confidence_level, error_metric_name, error_metric_value, history_days_used, generated_at",
      )
      .eq("organization_id", membership.organization_id),
  ]);

  let forecastResults = forecastQuery.data as ProductForecastRecord[] | null;
  let forecastError = forecastQuery.error;
  let medicineRows = (medicines ?? []) as MedicineRecord[];
  let medicineError = medicinesError;

  if (isMissingColumnError(medicinesError, "demand_category")) {
    const fallbackMedicinesQuery = await supabase
      .from("medicines")
      .select("id, name")
      .eq("organization_id", membership.organization_id)
      .order("name", { ascending: true });

    medicineRows = ((fallbackMedicinesQuery.data ?? []) as Array<{ id: string; name: string }>).map(
      (medicine) => ({
        ...medicine,
        demand_category: "general",
      }),
    );
    medicineError = fallbackMedicinesQuery.error;
  }

  if (isMissingColumnError(forecastQuery.error, "baseline_daily_demand")) {
    const fallbackForecastQuery = await supabase
      .from("forecast_results")
      .select(
        "medicine_id, model_name, forecast_7d, forecast_30d, daily_demand_avg, confidence_level, error_metric_name, error_metric_value, history_days_used, generated_at",
      )
      .eq("organization_id", membership.organization_id);

    forecastResults = ((fallbackForecastQuery.data ?? []) as ProductForecastRecord[]).map(
      (row) => ({
        ...row,
        baseline_daily_demand: row.daily_demand_avg,
        active_uplift_percentage: 0,
        demand_signal_title: null,
        signal_explanation: "No signal uplift.",
      }),
    );
    forecastError = fallbackForecastQuery.error;
  }

  const dataError = medicineError ?? inventoryError ?? salesError ?? forecastError;

  if (dataError) {
    if (isMissingRelationError(forecastError, "forecast_results")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Forecasting"
            title="Forecast"
            description="Demand and stock cover."
          />
          <SetupNotice
            title="Forecasting not ready"
            description="Apply the forecast migration and generate forecasts."
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

  const rows = medicineRows
    .reduce<ForecastPageRow[]>((accumulator, medicine) => {
      const forecast = forecastByMedicine.get(medicine.id);

      if (!forecast) {
        return accumulator;
      }

      const currentStock = currentStockByMedicine.get(medicine.id) ?? 0;
      const baselineDailyDemand = forecast.baseline_daily_demand ?? forecast.daily_demand_avg;
      const activeUpliftPercentage = forecast.active_uplift_percentage ?? 0;
      const adjustedDailyDemand = forecast.daily_demand_avg;

      accumulator.push({
        medicineId: medicine.id,
        medicineName: medicine.name,
        demandCategory: medicine.demand_category ?? "general",
        baselineDailyDemand,
        activeUpliftPercentage,
        adjustedDailyDemand,
        forecast7d: forecast.forecast_7d,
        currentStock,
        daysOfStockLeft: calculateDaysOfStockLeft({
          currentStock,
          adjustedDailyDemand,
        }),
        confidenceLevel: forecast.confidence_level,
        signalTitle: forecast.demand_signal_title ?? null,
        signalExplanation: forecast.signal_explanation ?? null,
      });

      return accumulator;
    }, [])
    .sort((first, second) => {
      const firstDays = first.daysOfStockLeft ?? Number.POSITIVE_INFINITY;
      const secondDays = second.daysOfStockLeft ?? Number.POSITIVE_INFINITY;

      if (firstDays !== secondDays) {
        return firstDays - secondDays;
      }

      return second.forecast7d - first.forecast7d;
    });

  const highRiskCount = rows.filter((row) => (row.daysOfStockLeft ?? 999) <= 7).length;
  const adjustedCount = rows.filter((row) => row.activeUpliftPercentage > 0).length;
  const neutralCount = rows.length - adjustedCount;

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Forecasting"
        title="Forecast"
        description="7-day demand."
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
        <div className="app-stat-card border-l-2 border-l-blue-400">
          <p className="app-stat-eyebrow">Adjusted</p>
          <p className="app-stat-value text-blue-700">{adjustedCount}</p>
        </div>
        <div className="app-stat-card">
          <p className="app-stat-eyebrow">Neutral</p>
          <p className="app-stat-value">{neutralCount}</p>
        </div>
      </div>

      <section className="app-card">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h3 className="text-sm font-semibold text-slate-900">Forecasts</h3>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-12 sm:px-6">
            <div className="app-empty-state">
              <h4 className="app-empty-title">No forecast data</h4>
              <p className="app-empty-copy">Import sales and inventory data to generate predictions.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="space-y-4 p-4 sm:p-5 lg:hidden">
              {rows.map((row) => {
                const RiskIcon = getRiskIcon(row.daysOfStockLeft);
                return (
                  <div key={row.medicineId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{row.medicineName}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDemandCategoryLabel(row.demandCategory)}</p>
                      </div>
                      <span className={`app-badge flex-shrink-0 ${getRiskClasses(row.daysOfStockLeft)}`}>
                        <RiskIcon className="mr-1 h-3.5 w-3.5" />
                        {getRiskLabel(row.daysOfStockLeft)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-400">Baseline</p>
                        <p className="mt-0.5 text-sm tabular-nums text-slate-700">{formatDecimal(row.baselineDailyDemand)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-400">Uplift</p>
                        <p className="mt-0.5 text-sm tabular-nums text-slate-700">{row.activeUpliftPercentage > 0 ? `+${row.activeUpliftPercentage}%` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-400">7d Forecast</p>
                        <p className="mt-0.5 text-sm tabular-nums text-slate-700">{formatDecimal(row.forecast7d)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-slate-400">Cover</p>
                        <p className="mt-0.5 text-sm tabular-nums text-slate-700">{formatDaysOfStockLeft(row.daysOfStockLeft)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`app-badge capitalize ${getConfidenceClasses(row.confidenceLevel)}`}>
                        {row.confidenceLevel ?? "none"}
                      </span>
                      <span className="text-xs text-slate-500">{row.signalTitle ?? "Baseline"}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Category</th>
                    <th>Baseline</th>
                    <th>Uplift</th>
                    <th>7d Forecast</th>
                    <th>Cover</th>
                    <th>Risk</th>
                    <th>Confidence</th>
                    <th>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const RiskIcon = getRiskIcon(row.daysOfStockLeft);

                    return (
                      <tr key={row.medicineId}>
                        <td>
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">{row.medicineName}</p>
                          </div>
                        </td>
                        <td className="text-slate-600">
                          {formatDemandCategoryLabel(row.demandCategory)}
                        </td>
                        <td className="tabular-nums">{formatDecimal(row.baselineDailyDemand)}</td>
                        <td className="tabular-nums">
                          {row.activeUpliftPercentage > 0 ? `+${row.activeUpliftPercentage}%` : "—"}
                        </td>
                        <td className="tabular-nums">{formatDecimal(row.forecast7d)}</td>
                        <td className="tabular-nums">{formatDaysOfStockLeft(row.daysOfStockLeft)}</td>
                        <td>
                          <span className={`app-badge ${getRiskClasses(row.daysOfStockLeft)}`}>
                            <RiskIcon className="mr-1 h-3.5 w-3.5" />
                            {getRiskLabel(row.daysOfStockLeft)}
                          </span>
                        </td>
                        <td>
                          <span className={`app-badge capitalize ${getConfidenceClasses(row.confidenceLevel)}`}>
                            {row.confidenceLevel ?? "none"}
                          </span>
                        </td>
                        <td>
                          <div className="space-y-1">
                            <p className="text-sm text-slate-700">
                              {row.signalTitle ?? "Baseline"}
                            </p>
                            <p className="text-xs leading-5 text-slate-500">
                              {row.signalExplanation ?? "No uplift."}
                            </p>
                          </div>
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
    </div>
  );
}
