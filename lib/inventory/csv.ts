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

const supportedInventoryColumns = [
  ...requiredInventoryColumns,
  ...optionalInventoryColumns,
] as const;

type SupportedInventoryColumn = (typeof supportedInventoryColumns)[number];

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

type RawCsvRow = Record<string, unknown>;

function trimCell(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function toNullableText(value: string) {
  return value ? value : null;
}

function normalizeDate(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

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
    const hasAnyValue = Object.values(values).some(Boolean);

    if (!hasAnyValue) {
      skippedEmptyRows += 1;
      return;
    }

    const errors: string[] = [];
    const quantityValue = values.quantity;
    const expiryDateValue = values.expiry_date;
    const normalizedQuantity = Number(quantityValue);
    const normalizedExpiryDate = normalizeDate(expiryDateValue);
    const normalizedPurchasePrice = normalizeNumeric(values.purchase_price);
    const normalizedSellingPrice = normalizeNumeric(values.selling_price);

    if (!values.medicine_name) {
      errors.push("Medicine name is required.");
    }

    if (!values.batch_number) {
      errors.push("Batch number is required.");
    }

    if (!quantityValue) {
      errors.push("Quantity is required.");
    } else if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 0) {
      errors.push("Quantity must be a non-negative whole number.");
    }

    if (!expiryDateValue) {
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

    const previewRow: InventoryPreviewRow = {
      rowNumber: index + 2,
      values,
      errors,
    };

    previewRows.push(previewRow);

    if (!errors.length && !missingColumns.length) {
      validRows.push({
        medicine_name: values.medicine_name,
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

export function normalizeInventoryCsvHeader(header: string) {
  return normalizeHeader(header);
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
      !normalizeDate(candidate.expiry_date)
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
      medicine_name: candidate.medicine_name!.trim(),
      batch_number: candidate.batch_number!.trim(),
      quantity: candidate.quantity!,
      expiry_date: normalizeDate(candidate.expiry_date!)!,
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
