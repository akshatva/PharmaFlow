import Link from "next/link";
import { redirect } from "next/navigation";

import { SectionIntro } from "@/components/layout/section-intro";
import { ExportButton } from "@/components/reports/export-button";
import { SetupNotice } from "@/components/layout/setup-notice";
import { CreateProcurementFromReorderForm } from "@/components/procurement/create-procurement-from-reorder-form";
import { ReorderStatusForm } from "@/components/reorders/reorder-status-form";
import {
  buildProductForecastRows,
  getForecastAwareReorderDecision,
  type ProductForecastRecord,
  type ProductForecastRow,
} from "@/lib/forecasting/product";
import { getLocalDemandSignals } from "@/services/insights";
import {
  isDemandCategory,
  getRulesBasedReorderDecision,
} from "@/services/inventory";
import {
  getSupplierRecommendationForMedicine,
  type ReorderUrgency,
  type SupplierCatalogCandidate,
  type SupplierRecommendation,
} from "@/lib/suppliers/recommendations";
import { getLocalWeatherSnapshot } from "@/services/weather";
import { isMissingColumnError, isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ReorderItemRecord = {
  id: string;
  medicine_id: string;
  reason: string;
  status: "pending" | "ordered";
  created_at: string;
  medicines:
    | {
        name: string;
        demand_category: string | null;
      }
    | {
        name: string;
        demand_category: string | null;
      }[]
    | null;
};

type BatchRecord = {
  medicine_id: string;
  quantity: number;
};

type SalesRecord = {
  medicine_id: string;
  quantity_sold: number;
};

type SupplierRecord = {
  id: string;
  name: string;
};

type CatalogSupplierRecord = {
  id: string;
  distributor_name: string;
  active: boolean;
};

type SupplierCatalogRecord = {
  distributor_id: string;
  medicine_name: string;
  unit_price: number | string;
  available_quantity: number | null;
  lead_time_days: number | null;
  active: boolean;
};

type ProcurementOrderRecord = {
  id: string;
  supplier_id: string;
  created_at: string;
  reorder_item_id: string | null;
};


type ReorderRow = {
  id: string;
  medicineId: string;
  medicineName: string;
  currentStock: number;
  recentSales: number;
  daysOfStockLeft: number | null;
  stockRisk: ProductForecastRow["stockRisk"];
  confidenceLevel: ProductForecastRow["confidenceLevel"];
  modelName: string | null;
  recommendation: "Reorder Now" | "Reorder Soon" | "Monitor" | "Avoid Reorder";
  priority: "Urgent" | "High" | "Medium" | "Low";
  suggestedQuantity: number;
  baseSuggestedQuantity: number | null;
  forecast30d: number | null;
  forecastAvailable: boolean;
  usedForecast: boolean;
  explainabilityNote: string;
  confidenceNote: string;
  demandSignalAdjusted: boolean;
  appliedDemandSignalUpliftPercentage: number | null;
  demandSignalTitle: string | null;
  demandSignalExplanation: string | null;
  suggestedSupplierId: string | null;
  suggestedSupplierName: string | null;
  supplierSuggestionNote: string | null;
  supplierRecommendation: SupplierRecommendation | null;
  supplierRecommendationFallback: string;
  originalReason: string;
  status: "pending" | "ordered";
  createdAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDecimal(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value);
}

function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDaysOfStockLeft(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${formatDecimal(value)} days`;
}

function getSmartOrderingSuggestion({
  currentStock,
  recentSales,
  demandSignal,
}: {
  currentStock: number;
  recentSales: number;
  demandSignal?: ReturnType<typeof getLocalDemandSignals>[number] | null;
}) {
  const decision = getRulesBasedReorderDecision({
    currentStock,
    recentSales30d: recentSales,
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
    daysOfStockLeft: decision.daysOfStockLeft,
    recommendation: decision.recommendation,
    priority: decision.priority,
    suggestedQuantity: decision.recommendedReorderQuantity ?? 0,
    baseSuggestedQuantity: decision.baseRecommendedReorderQuantity,
    explainabilityNote:
      decision.availability === "available" && decision.demandSignalAdjusted
        ? `Rule fallback with +${decision.appliedDemandSignalUpliftPercentage}% local demand.`
        : decision.availability === "available"
          ? "Rule fallback."
        : "Not enough recent sales data.",
    confidenceNote:
      decision.availability === "available"
        ? decision.confidenceNote
        : decision.confidenceNote,
    demandSignalAdjusted: decision.demandSignalAdjusted,
    appliedDemandSignalUpliftPercentage: decision.appliedDemandSignalUpliftPercentage,
    demandSignalTitle: decision.demandSignalTitle,
    demandSignalExplanation: decision.demandSignalExplanation,
  };
}

function getRiskClasses(risk: ReorderRow["stockRisk"]) {
  switch (risk) {
    case "High risk":
      return "border-red-200 bg-red-50 text-red-700";
    case "Medium":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

function getConfidenceClasses(confidenceLevel: ReorderRow["confidenceLevel"]) {
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

export default async function ReordersPage() {
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
    { data: reorderItems, error: reorderError },
    { data: batchRecords, error: batchError },
    { data: salesRecords, error: salesError },
    { data: suppliers, error: suppliersError },
    { data: catalogSuppliers, error: catalogSuppliersError },
    { data: supplierCatalogItems, error: supplierCatalogError },
    { data: procurementOrders, error: procurementOrdersError },
    { data: forecastResults, error: forecastError },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("city, state, country")
      .eq("id", membership.organization_id)
      .maybeSingle(),
    supabase
      .from("reorder_items")
      .select("id, medicine_id, reason, status, created_at, medicines(name, demand_category)")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false }),
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
      .from("suppliers")
      .select("id, name")
      .eq("organization_id", membership.organization_id)
      .order("name", { ascending: true }),
    supabase
      .from("distributors")
      .select("id, distributor_name, active")
      .eq("organization_id", membership.organization_id)
      .order("distributor_name", { ascending: true }),
    supabase
      .from("distributor_catalog")
      .select("distributor_id, medicine_name, unit_price, available_quantity, lead_time_days, active"),
    supabase
      .from("procurement_orders")
      .select("id, supplier_id, created_at, reorder_item_id")
      .eq("organization_id", membership.organization_id),
    supabase
      .from("forecast_results")
      .select(
        "medicine_id, model_name, forecast_7d, forecast_30d, daily_demand_avg, confidence_level, error_metric_name, error_metric_value, history_days_used, generated_at",
      )
      .eq("organization_id", membership.organization_id),
  ]);

  const baseDataError =
    reorderError ??
    batchError ??
    salesError ??
    suppliersError ??
    procurementOrdersError;
  const supplierCatalogUnavailable =
    isMissingRelationError(catalogSuppliersError, "distributors") ||
    isMissingRelationError(supplierCatalogError, "distributor_catalog");
  const supplierCatalogDataError = supplierCatalogUnavailable
    ? null
    : catalogSuppliersError ?? supplierCatalogError;
  let organization = organizationQuery.data;
  let organizationError = organizationQuery.error;

  if (
    isMissingColumnError(organizationQuery.error, "city") ||
    isMissingColumnError(organizationQuery.error, "state") ||
    isMissingColumnError(organizationQuery.error, "country")
  ) {
    organization = null;
    organizationError = null;
  }

  if (baseDataError ?? organizationError ?? supplierCatalogDataError) {
    if (isMissingRelationError(reorderError, "reorder_items")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Action"
            title="Reorders"
            description="Review and create draft POs."
          />
          <SetupNotice
            title="Reorders not ready"
            description="Apply the reorder migration and refresh."
          />
        </div>
      );
    }

    if (isMissingRelationError(suppliersError, "suppliers")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Action"
            title="Reorders"
            description="Review and create draft POs."
          />
          <SetupNotice
            title="Suppliers not ready"
            description="Apply the supplier migration and refresh."
          />
        </div>
      );
    }

    if (isMissingRelationError(procurementOrdersError, "procurement_orders")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Action"
            title="Reorders"
            description="Review and create draft POs."
          />
          <SetupNotice
            title="Purchase orders not ready"
            description="Apply the purchase order migration and refresh."
          />
        </div>
      );
    }

    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load reorders: ${(baseDataError ?? organizationError ?? supplierCatalogDataError)!.message}`
        : "Unable to load reorders.",
    );
  }

  const stockByMedicine = new Map<string, number>();
  const recentSalesByMedicine = new Map<string, number>();
  const procurementOrderSourceIds = new Set<string>();
  const procurementOrdersById = new Map<string, ProcurementOrderRecord>();
  const latestSupplierByMedicineId = new Map<
    string,
    { supplierId: string; supplierName: string | null; createdAt: string }
  >();
  const suppliersById = new Map(
    ((suppliers ?? []) as SupplierRecord[]).map((supplier) => [supplier.id, supplier.name]),
  );
  const catalogSuppliersById = new Map(
    (supplierCatalogUnavailable ? [] : ((catalogSuppliers ?? []) as CatalogSupplierRecord[])).map(
      (supplier) => [
        supplier.id,
        {
          supplierName: supplier.distributor_name,
          active: supplier.active,
        },
      ],
    ),
  );
  const supplierCatalogCandidates: SupplierCatalogCandidate[] = (
    supplierCatalogUnavailable ? [] : ((supplierCatalogItems ?? []) as SupplierCatalogRecord[])
  ).flatMap((item) => {
    const supplier = catalogSuppliersById.get(item.distributor_id);

    if (!supplier) {
      return [];
    }

    return [
      {
        supplierId: item.distributor_id,
        supplierName: supplier.supplierName,
        supplierActive: supplier.active,
        medicineName: item.medicine_name,
        unitPrice: Number(item.unit_price),
        availableQuantity: item.available_quantity,
        leadTimeDays: item.lead_time_days,
        itemActive: item.active,
      },
    ];
  });

  ((batchRecords ?? []) as BatchRecord[]).forEach((batch) => {
    stockByMedicine.set(
      batch.medicine_id,
      (stockByMedicine.get(batch.medicine_id) ?? 0) + batch.quantity,
    );
  });

  ((salesRecords ?? []) as SalesRecord[]).forEach((sale) => {
    recentSalesByMedicine.set(
      sale.medicine_id,
      (recentSalesByMedicine.get(sale.medicine_id) ?? 0) + sale.quantity_sold,
    );
  });

  ((procurementOrders ?? []) as ProcurementOrderRecord[]).forEach((order) => {
    procurementOrdersById.set(order.id, order);

    if (order.reorder_item_id) {
      procurementOrderSourceIds.add(order.reorder_item_id);
    }
  });

  const forecastUnavailable = Boolean(
    forecastError && isMissingRelationError(forecastError, "forecast_results"),
  );
  const forecastByMedicine = new Map<string, ProductForecastRecord>(
    forecastError ? [] : (((forecastResults ?? []) as ProductForecastRecord[]).map((row) => [row.medicine_id, row])),
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

  const forecastRowsByMedicine = new Map(forecastRows.map((row) => [row.medicineId, row]));
  const localWeather = await getLocalWeatherSnapshot(organization ?? undefined);
  const localDemandSignals = getLocalDemandSignals({
    location: organization ?? undefined,
    weather: localWeather,
    availableCategories: ((reorderItems ?? []) as ReorderItemRecord[])
      .map((item) => {
        const medicine = Array.isArray(item.medicines) ? item.medicines[0] : item.medicines;
        return medicine?.demand_category ?? "";
      })
      .filter(Boolean),
  });
  const activeSignalsByCategory = new Map(
    localDemandSignals.map((signal) => [signal.category, signal]),
  );

  const rows: ReorderRow[] = ((reorderItems ?? []) as ReorderItemRecord[])
    .map((item) => {
      const medicine = Array.isArray(item.medicines) ? item.medicines[0] : item.medicines;
      const currentStock = stockByMedicine.get(item.medicine_id) ?? 0;
      const recentSales = recentSalesByMedicine.get(item.medicine_id) ?? 0;
      const demandSignal =
        medicine?.demand_category && isDemandCategory(medicine.demand_category)
          ? activeSignalsByCategory.get(medicine.demand_category) ?? null
          : null;
      const supplierSuggestion = latestSupplierByMedicineId.get(item.medicine_id);
      const supplierSuggestionNote = supplierSuggestion
        ? `Most recently used supplier for this medicine.`
        : "No supplier history yet. Select a supplier manually.";
      const fallbackDecision = getSmartOrderingSuggestion({
        currentStock,
        recentSales,
        demandSignal,
      });
      const forecastRow = forecastRowsByMedicine.get(item.medicine_id) ?? null;
      const decision = getForecastAwareReorderDecision({
        forecastRow,
        fallbackDecision,
      });
      const recommendationUrgency: ReorderUrgency =
        decision.priority === "Urgent"
          ? "urgent"
          : decision.priority === "High"
            ? "high"
            : "normal";
      const supplierRecommendation =
        decision.suggestedQuantity > 0
          ? getSupplierRecommendationForMedicine({
              medicineName: medicine?.name ?? "Unknown medicine",
              suggestedQuantity: decision.suggestedQuantity,
              candidates: supplierCatalogCandidates,
              urgency: recommendationUrgency,
            })
          : null;

      return {
        id: item.id,
        medicineId: item.medicine_id,
        medicineName: medicine?.name ?? "Unknown medicine",
        currentStock,
        recentSales,
        daysOfStockLeft: forecastRow?.daysOfStockLeft ?? fallbackDecision.daysOfStockLeft,
        stockRisk: forecastRow?.stockRisk ?? "Safe",
        confidenceLevel: forecastRow?.confidenceLevel ?? null,
        modelName: forecastRow?.modelName ?? null,
        recommendation: decision.recommendation,
        priority: decision.priority,
        suggestedQuantity: decision.suggestedQuantity,
        baseSuggestedQuantity: fallbackDecision.baseSuggestedQuantity,
        forecast30d: forecastRow?.forecast30d ?? null,
        forecastAvailable: forecastRow?.forecastAvailable ?? false,
        usedForecast: decision.usedForecast,
        explainabilityNote: decision.explainabilityNote,
        confidenceNote: decision.confidenceNote,
        demandSignalAdjusted: fallbackDecision.demandSignalAdjusted,
        appliedDemandSignalUpliftPercentage: fallbackDecision.appliedDemandSignalUpliftPercentage,
        demandSignalTitle: fallbackDecision.demandSignalTitle,
        demandSignalExplanation: fallbackDecision.demandSignalExplanation,
        suggestedSupplierId: supplierSuggestion?.supplierId ?? null,
        suggestedSupplierName: supplierSuggestion?.supplierName ?? null,
        supplierSuggestionNote,
        supplierRecommendation,
        supplierRecommendationFallback: supplierCatalogUnavailable
          ? "Supplier catalog unavailable."
          : "No matching suppliers found.",
        originalReason: item.reason,
        status: item.status,
        createdAt: item.created_at,
      };
    })
    .sort((first, second) => {
      const priorityWeight = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
      const priorityDifference = priorityWeight[second.priority] - priorityWeight[first.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
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

      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });

  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const orderedCount = rows.filter((row) => row.status === "ordered").length;
  const forecastDrivenCount = rows.filter((row) => row.usedForecast).length;
  const fallbackCount = rows.length - forecastDrivenCount;
  const supplierRecommendationRows = rows.filter((row) => row.supplierRecommendation);
  const supplierRecommendationCount = supplierRecommendationRows.length;

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Action"
        title="Reorders"
        description="Review and create draft POs."
      />
      <div className="flex flex-wrap gap-3">
        <ExportButton href="/api/exports/reorders" label="Export Reorder Report" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="app-stat-card">
          <p className="app-stat-eyebrow">Pending</p>
          <p className="app-stat-value">{pendingCount}</p>
        </div>
        <div className="app-stat-card">
          <p className="app-stat-eyebrow">Ordered</p>
          <p className="app-stat-value">{orderedCount}</p>
        </div>
        <div className="app-stat-card">
          <p className="app-stat-eyebrow">Forecast</p>
          <p className="app-stat-value">{forecastDrivenCount}</p>
        </div>
        <div className="app-stat-card">
          <p className="app-stat-eyebrow">Rules</p>
          <p className="app-stat-value">{fallbackCount}</p>
        </div>
      </div>

      {forecastUnavailable ? (
        <SetupNotice
          title="Forecasts off"
          description="Using rules."
        />
      ) : null}

      <section className="app-card p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="app-kicker">Supplier Match</p>
            <h3 className="mt-1 app-section-title">Supplier Recommendations</h3>
          </div>
          <span className="app-badge border-slate-200 bg-slate-50 text-slate-600">
            {supplierRecommendationCount} match{supplierRecommendationCount === 1 ? "" : "es"}
          </span>
        </div>

        {supplierCatalogUnavailable ? (
          <p className="mt-5 app-panel-warning">Supplier catalog unavailable.</p>
        ) : supplierRecommendationRows.length === 0 ? (
          <div className="mt-5 app-empty-state">
            <p className="app-empty-title">No matching suppliers found.</p>
            <p className="app-empty-copy">Add matching active catalog entries to enable recommendations.</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {supplierRecommendationRows.slice(0, 3).map((row) => {
              const recommendation = row.supplierRecommendation!;

              return (
                <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {row.medicineName}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {recommendation.supplierName}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-400">Price</p>
                      <p className="mt-1 font-medium text-slate-800">
                        {formatCurrency(recommendation.unitPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Lead</p>
                      <p className="mt-1 font-medium text-slate-800">
                        {recommendation.leadTimeDays === null ? "—" : `${recommendation.leadTimeDays}d`}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Avail.</p>
                      <p className="mt-1 font-medium text-slate-800">
                        {recommendation.availableQuantity}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{recommendation.reason}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="app-card">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Reorder list</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {rows.length} item{rows.length === 1 ? "" : "s"}
            </span>
            <Link
              href="/forecast"
              className="app-button-secondary py-2 text-xs"
            >
              View full forecast
            </Link>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-5 sm:p-6">
            <div className="app-empty-state">
              <h4 className="app-empty-title">All caught up</h4>
              <p className="app-empty-copy">There are no pending reorders that require your attention.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 px-4 py-5 sm:px-5 lg:hidden">
              {rows.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-slate-950">{row.medicineName}</p>
                      <p className="mt-1 text-sm text-slate-500">Created {formatDate(row.createdAt)}</p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <ReorderStatusForm reorderItemId={row.id} initialStatus={row.status} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`app-badge ${getRiskClasses(row.stockRisk)}`}>
                      {row.stockRisk}
                    </span>
                    <span className={`app-badge capitalize ${getConfidenceClasses(row.confidenceLevel)}`}>
                      {row.confidenceLevel ?? "none"}
                    </span>
                    <span className="app-badge border-slate-200 bg-white text-slate-700">
                      {row.usedForecast ? "Forecast" : "Rules"}
                    </span>
                    {row.demandSignalAdjusted ? (
                      <span className="app-badge border-blue-200 bg-blue-50 text-blue-700">
                        +{row.appliedDemandSignalUpliftPercentage}% local demand
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Stock</p>
                      <p className="mt-1 text-sm text-slate-700">{row.currentStock}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Sales</p>
                      <p className="mt-1 text-sm text-slate-700">{row.recentSales}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">30d</p>
                      <p className="mt-1 text-sm text-slate-700">{formatDecimal(row.forecast30d)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Cover</p>
                      <p className="mt-1 text-sm text-slate-700">{formatDaysOfStockLeft(row.daysOfStockLeft)}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">{row.recommendation}</p>
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                      {row.explainabilityNote}
                    </div>
                    {row.demandSignalAdjusted && row.demandSignalExplanation ? (
                      <p className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
                        {row.demandSignalExplanation}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Quantity</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {row.suggestedQuantity > 0 ? row.suggestedQuantity : "No draft suggested"}
                      </p>
                      {row.demandSignalAdjusted &&
                      row.baseSuggestedQuantity !== null &&
                      row.suggestedQuantity > 0 ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Base {row.baseSuggestedQuantity} → Final {row.suggestedQuantity}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Method</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {row.usedForecast ? "Forecast" : "Rules"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Supplier match</p>
                      {row.supplierRecommendation ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm font-medium text-slate-900">
                            {row.supplierRecommendation.supplierName}
                          </p>
                          <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                            <span>{formatCurrency(row.supplierRecommendation.unitPrice)}</span>
                            <span>
                              {row.supplierRecommendation.leadTimeDays === null
                                ? "Lead —"
                                : `${row.supplierRecommendation.leadTimeDays}d lead`}
                            </span>
                            <span>{row.supplierRecommendation.availableQuantity} available</span>
                          </div>
                          <p className="text-xs leading-5 text-slate-500">
                            {row.supplierRecommendation.reason}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1 text-sm font-medium text-slate-500">
                          {row.supplierRecommendationFallback}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    {row.recommendation === "Avoid Reorder" || row.suggestedQuantity <= 0 ? (
                      <p className="text-xs font-medium text-slate-500">
                        No draft suggested.
                      </p>
                    ) : (
                      <CreateProcurementFromReorderForm
                        reorderItemId={row.id}
                        medicineId={row.medicineId}
                        medicineName={row.medicineName}
                        suggestedQuantity={row.suggestedQuantity}
                        suppliers={(suppliers ?? []) as SupplierRecord[]}
                        suggestedSupplierId={row.suggestedSupplierId}
                        suggestedSupplierName={row.suggestedSupplierName}
                        suggestedUnitPrice={row.supplierRecommendation?.unitPrice}
                        recommendation={`${row.recommendation} • ${row.priority} priority`}
                        supplierSuggestionNote={row.supplierSuggestionNote}
                        disabled={procurementOrderSourceIds.has(row.id)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="app-table-shell hidden overflow-x-auto lg:block">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Stock</th>
                    <th>30d</th>
                    <th>Cover</th>
                    <th>Risk</th>
                    <th>Confidence</th>
                    <th>Recommendation</th>
                    <th>Supplier Match</th>
                    <th>Status</th>
                    <th>Draft PO</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="border-b border-slate-100 px-3 py-4">
                        <div className="space-y-2">
                          <p className="font-medium text-slate-900">{row.medicineName}</p>
                          {row.demandSignalAdjusted ? (
                            <p className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              Adjusted +{row.appliedDemandSignalUpliftPercentage}% for{" "}
                              {row.demandSignalTitle?.toLowerCase()}
                            </p>
                          ) : null}
                          <p className="text-xs text-slate-500">
                            {row.usedForecast ? "Forecast" : "Rules"}
                          </p>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                        {row.currentStock}
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
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getConfidenceClasses(
                            row.confidenceLevel,
                          )}`}
                        >
                          {row.confidenceLevel ?? "none"}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-4">
                        <div className="space-y-2">
                          <p className="font-medium text-slate-900">{row.recommendation}</p>
                          <p className="text-xs text-slate-500">
                            {row.suggestedQuantity > 0
                              ? `${row.suggestedQuantity} units suggested`
                              : "No draft suggested"}
                          </p>
                          {row.demandSignalAdjusted &&
                          row.baseSuggestedQuantity !== null &&
                          row.suggestedQuantity > 0 ? (
                            <p className="text-xs text-slate-500">
                              Base {row.baseSuggestedQuantity} → Final {row.suggestedQuantity}
                            </p>
                          ) : null}
                          <p className="text-xs text-slate-500">
                            {row.usedForecast ? "Forecast" : "Rules"}
                          </p>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                            {row.explainabilityNote}
                          </div>
                          {row.demandSignalAdjusted && row.demandSignalExplanation ? (
                            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
                              {row.demandSignalExplanation}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-4 text-slate-700">
                        {row.supplierRecommendation ? (
                          <div className="space-y-2">
                            <p className="font-medium text-slate-900">
                              {row.supplierRecommendation.supplierName}
                            </p>
                            <div className="space-y-1 text-xs text-slate-500">
                              <p>{formatCurrency(row.supplierRecommendation.unitPrice)}</p>
                              <p>
                                {row.supplierRecommendation.leadTimeDays === null
                                  ? "Lead —"
                                  : `${row.supplierRecommendation.leadTimeDays}d lead`}{" "}
                                • {row.supplierRecommendation.availableQuantity} available
                              </p>
                              <p>{row.supplierRecommendation.reason}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs font-medium text-slate-500">
                            {row.supplierRecommendationFallback}
                          </p>
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-4">
                        <ReorderStatusForm reorderItemId={row.id} initialStatus={row.status} />
                      </td>
                      <td className="border-b border-slate-100 px-3 py-4">
                        {row.recommendation === "Avoid Reorder" || row.suggestedQuantity <= 0 ? (
                          <span className="text-xs font-medium text-slate-500">No draft suggested</span>
                        ) : (
                          <CreateProcurementFromReorderForm
                            reorderItemId={row.id}
                            medicineId={row.medicineId}
                            medicineName={row.medicineName}
                            suggestedQuantity={row.suggestedQuantity}
                            suppliers={(suppliers ?? []) as SupplierRecord[]}
                            suggestedSupplierId={row.suggestedSupplierId}
                            suggestedSupplierName={row.suggestedSupplierName}
                            suggestedUnitPrice={row.supplierRecommendation?.unitPrice}
                            recommendation={`${row.recommendation} • ${row.priority} priority`}
                            supplierSuggestionNote={row.supplierSuggestionNote}
                            disabled={procurementOrderSourceIds.has(row.id)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
