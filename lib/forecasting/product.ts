export type ForecastConfidenceLevel = "low" | "medium" | "high";
export type ForecastTrendDirection = "increasing" | "stable" | "decreasing";
export type StockRiskLevel = "High risk" | "Medium" | "Safe";
export type ForecastRecommendation = "Reorder Now" | "Reorder Soon" | "Monitor" | "Avoid Reorder";
export type ForecastPriority = "Urgent" | "High" | "Medium" | "Low";

export type ProductForecastRecord = {
  medicine_id: string;
  model_name: string;
  forecast_7d: number;
  forecast_30d: number;
  daily_demand_avg: number;
  baseline_daily_demand?: number | null;
  active_uplift_percentage?: number | null;
  demand_signal_title?: string | null;
  signal_explanation?: string | null;
  confidence_level: ForecastConfidenceLevel | null;
  error_metric_name: string | null;
  error_metric_value: number | null;
  history_days_used: number | null;
  generated_at: string;
};

export type ProductForecastRow = {
  medicineId: string;
  medicineName: string;
  currentStock: number;
  forecast7d: number | null;
  forecast30d: number | null;
  daysOfStockLeft: number | null;
  trendDirection: ForecastTrendDirection;
  confidenceLevel: ForecastConfidenceLevel | null;
  modelName: string | null;
  stockRisk: StockRiskLevel;
  explainabilityNote: string;
  confidenceNote: string;
  forecastAvailable: boolean;
};

export type ForecastAwareReorderDecision = {
  recommendation: ForecastRecommendation;
  priority: ForecastPriority;
  suggestedQuantity: number;
  explainabilityNote: string;
  confidenceNote: string;
  usedForecast: boolean;
};

function roundValue(value: number) {
  return Number(value.toFixed(2));
}

export function calculateDaysOfStockLeft({
  currentStock,
  forecast30d,
}: {
  currentStock: number;
  forecast30d: number | null;
}) {
  if (forecast30d === null || forecast30d <= 0) {
    return null;
  }

  const dailyForecastDemand = forecast30d / 30;

  if (dailyForecastDemand <= 0) {
    return null;
  }

  return roundValue(currentStock / dailyForecastDemand);
}

export function classifyStockRisk(daysOfStockLeft: number | null): StockRiskLevel {
  if (daysOfStockLeft !== null && daysOfStockLeft <= 7) {
    return "High risk";
  }

  if (daysOfStockLeft !== null && daysOfStockLeft <= 15) {
    return "Medium";
  }

  return "Safe";
}

export function getTrendDirection({
  recentSales30d,
  forecast30d,
}: {
  recentSales30d: number;
  forecast30d: number | null;
}): ForecastTrendDirection {
  if (forecast30d === null) {
    return "stable";
  }

  const recentDaily = recentSales30d / 30;
  const forecastDaily = forecast30d / 30;

  if (recentDaily === 0 && forecastDaily === 0) {
    return "stable";
  }

  if (recentDaily === 0 && forecastDaily > 0) {
    return "increasing";
  }

  if (forecastDaily >= recentDaily * 1.1) {
    return "increasing";
  }

  if (forecastDaily <= recentDaily * 0.9) {
    return "decreasing";
  }

  return "stable";
}

export function getConfidenceNote({
  confidenceLevel,
  historyDaysUsed,
}: {
  confidenceLevel: ForecastConfidenceLevel | null;
  historyDaysUsed: number | null;
}) {
  if (!confidenceLevel || confidenceLevel === "low") {
    return "Confidence low due to limited sales data or unstable demand.";
  }

  if (confidenceLevel === "medium") {
    return historyDaysUsed && historyDaysUsed >= 60
      ? "Confidence medium based on usable demand history."
      : "Confidence medium with some demand history, but limited stability.";
  }

  return "Confidence high due to stronger history and more consistent demand.";
}

export function getExplainabilityNote({
  forecastAvailable,
  confidenceLevel,
}: {
  forecastAvailable: boolean;
  confidenceLevel: ForecastConfidenceLevel | null;
}) {
  if (!forecastAvailable) {
    return "No forecast available yet. Using existing operational signals.";
  }

  if (confidenceLevel === "low") {
    return "Based on recent demand trends, but forecast certainty is limited.";
  }

  return "Based on recent demand trends and the selected forecast model.";
}

