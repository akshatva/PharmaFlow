import Link from "next/link";
import { redirect } from "next/navigation";

import { SectionIntro } from "@/components/layout/section-intro";
import { ExportButton } from "@/components/reports/export-button";
import { InsightWorkflowForm } from "@/components/insights/insight-workflow-form";
import { SetupNotice } from "@/components/layout/setup-notice";
import { ReorderButton } from "@/components/reorders/reorder-button";
import {
  getInsightWorkflowKey,
  getInsightWorkflowStatusLabel,
  getLocalDemandSignals,
  type InsightWorkflowStatus,
  type InsightWorkflowType,
} from "@/services/insights";
import {
  REORDER_TRANSPARENCY_COPY,
  isDemandCategory,
  getRulesBasedReorderDecision,
} from "@/services/inventory";
import {
  formatWeatherLocationInput,
  getLocalWeatherSnapshot,
  getMissingWeatherLocationFields,
} from "@/services/weather";
import { isMissingColumnError, isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InsightsPageProps = {
  searchParams?: Promise<{
    severity?: string;
    noSalesOnly?: string;
    workflow?: string;
  }>;
};

type MedicineRecord = {
  id: string;
  name: string;
  demand_category: string | null;
};

type BatchRecord = {
  id: string;
  medicine_id: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
  purchase_price: number | null;
  last_imported_at: string | null;
  medicines:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "No CSV import refresh recorded yet";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

type SalesRecord = {
  medicine_id: string;
  quantity_sold: number;
};

type ReorderRecord = {
  medicine_id: string;
};

type InsightWorkflowRecord = {
  insight_key: string;
  insight_type: InsightWorkflowType;
  medicine_id: string | null;
  inventory_batch_id: string | null;
  status: Exclude<InsightWorkflowStatus, "open">;
};

type MedicineInsight = {
  id: string;
  medicineName: string;
  currentStock: number;
  recentSales: number;
  demandCategory: string | null;
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
  averageDailySales30d: number | null;
  baseAverageDailySales30d: number | null;
  adjustedAverageDailySales30d: number | null;
  daysOfStockLeft: number | null;
  status: "Ready" | "Not enough recent sales data";
  recommendation: "Reorder Now" | "Reorder Soon" | "Monitor" | "Avoid Reorder";
  priority: "Urgent" | "High" | "Medium" | "Low";
  recommendedReorderQuantity: number | null;
  baseRecommendedReorderQuantity: number | null;
  reason: string;
  confidenceNote: string;
  actionable: boolean;
  demandSignalAdjusted: boolean;
  appliedDemandSignalUpliftPercentage: number | null;
  demandSignalTitle: string | null;
  demandSignalExplanation: string | null;
};

type ForecastRow = MedicineInsight & {
  dailySalesAverage: number;
  predictedDemand7Days: number;
  predictedDemand30Days: number;
  daysOfStockLeft: number | null;
  coverageLabel: "Stock sufficient" | "Stock running low" | "Stock will run out soon";
};

type InsightWorkflowItem = {
  key: string;
  insightType: InsightWorkflowType;
  workflowStatus: InsightWorkflowStatus;
  medicineId: string | null;
  inventoryBatchId: string | null;
  medicineName: string;
  title: string;
  summary: string;
};

type PriorityItem = {
  key: string;
  insightType: "stockout_risk" | "expiry_risk" | "reorder_suggestion";
  workflowStatus: InsightWorkflowStatus;
  medicineId: string | null;
  inventoryBatchId: string | null;
  medicineName: string;
  issueTypeLabel: string;
  urgencyLabel: string;
  reason: string;
  severity: "Critical" | "Warning" | "Safe";
  sortOrder: number;
};

function SummaryCard({
  label,
  value,
  helperText,
}: {
  label: string;
  value: number | string;
  helperText?: string;
}) {
  return (
    <div className="app-stat-card">
      <p className="app-stat-eyebrow">{label}</p>
      <p className="app-stat-value">{value}</p>
      {helperText ? (
        <p className="mt-1.5 text-xs leading-5 text-slate-400">{helperText}</p>
      ) : null}
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
    <section className="app-card">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {hasContent ? (
          <div>{children}</div>
        ) : (
          <div className="app-empty-state">
            {emptyText}
          </div>
        )}
      </div>
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
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
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

function getReorderStatusClasses(status: ReorderSuggestion["status"]) {
  if (status === "Not enough recent sales data") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
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

function getWorkflowStatusClasses(status: InsightWorkflowStatus) {
  switch (status) {
    case "reviewed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "needs_reorder":
      return "border-red-200 bg-red-50 text-red-700";
    case "monitor":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function getSeverityClasses(severity: PriorityItem["severity"]) {
  switch (severity) {
    case "Critical":
      return "border-red-200 bg-red-50 text-red-700";
    case "Warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function buildWorkflowInsightsHref({
  severity,
  noSalesOnly,
  workflow,
}: {
  severity: string | null;
  noSalesOnly: boolean;
  workflow: "all" | InsightWorkflowStatus;
}) {
  const params = new URLSearchParams();

  if (severity) {
    params.set("severity", severity);
  }

  if (noSalesOnly) {
    params.set("noSalesOnly", "true");
  }

  if (workflow !== "all") {
    params.set("workflow", workflow);
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
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

function getReorderSuggestion({
  row,
  activeSignalsByCategory,
}: {
  row: MedicineInsight;
  activeSignalsByCategory: Map<string, ReturnType<typeof getLocalDemandSignals>[number]>;
}): ReorderSuggestion | null {
  if (row.currentStock <= 0 && row.recentSales <= 0) {
    return null;
  }

  const demandSignal =
    row.demandCategory && isDemandCategory(row.demandCategory)
      ? activeSignalsByCategory.get(row.demandCategory) ?? null
      : null;

  const decision = getRulesBasedReorderDecision({
    currentStock: row.currentStock,
    recentSales30d: row.recentSales,
    demandSignal: demandSignal
      ? {
          title: demandSignal.title,
          upliftPercentage: demandSignal.upliftPercentage,
          explanation: demandSignal.explanation,
          category: demandSignal.category,
        }
      : null,
  });

  return {
    ...row,
    averageDailySales30d: decision.averageDailySales30d,
    baseAverageDailySales30d: decision.baseAverageDailySales30d,
    adjustedAverageDailySales30d: decision.adjustedAverageDailySales30d,
    daysOfStockLeft: decision.daysOfStockLeft,
    status:
      decision.availability === "available" ? "Ready" : "Not enough recent sales data",
    recommendation: decision.recommendation,
    priority: decision.priority,
    recommendedReorderQuantity: decision.recommendedReorderQuantity,
    baseRecommendedReorderQuantity: decision.baseRecommendedReorderQuantity,
    reason: decision.explainabilityNote,
    confidenceNote: decision.confidenceNote,
    actionable:
      decision.availability === "available" &&
      (decision.recommendedReorderQuantity ?? 0) > 0 &&
      decision.recommendation !== "Avoid Reorder",
    demandSignalAdjusted: decision.demandSignalAdjusted,
    appliedDemandSignalUpliftPercentage: decision.appliedDemandSignalUpliftPercentage,
    demandSignalTitle: decision.demandSignalTitle,
    demandSignalExplanation: decision.demandSignalExplanation,
  };
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
  const workflowFilter =
    resolvedSearchParams.workflow === "open" ||
    resolvedSearchParams.workflow === "reviewed" ||
    resolvedSearchParams.workflow === "needs_reorder" ||
    resolvedSearchParams.workflow === "monitor"
      ? resolvedSearchParams.workflow
      : "all";

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
    organizationQuery,
    { data: medicines, error: medicinesError },
    inventoryQuery,
    { data: recentSales, error: salesError },
    { data: reorderItems, error: reorderError },
    { data: workflowItems, error: workflowError },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("city, state, country")
      .eq("id", membership.organization_id)
      .maybeSingle(),
    supabase
      .from("medicines")
      .select("id, name, demand_category")
      .eq("organization_id", membership.organization_id)
      .order("name", { ascending: true }),
    supabase
      .from("inventory_batches")
      .select(
        "id, medicine_id, batch_number, quantity, expiry_date, purchase_price, last_imported_at, medicines(name)",
      )
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
    supabase
      .from("insight_workflow_items")
      .select("insight_key, insight_type, medicine_id, inventory_batch_id, status")
      .eq("organization_id", membership.organization_id),
  ]);

  let inventoryBatches = inventoryQuery.data as BatchRecord[] | null;
  let inventoryError = inventoryQuery.error;
  let medicineRows = (medicines ?? []) as MedicineRecord[];
  let medicineError = medicinesError;
  let organization = organizationQuery.data;
  let organizationError = organizationQuery.error;

  if (isMissingColumnError(inventoryQuery.error, "last_imported_at")) {
    const fallbackInventoryQuery = await supabase
      .from("inventory_batches")
      .select(
        "id, medicine_id, batch_number, quantity, expiry_date, purchase_price, medicines(name)",
      )
      .eq("organization_id", membership.organization_id);

    inventoryBatches = ((fallbackInventoryQuery.data ?? []) as BatchRecord[]).map((batch) => ({
      ...batch,
      last_imported_at: null,
    }));
    inventoryError = fallbackInventoryQuery.error;
  }

  if (isMissingColumnError(medicinesError, "demand_category")) {
    const fallbackMedicinesQuery = await supabase
      .from("medicines")
      .select("id, name")
      .eq("organization_id", membership.organization_id)
      .order("name", { ascending: true });

    medicineRows = ((fallbackMedicinesQuery.data ?? []) as Array<{ id: string; name: string }>).map(
      (medicine) => ({
        ...medicine,
        demand_category: null,
      }),
    );
    medicineError = fallbackMedicinesQuery.error;
  }

  if (
    isMissingColumnError(organizationQuery.error, "city") ||
    isMissingColumnError(organizationQuery.error, "state") ||
    isMissingColumnError(organizationQuery.error, "country")
  ) {
    organization = null;
    organizationError = null;
  }

  const dataError =
    medicineError ?? inventoryError ?? salesError ?? reorderError ?? workflowError ?? organizationError;

  if (dataError) {
    if (isMissingRelationError(workflowError, "insight_workflow_items")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Visibility"
            title="Insights"
            description="Movement-based inventory signals using current stock and the last 30 days of sales activity."
          />
          <SetupNotice
            title="Insight workflow setup is missing"
            description="The `insight_workflow_items` table is missing in your connected Supabase project. Run the workflow SQL migration, reload the schema, and refresh the app."
          />
        </div>
      );
    }

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
  const workflowStatusByKey = new Map<string, InsightWorkflowStatus>(
    ((workflowItems ?? []) as InsightWorkflowRecord[]).map((item) => [item.insight_key, item.status]),
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

  const insights = medicineRows.map((medicine) => ({
    id: medicine.id,
    medicineName: medicine.name,
    currentStock: stockByMedicine.get(medicine.id) ?? 0,
    recentSales: salesByMedicine.get(medicine.id) ?? 0,
    demandCategory: medicine.demand_category,
  }));
  const localWeather = await getLocalWeatherSnapshot(organization ?? undefined);
  const localDemandSignals = getLocalDemandSignals({
    location: organization ?? undefined,
    weather: localWeather,
    availableCategories: medicineRows
      .map((medicine) => medicine.demand_category ?? "")
      .filter(Boolean),
  });
  const activeSignalsByCategory = new Map(
    localDemandSignals.map((signal) => [signal.category, signal]),
  );
  const missingLocationFields = getMissingWeatherLocationFields(organization ?? undefined);
  const hasRequiredWeatherLocation = missingLocationFields.length === 0;
  const weatherAwareSignals = localDemandSignals.filter(
    (signal) => signal.source === "weather" || signal.source === "seasonal_weather",
  );
  const weatherStatus = !hasRequiredWeatherLocation
    ? "missing_location"
    : !localWeather
      ? "weather_unavailable"
      : weatherAwareSignals.length
        ? "live_active"
        : "live_non_triggering";
  const fallbackUsed = !localWeather || weatherAwareSignals.length === 0;
  const weatherStatusMessage =
    weatherStatus === "missing_location"
      ? `Live weather is inactive because the organization is missing ${missingLocationFields.join(", ")}. Seasonal fallback is active.`
      : weatherStatus === "weather_unavailable"
        ? `Live weather could not be loaded for ${formatWeatherLocationInput(organization ?? undefined)}. Seasonal fallback is active.`
        : weatherStatus === "live_non_triggering"
          ? `Live weather is available for ${localWeather?.locationName}, but no weather-specific rules are active right now. Seasonal signals are shown where relevant.`
          : `Live weather is active for ${localWeather?.locationName}. Weather-aware demand signals are included below.`;

  const medicinesWithStock = insights.filter((row) => row.currentStock > 0);

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

  const batchIntelligenceRows = getBatchIntelligenceRows((inventoryBatches ?? []) as BatchRecord[]);
  const latestInventoryImportAt = ((inventoryBatches ?? []) as BatchRecord[]).reduce<string | null>(
    (latest, batch) => {
      if (!batch.last_imported_at) {
        return latest;
      }

      if (!latest) {
        return batch.last_imported_at;
      }

      return new Date(batch.last_imported_at).getTime() > new Date(latest).getTime()
        ? batch.last_imported_at
        : latest;
    },
    null,
  );
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

  const reorderSuggestions = insights
    .map((row) =>
      getReorderSuggestion({
        row,
        activeSignalsByCategory,
      }),
    )
    .filter((row): row is ReorderSuggestion => Boolean(row))
    .sort((a, b) => {
      const priorityWeight = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
      const priorityDifference = priorityWeight[b.priority] - priorityWeight[a.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      if (a.actionable !== b.actionable) {
        return a.actionable ? -1 : 1;
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

  const stockRunOutSoonCount = forecastRows.filter(
    (row) => row.coverageLabel === "Stock will run out soon",
  ).length;
  const atRiskBatchIds = new Set(
    batchIntelligenceRows
      .filter((row) => row.status === "Expired" || row.status === "Expiring Soon")
      .map((row) => row.id),
  );
  const slowMovingMedicineIds = new Set(deadStockRisk.map((row) => row.id));
  const atRiskInventoryValue = ((inventoryBatches ?? []) as BatchRecord[]).reduce((sum, batch) => {
    const isNearExpiry = atRiskBatchIds.has(batch.id);
    const isSlowMoving = slowMovingMedicineIds.has(batch.medicine_id);

    if (
      batch.quantity <= 0 ||
      batch.purchase_price === null ||
      (!isNearExpiry && !isSlowMoving)
    ) {
      return sum;
    }

    return sum + batch.quantity * batch.purchase_price;
  }, 0);
  const reorderRecommendationCount = reorderSuggestions.filter(
    (row) => row.actionable && (row.recommendedReorderQuantity ?? 0) > 0,
  ).length;
  const stockoutRiskRows = forecastRows
    .filter((row) => row.coverageLabel !== "Stock sufficient")
    .slice(0, 12);
  const nearExpiryRows = batchIntelligenceRows
    .filter((row) => row.status !== "Normal")
    .slice(0, 12);

  const priorityItems: PriorityItem[] = [];

  stockoutRiskRows.forEach((row) => {
    const key = getInsightWorkflowKey({
      insightType: "stockout_risk",
      medicineId: row.id,
    });

    priorityItems.push({
      key,
      insightType: "stockout_risk",
      workflowStatus: workflowStatusByKey.get(key) ?? "open",
      medicineId: row.id,
      inventoryBatchId: null,
      medicineName: row.medicineName,
      issueTypeLabel: "Stockout risk",
      urgencyLabel:
        row.daysOfStockLeft === null
          ? "Stock cover unavailable"
          : `Runs out in ${formatDaysOfStockLeft(row.daysOfStockLeft)}`,
      reason: `Stock will run out in ${formatDaysOfStockLeft(row.daysOfStockLeft)} at the recent sales pace.`,
      severity: row.coverageLabel === "Stock will run out soon" ? "Critical" : "Warning",
      sortOrder: row.daysOfStockLeft ?? 999,
    });
  });

  nearExpiryRows.forEach((row) => {
    const key = getInsightWorkflowKey({
      insightType: "expiry_risk",
      inventoryBatchId: row.id,
    });

    priorityItems.push({
      key,
      insightType: "expiry_risk",
      workflowStatus: workflowStatusByKey.get(key) ?? "open",
      medicineId: row.medicineId,
      inventoryBatchId: row.id,
      medicineName: row.medicineName,
      issueTypeLabel: "Expiry risk",
      urgencyLabel:
        row.daysUntilExpiry < 0
          ? "Expired"
          : `Expires in ${row.daysUntilExpiry} day${row.daysUntilExpiry === 1 ? "" : "s"}`,
      reason:
        row.daysUntilExpiry < 0
          ? `Expired batch ${row.batchNumber} still has ${row.quantity} units remaining.`
          : `Expires in ${row.daysUntilExpiry} days with ${row.quantity} units remaining.`,
      severity: row.daysUntilExpiry < 0 || row.status === "Expiring Soon" ? "Critical" : "Warning",
      sortOrder: row.daysUntilExpiry < 0 ? -1000 : row.daysUntilExpiry,
    });
  });

  reorderSuggestions
    .filter((row) => row.actionable)
    .forEach((row) => {
      const key = getInsightWorkflowKey({
        insightType: "reorder_suggestion",
        medicineId: row.id,
      });

      priorityItems.push({
        key,
        insightType: "reorder_suggestion",
        workflowStatus: workflowStatusByKey.get(key) ?? "open",
        medicineId: row.id,
        inventoryBatchId: null,
        medicineName: row.medicineName,
        issueTypeLabel: "Reorder suggestion",
        urgencyLabel:
          row.daysOfStockLeft === null
            ? "Review now"
            : `Cover left: ${formatDaysOfStockLeft(row.daysOfStockLeft)}`,
        reason:
          row.recommendedReorderQuantity === null
            ? row.reason
            : `${row.reason} Suggested reorder: ${row.recommendedReorderQuantity} units.`,
        severity: row.recommendation === "Reorder Now" ? "Critical" : "Warning",
        sortOrder: row.daysOfStockLeft ?? 999,
      });
    });

  const workflowCounts = {
    open: priorityItems.filter((item) => item.workflowStatus === "open").length,
    reviewed: priorityItems.filter((item) => item.workflowStatus === "reviewed").length,
    needs_reorder: priorityItems.filter((item) => item.workflowStatus === "needs_reorder").length,
    monitor: priorityItems.filter((item) => item.workflowStatus === "monitor").length,
  };
  const actionableInsightCount = workflowCounts.open;
  const filteredPriorityItems = priorityItems
    .filter((item) => {
      if (workflowFilter === "all") {
        return true;
      }

      return item.workflowStatus === workflowFilter;
    })
    .sort((first, second) => {
      if (first.workflowStatus === "open" && second.workflowStatus !== "open") {
        return -1;
      }

      if (first.workflowStatus !== "open" && second.workflowStatus === "open") {
        return 1;
      }

      return first.sortOrder - second.sortOrder;
    })
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Visibility"
        title="Insights"
        description="Movement-based inventory signals using current stock, batch expiry, and the last 30 days of sales activity."
      />
      <div className="flex flex-wrap items-center gap-3">
        <ExportButton href="/api/exports/low-stock" label="Export Low Stock Report" />
        <ExportButton href="/api/exports/expiry" label="Export Expiry Report" />
      </div>
      <div className="app-panel-info">
        Inventory data last updated on{" "}
        <span className="font-medium">{formatDateTime(latestInventoryImportAt)}</span>.
        Sales-based insights and reorder signals are based on the last 30 days of sales.
      </div>

      <InsightSection
        title="Local demand signals"
        description="Simple demand indicators based on the current month, your pharmacy location, live weather when available, and medicine demand categories."
        emptyText="No active local demand signals are available for your current medicine categories this month."
      >
        <div className="space-y-4">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              weatherStatus === "live_active"
                ? "border-blue-200 bg-blue-50 text-blue-800"
                : weatherStatus === "live_non_triggering"
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {weatherStatusMessage}
          </div>
          {localWeather ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Live weather context
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {localWeather.summary} in {localWeather.locationName}
              </p>
            </div>
          ) : null}
          {process.env.NODE_ENV === "development" ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Weather debug
              </p>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <p>Org location used: {formatWeatherLocationInput(organization ?? undefined)}</p>
                <p>
                  Missing required fields:{" "}
                  {missingLocationFields.length ? missingLocationFields.join(", ") : "none"}
                </p>
                <p>Weather status: {weatherStatus}</p>
                <p>Fallback used: {fallbackUsed ? "yes" : "no"}</p>
                <p>
                  Resolved weather location: {localWeather?.locationName ?? "not resolved"}
                </p>
                <p>Weather snapshot: {localWeather?.summary ?? "not available"}</p>
                <p>
                  Triggered weather rules:{" "}
                  {weatherAwareSignals.length
                    ? weatherAwareSignals.map((signal) => signal.categoryLabel).join(", ")
                    : "none"}
                </p>
              </div>
            </div>
          ) : null}
          {localDemandSignals.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {localDemandSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{signal.title}</p>
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      +{signal.upliftPercentage}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    {signal.categoryLabel}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{signal.explanation}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="app-empty-state">
              No active local demand signals are available for your current medicine categories this month.
            </div>
          )}
        </div>
      </InsightSection>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="At-Risk Value"
          value={formatCurrency(atRiskInventoryValue)}
          helperText="Near-expiry or slow-moving stock, by purchase price."
        />
        <SummaryCard
          label="Stockout Risk"
          value={stockRunOutSoonCount}
          helperText="Medicines likely to run out soon."
        />
        <SummaryCard
          label="Reorder Needed"
          value={reorderRecommendationCount}
          helperText="Positive reorder quantity items."
        />
        <SummaryCard
          label="Needs Attention"
          value={actionableInsightCount}
          helperText="Open workflow items."
        />
        <SummaryCard
          label="Last Updated"
          value={formatDateTime(latestInventoryImportAt)}
          helperText="Latest CSV import refresh."
        />
      </div>

      <InsightSection
        title="Needs attention"
        description="Top priority items are sorted by urgency so your team can move through the most important stockout, expiry, and reorder issues first."
        emptyText="No priority items are currently available."
      >
        {priorityItems.length ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Open Items" value={workflowCounts.open} />
              <SummaryCard label="Reviewed Items" value={workflowCounts.reviewed} />
              <SummaryCard label="Needs Reorder" value={workflowCounts.needs_reorder} />
              <SummaryCard label="Monitor Items" value={workflowCounts.monitor} />
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterLink
                label="All items"
                href={buildWorkflowInsightsHref({
                  severity: severityFilter === "all" ? null : severityFilter,
                  noSalesOnly,
                  workflow: "all",
                })}
                active={workflowFilter === "all"}
              />
              <FilterLink
                label="Open"
                href={buildWorkflowInsightsHref({
                  severity: severityFilter === "all" ? null : severityFilter,
                  noSalesOnly,
                  workflow: "open",
                })}
                active={workflowFilter === "open"}
              />
              <FilterLink
                label="Reviewed"
                href={buildWorkflowInsightsHref({
                  severity: severityFilter === "all" ? null : severityFilter,
                  noSalesOnly,
                  workflow: "reviewed",
                })}
                active={workflowFilter === "reviewed"}
              />
              <FilterLink
                label="Needs reorder"
                href={buildWorkflowInsightsHref({
                  severity: severityFilter === "all" ? null : severityFilter,
                  noSalesOnly,
                  workflow: "needs_reorder",
                })}
                active={workflowFilter === "needs_reorder"}
              />
              <FilterLink
                label="Monitor"
                href={buildWorkflowInsightsHref({
                  severity: severityFilter === "all" ? null : severityFilter,
                  noSalesOnly,
                  workflow: "monitor",
                })}
                active={workflowFilter === "monitor"}
              />
            </div>

            {filteredPriorityItems.length ? (
              <div className="space-y-3">
                {filteredPriorityItems.map((item) => (
                  <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className={`app-badge ${getSeverityClasses(
                              item.severity,
                            )}`}
                          >
                            {item.severity}
                          </span>
                          <span className="app-badge border-slate-200 bg-slate-50 text-slate-600">
                            {item.issueTypeLabel}
                          </span>
                          <span
                            className={`app-badge ${getWorkflowStatusClasses(
                              item.workflowStatus,
                            )}`}
                          >
                            {getInsightWorkflowStatusLabel(item.workflowStatus)}
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.medicineName}</p>
                          <p className="mt-0.5 text-xs font-medium text-slate-600">{item.urgencyLabel}</p>
                          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{item.reason}</p>
                        </div>
                      </div>

                      <div className="w-full lg:w-auto">
                        <InsightWorkflowForm
                          insightKey={item.key}
                          insightType={item.insightType}
                          initialStatus={item.workflowStatus}
                          medicineId={item.medicineId}
                          inventoryBatchId={item.inventoryBatchId}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="app-empty-state">
                No priority items match the current workflow filter.
              </div>
            )}
          </div>
        ) : null}
      </InsightSection>

      <InsightSection
        title="Stockout risk"
        description="Medicines most likely to run short soon, sorted by the lowest remaining days of cover."
        emptyText="No stockout risk items are currently flagged."
      >
        {stockoutRiskRows.length ? (
          <div className="app-table-shell">
            <div className="overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Current Stock</th>
                  <th>Avg Daily Sales</th>
                  <th>Days of Stock Left</th>
                  <th>Priority</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {stockoutRiskRows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium text-slate-900">
                      {row.medicineName}
                    </td>
                    <td>
                      {row.currentStock}
                    </td>
                    <td>
                      {formatDecimal(row.dailySalesAverage)}
                    </td>
                    <td>
                      {formatDaysOfStockLeft(row.daysOfStockLeft)}
                    </td>
                    <td>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getForecastCoverageClasses(
                          row.coverageLabel,
                        )}`}
                      >
                        {row.coverageLabel}
                      </span>
                    </td>
                    <td>
                      {`Stock will run out in ${formatDaysOfStockLeft(row.daysOfStockLeft)}.`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ) : null}
      </InsightSection>

      <InsightSection
        title="Near expiry"
        description="Batches with the shortest expiry horizon, including expired stock and batches that should be moved first."
        emptyText="No near-expiry items are currently flagged."
      >
        {nearExpiryRows.length ? (
          <div className="app-table-shell">
            <div className="overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch</th>
                  <th>Quantity</th>
                  <th>Expiry Date</th>
                  <th>Priority</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {nearExpiryRows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium text-slate-900">
                      {row.medicineName}
                    </td>
                    <td>
                      {row.batchNumber}
                    </td>
                    <td>
                      {row.quantity}
                    </td>
                    <td>
                      {formatDate(row.expiryDate)}
                    </td>
                    <td>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getBatchStatusClasses(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>
                      {row.daysUntilExpiry < 0
                        ? `Expired with ${row.quantity} units still in stock.`
                        : `Expires in ${row.daysUntilExpiry} day${row.daysUntilExpiry === 1 ? "" : "s"} with ${row.quantity} units remaining.`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ) : null}
      </InsightSection>

      <InsightSection
        title="Reorder suggestions"
        description="Rules-based reorder guidance using current stock and the last 30 days of sales activity."
        emptyText="No reorder suggestions are needed right now."
      >
        {reorderSuggestions.length ? (
          <div className="space-y-4">
            <div className="app-panel-info">
              {REORDER_TRANSPARENCY_COPY} Matching rows use a simple stock-cover rule. If there are
              no sales in the last 30 days, PharmaFlow shows “Not enough recent sales data” instead
              of a precise reorder quantity.
            </div>

            <div className="app-table-shell">
              <div className="overflow-x-auto">
                <table className="app-table">
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Days of Stock Left</th>
                      <th>Status</th>
                      <th>Recommendation</th>
                      <th>Recommended Reorder</th>
                      <th>Reason</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reorderSuggestions.map((row) => (
                      <tr key={row.id}>
                        <td className="font-medium text-slate-900">
                          <div className="space-y-1">
                            <p>{row.medicineName}</p>
                            {row.demandSignalAdjusted ? (
                              <p className="text-xs font-medium text-blue-700">
                                Adjusted +{row.appliedDemandSignalUpliftPercentage}% for{" "}
                                {row.demandSignalTitle?.toLowerCase()}
                              </p>
                            ) : null}
                            <p className="text-xs text-slate-500">{row.reason}</p>
                            <p className="text-xs text-slate-500">{row.confidenceNote}</p>
                          </div>
                        </td>
                        <td>
                          {formatDaysOfStockLeft(row.daysOfStockLeft)}
                        </td>
                        <td>
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getReorderStatusClasses(
                              row.status,
                            )}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getReorderRecommendationClasses(row.recommendation)}`}
                          >
                            {row.recommendation}
                          </span>
                        </td>
                        <td>
                          <div className="space-y-1 text-sm">
                            <p>
                              {row.recommendedReorderQuantity === null ? "—" : row.recommendedReorderQuantity}
                            </p>
                            {row.demandSignalAdjusted &&
                            row.baseRecommendedReorderQuantity !== null &&
                            row.recommendedReorderQuantity !== null ? (
                              <p className="text-xs text-slate-500">
                                Base {row.baseRecommendedReorderQuantity} → Final {row.recommendedReorderQuantity}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div className="space-y-1">
                            <p>{row.reason}</p>
                            {row.demandSignalAdjusted && row.demandSignalExplanation ? (
                              <p className="text-xs text-slate-500">{row.demandSignalExplanation}</p>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          {!row.actionable ? (
                            <span className="text-xs font-medium text-slate-500">No action recommended</span>
                          ) : (
                            <ReorderButton
                              medicineId={row.id}
                              reason={`${row.recommendation}: ${row.reason}${
                                row.demandSignalAdjusted && row.appliedDemandSignalUpliftPercentage !== null
                                  ? ` Adjusted by ${row.appliedDemandSignalUpliftPercentage}% for active local demand signal.`
                                  : ""
                              }`}
                              existingPending={pendingReorderMedicineIds.has(row.id)}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </InsightSection>
    </div>
  );
}
