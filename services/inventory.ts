import type {
  ForecastPriority,
  ForecastRecommendation,
} from "@/lib/forecasting/product";

export const requiredInventoryColumns = [
  "medicine_name",
  "batch_number",
  "quantity",
  "expiry_date",
] as const;

export const optionalInventoryColumns = [
  "purchase_price",
  "selling_price",
  "sku",
  "category",
  "unit",
] as const;

export const supportedInventoryColumns = [
  ...requiredInventoryColumns,
  ...optionalInventoryColumns,
] as const;

type SupportedInventoryColumn = (typeof supportedInventoryColumns)[number];
type RawCsvRow = Record<string, unknown>;

export type InventoryImportRow = {
  medicine_name: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
  purchase_price: number | null;
  selling_price: number | null;
  sku: string | null;
  category: string | null;
  unit: string | null;
};

export type InventoryPreviewRow = {
  rowNumber: number;
  values: Record<SupportedInventoryColumn, string>;
  errors: string[];
};

export type InventoryCsvValidationResult = {
  missingColumns: string[];
  previewRows: InventoryPreviewRow[];
  validRows: InventoryImportRow[];
  skippedEmptyRows: number;
};

export const REORDER_SALES_WINDOW_DAYS = 30;
export const REORDER_TARGET_DAYS_COVER = 14;
export const REORDER_SAFETY_BUFFER_UNITS = 5;

export const REORDER_TRANSPARENCY_COPY =
  "Based on last 30 days sales, 14 days target cover, and a 5-unit safety buffer.";

export const demandCategoryOptions = [
  "fever_flu",
  "respiratory",
  "hydration",
  "gastro",
  "allergy",
  "pain_relief",
  "general",
] as const;

export type DemandCategory = (typeof demandCategoryOptions)[number];

export type ReorderDemandSignalAdjustment = {
  title: string;
  upliftPercentage: number;
  explanation: string;
  category: DemandCategory;
};

export function isDemandCategory(value: string): value is DemandCategory {
  return demandCategoryOptions.includes(value as DemandCategory);
}

