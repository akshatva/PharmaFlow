"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    if (mode === "sign-in") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setIsSubmitting(false);
        return;
      }

      router.push("/onboarding");
      router.refresh();
      return;
    }

    const redirectUrl =
      typeof window === "undefined" ? undefined : `${window.location.origin}/auth/callback`;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }

    setMessage("Account created. Check your email to confirm your address before signing in.");
    setIsSubmitting(false);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
          placeholder="team@pharmaflow.com"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
          placeholder="Minimum 6 characters"
        />
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}
      </button>

      <p className="text-sm leading-6 text-slate-500">
        By continuing, you agree to keep your PharmaFlow workspace secure and restricted to
        authorized team members.
      </p>

      {mode === "sign-up" ? (
        <p className="text-sm text-slate-500">
          Email confirmation enabled in Supabase? Your link will return here through{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[13px]">/auth/callback</code>.
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          Need an account first?{" "}
          <Link className="font-medium text-accent" href="/sign-up">
            Create one here
          </Link>
          .
        </p>
      )}
    </form>
  );
}
