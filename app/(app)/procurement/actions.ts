"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProcurementMutationResult = {
  error: string | null;
  success: string | null;
  procurementOrderId?: string;
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
      membership: null,
      error: "Unable to resolve your organization for this request.",
    };
  }

  return {
    supabase,
    membership,
    error: null,
  };
}

export async function createProcurementOrder(
  formData: FormData,
): Promise<ProcurementMutationResult> {
  const medicineName = String(formData.get("medicineName") ?? "").trim();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const quantity = Number(formData.get("quantity"));
  const unitPrice = formData.has("unitPrice") ? Number(formData.get("unitPrice")) : null;
  const reorderItemId = formData.has("reorderItemId") ? String(formData.get("reorderItemId")) : null;
  const medicineId = formData.has("medicineId") ? String(formData.get("medicineId")) : null;

  if (!medicineName || !quantity || quantity <= 0) {
    return {
      error: "Medicine name and a valid quantity are required.",
      success: null,
    };
  }

  const { supabase, membership, error } = await getOrganizationContext();

  if (error || !membership) {
    return {
      error: error ?? "Unable to resolve your organization for this request.",
      success: null,
    };
  }

  const totalPrice = unitPrice !== null && unitPrice > 0 ? quantity * unitPrice : null;

  const { data: procurementOrder, error: insertError } = await supabase
    .from("procurement_orders")
    .insert({
      organization_id: membership.organization_id,
      medicine_name: medicineName,
      supplier_id: supplierId || null,
      quantity,
      unit_price: unitPrice || null,
      total_price: totalPrice,
      status: "pending",
      reorder_item_id: reorderItemId || null,
      medicine_id: medicineId || null,
    })
    .select("id")
    .single();

  if (insertError) {
    return {
      error: "Unable to create the procurement order.",
      success: null,
    };
  }

  if (reorderItemId) {
    // Optionally update reorder item status to ordered
    await supabase
      .from("reorder_items")
      .update({ status: "ordered" })
      .eq("organization_id", membership.organization_id)
      .eq("id", reorderItemId);
  }

  revalidatePath("/procurement");
  revalidatePath("/reorders");
  revalidatePath("/dashboard");

  return {
    error: null,
    success: "Procurement order created.",
    procurementOrderId: procurementOrder.id,
  };
}

export async function updateProcurementOrderStatus(
  formData: FormData,
): Promise<ProcurementMutationResult> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!orderId || !["pending", "ordered", "in_transit", "delivered", "cancelled"].includes(status)) {
    return {
      error: "A valid order ID and status are required.",
      success: null,
    };
  }

  const { supabase, membership, error } = await getOrganizationContext();

  if (error || !membership) {
    return {
      error: error ?? "Unable to resolve your organization for this request.",
      success: null,
    };
  }

  const { error: updateError } = await supabase
    .from("procurement_orders")
    .update({ status })
    .eq("organization_id", membership.organization_id)
    .eq("id", orderId);

  if (updateError) {
    return {
      error: "Unable to update order status.",
      success: null,
    };
  }

  revalidatePath("/procurement");

  return {
    error: null,
    success: `Order marked as ${status.replace("_", " ")}.`,
  };
}
