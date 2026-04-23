import type { LocalWeatherSnapshot, OrganizationLocation } from "@/services/weather";

export type InsightWorkflowStatus = "open" | "reviewed" | "needs_reorder" | "monitor";
export type PersistedInsightWorkflowStatus = Exclude<InsightWorkflowStatus, "open">;
export type InsightWorkflowType =
  | "stockout_risk"
  | "expiry_risk"
  | "dead_stock"
  | "reorder_suggestion";

export type DemandCategory =
  | "fever_flu"
  | "respiratory"
  | "hydration"
  | "gastro"
  | "allergy"
  | "pain_relief"
  | "general";

export type LocalDemandSignal = {
  id: string;
  title: string;
  category: DemandCategory;
  categoryLabel: string;
  upliftPercentage: number;
  explanation: string;
  source: "seasonal" | "weather" | "seasonal_weather";
};

export function getInsightWorkflowKey({
  insightType,
  medicineId,
  inventoryBatchId,
}: {
  insightType: InsightWorkflowType;
  medicineId?: string | null;
  inventoryBatchId?: string | null;
}) {
  if (inventoryBatchId) {
    return `${insightType}:batch:${inventoryBatchId}`;
  }

  if (medicineId) {
    return `${insightType}:medicine:${medicineId}`;
  }

  throw new Error("Insight workflow key requires a medicine or batch identifier.");
}

export function getInsightWorkflowStatusLabel(status: InsightWorkflowStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "reviewed":
      return "Reviewed";
    case "needs_reorder":
      return "Needs reorder";
    default:
      return "Monitor";
  }
}

export function getInsightWorkflowTypeLabel(insightType: InsightWorkflowType) {
  switch (insightType) {
    case "stockout_risk":
      return "Stockout risk";
    case "expiry_risk":
      return "Expiry risk";
    case "dead_stock":
      return "Dead stock";
    default:
      return "Reorder suggestion";
  }
}