export function buildProductForecastRows({
  medicines,
  currentStockByMedicine,
  recentSalesByMedicine,
  forecastByMedicine,
}: {
  medicines: { id: string; name: string }[];
  currentStockByMedicine: Map<string, number>;
  recentSalesByMedicine: Map<string, number>;
  forecastByMedicine: Map<string, ProductForecastRecord>;
}) {
  return medicines
    .map((medicine) => {
      const forecast = forecastByMedicine.get(medicine.id);
      const currentStock = currentStockByMedicine.get(medicine.id) ?? 0;
      const recentSales30d = recentSalesByMedicine.get(medicine.id) ?? 0;
      const forecastAvailable = Boolean(forecast);
      const forecast30d = forecast?.forecast_30d ?? null;
      const daysOfStockLeft = calculateDaysOfStockLeft({
        currentStock,
        forecast30d,
      });
      const stockRisk = classifyStockRisk(daysOfStockLeft);
      const confidenceLevel = forecast?.confidence_level ?? null;

      return {
        medicineId: medicine.id,
        medicineName: medicine.name,
        currentStock,
        forecast7d: forecast?.forecast_7d ?? null,
        forecast30d,
        daysOfStockLeft,
        trendDirection: getTrendDirection({
          recentSales30d,
          forecast30d,
        }),
        confidenceLevel,
        modelName: forecast?.model_name ?? null,
        stockRisk,
        explainabilityNote: getExplainabilityNote({
          forecastAvailable,
          confidenceLevel,
        }),
        confidenceNote: getConfidenceNote({
          confidenceLevel,
          historyDaysUsed: forecast?.history_days_used ?? null,
        }),
        forecastAvailable,
      } satisfies ProductForecastRow;
    })
    .sort((first, second) => {
      const riskWeight = { "High risk": 3, Medium: 2, Safe: 1 };
      const riskDifference = riskWeight[second.stockRisk] - riskWeight[first.stockRisk];

      if (riskDifference !== 0) {
        return riskDifference;
      }

      if (first.daysOfStockLeft === null && second.daysOfStockLeft !== null) {
        return 1;
      }

      if (first.daysOfStockLeft !== null && second.daysOfStockLeft === null) {
        return -1;
      }

      if (first.daysOfStockLeft !== null && second.daysOfStockLeft !== null) {
        return first.daysOfStockLeft - second.daysOfStockLeft;
      }

      return first.medicineName.localeCompare(second.medicineName);
    });
}

export function getForecastAwareReorderDecision({
  forecastRow,
  fallbackDecision,
}: {
  forecastRow: ProductForecastRow | null;
  fallbackDecision: {
    recommendation: ForecastRecommendation;
    priority: ForecastPriority;
    suggestedQuantity: number;
    explainabilityNote: string;
    confidenceNote: string;
  };
}): ForecastAwareReorderDecision {
  if (!forecastRow || !forecastRow.forecastAvailable || forecastRow.confidenceLevel === "low") {
    return {
      ...fallbackDecision,
      usedForecast: false,
    };
  }

  const suggestedQuantity = Math.max(
    0,
    Math.ceil((forecastRow.forecast30d ?? 0) - forecastRow.currentStock),
  );

  if (forecastRow.stockRisk === "High risk") {
    if (forecastRow.confidenceLevel === "high") {
      return {
        recommendation: "Reorder Now",
        priority: "Urgent",
        suggestedQuantity,
        explainabilityNote: "Based on recent demand trends and high stock risk.",
        confidenceNote: forecastRow.confidenceNote,
        usedForecast: true,
      };
    }

    return {
      recommendation: "Reorder Soon",
      priority: "High",
      suggestedQuantity,
      explainabilityNote: "Forecast indicates risk, but recommendation is softened due to moderate confidence.",
      confidenceNote: forecastRow.confidenceNote,
      usedForecast: true,
    };
  }

  if (forecastRow.stockRisk === "Medium") {
    return {
      recommendation: forecastRow.confidenceLevel === "high" ? "Reorder Soon" : "Monitor",
      priority: forecastRow.confidenceLevel === "high" ? "High" : "Medium",
      suggestedQuantity,
      explainabilityNote: "Based on recent demand trends and projected stock coverage.",
      confidenceNote: forecastRow.confidenceNote,
      usedForecast: true,
    };
  }

  return {
    recommendation: suggestedQuantity > 0 ? "Monitor" : "Avoid Reorder",
    priority: suggestedQuantity > 0 ? "Medium" : "Low",
    suggestedQuantity,
    explainabilityNote: "Forecast indicates stock is currently in a safer range.",
    confidenceNote: forecastRow.confidenceNote,
    usedForecast: true,
  };
}
