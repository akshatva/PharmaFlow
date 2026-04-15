export const requiredSalesColumns = ["medicine_name", "quantity_sold", "sold_at"] as const;

export const optionalSalesColumns = ["sku"] as const;

const supportedSalesColumns = [...requiredSalesColumns, ...optionalSalesColumns] as const;

type SupportedSalesColumn = (typeof supportedSalesColumns)[number];

export type SalesImportRow = {
  medicine_name: string;
  quantity_sold: number;
  sold_at: string;
  sku: string | null;
};

export type SalesPreviewRow = {
  rowNumber: number;
  values: Record<SupportedSalesColumn, string>;
  errors: string[];
};

export type SalesCsvValidationResult = {
  missingColumns: string[];
  previewRows: SalesPreviewRow[];
  validRows: SalesImportRow[];
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

function normalizeSoldAt(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function getRowValues(row: RawCsvRow) {
  return supportedSalesColumns.reduce(
    (accumulator, column) => {
      accumulator[column] = trimCell(row[column]);
      return accumulator;
    },
    {} as Record<SupportedSalesColumn, string>,
  );
}

export function validateSalesCsvRows(
  rows: RawCsvRow[],
  headers: string[],
): SalesCsvValidationResult {
  const normalizedHeaders = headers.map(normalizeHeader);
  const missingColumns = requiredSalesColumns.filter(
    (column) => !normalizedHeaders.includes(column),
  );

  const previewRows: SalesPreviewRow[] = [];
  const validRows: SalesImportRow[] = [];
  let skippedEmptyRows = 0;

  rows.forEach((row, index) => {
    const values = getRowValues(row);
    const hasAnyValue = Object.values(values).some(Boolean);

    if (!hasAnyValue) {
      skippedEmptyRows += 1;
      return;
    }

    const errors: string[] = [];
    const normalizedQuantity = Number(values.quantity_sold);
    const normalizedSoldAt = normalizeSoldAt(values.sold_at);

    if (!values.medicine_name) {
      errors.push("Medicine name is required.");
    }

    if (!values.quantity_sold) {
      errors.push("Quantity sold is required.");
    } else if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
      errors.push("Quantity sold must be a positive whole number.");
    }

    if (!values.sold_at) {
      errors.push("Sold at is required.");
    } else if (!normalizedSoldAt) {
      errors.push("Sold at must be a valid date or datetime.");
    }

    const previewRow: SalesPreviewRow = {
      rowNumber: index + 2,
      values,
      errors,
    };

    previewRows.push(previewRow);

    if (!errors.length && !missingColumns.length) {
      validRows.push({
        medicine_name: values.medicine_name,
        quantity_sold: normalizedQuantity,
        sold_at: normalizedSoldAt!,
        sku: toNullableText(values.sku),
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

export function validateSalesImportRows(input: unknown) {
  if (!Array.isArray(input)) {
    return {
      errors: ["Import payload is invalid."],
      validRows: [] as SalesImportRow[],
    };
  }

  const errors: string[] = [];
  const validRows: SalesImportRow[] = [];

  input.forEach((row, index) => {
    if (!row || typeof row !== "object") {
      errors.push(`Row ${index + 1} is invalid.`);
      return;
    }

    const candidate = row as Partial<SalesImportRow>;
    const rowErrors: string[] = [];

    if (!candidate.medicine_name || !candidate.medicine_name.trim()) {
      rowErrors.push("medicine_name is required");
    }

    if (
      typeof candidate.quantity_sold !== "number" ||
      !Number.isInteger(candidate.quantity_sold) ||
      candidate.quantity_sold <= 0
    ) {
      rowErrors.push("quantity_sold must be a positive whole number");
    }

    if (
      typeof candidate.sold_at !== "string" ||
      !candidate.sold_at ||
      !normalizeSoldAt(candidate.sold_at)
    ) {
      rowErrors.push("sold_at must be a valid date or datetime");
    }

    if (rowErrors.length) {
      errors.push(`Row ${index + 1}: ${rowErrors.join(", ")}.`);
      return;
    }

    validRows.push({
      medicine_name: candidate.medicine_name!.trim(),
      quantity_sold: candidate.quantity_sold!,
      sold_at: normalizeSoldAt(candidate.sold_at!)!,
      sku: toNullableText(String(candidate.sku ?? "").trim()),
    });
  });

  return {
    errors,
    validRows,
  };
}

export function normalizeSalesCsvHeader(header: string) {
  return normalizeHeader(header);
}
