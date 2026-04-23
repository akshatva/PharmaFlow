import { redirect } from "next/navigation";

import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import { AlertsEmailSettings } from "@/components/settings/alerts-email-settings";
import { PharmacyLocationSettings } from "@/components/settings/pharmacy-location-settings";
import { isMissingColumnError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email, alerts_email_enabled, phone_number, whatsapp_enabled")
    .eq("id", user.id)
    .maybeSingle();

  const organizationQuery = await supabase
    .from("organizations")
    .select("city, state, country, pincode")
    .eq("id", membership.organization_id)
    .maybeSingle();

  let organizationData = organizationQuery.data;
  let organizationError = organizationQuery.error;

  if (isMissingColumnError(organizationError, "pincode")) {
    const fallbackOrganizationQuery = await supabase
      .from("organizations")
      .select("city, state, country")
      .eq("id", membership.organization_id)
      .maybeSingle();

    organizationData = fallbackOrganizationQuery.data
      ? {
          ...fallbackOrganizationQuery.data,
          pincode: "",
        }
      : null;
    organizationError = fallbackOrganizationQuery.error;
  }

  const isLocationSetupMissing =
    isMissingColumnError(organizationError, "city") ||
    isMissingColumnError(organizationError, "state") ||
    isMissingColumnError(organizationError, "country");

  const isNotificationSetupMissing =
    !!profileError &&
    (profileError.message.includes("alerts_email_enabled") ||
      profileError.message.includes("phone_number") ||
      profileError.message.includes("whatsapp_enabled"));

  if (profileError) {
    if (isNotificationSetupMissing) {
      console.warn("Settings notifications schema mismatch", {
        code: profileError.code,
        message: profileError.message,
      });
    } else {
      throw new Error(
        process.env.NODE_ENV === "development"
          ? `Unable to load settings: ${profileError.message}`
          : "Unable to load settings.",
      );
    }
  }

  if (organizationError && !isLocationSetupMissing) {
    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load settings: ${organizationError.message}`
        : "Unable to load settings.",
    );
  }

  return (
    <div className="space-y-8">
      <SectionIntro
        eyebrow="Workspace"
        title="Settings"
        description="Manage pharmacy location and lightweight notification preferences for your PharmaFlow account."
      />

      <section id="pharmacy-location" className="space-y-4 scroll-mt-24">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-6 py-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Organization
            </p>
            <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-teal-700">
              Used for live weather
            </span>
          </div>
          <h2 className="mt-3 text-xl font-semibold text-slate-950">Pharmacy Location</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Save the pharmacy city, state, and country here so local demand and weather-aware
            workflows can activate correctly.
          </p>
        </div>

        {isLocationSetupMissing ? (
          <SetupNotice
            title="Organization location fields not available yet"
            description="Add the pharmacy location columns to the `organizations` table, then refresh the app to store city, state, country, and pincode."
          />
        ) : (
          <PharmacyLocationSettings
            initialCity={organizationData?.city ?? ""}
            initialState={organizationData?.state ?? ""}
            initialCountry={organizationData?.country ?? ""}
            initialPincode={organizationData?.pincode ?? ""}
          />
        )}
      </section>

      <section id="notifications" className="space-y-4 scroll-mt-24">
        <div className="rounded-3xl border border-slate-200 bg-slate-50/80 px-6 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Profile
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Notifications</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Profile-scoped notification preferences for email and WhatsApp delivery.
          </p>
        </div>

        {isNotificationSetupMissing ? (
          <SetupNotice
            title="Profile notification columns not available yet"
            description="Add the notification fields to the `profiles` table, then refresh the app to enable email and WhatsApp alert settings."
          />
        ) : (
          <AlertsEmailSettings
            email={profile?.email ?? user.email ?? "your account email"}
            initialEnabled={profile?.alerts_email_enabled ?? true}
            initialPhoneNumber={profile?.phone_number ?? ""}
            initialWhatsAppEnabled={profile?.whatsapp_enabled ?? false}
          />
        )}
      </section>
    </div>
  );
}