export function formatDemandCategoryLabel(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export type RulesBasedReorderDecision = {
  averageDailySales30d: number | null;
  baseAverageDailySales30d: number | null;
  adjustedAverageDailySales30d: number | null;
  daysOfStockLeft: number | null;
  recommendation: ForecastRecommendation;
  priority: ForecastPriority;
  recommendedReorderQuantity: number | null;
  baseRecommendedReorderQuantity: number | null;
  availability: "available" | "insufficient_recent_sales_data";
  explainabilityNote: string;
  confidenceNote: string;
  demandSignalAdjusted: boolean;
  appliedDemandSignalUpliftPercentage: number | null;
  demandSignalTitle: string | null;
  demandSignalExplanation: string | null;
};

export function normalizeMedicineDisplayName(value: string) {
  return value.trim().replace(/\s*-\s*/g, "-").replace(/\s+/g, " ");
}

export function normalizeMedicineComparableName(value: string) {
  return normalizeMedicineDisplayName(value).toLowerCase();
}

function trimCell(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function toNullableText(value: string) {
  return value ? value : null;
}

function normalizeHeader(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const aliases: Record<string, SupportedInventoryColumn> = {
    medicine: "medicine_name",
    medicine_name: "medicine_name",
    medicine_title: "medicine_name",
    item_name: "medicine_name",
    drug_name: "medicine_name",
    batch: "batch_number",
    batch_no: "batch_number",
    batch_number: "batch_number",
    lot_number: "batch_number",
    lot_no: "batch_number",
    qty: "quantity",
    quantity: "quantity",
    expiry: "expiry_date",
    expiry_date: "expiry_date",
    expiration_date: "expiry_date",
    exp_date: "expiry_date",
    purchase_cost: "purchase_price",
    purchase_price: "purchase_price",
    cost_price: "purchase_price",
    selling_price: "selling_price",
    sale_price: "selling_price",
    mrp: "selling_price",
    item_sku: "sku",
    sku: "sku",
  };

  return aliases[normalized] ?? normalized;
}

export function normalizeInventoryDate(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value.trim());

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeNumeric(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRowValues(row: RawCsvRow) {
  return supportedInventoryColumns.reduce(
    (accumulator, column) => {
      accumulator[column] = trimCell(row[column]);
      return accumulator;
    },
    {} as Record<SupportedInventoryColumn, string>,
  );
}

export function normalizeInventoryCsvHeader(header: string) {
  return normalizeHeader(header);
}

export function validateInventoryCsvRows(
  rows: RawCsvRow[],
  headers: string[],
): InventoryCsvValidationResult {
  const normalizedHeaders = headers.map(normalizeHeader);
  const missingColumns = requiredInventoryColumns.filter(
    (column) => !normalizedHeaders.includes(column),
  );
  const previewRows: InventoryPreviewRow[] = [];
  const validRows: InventoryImportRow[] = [];
  let skippedEmptyRows = 0;

  rows.forEach((row, index) => {
    const values = getRowValues(row);

    if (!Object.values(values).some(Boolean)) {
      skippedEmptyRows += 1;
      return;
    }

    const errors: string[] = [];
    const normalizedQuantity = Number(values.quantity);
    const normalizedExpiryDate = normalizeInventoryDate(values.expiry_date);
    const normalizedPurchasePrice = normalizeNumeric(values.purchase_price);
    const normalizedSellingPrice = normalizeNumeric(values.selling_price);

    if (!values.medicine_name) {
      errors.push("Medicine name is required.");
    }

    if (!values.batch_number) {
      errors.push("Batch number is required.");
    }

    if (!values.quantity) {
      errors.push("Quantity is required.");
    } else if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 0) {
      errors.push("Quantity must be a non-negative whole number.");
    }

    if (!values.expiry_date) {
      errors.push("Expiry date is required.");
    } else if (!normalizedExpiryDate) {
      errors.push("Expiry date must be a valid date.");
    }

    if (values.purchase_price && normalizedPurchasePrice === null) {
      errors.push("Purchase price must be a valid number.");
    }

    if (values.selling_price && normalizedSellingPrice === null) {
      errors.push("Selling price must be a valid number.");
    }

    previewRows.push({
      rowNumber: index + 2,
      values,
      errors,
    });

    if (!errors.length && !missingColumns.length) {
      validRows.push({
        medicine_name: normalizeMedicineDisplayName(values.medicine_name),
        batch_number: values.batch_number,
        quantity: normalizedQuantity,
        expiry_date: normalizedExpiryDate!,
        purchase_price: normalizedPurchasePrice,
        selling_price: normalizedSellingPrice,
        sku: toNullableText(values.sku),
        category: toNullableText(values.category),
        unit: toNullableText(values.unit),
      });
    }
  });

  return {
    missingColumns,
    previewRows,
    validRows,
    skippedEmptyRows,
  };
}

export function validateInventoryImportRows(input: unknown) {
  if (!Array.isArray(input)) {
    return {
      errors: ["Import payload is invalid."],
      validRows: [] as InventoryImportRow[],
    };
  }

  const errors: string[] = [];
  const validRows: InventoryImportRow[] = [];

  input.forEach((row, index) => {
    if (!row || typeof row !== "object") {
      errors.push(`Row ${index + 1} is invalid.`);
      return;
    }

    const candidate = row as Partial<InventoryImportRow>;
    const rowErrors: string[] = [];

    if (!candidate.medicine_name || !candidate.medicine_name.trim()) {
      rowErrors.push("medicine_name is required");
    }

    if (!candidate.batch_number || !candidate.batch_number.trim()) {
      rowErrors.push("batch_number is required");
    }

    if (
      typeof candidate.quantity !== "number" ||
      !Number.isInteger(candidate.quantity) ||
      candidate.quantity < 0
    ) {
      rowErrors.push("quantity must be a non-negative whole number");
    }

    if (
      typeof candidate.expiry_date !== "string" ||
      !candidate.expiry_date ||
      !normalizeInventoryDate(candidate.expiry_date)
    ) {
      rowErrors.push("expiry_date must be a valid date");
    }

    if (
      candidate.purchase_price !== null &&
      candidate.purchase_price !== undefined &&
      typeof candidate.purchase_price !== "number"
    ) {
      rowErrors.push("purchase_price must be numeric");
    }

    if (
      candidate.selling_price !== null &&
      candidate.selling_price !== undefined &&
      typeof candidate.selling_price !== "number"
    ) {
      rowErrors.push("selling_price must be numeric");
    }

    if (rowErrors.length) {
      errors.push(`Row ${index + 1}: ${rowErrors.join(", ")}.`);
      return;
    }

    validRows.push({
      medicine_name: normalizeMedicineDisplayName(candidate.medicine_name!),
      batch_number: candidate.batch_number!.trim(),
      quantity: candidate.quantity!,
      expiry_date: normalizeInventoryDate(candidate.expiry_date!)!,
      purchase_price: candidate.purchase_price ?? null,
      selling_price: candidate.selling_price ?? null,
      sku: toNullableText(String(candidate.sku ?? "").trim()),
      category: toNullableText(String(candidate.category ?? "").trim()),
      unit: toNullableText(String(candidate.unit ?? "").trim()),
    });
  });

  return {
    errors,
    validRows,
  };
}

function roundValue(value: number) {
  return Number(value.toFixed(2));
}

export function getRulesBasedReorderDecision({
  currentStock,
  recentSales30d,
  demandSignal,
}: {
  currentStock: number;
  recentSales30d: number;
  demandSignal?: ReorderDemandSignalAdjustment | null;
}): RulesBasedReorderDecision {
  const baseAverageDailySales30d =
    recentSales30d > 0 ? recentSales30d / REORDER_SALES_WINDOW_DAYS : null;
  const demandSignalAdjusted =
    Boolean(demandSignal) && baseAverageDailySales30d !== null;
  const appliedDemandSignalUpliftPercentage = demandSignalAdjusted
    ? demandSignal!.upliftPercentage
    : null;
  const adjustedAverageDailySales30d =
    baseAverageDailySales30d === null
      ? null
      : demandSignalAdjusted
        ? baseAverageDailySales30d * (1 + demandSignal!.upliftPercentage / 100)
        : baseAverageDailySales30d;

  if (recentSales30d <= 0) {
    return {
      averageDailySales30d: null,
      baseAverageDailySales30d: null,
      adjustedAverageDailySales30d: null,
      daysOfStockLeft: null,
      recommendation: "Monitor",
      priority: "Low",
      recommendedReorderQuantity: null,
      baseRecommendedReorderQuantity: null,
      availability: "insufficient_recent_sales_data",
      explainabilityNote: "Not enough recent sales data to calculate a reliable reorder quantity.",
      confidenceNote:
        "No sales were recorded in the last 30 days, so PharmaFlow is not showing a precise reorder number.",
      demandSignalAdjusted: false,
      appliedDemandSignalUpliftPercentage: null,
      demandSignalTitle: null,
      demandSignalExplanation: null,
    };
  }

  const averageDailySales30d = adjustedAverageDailySales30d!;
  const daysOfStockLeft =
    averageDailySales30d > 0 ? roundValue(currentStock / averageDailySales30d) : null;
  const baseRecommendedReorderQuantity = Math.max(
    0,
    Math.ceil(
      baseAverageDailySales30d! * REORDER_TARGET_DAYS_COVER +
        REORDER_SAFETY_BUFFER_UNITS -
        currentStock,
    ),
  );
  const recommendedReorderQuantity = Math.max(
    0,
    Math.ceil(
      averageDailySales30d * REORDER_TARGET_DAYS_COVER +
        REORDER_SAFETY_BUFFER_UNITS -
        currentStock,
    ),
  );

  if (recommendedReorderQuantity === 0) {
    return {
      averageDailySales30d: roundValue(averageDailySales30d),
      baseAverageDailySales30d: roundValue(baseAverageDailySales30d!),
      adjustedAverageDailySales30d: roundValue(averageDailySales30d),
      daysOfStockLeft,
      recommendation: "Monitor",
      priority: "Low",
      recommendedReorderQuantity: 0,
      baseRecommendedReorderQuantity,
      availability: "available",
      explainabilityNote: demandSignalAdjusted
        ? `Adjusted for ${demandSignal!.title.toLowerCase()}. Even after a ${demandSignal!.upliftPercentage}% demand uplift, current stock still covers the target window.`
        : "Current stock already covers the 14-day target window plus the 5-unit safety buffer.",
      confidenceNote: demandSignalAdjusted
        ? `${REORDER_TRANSPARENCY_COPY} Seasonal demand signal applied as a planning adjustment, not a precise forecast.`
        : REORDER_TRANSPARENCY_COPY,
      demandSignalAdjusted,
      appliedDemandSignalUpliftPercentage,
      demandSignalTitle: demandSignalAdjusted ? demandSignal!.title : null,
      demandSignalExplanation: demandSignalAdjusted ? demandSignal!.explanation : null,
    };
  }

  if (daysOfStockLeft !== null && daysOfStockLeft <= 7) {
    return {
      averageDailySales30d: roundValue(averageDailySales30d),
      baseAverageDailySales30d: roundValue(baseAverageDailySales30d!),
      adjustedAverageDailySales30d: roundValue(averageDailySales30d),
      daysOfStockLeft,
      recommendation: "Reorder Now",
      priority: "Urgent",
      recommendedReorderQuantity,
      baseRecommendedReorderQuantity,
      availability: "available",
      explainabilityNote: demandSignalAdjusted
        ? `Adjusted for ${demandSignal!.title.toLowerCase()}. The seasonal uplift increases the near-term reorder quantity.`
        : "Current stock is below the 14-day target window and close to running short at the recent sales pace.",
      confidenceNote: demandSignalAdjusted
        ? `${REORDER_TRANSPARENCY_COPY} Seasonal demand signal applied as a planning adjustment, not a precise forecast.`
        : REORDER_TRANSPARENCY_COPY,
      demandSignalAdjusted,
      appliedDemandSignalUpliftPercentage,
      demandSignalTitle: demandSignalAdjusted ? demandSignal!.title : null,
      demandSignalExplanation: demandSignalAdjusted ? demandSignal!.explanation : null,
    };
  }

  return {
    averageDailySales30d: roundValue(averageDailySales30d),
    baseAverageDailySales30d: roundValue(baseAverageDailySales30d!),
    adjustedAverageDailySales30d: roundValue(averageDailySales30d),
    daysOfStockLeft,
    recommendation: "Reorder Soon",
    priority: "High",
    recommendedReorderQuantity,
    baseRecommendedReorderQuantity,
    availability: "available",
    explainabilityNote: demandSignalAdjusted
      ? `Adjusted for ${demandSignal!.title.toLowerCase()}. PharmaFlow increased the reorder quantity using the active seasonal demand uplift.`
      : "Current stock is below the 14-day target window after applying the 5-unit safety buffer.",
    confidenceNote: demandSignalAdjusted
      ? `${REORDER_TRANSPARENCY_COPY} Seasonal demand signal applied as a planning adjustment, not a precise forecast.`
      : REORDER_TRANSPARENCY_COPY,
    demandSignalAdjusted,
    appliedDemandSignalUpliftPercentage,
    demandSignalTitle: demandSignalAdjusted ? demandSignal!.title : null,
    demandSignalExplanation: demandSignalAdjusted ? demandSignal!.explanation : null,
  };
}
