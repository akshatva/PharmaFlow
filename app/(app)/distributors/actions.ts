"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DistributorMutationResult = {
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

function normalizeOptionalText(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function parsePositivePrice(value: FormDataEntryValue | null) {
  const rawValue = String(value ?? "").trim();
  const parsed = Number(rawValue);

  if (!rawValue || !Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function parseOptionalNonNegativeInteger(value: FormDataEntryValue | null) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}

function normalizeActive(value: FormDataEntryValue | null) {
  return String(value ?? "").trim() !== "false";
}

export async function createDistributor(
  formData: FormData,
): Promise<DistributorMutationResult> {
  const distributorName = String(formData.get("distributorName") ?? "").trim();
  const contactName = normalizeOptionalText(formData.get("contactName"));
  const phone = normalizeOptionalText(formData.get("phone"));
  const email = normalizeOptionalText(formData.get("email"));
  const city = normalizeOptionalText(formData.get("city"));
  const state = normalizeOptionalText(formData.get("state"));
  const active = normalizeActive(formData.get("active"));

  if (!distributorName) {
    return {
      error: "Supplier name is required.",
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

  const { error: insertError } = await supabase.from("distributors").insert({
    organization_id: membership.organization_id,
    distributor_name: distributorName,
    contact_name: contactName,
    phone,
    email,
    city,
    state,
    active,
  });

  if (insertError) {
    return {
      error: "Unable to add supplier.",
      success: null,
    };
  }

  revalidatePath("/suppliers");

  return {
    error: null,
    success: "Supplier added.",
  };
}

export async function updateDistributor(
  formData: FormData,
): Promise<DistributorMutationResult> {
  const distributorId = String(formData.get("distributorId") ?? "").trim();
  const distributorName = String(formData.get("distributorName") ?? "").trim();
  const contactName = normalizeOptionalText(formData.get("contactName"));
  const phone = normalizeOptionalText(formData.get("phone"));
  const email = normalizeOptionalText(formData.get("email"));
  const city = normalizeOptionalText(formData.get("city"));
  const state = normalizeOptionalText(formData.get("state"));
  const active = normalizeActive(formData.get("active"));

  if (!distributorId || !distributorName) {
    return {
      error: "Supplier and name are required.",
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

  const { data: updatedSupplier, error: updateError } = await supabase
    .from("distributors")
    .update({
      distributor_name: distributorName,
      contact_name: contactName,
      phone,
      email,
      city,
      state,
      active,
    })
    .eq("organization_id", membership.organization_id)
    .eq("id", distributorId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return {
      error: "Unable to update supplier.",
      success: null,
    };
  }

  if (!updatedSupplier) {
    return {
      error: "Supplier not found.",
      success: null,
    };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${distributorId}`);

  return {
    error: null,
    success: "Supplier updated.",
  };
}

export async function createCatalogItem(
  formData: FormData,
): Promise<DistributorMutationResult> {
  const distributorId = String(formData.get("distributorId") ?? "").trim();
  const medicineName = String(formData.get("medicineName") ?? "").trim();
  const sku = normalizeOptionalText(formData.get("sku"));
  const category = normalizeOptionalText(formData.get("category"));
  const unitPrice = parsePositivePrice(formData.get("unitPrice"));
  const availableQuantity = parseOptionalNonNegativeInteger(formData.get("availableQuantity"));
  const leadTimeDays = parseOptionalNonNegativeInteger(formData.get("leadTimeDays"));
  const active = normalizeActive(formData.get("active"));

  if (!distributorId || !medicineName) {
    return {
      error: "Medicine name is required.",
      success: null,
    };
  }

  if (unitPrice === null) {
    return {
      error: "Unit price must be a positive number.",
      success: null,
    };
  }

  if (availableQuantity === undefined) {
    return {
      error: "Available quantity must be a whole number.",
      success: null,
    };
  }

  if (leadTimeDays === undefined) {
    return {
      error: "Lead time must be a whole number.",
      success: null,
    };
  }

  const { supabase, error } = await getOrganizationContext();

  if (error) {
    return {
      error,
      success: null,
    };
  }

  const { error: insertError } = await supabase.from("distributor_catalog").insert({
    distributor_id: distributorId,
    medicine_name: medicineName,
    sku,
    category,
    unit_price: unitPrice,
    available_quantity: availableQuantity,
    lead_time_days: leadTimeDays,
    active,
  });

  if (insertError) {
    return {
      error: "Unable to add catalog item.",
      success: null,
    };
  }

  revalidatePath(`/suppliers/${distributorId}`);

  return {
    error: null,
    success: "Catalog item added.",
  };
}

export async function updateCatalogItem(
  formData: FormData,
): Promise<DistributorMutationResult> {
  const distributorId = String(formData.get("distributorId") ?? "").trim();
  const catalogItemId = String(formData.get("catalogItemId") ?? "").trim();
  const medicineName = String(formData.get("medicineName") ?? "").trim();
  const sku = normalizeOptionalText(formData.get("sku"));
  const category = normalizeOptionalText(formData.get("category"));
  const unitPrice = parsePositivePrice(formData.get("unitPrice"));
  const availableQuantity = parseOptionalNonNegativeInteger(formData.get("availableQuantity"));
  const leadTimeDays = parseOptionalNonNegativeInteger(formData.get("leadTimeDays"));
  const active = normalizeActive(formData.get("active"));

  if (!distributorId || !catalogItemId || !medicineName) {
    return {
      error: "Catalog item and medicine name are required.",
      success: null,
    };
  }

  if (unitPrice === null) {
    return {
      error: "Unit price must be a positive number.",
      success: null,
    };
  }

  if (availableQuantity === undefined) {
    return {
      error: "Available quantity must be a whole number.",
      success: null,
    };
  }

  if (leadTimeDays === undefined) {
    return {
      error: "Lead time must be a whole number.",
      success: null,
    };
  }

  const { supabase, error } = await getOrganizationContext();

  if (error) {
    return {
      error,
      success: null,
    };
  }

  const { data: updatedCatalogItem, error: updateError } = await supabase
    .from("distributor_catalog")
    .update({
      medicine_name: medicineName,
      sku,
      category,
      unit_price: unitPrice,
      available_quantity: availableQuantity,
      lead_time_days: leadTimeDays,
      active,
    })
    .eq("distributor_id", distributorId)
    .eq("id", catalogItemId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return {
      error: "Unable to update catalog item.",
      success: null,
    };
  }

  if (!updatedCatalogItem) {
    return {
      error: "Catalog item not found.",
      success: null,
    };
  }

  revalidatePath(`/suppliers/${distributorId}`);

  return {
    error: null,
    success: "Catalog item updated.",
  };
}
