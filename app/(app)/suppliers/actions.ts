"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SupplierMutationResult = {
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

function normalizeOptionalField(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

export async function createSupplier(
  formData: FormData,
): Promise<SupplierMutationResult> {
  const name = String(formData.get("name") ?? "").trim();
  const contactPerson = normalizeOptionalField(formData.get("contactPerson"));
  const phone = normalizeOptionalField(formData.get("phone"));
  const email = normalizeOptionalField(formData.get("email"));
  const notes = normalizeOptionalField(formData.get("notes"));

  if (!name) {
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

  const { error: insertError } = await supabase.from("suppliers").insert({
    organization_id: membership.organization_id,
    name,
    contact_person: contactPerson,
    phone,
    email,
    notes,
  });

  if (insertError) {
    return {
      error: "Unable to add supplier.",
      success: null,
    };
  }

  revalidatePath("/suppliers");
  revalidatePath("/purchase-orders");
  revalidatePath("/reorders");

  return {
    error: null,
    success: "Supplier added successfully.",
  };
}

export async function updateSupplier(
  formData: FormData,
): Promise<SupplierMutationResult> {
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const contactPerson = normalizeOptionalField(formData.get("contactPerson"));
  const phone = normalizeOptionalField(formData.get("phone"));
  const email = normalizeOptionalField(formData.get("email"));
  const notes = normalizeOptionalField(formData.get("notes"));

  if (!supplierId || !name) {
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

  const { error: updateError } = await supabase
    .from("suppliers")
    .update({
      name,
      contact_person: contactPerson,
      phone,
      email,
      notes,
    })
    .eq("organization_id", membership.organization_id)
    .eq("id", supplierId);

  if (updateError) {
    return {
      error: "Unable to update supplier.",
      success: null,
    };
  }

  revalidatePath("/suppliers");
  revalidatePath("/purchase-orders");

  return {
    error: null,
    success: "Supplier updated successfully.",
  };
}

export async function deleteSupplier(
  formData: FormData,
): Promise<SupplierMutationResult> {
  const supplierId = String(formData.get("supplierId") ?? "").trim();

  if (!supplierId) {
    return {
      error: "Supplier identifier is missing.",
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

  const { data: linkedOrder, error: linkedOrderError } = await supabase
    .from("purchase_orders")
    .select("id")
    .eq("organization_id", membership.organization_id)
    .eq("supplier_id", supplierId)
    .limit(1)
    .maybeSingle();

  if (linkedOrderError) {
    return {
      error: "Unable to verify supplier usage.",
      success: null,
    };
  }

  if (linkedOrder) {
    return {
      error: "This supplier is already used in a purchase order and cannot be deleted.",
      success: null,
    };
  }

  const { error: deleteError } = await supabase
    .from("suppliers")
    .delete()
    .eq("organization_id", membership.organization_id)
    .eq("id", supplierId);

  if (deleteError) {
    return {
      error: "Unable to delete supplier.",
      success: null,
    };
  }

  revalidatePath("/suppliers");
  revalidatePath("/purchase-orders");
  revalidatePath("/reorders");

  return {
    error: null,
    success: "Supplier deleted successfully.",
  };
}
