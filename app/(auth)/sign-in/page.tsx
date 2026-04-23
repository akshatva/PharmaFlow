import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SignInPageProps = {
  searchParams?: Promise<{
    next?: string;
    message?: string;
  }>;
};

function getSafeNextPath(nextPath: string | undefined) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return undefined;
  }

  return nextPath;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const resolvedSearchParams = (await searchParams) ?? {};
  const nextPath = getSafeNextPath(resolvedSearchParams.next);
  const statusMessage = resolvedSearchParams.message;

  if (user) {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-8">
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">Sign In</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-950">Welcome back</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in to access PharmaFlow and manage your operational workspace.
        </p>
      </div>

      {statusMessage ? (
        <p className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {statusMessage}
        </p>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <AuthForm mode="sign-in" nextPath={nextPath} />
      </div>

      <p className="text-sm text-slate-600">
        New to PharmaFlow?{" "}
        <Link className="font-medium text-accent transition hover:text-teal-700" href="/sign-up">
          Create an account
        </Link>
      </p>
    </div>
  );
}
