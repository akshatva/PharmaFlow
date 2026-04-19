import { redirect } from "next/navigation";

import {
  InventoryTable,
  type InventoryTableRow,
} from "@/components/inventory/inventory-table";
import { InventoryUpload } from "@/components/inventory/inventory-upload";
import { SectionIntro } from "@/components/layout/section-intro";
import { ExportButton } from "@/components/reports/export-button";
import { isMissingColumnError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InventoryPageProps = {
  searchParams?: Promise<{
    query?: string;
    medicineId?: string;
  }>;
};

type InventoryBatchRecord = {
  id: string;
  medicine_id: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
  purchase_price: number | null;
  selling_price: number | null;
  created_at: string;
  last_imported_at: string | null;
  medicines:
    | {
        name: string;
        sku: string | null;
        category: string | null;
        unit: string | null;
      }
    | {
        name: string;
        sku: string | null;
        category: string | null;
        unit: string | null;
      }[]
    | null;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "No CSV import has refreshed inventory yet.";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function mapInventoryRows(records: InventoryBatchRecord[]): InventoryTableRow[] {
  return records.map((record) => {
    const medicine = Array.isArray(record.medicines) ? record.medicines[0] : record.medicines;

    return {
      id: record.id,
      medicineId: record.medicine_id,
      medicineName: medicine?.name ?? "Unknown medicine",
      batchNumber: record.batch_number,
      quantity: record.quantity,
      expiryDate: record.expiry_date,
      purchasePrice: record.purchase_price,
      sellingPrice: record.selling_price,
      sku: medicine?.sku ?? null,
      category: medicine?.category ?? null,
      unit: medicine?.unit ?? null,
      createdAt: record.created_at,
    };
  });
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  let inventoryRecords: InventoryBatchRecord[] | null = null;
  let inventoryError: Error | { message?: string | null; code?: string | null } | null = null;

  const inventoryQuery = await supabase
    .from("inventory_batches")
    .select(
      "id, medicine_id, batch_number, quantity, expiry_date, purchase_price, selling_price, created_at, last_imported_at, medicines(name, sku, category, unit)",
    )
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false });

  if (isMissingColumnError(inventoryQuery.error, "last_imported_at")) {
    const fallbackInventoryQuery = await supabase
      .from("inventory_batches")
      .select(
        "id, medicine_id, batch_number, quantity, expiry_date, purchase_price, selling_price, created_at, medicines(name, sku, category, unit)",
      )
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false });

    inventoryRecords = ((fallbackInventoryQuery.data ?? []) as InventoryBatchRecord[]).map(
      (record) => ({
        ...record,
        last_imported_at: null,
      }),
    );
    inventoryError = fallbackInventoryQuery.error;
  } else {
    inventoryRecords = (inventoryQuery.data ?? []) as InventoryBatchRecord[];
    inventoryError = inventoryQuery.error;
  }

  const { data: medicines, error: medicinesError } = await supabase
    .from("medicines")
    .select("id, name")
    .eq("organization_id", membership.organization_id)
    .order("name", { ascending: true });

  if (inventoryError || medicinesError) {
    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load inventory: ${(inventoryError ?? medicinesError)?.message}`
        : "Unable to load inventory.",
    );
  }

  const inventoryRows = mapInventoryRows((inventoryRecords ?? []) as InventoryBatchRecord[]);
  const latestInventoryImportAt = ((inventoryRecords ?? []) as InventoryBatchRecord[]).reduce<string | null>(
    (latest, record) => {
      if (!record.last_imported_at) {
        return latest;
      }

      if (!latest) {
        return record.last_imported_at;
      }

      return new Date(record.last_imported_at).getTime() > new Date(latest).getTime()
        ? record.last_imported_at
        : latest;
    },
    null,
  );

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Operations"
        title="Inventory"
        description="Upload and validate batch-based inventory data for your organization before importing it into PharmaFlow."
      />
      <div className="flex flex-wrap gap-3">
        <ExportButton href="/api/exports/inventory" label="Export Inventory CSV" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600 shadow-sm">
        Inventory last updated:{" "}
        <span className="font-medium text-slate-900">{formatDateTime(latestInventoryImportAt)}</span>
        <br />
        CSV imports use snapshot updates. Matching batches are refreshed with the uploaded values,
        quantity is replaced rather than added, and batches not present in the file stay unchanged.
      </div>
      <InventoryUpload />
      <InventoryTable
        rows={inventoryRows}
        medicineOptions={medicines ?? []}
        initialQuery={resolvedSearchParams.query ?? ""}
        initialMedicineId={resolvedSearchParams.medicineId ?? ""}
      />
    </div>
  );
}
