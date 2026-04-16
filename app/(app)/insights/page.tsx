import Link from "next/link";
import { redirect } from "next/navigation";

import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import { ReorderButton } from "@/components/reorders/reorder-button";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InsightsPageProps = {
  searchParams?: Promise<{
    severity?: string;
    noSalesOnly?: string;
  }>;
};

type MedicineRecord = {
  id: string;
  name: string;
};

type BatchRecord = {
  id: string;
  medicine_id: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
  medicines:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

type SalesRecord = {
  medicine_id: string;
  quantity_sold: number;
};

type ReorderRecord = {
  medicine_id: string;
};

type MedicineInsight = {
  id: string;
  medicineName: string;
  currentStock: number;
  recentSales: number;
};

type DeadStockInsight = MedicineInsight & {
  severity: "High" | "Medium" | "Low";
  recommendation: "Avoid reorder" | "Push sales" | "Review stock";
  noSales: boolean;
};

type BatchIntelligenceRow = {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  status: "Expired" | "Expiring Soon" | "Sell First" | "Normal";
  recommendation: "Do not dispense" | "Sell this batch first" | "Monitor expiry" | "Healthy batch";
  isSellFirst: boolean;
  daysUntilExpiry: number;
};

type ReorderSuggestion = MedicineInsight & {
  dailySalesVelocity: number;
  predictedDemand7Days: number;
  predictedDemand30Days: number;
  daysOfStockLeft: number | null;
  recommendation: "Reorder Now" | "Reorder Soon" | "Monitor" | "Avoid Reorder";
  priority: "Urgent" | "High" | "Medium" | "Low";
  suggestedQuantity: number;
  reason: string;
};

type ForecastRow = MedicineInsight & {
  dailySalesAverage: number;
  predictedDemand7Days: number;
  predictedDemand30Days: number;
  daysOfStockLeft: number | null;
  coverageLabel: "Stock sufficient" | "Stock running low" | "Stock will run out soon";
};

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function InsightSection({
  title,
  description,
  emptyText,
  children,
}: {
  title: string;
  description: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const hasContent = Boolean(children);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>

      {hasContent ? (
        <div className="mt-6">{children}</div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
          {emptyText}
        </div>
      )}
    </section>
  );
}

function FilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}

