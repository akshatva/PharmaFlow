"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateMedicineFromScanResult = {
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

export async function createMedicineFromScan(
  formData: FormData,
): Promise<CreateMedicineFromScanResult> {
  const barcode = String(formData.get("barcode") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();

  if (!barcode || !name) {
    return {
      error: "Barcode and medicine name are required.",
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

  const [{ data: existingBarcodeMatch, error: barcodeLookupError }, { data: existingSkuMatch, error: skuLookupError }] =
    await Promise.all([
      supabase
        .from("medicines")
        .select("id, name")
        .eq("organization_id", membership.organization_id)
        .eq("barcode", barcode)
        .limit(1)
        .maybeSingle(),
      sku
        ? supabase
            .from("medicines")
            .select("id, name")
            .eq("organization_id", membership.organization_id)
            .eq("sku", sku)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

  const lookupError = barcodeLookupError ?? skuLookupError;

  if (lookupError) {
    return {
      error:
        process.env.NODE_ENV === "development"
          ? `Unable to validate medicine uniqueness: ${lookupError.message}`
          : "Unable to validate medicine uniqueness.",
      success: null,
    };
  }

  if (existingBarcodeMatch) {
    return {
      error: null,
      success: `${existingBarcodeMatch.name} already exists for this barcode.`,
    };
  }

  if (existingSkuMatch) {
    return {
      error: `SKU is already assigned to ${existingSkuMatch.name}.`,
      success: null,
    };
  }

  const { error: insertError } = await supabase.from("medicines").insert({
    organization_id: membership.organization_id,
    name,
    sku: sku || null,
    barcode,
    category: category || null,
    unit: unit || null,
  });

  if (insertError) {
    return {
      error:
        process.env.NODE_ENV === "development"
          ? `Unable to create medicine: ${insertError.message}`
          : "Unable to create medicine.",
      success: null,
    };
  }

  revalidatePath("/scan");
  revalidatePath("/inventory");

  return {
    error: null,
    success: "Medicine created successfully from scanned barcode.",
  };
}
