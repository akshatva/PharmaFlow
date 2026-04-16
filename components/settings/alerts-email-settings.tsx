"use client";

import { useState, useTransition } from "react";

import {
  updateAlertsEmailPreference,
  updateWhatsAppAlertsPreference,
} from "@/app/(app)/settings/actions";

type AlertsEmailSettingsProps = {
  email: string;
  initialEnabled: boolean;
  initialPhoneNumber: string;
  initialWhatsAppEnabled: boolean;
};

export function AlertsEmailSettings({
  email,
  initialEnabled,
  initialPhoneNumber,
  initialWhatsAppEnabled,
}: AlertsEmailSettingsProps) {
  const [alertsEmailEnabled, setAlertsEmailEnabled] = useState(initialEnabled);
  const [whatsappEnabled, setWhatsappEnabled] = useState(initialWhatsAppEnabled);
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [preferenceFeedback, setPreferenceFeedback] = useState<{
    error: string | null;
    success: string | null;
  }>({
    error: null,
    success: null,
  });
  const [whatsappPreferenceFeedback, setWhatsappPreferenceFeedback] = useState<{
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
  const [isSavingWhatsApp, startSavingWhatsAppTransition] = useTransition();
  const [isSending, startSendingTransition] = useTransition();
  const [isSendingWhatsApp, startSendingWhatsAppTransition] = useTransition();

  function handleSavePreference() {
    const formData = new FormData();
    formData.set("alertsEmailEnabled", alertsEmailEnabled ? "true" : "false");

    startSavingTransition(async () => {
      const result = await updateAlertsEmailPreference(formData);
      setPreferenceFeedback(result);
    });
  }

  function handleSaveWhatsAppPreference() {
    const formData = new FormData();
    formData.set("whatsappEnabled", whatsappEnabled ? "true" : "false");
    formData.set("phoneNumber", phoneNumber);

    startSavingWhatsAppTransition(async () => {
      const result = await updateWhatsAppAlertsPreference(formData);
      setWhatsappPreferenceFeedback(result);
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

  function handleSendWhatsAppDigest() {
    startSendingWhatsAppTransition(async () => {
      setDigestFeedback((current) => current);
      setWhatsappPreferenceFeedback((current) => current);

      try {
        const response = await fetch("/api/alerts/send-whatsapp", {
          method: "POST",
        });
        const payload = (await response.json()) as {
          error?: string;
          success?: string;
        };

        if (!response.ok) {
          setWhatsappPreferenceFeedback({
            error: payload.error ?? "Unable to send WhatsApp alerts.",
            success: null,
          });
          return;
        }

        setWhatsappPreferenceFeedback({
          error: null,
          success: payload.success ?? "WhatsApp alerts sent successfully.",
        });
      } catch {
        setWhatsappPreferenceFeedback({
          error: "Unable to send WhatsApp alerts.",
          success: null,
        });
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">WhatsApp alerts</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Send a short WhatsApp summary of low stock, expiring items, and urgent reorders to your configured number.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-900">WhatsApp phone number</span>
            <input
              type="text"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+919876543210"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-accent focus:ring-2 focus:ring-teal-100"
            />
            <p className="text-xs leading-5 text-slate-500">
              Use E.164 format with a leading <code>+</code>, for example <code>+919876543210</code>.
            </p>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              checked={whatsappEnabled}
              onChange={(event) => setWhatsappEnabled(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-teal-200"
            />
            <div>
              <p className="text-sm font-medium text-slate-900">Enable WhatsApp alerts</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Turn WhatsApp delivery on only if Twilio WhatsApp is configured and this number can receive messages.
              </p>
            </div>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveWhatsAppPreference}
              disabled={isSavingWhatsApp}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingWhatsApp ? "Saving..." : "Save WhatsApp settings"}
            </button>

            <button
              type="button"
              onClick={handleSendWhatsAppDigest}
              disabled={isSendingWhatsApp}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSendingWhatsApp ? "Sending..." : "Send WhatsApp now"}
            </button>
          </div>

          {whatsappPreferenceFeedback.error ? <p className="text-sm text-red-600">{whatsappPreferenceFeedback.error}</p> : null}
          {whatsappPreferenceFeedback.success ? <p className="text-sm text-emerald-700">{whatsappPreferenceFeedback.success}</p> : null}
        </div>
      </section>
    </div>
  );
}