function formatDemandCategoryLabel(category: DemandCategory) {
  switch (category) {
    case "fever_flu":
      return "Fever & flu";
    case "pain_relief":
      return "Pain relief";
    default:
      return category
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function getLocationLabel(location: OrganizationLocation) {
  const parts = [location.city, location.district, location.state, location.country].filter(Boolean);
  return parts.length ? parts.slice(0, 2).join(", ") : "your area";
}

function isMonthInRange(month: number, activeMonths: number[]) {
  return activeMonths.includes(month);
}

export function getLocalDemandSignals({
  month = new Date().getMonth() + 1,
  location,
  weather,
  availableCategories,
}: {
  month?: number;
  location?: OrganizationLocation;
  weather?: LocalWeatherSnapshot | null;
  availableCategories: string[];
}) {
  const categorySet = new Set(
    availableCategories.filter(Boolean).map((category) => category as DemandCategory),
  );
  const locationLabel = getLocationLabel(location ?? {});
  const seasonalSignals: Array<Omit<LocalDemandSignal, "categoryLabel"> | null> = [
    categorySet.has("hydration") && isMonthInRange(month, [3, 4, 5, 6])
      ? {
          id: "hydration-summer",
          title: "Hot season demand may rise",
          category: "hydration",
          upliftPercentage: 18,
          explanation: `Hydration products often move faster during hotter months in ${locationLabel}.`,
          source: "seasonal",
        }
      : null,
    categorySet.has("gastro") && isMonthInRange(month, [7, 8, 9])
      ? {
          id: "gastro-monsoon",
          title: "Monsoon gastro demand signal",
          category: "gastro",
          upliftPercentage: 16,
          explanation: `Gastro-related demand can lift during monsoon periods, so keep a closer watch in ${locationLabel}.`,
          source: "seasonal",
        }
      : null,
    categorySet.has("fever_flu") && isMonthInRange(month, [7, 8, 9, 11, 12, 1, 2])
      ? {
          id: "fever-flu-seasonal",
          title: "Seasonal fever and flu watch",
          category: "fever_flu",
          upliftPercentage: isMonthInRange(month, [11, 12, 1, 2]) ? 20 : 14,
          explanation: `Fever and flu medicines often see stronger movement in monsoon and winter months around ${locationLabel}.`,
          source: "seasonal",
        }
      : null,
    categorySet.has("respiratory") && isMonthInRange(month, [11, 12, 1, 2])
      ? {
          id: "respiratory-winter",
          title: "Winter respiratory demand signal",
          category: "respiratory",
          upliftPercentage: 17,
          explanation: `Respiratory medicines can move faster during cooler flu-prone months in ${locationLabel}.`,
          source: "seasonal",
        }
      : null,
    categorySet.has("allergy") && isMonthInRange(month, [2, 3, 4])
      ? {
          id: "allergy-seasonal",
          title: "Light seasonal allergy uplift",
          category: "allergy",
          upliftPercentage: 10,
          explanation: `Allergy demand can pick up modestly during seasonal transitions, so this category is worth monitoring.`,
          source: "seasonal",
        }
      : null,
  ];
  const weatherSignals: Array<Omit<LocalDemandSignal, "categoryLabel"> | null> = [
    weather?.isHot && categorySet.has("hydration")
      ? {
          id: "hydration-weather-hot",
          title: "Heat conditions may lift hydration demand",
          category: "hydration",
          upliftPercentage: 22,
          explanation: `Heat conditions in ${weather.locationName || locationLabel} may increase hydration demand.`,
          source: "weather",
        }
      : null,
    (weather?.isRainy || weather?.isHumid) && categorySet.has("gastro")
      ? {
          id: "gastro-weather-rain",
          title: "Rainy conditions may raise gastro demand",
          category: "gastro",
          upliftPercentage: 18,
          explanation: `Rain or high humidity in ${weather?.locationName || locationLabel} may increase gastro demand.`,
          source: "weather",
        }
      : null,
    (weather?.isRainy || weather?.isHumid) && categorySet.has("fever_flu")
      ? {
          id: "fever-flu-weather-rain",
          title: "Rainy conditions may raise fever and flu demand",
          category: "fever_flu",
          upliftPercentage: 16,
          explanation: `Rainy or humid conditions in ${weather?.locationName || locationLabel} may increase fever and flu demand.`,
          source: "weather",
        }
      : null,
    weather?.isCold && categorySet.has("respiratory")
      ? {
          id: "respiratory-weather-cold",
          title: "Cool conditions may raise respiratory demand",
          category: "respiratory",
          upliftPercentage: 18,
          explanation: `Cool conditions in ${weather.locationName || locationLabel} may increase respiratory demand.`,
          source: "weather",
        }
      : null,
    weather?.isCold && categorySet.has("fever_flu")
      ? {
          id: "fever-flu-weather-cold",
          title: "Cool conditions may raise fever and flu demand",
          category: "fever_flu",
          upliftPercentage: 17,
          explanation: `Cool conditions in ${weather.locationName || locationLabel} may increase fever and flu demand.`,
          source: "weather",
        }
      : null,
  ];
  const triggeredWeatherRules = (
    weatherSignals.filter(Boolean) as Array<Omit<LocalDemandSignal, "categoryLabel">>
  ).map((signal) => ({
    id: signal.id,
    category: signal.category,
    upliftPercentage: signal.upliftPercentage,
    title: signal.title,
  }));

  const mergedSignals = new Map<DemandCategory, Omit<LocalDemandSignal, "categoryLabel">>();

  for (const signal of seasonalSignals.filter(Boolean) as Array<Omit<LocalDemandSignal, "categoryLabel">>) {
    mergedSignals.set(signal.category, signal);
  }

  for (const signal of weatherSignals.filter(Boolean) as Array<Omit<LocalDemandSignal, "categoryLabel">>) {
    const existing = mergedSignals.get(signal.category);

    if (!existing) {
      mergedSignals.set(signal.category, signal);
      continue;
    }

    mergedSignals.set(signal.category, {
      ...signal,
      upliftPercentage: Math.max(existing.upliftPercentage, signal.upliftPercentage),
      explanation:
        existing.source === "seasonal"
          ? `${signal.explanation} Seasonal timing also supports keeping this category on watch.`
          : signal.explanation,
      source: "seasonal_weather",
    });
  }

  const finalSignals = [...mergedSignals.values()]
    .sort((first, second) => second.upliftPercentage - first.upliftPercentage)
    .slice(0, 4)
    .map((signal) => ({
      ...signal,
      title: signal.title,
      explanation: signal.explanation,
      category: signal.category,
      categoryLabel: formatDemandCategoryLabel(signal.category),
    }));

  console.info("[pharmaflow-signals] local demand evaluation", {
    month,
    locationLabel,
    availableCategories: [...categorySet],
    weatherAvailable: Boolean(weather),
    weatherSnapshot: weather
      ? {
          locationName: weather.locationName,
          temperatureC: weather.temperatureC,
          relativeHumidity: weather.relativeHumidity,
          weatherCode: weather.weatherCode,
          isHot: weather.isHot,
          isCold: weather.isCold,
          isHumid: weather.isHumid,
          isRainy: weather.isRainy,
        }
      : null,
    triggeredWeatherRules,
    usedFallback: !weather || triggeredWeatherRules.length === 0,
    finalSignals: finalSignals.map((signal) => ({
      id: signal.id,
      category: signal.category,
      source: signal.source,
      upliftPercentage: signal.upliftPercentage,
    })),
  });

  return finalSignals;
}
