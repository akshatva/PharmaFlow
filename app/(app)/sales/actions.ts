"use server";

import { redirect } from "next/navigation";

import { validateSalesImportRows } from "@/lib/sales/csv";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SalesImportState = {
  error: string | null;
  success: string | null;
  importedCount: number;
  skippedCount: number;
  unresolvedMedicines: string[];
};

export async function importSalesCsv(
  _previousState: SalesImportState,
  formData: FormData,
): Promise<SalesImportState> {
  const rowsJson = String(formData.get("rowsJson") ?? "");

  if (!rowsJson) {
    return {
      error: "No validated rows were provided for import.",
      success: null,
      importedCount: 0,
      skippedCount: 0,
      unresolvedMedicines: [],
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return {
      error: "Unable to resolve your organization for this import.",
      success: null,
      importedCount: 0,
      skippedCount: 0,
      unresolvedMedicines: [],
    };
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(rowsJson);
  } catch {
    return {
      error: "The upload payload could not be read.",
      success: null,
      importedCount: 0,
      skippedCount: 0,
      unresolvedMedicines: [],
    };
  }

  const { errors, validRows } = validateSalesImportRows(parsedPayload);

  if (errors.length || !validRows.length) {
    return {
      error: errors[0] ?? "No valid sales rows were found to import.",
      success: null,
      importedCount: 0,
      skippedCount: 0,
      unresolvedMedicines: [],
    };
  }

  const medicineNames = Array.from(new Set(validRows.map((row) => row.medicine_name)));
  const { data: medicines, error: medicinesError } = await supabase
    .from("medicines")
    .select("id, name")
    .eq("organization_id", membership.organization_id)
    .in("name", medicineNames);

  if (medicinesError) {
    return {
      error: "Unable to load medicines for this organization.",
      success: null,
      importedCount: 0,
      skippedCount: 0,
      unresolvedMedicines: [],
    };
  }

  const medicineMap = new Map(medicines.map((medicine) => [medicine.name, medicine.id]));
  const unresolvedMedicines = Array.from(
    new Set(validRows.filter((row) => !medicineMap.has(row.medicine_name)).map((row) => row.medicine_name)),
  );

  const salesRows = validRows
    .filter((row) => medicineMap.has(row.medicine_name))
    .map((row) => ({
      organization_id: membership.organization_id,
      medicine_id: medicineMap.get(row.medicine_name)!,
      quantity_sold: row.quantity_sold,
      sold_at: row.sold_at,
    }));

  if (!salesRows.length) {
    return {
      error: "No matching medicines were found for this sales CSV.",
      success: null,
      importedCount: 0,
      skippedCount: validRows.length,
      unresolvedMedicines,
    };
  }

  const { error: salesInsertError } = await supabase.from("sales_records").insert(salesRows);

  if (salesInsertError) {
    return {
      error: "Unable to import sales records from this file.",
      success: null,
      importedCount: 0,
      skippedCount: 0,
      unresolvedMedicines: [],
    };
  }

  const skippedCount = validRows.length - salesRows.length;

  return {
    error: null,
    success:
      skippedCount > 0
        ? `Imported ${salesRows.length} sales row${salesRows.length === 1 ? "" : "s"} and skipped ${skippedCount} row${skippedCount === 1 ? "" : "s"} for unknown medicines.`
        : `Imported ${salesRows.length} sales row${salesRows.length === 1 ? "" : "s"} successfully.`,
    importedCount: salesRows.length,
    skippedCount,
    unresolvedMedicines,
  };
}
