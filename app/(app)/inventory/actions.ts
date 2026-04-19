"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  normalizeMedicineComparableName,
  normalizeMedicineDisplayName,
  normalizeInventoryDate,
  validateInventoryImportRows,
} from "@/services/inventory";
import { createStockAdjustmentLog } from "@/lib/stock-adjustments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InventoryImportState = {
  error: string | null;
  success: string | null;
  totalParsedRows: number;
  skippedEmptyRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  importedRowsCount: number;
  newMedicinesCreated: number;
  medicinesReused: number;
  newBatchesCreated: number;
  existingBatchesUpdated: number;
};

export type InventoryBatchMutationResult = {
  error: string | null;
  success: string | null;
};

async function getOrganizationContext() {
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
      supabase,
      user,
      membership: null,
      error: "Unable to resolve your organization for this request.",
    };
  }

  return {
    supabase,
    user,
    membership,
    error: null,
  };
}

export async function importInventoryCsv(
  _previousState: InventoryImportState,
  formData: FormData,
): Promise<InventoryImportState> {
  const rowsJson = String(formData.get("rowsJson") ?? "");
  const totalParsedRows = Number(formData.get("totalParsedRows") ?? 0);
  const skippedEmptyRows = Number(formData.get("skippedEmptyRows") ?? 0);
  const invalidRowsCount = Number(formData.get("invalidRowsCount") ?? 0);

  if (!rowsJson) {
    return {
      error: "No validated rows were provided for import.",
      success: null,
      totalParsedRows,
      skippedEmptyRows,
      validRowsCount: 0,
      invalidRowsCount,
      importedRowsCount: 0,
      newMedicinesCreated: 0,
      medicinesReused: 0,
      newBatchesCreated: 0,
      existingBatchesUpdated: 0,
    };
  }

  const { supabase, user, membership, error } = await getOrganizationContext();

  if (error || !membership) {
    return {
      error: error ?? "Unable to resolve your organization for this import.",
      success: null,
      totalParsedRows,
      skippedEmptyRows,
      validRowsCount: 0,
      invalidRowsCount,
      importedRowsCount: 0,
      newMedicinesCreated: 0,
      medicinesReused: 0,
      newBatchesCreated: 0,
      existingBatchesUpdated: 0,
    };
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(rowsJson);
  } catch {
    return {
      error: "The upload payload could not be read.",
      success: null,
      totalParsedRows,
      skippedEmptyRows,
      validRowsCount: 0,
      invalidRowsCount,
      importedRowsCount: 0,
      newMedicinesCreated: 0,
      medicinesReused: 0,
      newBatchesCreated: 0,
      existingBatchesUpdated: 0,
    };
  }

  const { errors, validRows } = validateInventoryImportRows(parsedPayload);
  const importTimestamp = new Date().toISOString();

  if (errors.length || !validRows.length) {
    return {
      error: errors[0] ?? "No valid rows were found to import.",
      success: null,
      totalParsedRows,
      skippedEmptyRows,
      validRowsCount: validRows.length,
      invalidRowsCount,
      importedRowsCount: 0,
      newMedicinesCreated: 0,
      medicinesReused: 0,
      newBatchesCreated: 0,
      existingBatchesUpdated: 0,
    };
  }

  const rowsByMedicine = new Map<
    string,
    {
      normalizedName: string;
      sourceRow: (typeof validRows)[number];
    }
  >();

  validRows.forEach((row) => {
    const displayName = normalizeMedicineDisplayName(row.medicine_name);
    const key = normalizeMedicineComparableName(displayName);

    if (!rowsByMedicine.has(key)) {
      rowsByMedicine.set(key, {
        normalizedName: key,
        sourceRow: {
          ...row,
          medicine_name: displayName,
        },
      });
    }
  });

  const normalizedMedicineNames = Array.from(rowsByMedicine.keys());
  const { data: existingMedicines, error: existingMedicinesError } = await supabase
    .from("medicines")
    .select("id, name, normalized_name")
    .eq("organization_id", membership.organization_id)
    .in("normalized_name", normalizedMedicineNames);

  if (existingMedicinesError) {
    return {
      error: "Unable to load existing medicines for this organization.",
      success: null,
      totalParsedRows,
      skippedEmptyRows,
      validRowsCount: validRows.length,
      invalidRowsCount,
      importedRowsCount: 0,
      newMedicinesCreated: 0,
      medicinesReused: 0,
      newBatchesCreated: 0,
      existingBatchesUpdated: 0,
    };
  }

  const medicineMap = new Map(
    existingMedicines.map((medicine) => [medicine.normalized_name ?? "", medicine.id]),
  );
  const medicinesReused = normalizedMedicineNames.filter((normalizedName) =>
    medicineMap.has(normalizedName),
  ).length;
  const missingMedicineRows = normalizedMedicineNames
    .filter((normalizedName) => !medicineMap.has(normalizedName))
    .map((normalizedName) => {
      const { sourceRow } = rowsByMedicine.get(normalizedName)!;

      return {
        organization_id: membership.organization_id,
        name: sourceRow.medicine_name,
        normalized_name: normalizedName,
        sku: sourceRow.sku,
        category: sourceRow.category,
        unit: sourceRow.unit,
      };
    });

  if (missingMedicineRows.length) {
    const { data: createdMedicines, error: createMedicinesError } = await supabase
      .from("medicines")
      .insert(missingMedicineRows)
      .select("id, name, normalized_name");

    if (createMedicinesError) {
      return {
        error: "Unable to create medicines from this upload.",
        success: null,
        totalParsedRows,
        skippedEmptyRows,
        validRowsCount: validRows.length,
        invalidRowsCount,
        importedRowsCount: 0,
        newMedicinesCreated: 0,
        medicinesReused,
        newBatchesCreated: 0,
        existingBatchesUpdated: 0,
      };
    }

    createdMedicines.forEach((medicine) => {
      medicineMap.set(medicine.normalized_name ?? "", medicine.id);
    });
  }

  const batchRows = validRows.map((row) => ({
    organization_id: membership.organization_id,
    medicine_id: medicineMap.get(normalizeMedicineComparableName(row.medicine_name)),
    batch_number: row.batch_number,
    quantity: row.quantity,
    expiry_date: row.expiry_date,
    purchase_price: row.purchase_price,
    selling_price: row.selling_price,
  }));

  if (batchRows.some((row) => !row.medicine_id)) {
    return {
      error: "One or more medicine records could not be linked during import.",
      success: null,
      totalParsedRows,
      skippedEmptyRows,
      validRowsCount: validRows.length,
      invalidRowsCount,
      importedRowsCount: 0,
      newMedicinesCreated: missingMedicineRows.length,
      medicinesReused,
      newBatchesCreated: 0,
      existingBatchesUpdated: 0,
    };
  }

  const dedupedBatchRows = new Map<
    string,
    (typeof batchRows)[number] & { medicine_id: string }
  >();

  batchRows.forEach((row) => {
    if (!row.medicine_id) {
      return;
    }

    const key = `${membership.organization_id}:${row.medicine_id}:${row.batch_number}`;
    dedupedBatchRows.set(key, {
      ...row,
      medicine_id: row.medicine_id,
    });
  });

  const importBatchRows = Array.from(dedupedBatchRows.values());
  const medicineIds = Array.from(new Set(importBatchRows.map((row) => row.medicine_id)));
  const batchNumbers = Array.from(new Set(importBatchRows.map((row) => row.batch_number)));

  const { data: existingBatches, error: existingBatchesError } = await supabase
    .from("inventory_batches")
    .select("id, medicine_id, batch_number, quantity, purchase_price, selling_price")
    .eq("organization_id", membership.organization_id)
    .in("medicine_id", medicineIds)
    .in("batch_number", batchNumbers);

  if (existingBatchesError) {
    return {
      error: "Unable to load existing inventory batches for this import.",
      success: null,
      totalParsedRows,
      skippedEmptyRows,
      validRowsCount: validRows.length,
      invalidRowsCount,
      importedRowsCount: 0,
      newMedicinesCreated: missingMedicineRows.length,
      medicinesReused,
      newBatchesCreated: 0,
      existingBatchesUpdated: 0,
    };
  }

  const existingBatchMap = new Map(
    (existingBatches ?? []).map((batch) => [
      `${membership.organization_id}:${batch.medicine_id}:${batch.batch_number}`,
      batch,
    ]),
  );

  const newBatchRows: Array<(typeof importBatchRows)[number]> = [];
  const batchUpdates: Array<{
    id: string;
    medicineId: string;
    batchNumber: string;
    previousQuantity: number;
    nextQuantity: number;
    expiryDate: string;
    purchasePrice: number | null;
    sellingPrice: number | null;
  }> = [];

  importBatchRows.forEach((row) => {
    const key = `${membership.organization_id}:${row.medicine_id}:${row.batch_number}`;
    const existingBatch = existingBatchMap.get(key);

    if (!existingBatch) {
      newBatchRows.push(row);
      return;
    }

    batchUpdates.push({
      id: existingBatch.id,
      medicineId: row.medicine_id,
      batchNumber: row.batch_number,
      previousQuantity: existingBatch.quantity,
      nextQuantity: row.quantity,
      expiryDate: row.expiry_date,
      purchasePrice: row.purchase_price ?? existingBatch.purchase_price ?? null,
      sellingPrice: row.selling_price ?? existingBatch.selling_price ?? null,
    });
  });

  let createdBatchCount = 0;
  let updatedBatchCount = 0;

  if (newBatchRows.length) {
    const { data: createdBatches, error: batchInsertError } = await supabase
      .from("inventory_batches")
      .insert(
        newBatchRows.map((row) => ({
          ...row,
          last_imported_at: importTimestamp,
        })),
      )
      .select("id, medicine_id, batch_number, quantity");

    if (batchInsertError) {
      return {
        error: "Unable to import inventory batches from this file.",
        success: null,
        totalParsedRows,
        skippedEmptyRows,
        validRowsCount: validRows.length,
        invalidRowsCount,
        importedRowsCount: 0,
        newMedicinesCreated: missingMedicineRows.length,
        medicinesReused,
        newBatchesCreated: 0,
        existingBatchesUpdated: 0,
      };
    }

    createdBatchCount = createdBatches?.length ?? 0;

    await Promise.all(
      (createdBatches ?? []).map((batch) =>
        createStockAdjustmentLog(supabase, {
          organizationId: membership.organization_id,
          medicineId: batch.medicine_id,
          inventoryBatchId: batch.id,
          userId: user.id,
          actionType: "batch_created",
          newQuantity: batch.quantity,
          quantityChange: batch.quantity,
          note: "Inventory batch created from CSV import.",
          metadata: {
            source: "inventory_csv_import",
            batch_number: batch.batch_number,
          },
        }),
      ),
    );
  }

  for (const batchUpdate of batchUpdates) {
    const { error: updateBatchError } = await supabase
      .from("inventory_batches")
      .update({
        quantity: batchUpdate.nextQuantity,
        expiry_date: batchUpdate.expiryDate,
        purchase_price: batchUpdate.purchasePrice,
        selling_price: batchUpdate.sellingPrice,
        last_imported_at: importTimestamp,
      })
      .eq("organization_id", membership.organization_id)
      .eq("id", batchUpdate.id);

    if (updateBatchError) {
      return {
        error: "Unable to update duplicate inventory batches from this file.",
        success: null,
        totalParsedRows,
        skippedEmptyRows,
        validRowsCount: validRows.length,
        invalidRowsCount,
        importedRowsCount: createdBatchCount,
        newMedicinesCreated: missingMedicineRows.length,
        medicinesReused,
        newBatchesCreated: createdBatchCount,
        existingBatchesUpdated: updatedBatchCount,
      };
    }

    updatedBatchCount += 1;

    await createStockAdjustmentLog(supabase, {
      organizationId: membership.organization_id,
      medicineId: batchUpdate.medicineId,
      inventoryBatchId: batchUpdate.id,
      userId: user.id,
      actionType:
        batchUpdate.previousQuantity !== batchUpdate.nextQuantity
          ? "manual_adjustment"
          : "batch_updated",
      previousQuantity: batchUpdate.previousQuantity,
      newQuantity: batchUpdate.nextQuantity,
      quantityChange: batchUpdate.nextQuantity - batchUpdate.previousQuantity,
      note: "Inventory batch updated from CSV import.",
      metadata: {
        source: "inventory_csv_import",
        batch_number: batchUpdate.batchNumber,
      },
    });
  }

  const importedRowsCount = createdBatchCount + updatedBatchCount;

  return {
    error: null,
    success: `Snapshot import applied successfully. Imported ${importedRowsCount} valid row${importedRowsCount === 1 ? "" : "s"}, created ${createdBatchCount} new batch${createdBatchCount === 1 ? "" : "es"}, and updated ${updatedBatchCount} existing batch${updatedBatchCount === 1 ? "" : "es"} by replacing stored values for matching batches.${invalidRowsCount > 0 ? ` ${invalidRowsCount} invalid row${invalidRowsCount === 1 ? "" : "s"} were not imported.` : ""}`,
    totalParsedRows,
    skippedEmptyRows,
    validRowsCount: validRows.length,
    invalidRowsCount,
    importedRowsCount,
    newMedicinesCreated: missingMedicineRows.length,
    medicinesReused,
    newBatchesCreated: createdBatchCount,
    existingBatchesUpdated: updatedBatchCount,
  };
}

