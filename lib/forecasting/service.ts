import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingColumnError } from "@/lib/supabase/errors";
import { getLocalDemandSignals } from "@/services/insights";
import { isDemandCategory } from "@/services/inventory";
import { getLocalWeatherSnapshot } from "@/services/weather";

type MedicineRecord = {
  id: string;
  name: string;
  demand_category: string | null;
};

type SalesRecord = {
  medicine_id: string;
  quantity_sold: number;
  sold_at: string;
};

export type DailyDemandPoint = {
  date: string;
  quantity: number;
};

export type PreparedDailyDemand = {
  medicineId: string;
  medicineName: string;
  demandCategory: string | null;
  dailyDemand: DailyDemandPoint[];
};

export type GeneratedForecastRow = {
  organizationId: string;
  medicineId: string;
  medicineName: string;
  demandCategory: string | null;
  modelName: string;
  forecast7d: number;
  forecast30d: number;
  dailyDemandAvg: number;
  baselineDailyDemand: number;
  activeUpliftPercentage: number;
  signalTitle: string | null;
  signalExplanation: string | null;
  confidenceLevel: "low" | "medium" | "high";
  errorMetricName: null;
  errorMetricValue: number | null;
  historyDaysUsed: number;
};

function toUtcDateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function buildDateSeries(days: number) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const current = new Date(end);
    current.setUTCDate(end.getUTCDate() - (days - 1 - index));
    return current.toISOString().slice(0, 10);
  });
}

export function prepareDailyDemandHistory({
  medicines,
  salesRecords,
  historyDays = 180,
}: {
  medicines: MedicineRecord[];
  salesRecords: SalesRecord[];
  historyDays?: number;
}): PreparedDailyDemand[] {
  const dateSeries = buildDateSeries(historyDays);
  const dateLookup = new Set(dateSeries);
  const salesByMedicineAndDate = new Map<string, number>();

  for (const record of salesRecords) {
    const soldDate = toUtcDateKey(record.sold_at);

    if (!dateLookup.has(soldDate)) {
      continue;
    }

    const key = `${record.medicine_id}:${soldDate}`;
    salesByMedicineAndDate.set(key, (salesByMedicineAndDate.get(key) ?? 0) + record.quantity_sold);
  }

  return medicines.map((medicine) => ({
    medicineId: medicine.id,
    medicineName: medicine.name,
    demandCategory: medicine.demand_category,
    dailyDemand: dateSeries.map((date) => ({
      date,
      quantity: salesByMedicineAndDate.get(`${medicine.id}:${date}`) ?? 0,
    })),
  }));
}

export async function generateForecastsForOrganization({
  supabase,
  organizationId,
  historyDays = 180,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  historyDays?: number;
}) {
  const historyStart = new Date();
  historyStart.setUTCDate(historyStart.getUTCDate() - historyDays + 1);
  historyStart.setUTCHours(0, 0, 0, 0);

  const [
    { data: organization, error: organizationError },
    { data: medicines, error: medicinesError },
    { data: salesRecords, error: salesError },
  ] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("city, state, country")
        .eq("id", organizationId)
        .maybeSingle(),
      supabase
        .from("medicines")
        .select("id, name, demand_category")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true }),
      supabase
        .from("sales_records")
        .select("medicine_id, quantity_sold, sold_at")
        .eq("organization_id", organizationId)
        .gte("sold_at", historyStart.toISOString())
        .order("sold_at", { ascending: true }),
    ]);

  let medicineRows = (medicines ?? []) as MedicineRecord[];
  let medicineError = medicinesError;

  if (isMissingColumnError(medicinesError, "demand_category")) {
    const fallbackMedicinesQuery = await supabase
      .from("medicines")
      .select("id, name")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });

    medicineRows = ((fallbackMedicinesQuery.data ?? []) as Array<{ id: string; name: string }>).map(
      (medicine) => ({
        ...medicine,
        demand_category: "general",
      }),
    );
    medicineError = fallbackMedicinesQuery.error;
  }

  if (organizationError || medicineError || salesError) {
    return {
      forecastRows: [] as GeneratedForecastRow[],
      preparationError: organizationError ?? medicineError ?? salesError,
    };
  }

  const localWeather = await getLocalWeatherSnapshot(organization ?? undefined);
  const preparedDemandHistory = prepareDailyDemandHistory({
    medicines: medicineRows.map((medicine) => ({
      ...medicine,
      demand_category: medicine.demand_category ?? "general",
    })),
    salesRecords: (salesRecords ?? []) as SalesRecord[],
    historyDays,
  });
  const activeSignalsByCategory = new Map(
    getLocalDemandSignals({
      location: organization ?? undefined,
      weather: localWeather,
      availableCategories: medicineRows
        .map((medicine) => medicine.demand_category ?? "general")
        .filter(Boolean),
    }).map((signal) => [signal.category, signal]),
  );

  const forecastRows = preparedDemandHistory.map((entry) => {
    const recentDailyHistory = entry.dailyDemand.slice(-30);
    const recentSales30d = recentDailyHistory.reduce((sum, point) => sum + point.quantity, 0);
    const baselineDailyDemand = Number((recentSales30d / 30).toFixed(2));
    const activeDays = recentDailyHistory.filter((point) => point.quantity > 0).length;
    const activeSignal =
      entry.demandCategory && isDemandCategory(entry.demandCategory)
        ? activeSignalsByCategory.get(entry.demandCategory) ?? null
        : null;
    const activeUpliftPercentage = activeSignal?.upliftPercentage ?? 0;
    const adjustedDailyDemand = Number(
      (baselineDailyDemand * (1 + activeUpliftPercentage / 100)).toFixed(2),
    );
    const confidenceLevel =
      activeDays >= 15 ? "high" : activeDays >= 5 ? "medium" : "low";

    return {
      organizationId,
      medicineId: entry.medicineId,
      medicineName: entry.medicineName,
      demandCategory: entry.demandCategory,
      modelName: "signal_adjusted_daily_v1",
      forecast7d: Number((adjustedDailyDemand * 7).toFixed(2)),
      forecast30d: Number((adjustedDailyDemand * 30).toFixed(2)),
      dailyDemandAvg: adjustedDailyDemand,
      baselineDailyDemand,
      activeUpliftPercentage,
      signalTitle: activeSignal?.title ?? null,
      signalExplanation:
        activeSignal?.explanation ??
        "No active local demand signal is changing this forecast right now.",
      confidenceLevel,
      errorMetricName: null,
      errorMetricValue: null,
      historyDaysUsed: 30,
    };
  });

  if (!forecastRows.length) {
    return {
      forecastRows,
      preparationError: null,
    };
  }

  const { error: upsertError } = await supabase.from("forecast_results").upsert(
    forecastRows.map((row) => ({
      organization_id: row.organizationId,
      medicine_id: row.medicineId,
      model_name: row.modelName,
      forecast_7d: row.forecast7d,
      forecast_30d: row.forecast30d,
      daily_demand_avg: row.dailyDemandAvg,
      baseline_daily_demand: row.baselineDailyDemand,
      active_uplift_percentage: row.activeUpliftPercentage,
      demand_signal_title: row.signalTitle,
      signal_explanation: row.signalExplanation,
      confidence_level: row.confidenceLevel,
      error_metric_name: row.errorMetricName,
      error_metric_value: row.errorMetricValue,
      history_days_used: row.historyDaysUsed,
      generated_at: new Date().toISOString(),
    })),
    {
      onConflict: "organization_id,medicine_id",
    },
  );

  return {
    forecastRows,
    preparationError: upsertError,
  };
}
