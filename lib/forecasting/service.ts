import type { SupabaseClient } from "@supabase/supabase-js";

import { generateDemandForecast, type ConfidenceLevel, type ErrorMetricName } from "@/lib/forecasting/model";

type MedicineRecord = {
  id: string;
  name: string;
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
  dailyDemand: DailyDemandPoint[];
};

export type GeneratedForecastRow = {
  organizationId: string;
  medicineId: string;
  medicineName: string;
  modelName: string;
  forecast7d: number;
  forecast30d: number;
  dailyDemandAvg: number;
  confidenceLevel: ConfidenceLevel;
  errorMetricName: ErrorMetricName;
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

  const [{ data: medicines, error: medicinesError }, { data: salesRecords, error: salesError }] =
    await Promise.all([
      supabase
        .from("medicines")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true }),
      supabase
        .from("sales_records")
        .select("medicine_id, quantity_sold, sold_at")
        .eq("organization_id", organizationId)
        .gte("sold_at", historyStart.toISOString())
        .order("sold_at", { ascending: true }),
    ]);

  if (medicinesError || salesError) {
    return {
      forecastRows: [] as GeneratedForecastRow[],
      preparationError: medicinesError ?? salesError,
    };
  }

  const preparedDemandHistory = prepareDailyDemandHistory({
    medicines: (medicines ?? []) as MedicineRecord[],
    salesRecords: (salesRecords ?? []) as SalesRecord[],
    historyDays,
  });

  const forecastRows = preparedDemandHistory.map((entry) => {
    const forecast = generateDemandForecast({
      dailyHistory: entry.dailyDemand.map((point) => point.quantity),
    });

    return {
      organizationId,
      medicineId: entry.medicineId,
      medicineName: entry.medicineName,
      modelName: forecast.modelName,
      forecast7d: forecast.forecast7d,
      forecast30d: forecast.forecast30d,
      dailyDemandAvg: forecast.dailyDemandAvg,
      confidenceLevel: forecast.confidenceLevel,
      errorMetricName: forecast.errorMetricName,
      errorMetricValue: forecast.errorMetricValue,
      historyDaysUsed: forecast.historyDaysUsed,
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
