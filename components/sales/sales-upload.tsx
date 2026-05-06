"use client";

import { ChangeEvent, useActionState, useMemo, useState } from "react";
import Papa from "papaparse";

import type { SalesImportState } from "@/app/(app)/sales/actions";
import { importSalesCsv } from "@/app/(app)/sales/actions";
import {
  normalizeSalesCsvHeader,
  requiredSalesColumns,
  salesColumnAliases,
  validateSalesCsvRows,
  type SalesImportRow,
  type SalesPreviewRow,
} from "@/lib/sales/csv";

const initialImportState: SalesImportState = {
  error: null,
  success: null,
  importedCount: 0,
  skippedCount: 0,
  unresolvedMedicines: [],
};

function ImportSubmitButton({
  disabled,
  label,
}: {
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}

function SalesPreviewStatus({ row }: { row: SalesPreviewRow }) {
  if (!row.errors.length) {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Valid
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        Needs fix
      </span>
      <div className="space-y-1 rounded-xl border border-red-100 bg-red-50/70 px-3 py-2">
        {row.errors.map((error) => (
          <p key={error} className="text-xs leading-5 text-red-700">
            {error}
          </p>
        ))}
      </div>
    </div>
  );
}

function formatAcceptedColumns(column: keyof typeof salesColumnAliases) {
  return salesColumnAliases[column].join(", ");
}

function formatMissingColumn(column: string) {
  if (column in salesColumnAliases) {
    return `${column} (${formatAcceptedColumns(column as keyof typeof salesColumnAliases)})`;
  }

  return column;
}

export function SalesUpload() {
  const [importState, importAction, isPending] = useActionState(importSalesCsv, initialImportState);
  const [fileName, setFileName] = useState("");
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<SalesPreviewRow[]>([]);
  const [validRows, setValidRows] = useState<SalesImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [skippedEmptyRows, setSkippedEmptyRows] = useState(0);

  function isCsvFile(file: File) {
    return file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setParseError(null);
    setParseWarnings([]);
    setMissingColumns([]);
    setPreviewRows([]);
    setValidRows([]);
    setSkippedEmptyRows(0);
    setFileName(file?.name ?? "");

    if (!file) {
      return;
    }

    if (!isCsvFile(file)) {
      setParseWarnings([
        "PDF and image sales import are not available yet in this pass. CSV remains the supported import format.",
      ]);
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      delimiter: ",",
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeSalesCsvHeader,
      complete(results) {
        const nonFatalErrors = results.errors.filter(
          (error) => error.code !== "UndetectableDelimiter",
        );
        const hasHeaderRow = (results.meta.fields ?? []).some((field) => field.trim());
        const hasDataRows = results.data.some((row) =>
          Object.values(row ?? {}).some((value) => String(value ?? "").trim()),
        );

        if (!hasHeaderRow) {
          setParseError(
            "CSV is missing headers. Add a header row with medicine_name, quantity_sold, and sold_at.",
          );
          return;
        }

        if (!hasDataRows) {
          setParseError("CSV is empty. Add at least one sales row under the header.");
          return;
        }

        const validation = validateSalesCsvRows(results.data, results.meta.fields ?? []);

        setMissingColumns(validation.missingColumns);
        setPreviewRows(validation.previewRows);
        setValidRows(validation.validRows);
        setSkippedEmptyRows(validation.skippedEmptyRows);

        if (nonFatalErrors.length) {
          const hasFieldMismatch = nonFatalErrors.some(
            (error) => error.code === "TooFewFields" || error.code === "TooManyFields",
          );

          setParseError(
            hasFieldMismatch
              ? "Malformed CSV. Make sure the file is comma-separated and each row has the same columns as the header."
              : nonFatalErrors[0]?.message ?? "The CSV file could not be parsed.",
          );
          return;
        }

        if (results.errors.length) {
          setParseWarnings(results.errors.map((error) => error.message).filter(Boolean));
        }

        if (!validation.previewRows.length) {
          setParseError("No sales rows could be read from this CSV.");
        }
      },
      error(error) {
        setParseError(error.message);
      },
    });
  }

  const invalidRows = useMemo(
    () => previewRows.filter((row) => row.errors.length > 0),
    [previewRows],
  );
  const canImport =
    validRows.length > 0 && missingColumns.length === 0 && invalidRows.length === 0 && !parseError;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-slate-950">Sales import</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Upload a CSV, review the preview, then import matched medicines.
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Expected columns (canonical): medicine_name, quantity_sold, sold_at.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-700">Medicine</p>
                <p className="mt-1 leading-5">{formatAcceptedColumns("medicine_name")}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-700">Quantity</p>
                <p className="mt-1 leading-5">{formatAcceptedColumns("quantity_sold")}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-700">Sale date</p>
                <p className="mt-1 leading-5">{formatAcceptedColumns("sold_at")}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Examples that work: medicine,qty,date | product_name,quantity,sale_date |
              medicine_name,quantity_sold,sold_at
            </p>
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              CSV import is active. PDF and image extraction are not enabled yet.
            </p>
          </div>

          <label className="inline-flex w-fit cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100">
            <input
              type="file"
              accept=".csv,text/csv,.pdf,image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            Select file
          </label>
        </div>

        <div className="mt-5 space-y-3">
          {fileName ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Selected file: <span className="font-medium text-slate-900">{fileName}</span>
            </div>
          ) : null}

          {parseError ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {parseError}
            </p>
          ) : null}

          {!parseError && parseWarnings.length ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {parseWarnings[0]}
            </p>
          ) : null}

          {missingColumns.length ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Missing required columns: {missingColumns.map(formatMissingColumn).join("; ")}.
            </p>
          ) : null}

          {importState.error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {importState.error}
            </p>
          ) : null}

          {importState.success ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {importState.success}
            </p>
          ) : null}

          {importState.unresolvedMedicines.length ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Unknown medicines skipped: {importState.unresolvedMedicines.join(", ")}.
            </p>
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-slate-600 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Preview rows</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{previewRows.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Valid rows</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{validRows.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Imported</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{importState.importedCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Skipped</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {invalidRows.length + skippedEmptyRows + importState.skippedCount}
            </p>
          </div>
        </div>

        <form action={importAction} className="mt-6 flex flex-wrap items-center gap-3">
          <input type="hidden" name="rowsJson" value={JSON.stringify(validRows)} />
          <ImportSubmitButton
            disabled={!canImport || isPending}
            label={isPending ? "Importing..." : "Import sales"}
          />
          {!fileName ? (
            <span className="text-sm text-slate-500">Choose a CSV file to begin.</span>
          ) : !canImport ? (
            <span className="text-sm text-slate-500">Fix validation issues before importing.</span>
          ) : (
            <span className="text-sm text-slate-500">
              Ready to import {validRows.length} validated row{validRows.length === 1 ? "" : "s"}.
            </span>
          )}
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Preview</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review row status before import.
            </p>
          </div>
          <div className="w-fit rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            Required: {requiredSalesColumns.join(", ")}
          </div>
        </div>

        {previewRows.length ? (
          <div className="app-table-shell mt-6 overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Medicine</th>
                  <th>Quantity Sold</th>
                  <th>Sold At</th>
                  <th>SKU</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.rowNumber} className="align-top">
                    <td className="text-slate-500">{row.rowNumber}</td>
                    <td className="text-slate-900">
                      {row.values.medicine_name || "—"}
                    </td>
                    <td className="text-slate-900">
                      {row.values.quantity_sold || "—"}
                    </td>
                    <td className="text-slate-900">
                      {row.values.sold_at || "—"}
                    </td>
                    <td className="text-slate-900">
                      {row.values.sku || "—"}
                    </td>
                    <td>
                      <SalesPreviewStatus row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No rows to preview yet. Upload a CSV to validate before importing.
          </div>
        )}
      </div>
    </section>
  );
}
