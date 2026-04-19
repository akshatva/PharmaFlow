"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  InsightWorkflowStatus,
  InsightWorkflowType,
  PersistedInsightWorkflowStatus,
} from "@/services/insights";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InsightWorkflowMutationResult = {
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

const VALID_INSIGHT_TYPES = new Set<InsightWorkflowType>([
  "stockout_risk",
  "expiry_risk",
  "dead_stock",
  "reorder_suggestion",
]);

const VALID_WORKFLOW_STATUSES = new Set<InsightWorkflowStatus>([
  "open",
  "reviewed",
  "needs_reorder",
  "monitor",
]);

export async function updateInsightWorkflowStatus(
  formData: FormData,
): Promise<InsightWorkflowMutationResult> {
  const insightKey = String(formData.get("insightKey") ?? "").trim();
  const insightType = String(formData.get("insightType") ?? "").trim() as InsightWorkflowType;
  const status = String(formData.get("status") ?? "").trim() as InsightWorkflowStatus;
  const medicineId = String(formData.get("medicineId") ?? "").trim() || null;
  const inventoryBatchId = String(formData.get("inventoryBatchId") ?? "").trim() || null;

  if (
    !insightKey ||
    !VALID_INSIGHT_TYPES.has(insightType) ||
    !VALID_WORKFLOW_STATUSES.has(status) ||
    (!medicineId && !inventoryBatchId)
  ) {
    return {
      error: "A valid insight item and workflow status are required.",
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

  if (medicineId) {
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
  }

  if (inventoryBatchId) {
    const { data: batch, error: batchError } = await supabase
      .from("inventory_batches")
      .select("id")
      .eq("organization_id", membership.organization_id)
      .eq("id", inventoryBatchId)
      .maybeSingle();

    if (batchError || !batch) {
      return {
        error: "This inventory batch could not be found in your organization.",
        success: null,
      };
    }
  }

  if (status === "open") {
    const { error: deleteError } = await supabase
      .from("insight_workflow_items")
      .delete()
      .eq("organization_id", membership.organization_id)
      .eq("insight_key", insightKey);

    if (deleteError) {
      return {
        error: "Unable to move this item back to open.",
        success: null,
      };
    }

    revalidatePath("/insights");

    return {
      error: null,
      success: "Moved back to open.",
    };
  }

  const persistedStatus = status as PersistedInsightWorkflowStatus;
  const entityType = inventoryBatchId ? "batch" : "medicine";

  const { error: upsertError } = await supabase.from("insight_workflow_items").upsert(
    {
      organization_id: membership.organization_id,
      insight_key: insightKey,
      insight_type: insightType,
      medicine_id: medicineId,
      inventory_batch_id: inventoryBatchId,
      status: persistedStatus,
      updated_at: new Date().toISOString(),
      entity_type: entityType,
    },
    {
      onConflict: "organization_id,insight_key",
    },
  );

  if (upsertError) {
    return {
      error: "Unable to update workflow state for this insight item.",
      success: null,
    };
  }

  revalidatePath("/insights");

  return {
    error: null,
    success:
      status === "reviewed"
        ? "Marked as reviewed."
        : status === "needs_reorder"
          ? "Marked as needs reorder."
          : "Marked as monitor.",
  };
}
