"use client";

import { useState, useTransition } from "react";

import { updateOrganizationLocation } from "@/app/(app)/settings/actions";

type PharmacyLocationSettingsProps = {
  initialCity: string;
  initialState: string;
  initialCountry: string;
  initialPincode: string;
};

export function PharmacyLocationSettings({
  initialCity,
  initialState,
  initialCountry,
  initialPincode,
}: PharmacyLocationSettingsProps) {
  const [city, setCity] = useState(initialCity);
  const [stateValue, setStateValue] = useState(initialState);
  const [country, setCountry] = useState(initialCountry);
  const [pincode, setPincode] = useState(initialPincode);
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });
  const [isSaving, startSavingTransition] = useTransition();

  function handleSaveLocation() {
    const formData = new FormData();
    formData.set("city", city);
    formData.set("state", stateValue);
    formData.set("country", country);
    formData.set("pincode", pincode);

    startSavingTransition(async () => {
      const result = await updateOrganizationLocation(formData);
      setFeedback(result);
    });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-slate-950">Pharmacy location</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Save the primary location of your organization so PharmaFlow is ready for
          location-aware demand intelligence later.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-900">City</span>
          <input
            type="text"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="app-input"
            placeholder="Mumbai"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-900">State</span>
          <input
            type="text"
            value={stateValue}
            onChange={(event) => setStateValue(event.target.value)}
            className="app-input"
            placeholder="Maharashtra"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-900">Country</span>
          <input
            type="text"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="app-input"
            placeholder="India"
          />
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium text-slate-900">Pincode (optional)</span>
          <input
            type="text"
            value={pincode}
            onChange={(event) => setPincode(event.target.value)}
            className="app-input"
            placeholder="400001"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSaveLocation}
          disabled={isSaving}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save location"}
        </button>
      </div>

      {feedback.error ? <p className="mt-3 text-sm text-red-600">{feedback.error}</p> : null}
      {feedback.success ? <p className="mt-3 text-sm text-emerald-700">{feedback.success}</p> : null}
    </section>
  );
}