export async function createInventoryBatch(
  formData: FormData,
): Promise<InventoryBatchMutationResult> {
  const medicineId = String(formData.get("medicineId") ?? "").trim();
  const batchNumber = String(formData.get("batchNumber") ?? "").trim();
  const quantityValue = String(formData.get("quantity") ?? "").trim();
  const expiryDateValue = String(formData.get("expiryDate") ?? "").trim();
  const purchasePriceValue = String(formData.get("purchasePrice") ?? "").trim();
  const sellingPriceValue = String(formData.get("sellingPrice") ?? "").trim();

  if (!medicineId || !batchNumber || !quantityValue || !expiryDateValue) {
    return {
      error: "Medicine, batch number, quantity, and expiry date are required.",
      success: null,
    };
  }

  const quantity = Number(quantityValue);
  const expiryDate = normalizeInventoryDate(expiryDateValue);
  const purchasePrice = purchasePriceValue ? Number(purchasePriceValue) : null;
  const sellingPrice = sellingPriceValue ? Number(sellingPriceValue) : null;

  if (!Number.isInteger(quantity) || quantity < 0) {
    return {
      error: "Quantity must be a non-negative whole number.",
      success: null,
    };
  }

  if (!expiryDate) {
    return {
      error: "Expiry date must be a valid date.",
      success: null,
    };
  }

  if (purchasePriceValue && !Number.isFinite(purchasePrice!)) {
    return {
      error: "Purchase price must be a valid number.",
      success: null,
    };
  }

  if (sellingPriceValue && !Number.isFinite(sellingPrice!)) {
    return {
      error: "Selling price must be a valid number.",
      success: null,
    };
  }

  const { supabase, user, membership, error } = await getOrganizationContext();

  if (error || !membership) {
    return {
      error: error ?? "Unable to resolve your organization for this request.",
      success: null,
    };
  }

  const { data: medicine, error: medicineError } = await supabase
    .from("medicines")
    .select("id")
    .eq("organization_id", membership.organization_id)
    .eq("id", medicineId)
    .maybeSingle();

  if (medicineError || !medicine) {
    return {
      error: "Selected medicine could not be found in your organization.",
      success: null,
    };
  }

  const { data: createdBatch, error: insertError } = await supabase
    .from("inventory_batches")
    .insert({
      organization_id: membership.organization_id,
      medicine_id: medicineId,
      batch_number: batchNumber,
      quantity,
      expiry_date: expiryDate,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
    })
    .select("id, medicine_id, batch_number, quantity")
    .single();

  if (insertError || !createdBatch) {
    return {
      error: "Unable to add the new inventory batch.",
      success: null,
    };
  }

  await createStockAdjustmentLog(supabase, {
    organizationId: membership.organization_id,
    medicineId: createdBatch.medicine_id,
    inventoryBatchId: createdBatch.id,
    userId: user.id,
    actionType: "batch_created",
    newQuantity: createdBatch.quantity,
    quantityChange: createdBatch.quantity,
    note: "Manual batch created.",
    metadata: {
      source: "manual_create",
      batch_number: createdBatch.batch_number,
    },
  });

  revalidatePath("/inventory");
  revalidatePath("/stock-adjustments");

  return {
    error: null,
    success: "Inventory batch added successfully.",
  };
}

