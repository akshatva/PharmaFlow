"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OnboardingActionState = {
  error: string | null;
};

function formatSupabaseActionError(step: string, error: {
  code?: string | null;
  message: string;
  details?: string | null;
  hint?: string | null;
}) {
  console.error(`Onboarding ${step} failed`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  return process.env.NODE_ENV === "development"
    ? `${step}: ${error.message}`
    : error.message;
}

export async function completeOnboarding(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const organizationId = crypto.randomUUID();

  if (!organizationName) {
    return {
      error: "Organization name is required.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!user.email) {
    return {
      error: "Your account email is missing. Please sign in again and retry onboarding.",
    };
  }

  const { data: existingMemberships, error: membershipLookupError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (membershipLookupError) {
    return {
      error: formatSupabaseActionError(
        "Unable to check your existing workspace membership",
        membershipLookupError,
      ),
    };
  }

  if ((existingMemberships?.length ?? 0) > 0) {
    redirect("/dashboard");
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: fullName || null,
    },
    {
      onConflict: "id",
    },
  );

  if (profileError) {
    return {
      error: formatSupabaseActionError("Unable to save your profile details", profileError),
    };
  }

  const { error: organizationError } = await supabase.from("organizations").insert({
    id: organizationId,
    name: organizationName,
  });

  if (organizationError) {
    return {
      error: formatSupabaseActionError("Unable to create your organization", organizationError),
    };
  }

  const { error: memberInsertError } = await supabase.from("organization_members").insert({
    organization_id: organizationId,
    user_id: user.id,
    role: "owner",
  });

  if (memberInsertError) {
    return {
      error: formatSupabaseActionError(
        "Unable to attach your account to the new organization",
        memberInsertError,
      ),
    };
  }

  redirect("/dashboard");
}
