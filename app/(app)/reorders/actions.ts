"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReorderMutationResult = {
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

export async function createReorderItem(
  formData: FormData,
): Promise<ReorderMutationResult> {
  const medicineId = String(formData.get("medicineId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!medicineId || !reason) {
    return {
      error: "Medicine and reorder reason are required.",
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

  const { data: medicine, error: medicineError } = await supabase
    .from("medicines")
    .select("id")
    .eq("organization_id", membership.organization_id)
    .eq("id", medicineId)
    .maybeSingle();

  if (medicineError || !medicine) {
    return {
      error: "This medicine could not be found in your organization.",
      success: null,
    };
  }

  const { data: existingPendingItem, error: existingItemError } = await supabase
    .from("reorder_items")
    .select("id")
    .eq("organization_id", membership.organization_id)
    .eq("medicine_id", medicineId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (existingItemError) {
    return {
      error: "Unable to check existing reorder state.",
      success: null,
    };
  }

  if (existingPendingItem) {
    return {
      error: null,
      success: "This medicine is already in your reorder list.",
    };
  }

  const { error: insertError } = await supabase.from("reorder_items").insert({
    organization_id: membership.organization_id,
    medicine_id: medicineId,
    reason,
    status: "pending",
  });

  if (insertError) {
    return {
      error: "Unable to create the reorder item.",
      success: null,
    };
  }

  revalidatePath("/alerts");
  revalidatePath("/insights");
  revalidatePath("/reorders");

  return {
    error: null,
    success: "Added to reorder list.",
  };
}

export async function updateReorderStatus(
  formData: FormData,
): Promise<ReorderMutationResult> {
  const reorderItemId = String(formData.get("reorderItemId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!reorderItemId || !["pending", "ordered"].includes(status)) {
    return {
      error: "A valid reorder item and status are required.",
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
    .from("reorder_items")
    .update({ status })
    .eq("organization_id", membership.organization_id)
    .eq("id", reorderItemId);

  if (updateError) {
    return {
      error: "Unable to update reorder status.",
      success: null,
    };
  }

  revalidatePath("/reorders");
  revalidatePath("/alerts");
  revalidatePath("/insights");

  return {
    error: null,
    success: status === "ordered" ? "Marked as ordered." : "Marked as pending.",
  };
}
