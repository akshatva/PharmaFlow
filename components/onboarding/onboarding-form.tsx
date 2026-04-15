"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { OnboardingActionState } from "@/app/onboarding/actions";

type OnboardingFormProps = {
  action: (
    state: OnboardingActionState,
    formData: FormData,
  ) => Promise<OnboardingActionState>;
  initialState: OnboardingActionState;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Creating workspace..." : "Finish setup"}
    </button>
  );
}

export function OnboardingForm({ action, initialState }: OnboardingFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="fullName">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
          placeholder="e.g. Dr. Aisha Patel"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-800" htmlFor="organizationName">
          Organization name
        </label>
        <input
          id="organizationName"
          name="organizationName"
          type="text"
          autoComplete="organization"
          required
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
          placeholder="e.g. CityCare Pharmacy"
        />
      </div>

      {state.error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
