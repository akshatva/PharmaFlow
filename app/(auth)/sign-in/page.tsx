import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SignInPage() {
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
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">Sign In</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-950">Welcome back</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in to access PharmaFlow and manage your operational workspace.
        </p>
      </div>

      <AuthForm mode="sign-in" />

      <p className="mt-6 text-sm text-slate-600">
        New to PharmaFlow?{" "}
        <Link className="font-medium text-accent transition hover:text-teal-700" href="/sign-up">
          Create an account
        </Link>
      </p>
    </div>
  );
}
