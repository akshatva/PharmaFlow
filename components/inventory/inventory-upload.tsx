"use client";

import { ChangeEvent, useActionState, useMemo, useState } from "react";
import Papa from "papaparse";

import type { InventoryImportState } from "@/app/(app)/inventory/actions";
import { importInventoryCsv } from "@/app/(app)/inventory/actions";
import {
  normalizeInventoryCsvHeader,
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
      className="app-button-primary"
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
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
        "PDF and image inventory import are not available yet in this pass. CSV remains the supported import format.",
      ]);
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
      <div className="app-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="app-kicker">File import</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Inventory import
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              CSV with columns: <code className="text-slate-700">medicine_name</code>, <code className="text-slate-700">batch_number</code>, <code className="text-slate-700">quantity</code>, <code className="text-slate-700">expiry_date</code>. Existing batches update automatically.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="app-button-secondary"
            >
              Download sample CSV
            </button>
            <label className="app-button-subtle inline-flex w-full cursor-pointer sm:w-auto">
              <input
                type="file"
                accept=".csv,text/csv,.pdf,image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              Select file
            </label>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {fileName ? (
            <p className="text-sm text-slate-600">
              File: <span className="font-medium text-slate-900">{fileName}</span>
            </p>
          ) : null}

          {parseError ? (
            <p className="app-panel-danger">{parseError}</p>
          ) : null}

          {!parseError && parseWarnings.length ? (
            <p className="app-panel-warning">{parseWarnings[0]}</p>
          ) : null}

          {missingColumns.length ? (
            <p className="app-panel-danger">
              Missing required columns: {missingColumns.join(", ")}.
            </p>
          ) : null}

          {importState.error ? (
            <p className="app-panel-danger">{importState.error}</p>
          ) : null}

          {importState.success ? (
            <p className="app-panel-success">{importState.success}</p>
          ) : null}

          {(importState.success || importState.error) && importState.totalParsedRows > 0 ? (
            <div className="app-card-muted p-4">
              <p className="text-sm font-medium text-slate-900">Import summary</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <SummaryStat label="Imported" value={importState.importedRowsCount} />
                <SummaryStat label="Rejected" value={importState.invalidRowsCount} />
                <SummaryStat label="New batches" value={importState.newBatchesCreated} />
                <SummaryStat label="Updated" value={importState.existingBatchesUpdated} />
              </div>
            </div>
          ) : null}
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
            <span className="text-sm text-slate-500">Select a CSV to begin.</span>
          ) : !canImport ? (
            <span className="text-sm text-slate-500">
              Fix issues above before importing.
            </span>
          ) : rejectedRowsCount > 0 ? (
            <span className="text-sm text-slate-500">
              {validRows.length} valid, {rejectedRowsCount} skipped.
            </span>
          ) : (
            <span className="text-sm text-slate-500">
              {validRows.length} row{validRows.length === 1 ? "" : "s"} ready.
            </span>
          )}
        </form>
      </div>

      <div className="app-card p-5 sm:p-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
          {previewRows.length > 0 ? (
            <p className="mt-1 text-sm text-slate-500">
              {previewRows.length - invalidRows.length} valid, {invalidRows.length} invalid of {previewRows.length} row{previewRows.length === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>

        {previewRows.length ? (
          <>
            <div className="mt-6 space-y-4 md:hidden">
              {previewRows.map((row) => (
                <div key={row.rowNumber} className="app-card-muted p-4">
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
                    <div className="app-panel-danger mt-4">
                      <PreviewStatus row={row} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="app-table-shell mt-6 hidden md:block">
              <div className="overflow-x-auto">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Medicine</th>
                    <th>Batch</th>
                    <th>Quantity</th>
                    <th>Expiry</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.rowNumber} className="align-top">
                      <td className="text-slate-500">
                        {row.rowNumber}
                      </td>
                      <td className="text-slate-900">
                        {row.values.medicine_name || "—"}
                      </td>
                      <td className="text-slate-900">
                        {row.values.batch_number || "—"}
                      </td>
                      <td className="text-slate-900">
                        {row.values.quantity || "—"}
                      </td>
                      <td className="text-slate-900">
                        {row.values.expiry_date || "—"}
                      </td>
                      <td className="text-slate-900">
                        {row.values.sku || "—"}
                      </td>
                      <td className="text-slate-900">
                        {row.values.category || "—"}
                      </td>
                      <td className="text-slate-900">
                        {row.values.unit || "—"}
                      </td>
                      <td>
                        <PreviewStatus row={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </>
        ) : (
          <div className="app-empty-state mt-6">
            <h4 className="app-empty-title">Ready for validation</h4>
            <p className="app-empty-copy">Upload a CSV to preview batch data before importing.</p>
          </div>
        )}
      </div>
    </section>
  );
}