export async function updateInventoryBatch(
  formData: FormData,
): Promise<InventoryBatchMutationResult> {
  const batchId = String(formData.get("batchId") ?? "").trim();
  const quantityValue = String(formData.get("quantity") ?? "").trim();
  const expiryDateValue = String(formData.get("expiryDate") ?? "").trim();
  const purchasePriceValue = String(formData.get("purchasePrice") ?? "").trim();
  const sellingPriceValue = String(formData.get("sellingPrice") ?? "").trim();

  if (!batchId || !quantityValue || !expiryDateValue) {
    return {
      error: "Batch, quantity, and expiry date are required.",
      success: null,
    };
  }

  const quantity = Number(quantityValue);
  const expiryDate = normalizeInventoryDate(expiryDateValue);
  const purchasePrice = purchasePriceValue ? Number(purchasePriceValue) : null;
  const sellingPrice = sellingPriceValue ? Number(sellingPriceValue) : null;

  if (!Number.isInteger(quantity) || quantity < 0) {
    return {
      error: "Quantity must be a non-negative whole number.",
      success: null,
    };
  }

  if (!expiryDate) {
    return {
      error: "Expiry date must be a valid date.",
      success: null,
    };
  }

  if (purchasePriceValue && !Number.isFinite(purchasePrice!)) {
    return {
      error: "Purchase price must be a valid number.",
      success: null,
    };
  }

  if (sellingPriceValue && !Number.isFinite(sellingPrice!)) {
    return {
      error: "Selling price must be a valid number.",
      success: null,
    };
  }

  const { supabase, user, membership, error } = await getOrganizationContext();

  if (error || !membership) {
    return {
      error: error ?? "Unable to resolve your organization for this request.",
      success: null,
    };
  }

  const { data: existingBatch, error: existingBatchError } = await supabase
    .from("inventory_batches")
    .select("id, medicine_id, batch_number, quantity")
    .eq("organization_id", membership.organization_id)
    .eq("id", batchId)
    .maybeSingle();

  if (existingBatchError || !existingBatch) {
    return {
      error: "Unable to find the inventory batch you want to update.",
      success: null,
    };
  }

  const { error: updateError } = await supabase
    .from("inventory_batches")
    .update({
      quantity,
      expiry_date: expiryDate,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
    })
    .eq("organization_id", membership.organization_id)
    .eq("id", batchId);

  if (updateError) {
    return {
      error: "Unable to update the inventory batch.",
      success: null,
    };
  }

  const quantityChanged = existingBatch.quantity !== quantity;

  await createStockAdjustmentLog(supabase, {
    organizationId: membership.organization_id,
    medicineId: existingBatch.medicine_id,
    inventoryBatchId: existingBatch.id,
    userId: user.id,
    actionType: quantityChanged ? "manual_adjustment" : "batch_updated",
    previousQuantity: existingBatch.quantity,
    newQuantity: quantity,
    quantityChange: quantityChanged ? quantity - existingBatch.quantity : 0,
    note: quantityChanged ? "Manual quantity adjustment." : "Inventory batch details updated.",
    metadata: {
      source: "manual_edit",
      batch_number: existingBatch.batch_number,
    },
  });

  revalidatePath("/inventory");
  revalidatePath("/stock-adjustments");

  return {
    error: null,
    success: "Inventory batch updated successfully.",
  };
}

