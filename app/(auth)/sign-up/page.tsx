import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SignUpPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">Sign Up</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-950">Create your workspace</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Start with secure access for your team and a focused operational dashboard.
        </p>
      </div>

      <AuthForm mode="sign-up" />

      <p className="mt-6 text-sm text-slate-600">
        Already have an account?{" "}
        <Link className="font-medium text-accent transition hover:text-teal-700" href="/sign-in">
          Sign in
        </Link>
      </p>
    </div>
  );
}
