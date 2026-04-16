"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeWhatsAppAddress } from "@/lib/whatsapp";

export type AlertsPreferenceResult = {
  error: string | null;
  success: string | null;
};

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
