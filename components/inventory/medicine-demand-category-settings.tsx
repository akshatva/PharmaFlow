"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateMedicineDemandCategory } from "@/app/(app)/settings/actions";
import {
  demandCategoryOptions,
  formatDemandCategoryLabel,
} from "@/services/inventory";

type MedicineDemandCategorySettingsProps = {
  medicines: {
    id: string;
    name: string;
    demand_category: string | null;
  }[];
};

export function MedicineDemandCategorySettings({
  medicines,
}: MedicineDemandCategorySettingsProps) {
  const router = useRouter();
  const [selectedMedicineId, setSelectedMedicineId] = useState(medicines[0]?.id ?? "");
  const [selectedDemandCategory, setSelectedDemandCategory] = useState(
    medicines[0]?.demand_category ?? "",
  );
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });
  const [isSaving, startSavingTransition] = useTransition();

  const selectedMedicine =
    medicines.find((medicine) => medicine.id === selectedMedicineId) ?? null;

  function handleMedicineChange(nextMedicineId: string) {
    setSelectedMedicineId(nextMedicineId);
    const nextMedicine = medicines.find((medicine) => medicine.id === nextMedicineId) ?? null;
    setSelectedDemandCategory(nextMedicine?.demand_category ?? "");
    setFeedback({ error: null, success: null });
  }

  function handleSaveDemandCategory() {
    const formData = new FormData();
    formData.set("medicineId", selectedMedicineId);
    formData.set("demandCategory", selectedDemandCategory);

    startSavingTransition(async () => {
      const result = await updateMedicineDemandCategory(formData);
      setFeedback(result);

      if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <section className="app-card p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Demand category
        </p>
        <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-slate-900">
          Medicine demand category
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Store one primary demand category per medicine so PharmaFlow can build
          location-aware demand intelligence later.
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-900">Medicine</span>
          <select
            value={selectedMedicineId}
            onChange={(event) => handleMedicineChange(event.target.value)}
            className="app-input"
            disabled={!medicines.length}
          >
            {medicines.length ? null : <option value="">No medicines available</option>}
            {medicines.map((medicine) => (
              <option key={medicine.id} value={medicine.id}>
                {medicine.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-900">Primary demand category</span>
          <select
            value={selectedDemandCategory}
            onChange={(event) => setSelectedDemandCategory(event.target.value)}
            className="app-input"
            disabled={!medicines.length}
          >
            <option value="">Not set</option>
            {demandCategoryOptions.map((category) => (
              <option key={category} value={category}>
                {formatDemandCategoryLabel(category)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedMedicine ? (
        <p className="mt-3 text-sm text-slate-500">
          Current value for <span className="font-medium text-slate-800">{selectedMedicine.name}</span>:{" "}
          {formatDemandCategoryLabel(selectedMedicine.demand_category)}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSaveDemandCategory}
          disabled={isSaving || !selectedMedicineId}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save demand category"}
        </button>
      </div>

      {feedback.error ? <p className="mt-3 text-sm text-red-600">{feedback.error}</p> : null}
      {feedback.success ? <p className="mt-3 text-sm text-emerald-700">{feedback.success}</p> : null}
    </section>
  );
}
