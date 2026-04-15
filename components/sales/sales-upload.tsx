"use client";

import { ChangeEvent, useActionState, useMemo, useState } from "react";
import Papa from "papaparse";

import type { SalesImportState } from "@/app/(app)/sales/actions";
import { importSalesCsv } from "@/app/(app)/sales/actions";
import {
  normalizeSalesCsvHeader,
  requiredSalesColumns,
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

export function SalesUpload() {
  const [importState, importAction, isPending] = useActionState(importSalesCsv, initialImportState);
  const [fileName, setFileName] = useState("");
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<SalesPreviewRow[]>([]);
  const [validRows, setValidRows] = useState<SalesImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [skippedEmptyRows, setSkippedEmptyRows] = useState(0);

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

    Papa.parse<Record<string, string>>(file, {
      delimiter: ",",
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeSalesCsvHeader,
      complete(results) {
        const nonFatalErrors = results.errors.filter(
          (error) => error.code !== "UndetectableDelimiter",
        );
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
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-slate-950">Sales CSV upload</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Upload sales records for your organization, validate the rows, and import the known medicines into PharmaFlow.
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Required columns: <code>medicine_name</code>, <code>quantity_sold</code>, <code>sold_at</code>
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
            Select CSV file
          </label>
        </div>

        <div className="mt-5 space-y-3">
          {fileName ? (
            <p className="text-sm text-slate-600">
              Selected file: <span className="font-medium text-slate-900">{fileName}</span>
            </p>
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
              Missing required columns: {missingColumns.join(", ")}.
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

        <div className="mt-6 grid gap-3 text-sm text-slate-600 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Preview rows</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{previewRows.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Valid rows</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{validRows.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Imported</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{importState.importedCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Skipped</p>
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

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Preview</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Rows are trimmed, empty lines are skipped, and row-level issues are shown before import.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            Expected columns: {requiredSalesColumns.join(", ")}
          </div>
        </div>

        {previewRows.length ? (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Row</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Medicine</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Quantity Sold</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Sold At</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">SKU</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.rowNumber} className="align-top">
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-500">{row.rowNumber}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-900">
                      {row.values.medicine_name || "—"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-900">
                      {row.values.quantity_sold || "—"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-900">
                      {row.values.sold_at || "—"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-900">
                      {row.values.sku || "—"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      {row.errors.length ? (
                        <div className="space-y-1">
                          {row.errors.map((error) => (
                            <p key={error} className="text-red-600">
                              {error}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <span className="text-emerald-700">Valid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No rows to preview yet. Upload a CSV file to validate and inspect the data before importing it.
          </div>
        )}
      </div>
    </section>
  );
}
