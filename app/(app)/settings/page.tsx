import { redirect } from "next/navigation";

import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import { AlertsEmailSettings } from "@/components/settings/alerts-email-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email, alerts_email_enabled, phone_number, whatsapp_enabled")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    if (
      profileError.message.includes("alerts_email_enabled") ||
      profileError.message.includes("phone_number") ||
      profileError.message.includes("whatsapp_enabled")
    ) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Workspace"
            title="Settings"
            description="Manage lightweight notification preferences for your PharmaFlow account."
          />
          <SetupNotice
            title="Profile notification column not available yet"
            description="Add the notification fields to the `profiles` table, then refresh the app to enable email and WhatsApp alert settings."
          />
        </div>
      );
    }

    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load settings: ${profileError.message}`
        : "Unable to load settings.",
    );
  }

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Workspace"
        title="Settings"
        description="Manage lightweight notification preferences for your PharmaFlow account."
      />

      <AlertsEmailSettings
        email={profile?.email ?? user.email ?? "your account email"}
        initialEnabled={profile?.alerts_email_enabled ?? true}
        initialPhoneNumber={profile?.phone_number ?? ""}
        initialWhatsAppEnabled={profile?.whatsapp_enabled ?? false}
      />
    </div>
  );
}
