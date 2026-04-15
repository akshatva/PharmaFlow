"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { validateInventoryImportRows } from "@/lib/inventory/csv";
import { createStockAdjustmentLog } from "@/lib/stock-adjustments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InventoryImportState = {
  error: string | null;
  success: string | null;
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

function normalizeInventoryDate(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString().slice(0, 10);
}

export async function importInventoryCsv(
  _previousState: InventoryImportState,
  formData: FormData,
): Promise<InventoryImportState> {
  const rowsJson = String(formData.get("rowsJson") ?? "");

  if (!rowsJson) {
    return {
      error: "No validated rows were provided for import.",
      success: null,
    };
  }

  const { supabase, user, membership, error } = await getOrganizationContext();

  if (error || !membership) {
    return {
      error: error ?? "Unable to resolve your organization for this import.",
      success: null,
    };
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(rowsJson);
  } catch {
    return {
      error: "The upload payload could not be read.",
      success: null,
    };
  }

  const { errors, validRows } = validateInventoryImportRows(parsedPayload);

  if (errors.length || !validRows.length) {
    return {
      error: errors[0] ?? "No valid rows were found to import.",
      success: null,
    };
  }

  const rowsByMedicine = new Map<string, (typeof validRows)[number]>();

  validRows.forEach((row) => {
    const key = row.medicine_name;

    if (!rowsByMedicine.has(key)) {
      rowsByMedicine.set(key, row);
    }
  });

  const medicineNames = Array.from(rowsByMedicine.keys());
  const { data: existingMedicines, error: existingMedicinesError } = await supabase
    .from("medicines")
    .select("id, name")
    .eq("organization_id", membership.organization_id)
    .in("name", medicineNames);

  if (existingMedicinesError) {
    return {
      error: "Unable to load existing medicines for this organization.",
      success: null,
    };
  }

  const medicineMap = new Map(existingMedicines.map((medicine) => [medicine.name, medicine.id]));
  const missingMedicineRows = medicineNames
    .filter((name) => !medicineMap.has(name))
    .map((name) => {
      const sourceRow = rowsByMedicine.get(name)!;

      return {
        organization_id: membership.organization_id,
        name: sourceRow.medicine_name,
        sku: sourceRow.sku,
        category: sourceRow.category,
        unit: sourceRow.unit,
      };
    });

  if (missingMedicineRows.length) {
    const { data: createdMedicines, error: createMedicinesError } = await supabase
      .from("medicines")
      .insert(missingMedicineRows)
      .select("id, name");

    if (createMedicinesError) {
      return {
        error: "Unable to create medicines from this upload.",
        success: null,
      };
    }

    createdMedicines.forEach((medicine) => {
      medicineMap.set(medicine.name, medicine.id);
    });
  }

  const batchRows = validRows.map((row) => ({
    organization_id: membership.organization_id,
    medicine_id: medicineMap.get(row.medicine_name),
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
    };
  }

  const { error: batchInsertError } = await supabase.from("inventory_batches").insert(batchRows);

  if (batchInsertError) {
    return {
      error: "Unable to import inventory batches from this file.",
      success: null,
    };
  }

  return {
    error: null,
    success: `Imported ${validRows.length} batch${validRows.length === 1 ? "" : "es"} successfully.`,
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
