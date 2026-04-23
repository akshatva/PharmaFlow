"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isMissingColumnError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemandCategory } from "@/services/inventory";
import { normalizeWhatsAppAddress } from "@/lib/whatsapp";

export type AlertsPreferenceResult = {
  error: string | null;
  success: string | null;
};

export type OrganizationLocationResult = {
  error: string | null;
  success: string | null;
};

export type DemandCategoryResult = {
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

export async function updateAlertsEmailPreference(
  formData: FormData,
): Promise<AlertsPreferenceResult> {
  const alertsEmailEnabled = String(formData.get("alertsEmailEnabled") ?? "").trim() === "true";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!user.email) {
    return {
      error: "Your account email is missing. Please sign in again and retry.",
      success: null,
    };
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email,
        alerts_email_enabled: alertsEmailEnabled,
      },
      {
        onConflict: "id",
      },
    );

  if (error) {
    console.error("Unable to update alerts email preference", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      error:
        process.env.NODE_ENV === "development"
          ? `Unable to update alerts email preference: ${error.message}`
          : "Unable to update alerts email preference.",
      success: null,
    };
  }

  revalidatePath("/settings");

  return {
    error: null,
    success: alertsEmailEnabled
      ? "Daily alert emails are enabled."
      : "Daily alert emails are disabled.",
  };
}

export async function updateWhatsAppAlertsPreference(
  formData: FormData,
): Promise<AlertsPreferenceResult> {
  const whatsappEnabled = String(formData.get("whatsappEnabled") ?? "").trim() === "true";
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!user.email) {
    return {
      error: "Your account email is missing. Please sign in again and retry.",
      success: null,
    };
  }

  if (whatsappEnabled && !phoneNumber) {
    return {
      error: "Phone number is required when WhatsApp alerts are enabled.",
      success: null,
    };
  }

  let normalizedPhoneNumber: string | null = null;

  if (phoneNumber) {
    const normalizedPhone = normalizeWhatsAppAddress(phoneNumber);

    if (!normalizedPhone.ok) {
      return {
        error: normalizedPhone.error,
        success: null,
      };
    }

    normalizedPhoneNumber = normalizedPhone.e164;
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email,
        phone_number: normalizedPhoneNumber,
        whatsapp_enabled: whatsappEnabled,
      },
      {
        onConflict: "id",
      },
    );

  if (error) {
    console.error("Unable to update WhatsApp alerts preference", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      error:
        process.env.NODE_ENV === "development"
          ? `Unable to update WhatsApp alerts preference: ${error.message}`
          : "Unable to update WhatsApp alerts preference.",
      success: null,
    };
  }

  revalidatePath("/settings");

  return {
    error: null,
    success: whatsappEnabled
      ? "WhatsApp alerts are enabled."
      : "WhatsApp alerts are disabled.",
  };
}

export async function updateOrganizationLocation(
  formData: FormData,
): Promise<OrganizationLocationResult> {
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const pincode = String(formData.get("pincode") ?? "").trim();

  const { supabase, membership, error } = await getOrganizationContext();

  if (error || !membership) {
    return {
      error: error ?? "Unable to resolve your organization for this request.",
      success: null,
    };
  }

  let updateError = (
    await supabase
      .from("organizations")
      .update({
        city: city || null,
        state: state || null,
        country: country || null,
        pincode: pincode || null,
      })
      .eq("id", membership.organization_id)
  ).error;

  if (isMissingColumnError(updateError, "pincode")) {
    updateError = (
      await supabase
        .from("organizations")
        .update({
          city: city || null,
          state: state || null,
          country: country || null,
        })
        .eq("id", membership.organization_id)
    ).error;
  }

  if (updateError) {
    return {
      error:
        process.env.NODE_ENV === "development"
          ? `Unable to update pharmacy location: ${updateError.message}`
          : "Unable to update pharmacy location.",
      success: null,
    };
  }

  revalidatePath("/settings");

  return {
    error: null,
    success: "Pharmacy location saved.",
  };
}

export async function updateMedicineDemandCategory(
  formData: FormData,
): Promise<DemandCategoryResult> {
  const medicineId = String(formData.get("medicineId") ?? "").trim();
  const demandCategory = String(formData.get("demandCategory") ?? "").trim();

  if (!medicineId) {
    return {
      error: "Select a medicine to update.",
      success: null,
    };
  }

  if (demandCategory && !isDemandCategory(demandCategory)) {
    return {
      error: "Select a valid demand category.",
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

  const { error: updateError } = await supabase
    .from("medicines")
    .update({
      demand_category: demandCategory || null,
    })
    .eq("organization_id", membership.organization_id)
    .eq("id", medicineId);

  if (updateError) {
    return {
      error:
        process.env.NODE_ENV === "development"
          ? `Unable to update medicine demand category: ${updateError.message}`
          : "Unable to update medicine demand category.",
      success: null,
    };
  }

  revalidatePath("/inventory");
  revalidatePath("/settings");

  return {
    error: null,
    success: demandCategory ? "Demand category updated." : "Demand category cleared.",
  };
}
