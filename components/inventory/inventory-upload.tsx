"use client";

import { ChangeEvent, useActionState, useMemo, useState } from "react";
import Papa from "papaparse";

import type { InventoryImportState } from "@/app/(app)/inventory/actions";
import { importInventoryCsv } from "@/app/(app)/inventory/actions";
import {
  normalizeInventoryCsvHeader,
  optionalInventoryColumns,
  requiredInventoryColumns,
  supportedInventoryColumns,
  validateInventoryCsvRows,
  type InventoryPreviewRow,
  type InventoryImportRow,
} from "@/services/inventory";

const initialImportState: InventoryImportState = {
  error: null,
  success: null,
  totalParsedRows: 0,
  skippedEmptyRows: 0,
  validRowsCount: 0,
  invalidRowsCount: 0,
  importedRowsCount: 0,
  newMedicinesCreated: 0,
  medicinesReused: 0,
  newBatchesCreated: 0,
  existingBatchesUpdated: 0,
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

function PreviewStatus({ row }: { row: InventoryPreviewRow }) {
  if (row.errors.length) {
    return (
      <div className="space-y-2">
        <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
          Invalid
        </span>
        <div className="space-y-1">
          {row.errors.map((error) => (
            <p key={error} className="text-sm text-red-600">
              {error}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
      Valid
    </span>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function InventoryUpload() {
  const [importState, importAction, isPending] = useActionState(
    importInventoryCsv,
    initialImportState,
  );
  const [fileName, setFileName] = useState("");
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<InventoryPreviewRow[]>([]);
  const [validRows, setValidRows] = useState<InventoryImportRow[]>([]);
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
      transformHeader: normalizeInventoryCsvHeader,
      complete(results) {
        const nonFatalErrors = results.errors.filter(
          (error) => error.code !== "UndetectableDelimiter",
        );
        const validation = validateInventoryCsvRows(results.data, results.meta.fields ?? []);

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
              ? "Malformed CSV. Make sure the file is comma-separated and each row uses the same columns as the header."
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
  const canImport = validRows.length > 0 && missingColumns.length === 0 && !parseError;
  const totalParsedRows = previewRows.length + skippedEmptyRows;
  const rejectedRowsCount = invalidRows.length;

  function handleDownloadTemplate() {
    const templateRows = [
      supportedInventoryColumns.join(","),
      "Paracetamol 650,BATCH-001,120,2027-12-31,1.5,2.2,PCM650,TABLET,strip",
      "Amoxicillin 500,BATCH-002,48,2026-10-15,4.8,6.5,AMX500,CAPSULE,box",
    ];
    const blob = new Blob([templateRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "pharmaflow-inventory-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-slate-950">Inventory CSV upload</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Upload batch-based inventory data, validate it before import, and keep repeated CSV refreshes predictable for your team.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Required columns
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  <code>medicine_name</code>, <code>batch_number</code>, <code>quantity</code>,{" "}
                  <code>expiry_date</code>
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Optional columns
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {optionalInventoryColumns.map((column, index) => (
                    <span key={column}>
                      <code>{column}</code>
                      {index < optionalInventoryColumns.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              Use a comma-separated file with one header row. Dates work best in <code>YYYY-MM-DD</code>{" "}
              format. Common header variations like <code>qty</code>, <code>expiry</code>, and{" "}
              <code>batch no</code> are accepted automatically when they clearly map to the expected columns.
            </div>
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
              Matching batches are updated using snapshot logic. If a row matches the same medicine
              and batch number, PharmaFlow replaces the stored quantity and batch details with the
              uploaded values. Quantity is replaced, not added, and batches missing from the file
              are not deleted.
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Download sample CSV
            </button>
            <label className="inline-flex w-full cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 sm:w-auto">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
              Select CSV file
            </label>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {fileName ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
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

          {(importState.success || importState.error) && importState.totalParsedRows > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">Last import result</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                <SummaryStat label="Rows parsed" value={importState.totalParsedRows} />
                <SummaryStat label="Rows imported" value={importState.importedRowsCount} />
                <SummaryStat label="Rows rejected" value={importState.invalidRowsCount} />
                <SummaryStat label="Skipped empty" value={importState.skippedEmptyRows} />
                <SummaryStat label="New batches created" value={importState.newBatchesCreated} />
                <SummaryStat label="Batches updated" value={importState.existingBatchesUpdated} />
                <SummaryStat label="New medicines created" value={importState.newMedicinesCreated} />
                <SummaryStat label="Medicines reused" value={importState.medicinesReused} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <SummaryStat label="Preview rows" value={previewRows.length} />
          <SummaryStat label="Valid rows" value={validRows.length} />
          <SummaryStat label="Invalid rows" value={rejectedRowsCount} />
          <SummaryStat label="Skipped empty" value={skippedEmptyRows} />
        </div>

        <form action={importAction} className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <input type="hidden" name="rowsJson" value={JSON.stringify(validRows)} />
          <input type="hidden" name="totalParsedRows" value={String(totalParsedRows)} />
          <input type="hidden" name="skippedEmptyRows" value={String(skippedEmptyRows)} />
          <input type="hidden" name="invalidRowsCount" value={String(invalidRows.length)} />
          <ImportSubmitButton
            disabled={!canImport || isPending}
            label={isPending ? "Importing..." : "Import inventory"}
          />
          {!fileName ? (
            <span className="text-sm text-slate-500">Choose a CSV file to begin.</span>
          ) : !canImport ? (
            <span className="text-sm text-slate-500">
              No valid rows available. Fix validation issues before importing.
            </span>
          ) : rejectedRowsCount > 0 ? (
            <span className="text-sm text-slate-500">
              {validRows.length} valid row{validRows.length === 1 ? "" : "s"} will import using snapshot updates.{" "}
              {rejectedRowsCount} invalid row{rejectedRowsCount === 1 ? "" : "s"} will be rejected.
            </span>
          ) : (
            <span className="text-sm text-slate-500">
              Ready to import {validRows.length} validated row
              {validRows.length === 1 ? "" : "s"} using snapshot updates for matching batches.
            </span>
          )}
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Preview</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Rows are trimmed, empty lines are skipped, and row-level issues are shown before import.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Expected columns: {supportedInventoryColumns.join(", ")}
          </div>
        </div>

        {previewRows.length ? (
          <>
            <div className="mt-6 space-y-4 md:hidden">
              {previewRows.map((row) => (
                <div key={row.rowNumber} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Row {row.rowNumber}
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-950">
                        {row.values.medicine_name || "Unnamed medicine"}
                      </p>
                    </div>
                    <PreviewStatus row={row} />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Batch</p>
                      <p className="mt-1 text-sm text-slate-700">{row.values.batch_number || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Quantity</p>
                      <p className="mt-1 text-sm text-slate-700">{row.values.quantity || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Expiry</p>
                      <p className="mt-1 text-sm text-slate-700">{row.values.expiry_date || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">SKU</p>
                      <p className="mt-1 text-sm text-slate-700">{row.values.sku || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Category</p>
                      <p className="mt-1 text-sm text-slate-700">{row.values.category || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Unit</p>
                      <p className="mt-1 text-sm text-slate-700">{row.values.unit || "—"}</p>
                    </div>
                  </div>

                  {row.errors.length ? (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                      <PreviewStatus row={row} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-6 hidden overflow-x-auto md:block">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Row</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Medicine</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Batch</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Quantity</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Expiry</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">SKU</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Category</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Unit</th>
                    <th className="border-b border-slate-200 px-3 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.rowNumber} className="align-top">
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-500">
                        {row.rowNumber}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-900">
                        {row.values.medicine_name || "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-900">
                        {row.values.batch_number || "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-900">
                        {row.values.quantity || "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-900">
                        {row.values.expiry_date || "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-900">
                        {row.values.sku || "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-900">
                        {row.values.category || "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-900">
                        {row.values.unit || "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <PreviewStatus row={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No rows to preview yet. Upload a CSV file to validate and inspect the data before importing it.
          </div>
        )}
      </div>
    </section>
  );
}
