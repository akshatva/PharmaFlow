"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createStockAdjustmentLog } from "@/lib/stock-adjustments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PurchaseOrderMutationResult = {
  error: string | null;
  success: string | null;
};

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

export async function createPurchaseOrderFromReorder(
  formData: FormData,
): Promise<PurchaseOrderMutationResult> {
  const reorderItemId = String(formData.get("reorderItemId") ?? "").trim();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const quantityValue = String(formData.get("quantity") ?? "").trim();

  if (!reorderItemId || !supplierId || !quantityValue) {
    return {
      error: "Reorder item, supplier, and quantity are required.",
      success: null,
    };
  }

  const quantity = Number(quantityValue);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return {
      error: "Quantity must be a positive whole number.",
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

  const [{ data: reorderItem, error: reorderError }, { data: supplier, error: supplierError }] =
    await Promise.all([
      supabase
        .from("reorder_items")
        .select("id, medicine_id, status")
        .eq("organization_id", membership.organization_id)
        .eq("id", reorderItemId)
        .maybeSingle(),
      supabase
        .from("suppliers")
        .select("id")
        .eq("organization_id", membership.organization_id)
        .eq("id", supplierId)
        .maybeSingle(),
    ]);

  if (reorderError || !reorderItem) {
    return {
      error: "The selected reorder item could not be found.",
      success: null,
    };
  }

  if (supplierError || !supplier) {
    return {
      error: "The selected supplier could not be found.",
      success: null,
    };
  }

  const { data: existingPurchaseOrder, error: existingPurchaseOrderError } = await supabase
    .from("purchase_orders")
    .select("id")
    .eq("organization_id", membership.organization_id)
    .eq("reorder_source_id", reorderItemId)
    .limit(1)
    .maybeSingle();

  if (existingPurchaseOrderError) {
    return {
      error: "Unable to verify existing purchase order state.",
      success: null,
    };
  }

  if (existingPurchaseOrder) {
    return {
      error: null,
      success: "A purchase order already exists for this reorder item.",
    };
  }

  const { data: purchaseOrder, error: purchaseOrderError } = await supabase
    .from("purchase_orders")
    .insert({
      organization_id: membership.organization_id,
      supplier_id: supplierId,
      reorder_source_id: reorderItemId,
      status: "draft",
    })
    .select("id")
    .single();

  if (purchaseOrderError || !purchaseOrder) {
    return {
      error: "Unable to create purchase order.",
      success: null,
    };
  }

  const { error: itemInsertError } = await supabase.from("purchase_order_items").insert({
    purchase_order_id: purchaseOrder.id,
    medicine_id: reorderItem.medicine_id,
    quantity,
  });

  if (itemInsertError) {
    return {
      error: "Unable to add purchase order item.",
      success: null,
    };
  }

  const { error: reorderUpdateError } = await supabase
    .from("reorder_items")
    .update({ status: "ordered" })
    .eq("organization_id", membership.organization_id)
    .eq("id", reorderItemId);

  if (reorderUpdateError) {
    return {
      error: "Purchase order created, but reorder state could not be updated.",
      success: null,
    };
  }

  revalidatePath("/reorders");
  revalidatePath("/purchase-orders");
  revalidatePath("/alerts");
  revalidatePath("/insights");

  return {
    error: null,
    success: "Purchase order created successfully.",
  };
}

export async function updatePurchaseOrderStatus(
  formData: FormData,
): Promise<PurchaseOrderMutationResult> {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!purchaseOrderId || !["draft", "placed"].includes(status)) {
    return {
      error: "A valid purchase order and editable status are required.",
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

  const { error: updateError } = await supabase
    .from("purchase_orders")
    .update({ status })
    .eq("organization_id", membership.organization_id)
    .eq("id", purchaseOrderId);

  if (updateError) {
    return {
      error: "Unable to update purchase order status.",
      success: null,
    };
  }

  revalidatePath("/purchase-orders");

  return {
    error: null,
    success: "Purchase order status updated.",
  };
}

export async function receivePurchaseOrder(
  formData: FormData,
): Promise<PurchaseOrderMutationResult> {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "").trim();
  const itemIdsJson = String(formData.get("itemIdsJson") ?? "").trim();

  if (!purchaseOrderId || !itemIdsJson) {
    return {
      error: "Purchase order details are missing.",
      success: null,
    };
  }

  let itemIds: unknown;

  try {
    itemIds = JSON.parse(itemIdsJson);
  } catch {
    return {
      error: "Unable to read purchase order item details.",
      success: null,
    };
  }

  if (!Array.isArray(itemIds) || itemIds.some((itemId) => typeof itemId !== "string")) {
    return {
      error: "Purchase order item details are invalid.",
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

  const { data: purchaseOrder, error: purchaseOrderError } = await supabase
    .from("purchase_orders")
    .select("id, status")
    .eq("organization_id", membership.organization_id)
    .eq("id", purchaseOrderId)
    .maybeSingle();

  if (purchaseOrderError || !purchaseOrder) {
    return {
      error: "The selected purchase order could not be found.",
      success: null,
    };
  }

  if (purchaseOrder.status === "received") {
    return {
      error: null,
      success: "This purchase order has already been received.",
    };
  }

  const { data: purchaseOrderItems, error: purchaseOrderItemsError } = await supabase
    .from("purchase_order_items")
    .select("id, medicine_id, quantity")
    .eq("purchase_order_id", purchaseOrderId);

  if (purchaseOrderItemsError || !purchaseOrderItems?.length) {
    return {
      error: "Unable to load purchase order items for receiving.",
      success: null,
    };
  }

  const relevantItems = purchaseOrderItems.filter((item) => itemIds.includes(item.id));

  if (!relevantItems.length) {
    return {
      error: "No purchase order items were found to receive.",
      success: null,
    };
  }

  const batchRows = [];

  for (const item of relevantItems) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return {
        error: "Each purchase order item must have a positive quantity before receiving.",
        success: null,
      };
    }

    const batchNumber = String(formData.get(`batchNumber:${item.id}`) ?? "").trim();
    const expiryDateValue = String(formData.get(`expiryDate:${item.id}`) ?? "").trim();
    const expiryDate = normalizeInventoryDate(expiryDateValue);

    if (!batchNumber || !expiryDate) {
      return {
        error: "Every purchase order item needs a batch number and valid expiry date.",
        success: null,
      };
    }

    batchRows.push({
      organization_id: membership.organization_id,
      medicine_id: item.medicine_id,
      quantity: item.quantity,
      batch_number: batchNumber,
      expiry_date: expiryDate,
      purchase_price: null,
      selling_price: null,
    });
  }

  const { data: insertedBatches, error: inventoryInsertError } = await supabase
    .from("inventory_batches")
    .insert(batchRows)
    .select("id, medicine_id, batch_number, quantity");

  if (inventoryInsertError || !insertedBatches?.length) {
    return {
      error: "Unable to create inventory batches from this purchase order.",
      success: null,
    };
  }

  await Promise.all(
    insertedBatches.map((batch) =>
      createStockAdjustmentLog(supabase, {
        organizationId: membership.organization_id,
        medicineId: batch.medicine_id,
        inventoryBatchId: batch.id,
        userId: user.id,
        actionType: "stock_received",
        previousQuantity: 0,
        newQuantity: batch.quantity,
        quantityChange: batch.quantity,
        note: "Stock received from purchase order.",
        metadata: {
          source: "purchase_order",
          purchase_order_id: purchaseOrderId,
          batch_number: batch.batch_number,
        },
      }),
    ),
  );

  const { error: statusUpdateError } = await supabase
    .from("purchase_orders")
    .update({ status: "received" })
    .eq("organization_id", membership.organization_id)
    .eq("id", purchaseOrderId);

  if (statusUpdateError) {
    return {
      error: "Inventory was received, but the purchase order status could not be updated.",
      success: null,
    };
  }

  revalidatePath("/inventory");
  revalidatePath("/purchase-orders");
  revalidatePath("/insights");
  revalidatePath("/alerts");
  revalidatePath("/stock-adjustments");

  return {
    error: null,
    success: "Purchase order received and inventory updated successfully.",
  };
}