function getDeadStockSeverityClasses(severity: DeadStockInsight["severity"]) {
  if (severity === "High") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (severity === "Medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getBatchStatusClasses(status: BatchIntelligenceRow["status"]) {
  switch (status) {
    case "Expired":
      return "border-red-200 bg-red-50 text-red-700";
    case "Expiring Soon":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Sell First":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function getReorderRecommendationClasses(
  recommendation: ReorderSuggestion["recommendation"],
) {
  switch (recommendation) {
    case "Reorder Now":
      return "border-red-200 bg-red-50 text-red-700";
    case "Reorder Soon":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Monitor":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getPriorityClasses(priority: ReorderSuggestion["priority"]) {
  switch (priority) {
    case "Urgent":
      return "border-red-200 bg-red-50 text-red-700";
    case "High":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Medium":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getForecastCoverageClasses(label: ForecastRow["coverageLabel"]) {
  switch (label) {
    case "Stock will run out soon":
      return "border-red-200 bg-red-50 text-red-700";
    case "Stock running low":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function buildInsightsHref(severity: string | null, noSalesOnly: boolean) {
  const params = new URLSearchParams();

  if (severity) {
    params.set("severity", severity);
  }

  if (noSalesOnly) {
    params.set("noSalesOnly", "true");
  }

  const query = params.toString();
  return query ? `/insights?${query}` : "/insights";
}

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDaysOfStockLeft(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${formatDecimal(value)} days`;
}

function buildForecastRow(row: MedicineInsight): ForecastRow {
  const dailySalesAverage = row.recentSales > 0 ? row.recentSales / 30 : 0;
  const predictedDemand7Days = dailySalesAverage * 7;
  const predictedDemand30Days = dailySalesAverage * 30;
  const daysOfStockLeft =
    dailySalesAverage > 0 ? row.currentStock / dailySalesAverage : null;

  let coverageLabel: ForecastRow["coverageLabel"] = "Stock sufficient";

  if (daysOfStockLeft !== null && daysOfStockLeft <= 7) {
    coverageLabel = "Stock will run out soon";
  } else if (daysOfStockLeft !== null && daysOfStockLeft <= 15) {
    coverageLabel = "Stock running low";
  }

  return {
    ...row,
    dailySalesAverage,
    predictedDemand7Days,
    predictedDemand30Days,
    daysOfStockLeft,
    coverageLabel,
  };
}

function getDeadStockInsight(row: MedicineInsight): DeadStockInsight | null {
  if (row.currentStock <= 0) {
    return null;
  }

  if (row.currentStock > 100 && row.recentSales === 0) {
    return {
      ...row,
      severity: "High",
      recommendation: "Avoid reorder",
      noSales: true,
    };
  }

  if (row.currentStock > 30 && row.recentSales <= 5) {
    return {
      ...row,
      severity: "Medium",
      recommendation: row.recentSales === 0 ? "Push sales" : "Review stock",
      noSales: row.recentSales === 0,
    };
  }

  if (row.recentSales === 0) {
    return {
      ...row,
      severity: "Medium",
      recommendation: "Push sales",
      noSales: true,
    };
  }

  if (row.currentStock > row.recentSales * 6 || (row.currentStock >= 10 && row.recentSales <= 3)) {
    return {
      ...row,
      severity: "Low",
      recommendation: "Review stock",
      noSales: false,
    };
  }

  return null;
}

function getBatchIntelligenceRows(records: BatchRecord[]) {
  const activeBatchIdsToSellFirst = new Set<string>();
  const activeBatchesByMedicine = new Map<string, BatchRecord[]>();

  records.forEach((record) => {
    if (record.quantity <= 0) {
      return;
    }

    if (getDaysUntilExpiry(record.expiry_date) < 0) {
      return;
    }

    const currentRecords = activeBatchesByMedicine.get(record.medicine_id) ?? [];
    currentRecords.push(record);
    activeBatchesByMedicine.set(record.medicine_id, currentRecords);
  });

  activeBatchesByMedicine.forEach((batches) => {
    if (batches.length < 2) {
      return;
    }

    const earliestBatch = [...batches].sort((first, second) => {
      const expiryDifference =
        new Date(first.expiry_date).getTime() - new Date(second.expiry_date).getTime();

      if (expiryDifference !== 0) {
        return expiryDifference;
      }

      return first.batch_number.localeCompare(second.batch_number);
    })[0];

    if (earliestBatch) {
      activeBatchIdsToSellFirst.add(earliestBatch.id);
    }
  });

  return records
    .filter((record) => record.quantity > 0)
    .map((record) => {
      const medicine = Array.isArray(record.medicines) ? record.medicines[0] : record.medicines;
      const daysUntilExpiry = getDaysUntilExpiry(record.expiry_date);
      const isSellFirst = activeBatchIdsToSellFirst.has(record.id);

      if (daysUntilExpiry < 0) {
        return {
          id: record.id,
          medicineId: record.medicine_id,
          medicineName: medicine?.name ?? "Unknown medicine",
          batchNumber: record.batch_number,
          quantity: record.quantity,
          expiryDate: record.expiry_date,
          status: "Expired" as const,
          recommendation: "Do not dispense" as const,
          isSellFirst: false,
          daysUntilExpiry,
        };
      }

      if (daysUntilExpiry <= 90) {
        return {
          id: record.id,
          medicineId: record.medicine_id,
          medicineName: medicine?.name ?? "Unknown medicine",
          batchNumber: record.batch_number,
          quantity: record.quantity,
          expiryDate: record.expiry_date,
          status: "Expiring Soon" as const,
          recommendation: isSellFirst ? "Sell this batch first" as const : "Monitor expiry" as const,
          isSellFirst,
          daysUntilExpiry,
        };
      }

      if (isSellFirst) {
        return {
          id: record.id,
          medicineId: record.medicine_id,
          medicineName: medicine?.name ?? "Unknown medicine",
          batchNumber: record.batch_number,
          quantity: record.quantity,
          expiryDate: record.expiry_date,
          status: "Sell First" as const,
          recommendation: "Sell this batch first" as const,
          isSellFirst,
          daysUntilExpiry,
        };
      }

      return {
        id: record.id,
        medicineId: record.medicine_id,
        medicineName: medicine?.name ?? "Unknown medicine",
        batchNumber: record.batch_number,
        quantity: record.quantity,
        expiryDate: record.expiry_date,
        status: "Normal" as const,
        recommendation: "Healthy batch" as const,
        isSellFirst: false,
        daysUntilExpiry,
      };
    })
    .sort((first, second) => {
      const statusWeight = {
        Expired: 4,
        "Expiring Soon": 3,
        "Sell First": 2,
        Normal: 1,
      };
      const statusDifference = statusWeight[second.status] - statusWeight[first.status];

      if (statusDifference !== 0) {
        return statusDifference;
      }

      return new Date(first.expiryDate).getTime() - new Date(second.expiryDate).getTime();
    })
    .slice(0, 12);
}

function getReorderSuggestion(
  row: MedicineInsight,
  deadStockRiskMap: Map<string, DeadStockInsight>,
): ReorderSuggestion | null {
  if (row.currentStock <= 0) {
    return null;
  }

  const forecast = buildForecastRow(row);
  const dailySalesVelocity = forecast.dailySalesAverage;
  const daysOfStockLeft = forecast.daysOfStockLeft;
  const deadStockRisk = deadStockRiskMap.get(row.id);

  if (deadStockRisk || row.recentSales === 0) {
    return {
      ...row,
      dailySalesVelocity,
      predictedDemand7Days: forecast.predictedDemand7Days,
      predictedDemand30Days: forecast.predictedDemand30Days,
      daysOfStockLeft,
      recommendation: "Avoid Reorder",
      priority: "Low",
      suggestedQuantity: 0,
      reason: deadStockRisk
        ? `${deadStockRisk.severity} dead stock risk with ${row.currentStock} units in stock and ${row.recentSales} sold in the last 30 days.`
        : `No recent sales in the last 30 days, so replenishment is not recommended yet.`,
    };
  }

  if (daysOfStockLeft !== null && daysOfStockLeft <= 7) {
    return {
      ...row,
      dailySalesVelocity,
      predictedDemand7Days: forecast.predictedDemand7Days,
      predictedDemand30Days: forecast.predictedDemand30Days,
      daysOfStockLeft,
      recommendation: "Reorder Now",
      priority: "Urgent",
      suggestedQuantity: Math.max(1, Math.ceil(forecast.predictedDemand30Days)),
      reason: `Only ${formatDecimal(daysOfStockLeft)} days of stock left. Forecast demand is ${formatDecimal(
        forecast.predictedDemand7Days,
      )} units over 7 days and ${formatDecimal(forecast.predictedDemand30Days)} over 30 days.`,
    };
  }

  if (daysOfStockLeft !== null && daysOfStockLeft <= 15) {
    return {
      ...row,
      dailySalesVelocity,
      predictedDemand7Days: forecast.predictedDemand7Days,
      predictedDemand30Days: forecast.predictedDemand30Days,
      daysOfStockLeft,
      recommendation: "Reorder Soon",
      priority: "High",
      suggestedQuantity: Math.max(1, Math.ceil(dailySalesVelocity * 21)),
      reason: `About ${formatDecimal(daysOfStockLeft)} days of stock left with forecast demand of ${formatDecimal(
        forecast.predictedDemand30Days,
      )} units over the next 30 days.`,
    };
  }

  if (row.currentStock < 20 || (daysOfStockLeft !== null && daysOfStockLeft <= 30)) {
    return {
      ...row,
      dailySalesVelocity,
      predictedDemand7Days: forecast.predictedDemand7Days,
      predictedDemand30Days: forecast.predictedDemand30Days,
      daysOfStockLeft,
      recommendation: "Monitor",
      priority: "Medium",
      suggestedQuantity: Math.max(1, Math.ceil(forecast.predictedDemand7Days)),
      reason: `Stock is still manageable, but forecast demand is ${formatDecimal(
        forecast.predictedDemand7Days,
      )} units over the next 7 days. Monitor before placing a purchase order.`,
    };
  }

  return null;
}

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const severityFilter =
    resolvedSearchParams.severity === "high" ||
    resolvedSearchParams.severity === "medium" ||
    resolvedSearchParams.severity === "low"
      ? resolvedSearchParams.severity
      : "all";
  const noSalesOnly = resolvedSearchParams.noSalesOnly === "true";

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
    { data: recentSales, error: salesError },
    { data: reorderItems, error: reorderError },
  ] = await Promise.all([
    supabase
      .from("medicines")
      .select("id, name")
      .eq("organization_id", membership.organization_id)
      .order("name", { ascending: true }),
    supabase
      .from("inventory_batches")
      .select("id, medicine_id, batch_number, quantity, expiry_date, medicines(name)")
      .eq("organization_id", membership.organization_id),
    supabase
      .from("sales_records")
      .select("medicine_id, quantity_sold")
      .eq("organization_id", membership.organization_id)
      .gte("sold_at", recentSalesCutoff.toISOString()),
    supabase
      .from("reorder_items")
      .select("medicine_id")
      .eq("organization_id", membership.organization_id)
      .eq("status", "pending"),
  ]);

  const dataError = medicinesError ?? inventoryError ?? salesError ?? reorderError;

  if (dataError) {
    if (isMissingRelationError(reorderError, "reorder_items")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Visibility"
            title="Insights"
            description="Movement-based inventory signals using current stock and the last 30 days of sales activity."
          />
          <SetupNotice
            title="Reorder table not available yet"
            description="Insights can still calculate movement signals, but the reorder action layer depends on the `reorder_items` table. Run the reorder_items SQL in Supabase, reload the schema, and refresh the app."
          />
        </div>
      );
    }

    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load movement insights: ${dataError.message}`
        : "Unable to load movement insights.",
    );
  }

  const stockByMedicine = new Map<string, number>();
  const salesByMedicine = new Map<string, number>();
  const pendingReorderMedicineIds = new Set(
    ((reorderItems ?? []) as ReorderRecord[]).map((item) => item.medicine_id),
  );

  ((inventoryBatches ?? []) as BatchRecord[]).forEach((batch) => {
    stockByMedicine.set(
      batch.medicine_id,
      (stockByMedicine.get(batch.medicine_id) ?? 0) + batch.quantity,
    );
  });

  ((recentSales ?? []) as SalesRecord[]).forEach((sale) => {
    salesByMedicine.set(
      sale.medicine_id,
      (salesByMedicine.get(sale.medicine_id) ?? 0) + sale.quantity_sold,
    );
  });

  const insights = ((medicines ?? []) as MedicineRecord[]).map((medicine) => ({
    id: medicine.id,
    medicineName: medicine.name,
    currentStock: stockByMedicine.get(medicine.id) ?? 0,
    recentSales: salesByMedicine.get(medicine.id) ?? 0,
  }));

  const medicinesWithStock = insights.filter((row) => row.currentStock > 0);

  const fastMoving = [...insights]
    .filter((row) => row.recentSales > 0)
    .sort((a, b) => b.recentSales - a.recentSales)
    .slice(0, 5);

  const slowMoving = [...medicinesWithStock]
    .filter((row) => row.recentSales > 0 && row.recentSales <= 5)
    .sort((a, b) => a.recentSales - b.recentSales || b.currentStock - a.currentStock)
    .slice(0, 8);

  const deadStockRisk = medicinesWithStock
    .map(getDeadStockInsight)
    .filter((row): row is DeadStockInsight => Boolean(row))
    .sort((a, b) => {
      const severityWeight = { High: 3, Medium: 2, Low: 1 };
      const severityDifference = severityWeight[b.severity] - severityWeight[a.severity];

      if (severityDifference !== 0) {
        return severityDifference;
      }

      if (a.recentSales !== b.recentSales) {
        return a.recentSales - b.recentSales;
      }

      return b.currentStock - a.currentStock;
    });

  const deadStockRiskMap = new Map(deadStockRisk.map((row) => [row.id, row]));

  const filteredDeadStockRisk = deadStockRisk.filter((row) => {
    if (noSalesOnly && !row.noSales) {
      return false;
    }

    if (severityFilter === "all") {
      return true;
    }

    return row.severity.toLowerCase() === severityFilter;
  });

  const batchIntelligenceRows = getBatchIntelligenceRows((inventoryBatches ?? []) as BatchRecord[]);
  const urgentBatchCount = batchIntelligenceRows.filter(
    (row) => row.status === "Expired" || row.status === "Expiring Soon" || row.status === "Sell First",
  ).length;

  const forecastRows = medicinesWithStock
    .map(buildForecastRow)
    .sort((a, b) => {
      const coverageWeight = {
        "Stock will run out soon": 3,
        "Stock running low": 2,
        "Stock sufficient": 1,
      };
      const coverageDifference =
        coverageWeight[b.coverageLabel] - coverageWeight[a.coverageLabel];

      if (coverageDifference !== 0) {
        return coverageDifference;
      }

      if (a.daysOfStockLeft === null && b.daysOfStockLeft !== null) {
        return 1;
      }

      if (a.daysOfStockLeft !== null && b.daysOfStockLeft === null) {
        return -1;
      }

      if (a.daysOfStockLeft !== null && b.daysOfStockLeft !== null) {
        return a.daysOfStockLeft - b.daysOfStockLeft;
      }

      return b.predictedDemand30Days - a.predictedDemand30Days;
    })
    .slice(0, 12);

  const reorderSuggestions = medicinesWithStock
    .map((row) => getReorderSuggestion(row, deadStockRiskMap))
    .filter((row): row is ReorderSuggestion => Boolean(row))
    .sort((a, b) => {
      const priorityWeight = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
      const priorityDifference = priorityWeight[b.priority] - priorityWeight[a.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      if (a.daysOfStockLeft === null && b.daysOfStockLeft !== null) {
        return 1;
      }

      if (a.daysOfStockLeft !== null && b.daysOfStockLeft === null) {
        return -1;
      }

      if (a.daysOfStockLeft !== null && b.daysOfStockLeft !== null && a.daysOfStockLeft !== b.daysOfStockLeft) {
        return a.daysOfStockLeft - b.daysOfStockLeft;
      }

      return b.recentSales - a.recentSales;
    })
    .slice(0, 10);

  const urgentReorderCount = reorderSuggestions.filter(
    (row) => row.recommendation === "Reorder Now",
  ).length;
  const reorderSoonCount = reorderSuggestions.filter(
    (row) => row.recommendation === "Reorder Soon",
  ).length;
  const avoidReorderCount = reorderSuggestions.filter(
    (row) => row.recommendation === "Avoid Reorder",
  ).length;
  const stockRunOutSoonCount = forecastRows.filter(
    (row) => row.coverageLabel === "Stock will run out soon",
  ).length;
  const stockRunningLowCount = forecastRows.filter(
    (row) => row.coverageLabel === "Stock running low",
  ).length;

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Visibility"
        title="Insights"
        description="Movement-based inventory signals using current stock, batch expiry, and the last 30 days of sales activity."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Fast-Moving Medicines" value={fastMoving.length} />
        <SummaryCard label="Dead Stock Risk" value={deadStockRisk.length} />
        <SummaryCard label="Urgent Batches" value={urgentBatchCount} />
        <SummaryCard label="Urgent Reorders" value={urgentReorderCount} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Reorder Soon" value={reorderSoonCount} />
        <SummaryCard label="Avoid Reorder" value={avoidReorderCount} />
        <SummaryCard label="Active Suggestions" value={reorderSuggestions.length} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard label="Forecast Runout Soon" value={stockRunOutSoonCount} />
        <SummaryCard label="Forecast Running Low" value={stockRunningLowCount} />
        <SummaryCard label="Forecast Rows" value={forecastRows.length} />
      </div>

      <InsightSection
        title="Demand forecast"
        description="Simple demand forecasting from the last 30 days of sales, with stock coverage labels to guide replenishment decisions."
        emptyText="No forecast rows are available yet."
      >
        {forecastRows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Medicine</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Current Stock</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Daily Sales Avg</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Predicted 7-Day Demand</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Predicted 30-Day Demand</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Days of Stock Left</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Forecast Status</th>
                </tr>
              </thead>
              <tbody>
                {forecastRows.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                      {row.medicineName}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.currentStock}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {formatDecimal(row.dailySalesAverage)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {formatDecimal(row.predictedDemand7Days)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {formatDecimal(row.predictedDemand30Days)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {formatDaysOfStockLeft(row.daysOfStockLeft)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getForecastCoverageClasses(
                          row.coverageLabel,
                        )}`}
                      >
                        {row.coverageLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </InsightSection>

      <InsightSection
        title="Fast-moving medicines"
        description="Top-selling medicines by total quantity sold in the last 30 days."
        emptyText="No recent sales data is available yet for fast-moving insights."
      >
        {fastMoving.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Medicine</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Quantity Sold (30d)</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {fastMoving.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                      {row.medicineName}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.recentSales}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <ReorderButton
                        medicineId={row.id}
                        reason={`High demand: strong sales in last 30 days (${row.recentSales} units)`}
                        existingPending={pendingReorderMedicineIds.has(row.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </InsightSection>

      <InsightSection
        title="Slow-moving medicines"
        description="Medicines with stock on hand but very low sales in the last 30 days."
        emptyText="No slow-moving medicines detected right now."
      >
        {slowMoving.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Medicine</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Quantity Sold (30d)</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Current Stock</th>
                </tr>
              </thead>
              <tbody>
                {slowMoving.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                      {row.medicineName}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.recentSales}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.currentStock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </InsightSection>

      <InsightSection
        title="Batch intelligence"
        description="Expiry-focused batch guidance to help your team sell the right batch first and spot urgent stock quickly."
        emptyText="No active batches are available for batch intelligence yet."
      >
        {batchIntelligenceRows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Medicine</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Batch</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Quantity</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Expiry Date</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Status</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {batchIntelligenceRows.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                      {row.medicineName}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.batchNumber}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.quantity}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {formatDate(row.expiryDate)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getBatchStatusClasses(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.recommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </InsightSection>

      <InsightSection
        title="Dead stock risk"
        description="Medicines with stock remaining and weak movement in the last 30 days, now grouped with clearer severity signals."
        emptyText="No dead stock risk is currently flagged."
      >
        {deadStockRisk.length ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <FilterLink
                label="All severities"
                href={buildInsightsHref(null, noSalesOnly)}
                active={severityFilter === "all"}
              />
              <FilterLink
                label="High"
                href={buildInsightsHref("high", noSalesOnly)}
                active={severityFilter === "high"}
              />
              <FilterLink
                label="Medium"
                href={buildInsightsHref("medium", noSalesOnly)}
                active={severityFilter === "medium"}
              />
              <FilterLink
                label="Low"
                href={buildInsightsHref("low", noSalesOnly)}
                active={severityFilter === "low"}
              />
              <FilterLink
                label="No-sales only"
                href={buildInsightsHref(
                  severityFilter === "all" ? null : severityFilter,
                  !noSalesOnly,
                )}
                active={noSalesOnly}
              />
            </div>

            {filteredDeadStockRisk.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="border-b border-slate-200 px-3 py-3 font-medium">Medicine</th>
                      <th className="border-b border-slate-200 px-3 py-3 font-medium">Current Stock</th>
                      <th className="border-b border-slate-200 px-3 py-3 font-medium">Recent Sales (30d)</th>
                      <th className="border-b border-slate-200 px-3 py-3 font-medium">Severity</th>
                      <th className="border-b border-slate-200 px-3 py-3 font-medium">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeadStockRisk.map((row) => (
                      <tr key={row.id}>
                        <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                          {row.medicineName}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {row.currentStock}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {row.recentSales}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getDeadStockSeverityClasses(row.severity)}`}
                          >
                            {row.severity}
                          </span>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {row.recommendation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                No medicines match the current dead stock filters.
              </div>
            )}
          </div>
        ) : null}
      </InsightSection>

      <InsightSection
        title="Reorder suggestions"
        description="Smarter reorder guidance using stock cover, sales velocity, and dead stock signals from the last 30 days."
        emptyText="No reorder suggestions are needed right now."
      >
        {reorderSuggestions.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Medicine</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Current Stock</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Recent Sales (30d)</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Daily Sales Velocity</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Predicted 7-Day Demand</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Predicted 30-Day Demand</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Days of Stock Left</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Recommendation</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Suggested Quantity</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Priority</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {reorderSuggestions.map((row) => (
                  <tr key={row.id}>
                    <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                      <div className="space-y-1">
                        <p>{row.medicineName}</p>
                        <p className="text-xs text-slate-500">{row.reason}</p>
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.currentStock}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.recentSales}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {formatDecimal(row.dailySalesVelocity)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {formatDecimal(row.predictedDemand7Days)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {formatDecimal(row.predictedDemand30Days)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {formatDaysOfStockLeft(row.daysOfStockLeft)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getReorderRecommendationClasses(row.recommendation)}`}
                      >
                        {row.recommendation}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.suggestedQuantity > 0 ? row.suggestedQuantity : "—"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getPriorityClasses(row.priority)}`}
                      >
                        {row.priority}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      {row.recommendation === "Avoid Reorder" ? (
                        <span className="text-xs font-medium text-slate-500">No action recommended</span>
                      ) : (
                        <ReorderButton
                          medicineId={row.id}
                          reason={`${row.recommendation}: ${row.reason}`}
                          existingPending={pendingReorderMedicineIds.has(row.id)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </InsightSection>
    </div>
  );
}
