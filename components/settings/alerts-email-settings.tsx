"use client";

import { useState, useTransition } from "react";

import { updateAlertsEmailPreference } from "@/app/(app)/settings/actions";

type AlertsEmailSettingsProps = {
  email: string;
  initialEnabled: boolean;
};

export function AlertsEmailSettings({
  email,
  initialEnabled,
}: AlertsEmailSettingsProps) {
  const [alertsEmailEnabled, setAlertsEmailEnabled] = useState(initialEnabled);
  const [preferenceFeedback, setPreferenceFeedback] = useState<{
    error: string | null;
    success: string | null;
  }>({
    error: null,
    success: null,
  });
  const [digestFeedback, setDigestFeedback] = useState<{
    error: string | null;
    success: string | null;
  }>({
    error: null,
    success: null,
  });
  const [isSaving, startSavingTransition] = useTransition();
  const [isSending, startSendingTransition] = useTransition();

  function handleSavePreference() {
    const formData = new FormData();
    formData.set("alertsEmailEnabled", alertsEmailEnabled ? "true" : "false");

    startSavingTransition(async () => {
      const result = await updateAlertsEmailPreference(formData);
      setPreferenceFeedback(result);
    });
  }

  function handleSendDigest() {
    startSendingTransition(async () => {
      setDigestFeedback({ error: null, success: null });

      try {
        const response = await fetch("/api/alerts/send", {
          method: "POST",
        });
        const payload = (await response.json()) as {
          error?: string;
          success?: string;
        };

        if (!response.ok) {
          setDigestFeedback({
            error: payload.error ?? "Unable to send alerts digest.",
            success: null,
          });
          return;
        }

        setDigestFeedback({
          error: null,
          success: payload.success ?? "Alerts digest sent successfully.",
        });
      } catch {
        setDigestFeedback({
          error: "Unable to send alerts digest.",
          success: null,
        });
      }
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-slate-950">Alerts email</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Send a simple daily digest of low stock and near-expiry items to <span className="font-medium text-slate-900">{email}</span>.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={alertsEmailEnabled}
            onChange={(event) => setAlertsEmailEnabled(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-teal-200"
          />
          <div>
            <p className="text-sm font-medium text-slate-900">Enable daily alerts digest</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Turn daily inventory alert emails on or off for your profile.
            </p>
          </div>
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSavePreference}
            disabled={isSaving}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save preference"}
          </button>

          <button
            type="button"
            onClick={handleSendDigest}
            disabled={isSending}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? "Sending..." : "Send digest now"}
          </button>
        </div>

        {preferenceFeedback.error ? <p className="text-sm text-red-600">{preferenceFeedback.error}</p> : null}
        {preferenceFeedback.success ? <p className="text-sm text-emerald-700">{preferenceFeedback.success}</p> : null}
        {digestFeedback.error ? <p className="text-sm text-red-600">{digestFeedback.error}</p> : null}
        {digestFeedback.success ? <p className="text-sm text-emerald-700">{digestFeedback.success}</p> : null}
      </div>
    </section>
  );
}
