import { redirect } from "next/navigation";

import {
  completeOnboarding,
} from "@/app/onboarding/actions";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (membershipError) {
    console.error("Onboarding membership lookup failed", {
      userId: user.id,
      code: membershipError.code,
      message: membershipError.message,
      details: membershipError.details,
      hint: membershipError.hint,
    });

    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to check your existing workspace membership: ${membershipError.message}`
        : "Unable to check your existing workspace membership.",
    );
  }

  if ((memberships?.length ?? 0) > 0) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-3xl rounded-3xl border border-white/70 bg-white/90 p-8 shadow-panel backdrop-blur md:p-10">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Onboarding
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            Set up your PharmaFlow workspace
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            We only need your name and the organization name to create your initial owner
            workspace.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Signed in as <span className="font-medium text-slate-900">{user.email}</span>
        </div>

        <div className="mt-8">
          <OnboardingForm action={completeOnboarding} initialState={{ error: null }} />
        </div>
      </div>
    </main>
  );
}