export async function deleteInventoryBatch(
  formData: FormData,
): Promise<InventoryBatchMutationResult> {
  const batchId = String(formData.get("batchId") ?? "").trim();

  if (!batchId) {
    return {
      error: "Batch identifier is missing.",
      success: null,
    };
  }

  const { supabase, user, membership, error } = await getOrganizationContext();

  if (error || !membership) {
    return {
      error: error ?? "Unable to resolve your organization for this request.",
      success: null,
    };
  }

  const { data: existingBatch, error: existingBatchError } = await supabase
    .from("inventory_batches")
    .select("id, medicine_id, batch_number, quantity")
    .eq("organization_id", membership.organization_id)
    .eq("id", batchId)
    .maybeSingle();

  if (existingBatchError || !existingBatch) {
    return {
      error: "Unable to find the inventory batch you want to delete.",
      success: null,
    };
  }

  await createStockAdjustmentLog(supabase, {
    organizationId: membership.organization_id,
    medicineId: existingBatch.medicine_id,
    inventoryBatchId: existingBatch.id,
    userId: user.id,
    actionType: "batch_deleted",
    previousQuantity: existingBatch.quantity,
    newQuantity: 0,
    quantityChange: -existingBatch.quantity,
    note: "Inventory batch deleted.",
    metadata: {
      source: "manual_delete",
      batch_number: existingBatch.batch_number,
    },
  });

  const { error: deleteError } = await supabase
    .from("inventory_batches")
    .delete()
    .eq("organization_id", membership.organization_id)
    .eq("id", batchId);

  if (deleteError) {
    return {
      error: "Unable to delete the inventory batch.",
      success: null,
    };
  }

  revalidatePath("/inventory");
  revalidatePath("/stock-adjustments");

  return {
    error: null,
    success: "Inventory batch deleted successfully.",
  };
}
