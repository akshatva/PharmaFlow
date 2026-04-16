import Link from "next/link";
import { redirect } from "next/navigation";

import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import { SupplierManager } from "@/components/suppliers/supplier-manager";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupplierRecord = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
};

export default async function SuppliersPage() {
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

  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select("id, name, contact_person, phone, email, notes, created_at")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingRelationError(error, "suppliers")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Procurement"
            title="Suppliers"
            description="Maintain a lightweight supplier list so reorders can turn into purchase orders quickly."
          />
          <SetupNotice
            title="Supplier table not available yet"
            description="The `suppliers` table is missing in your connected Supabase project. Run the supplier and purchase order SQL in Supabase, reload the schema, and refresh the app."
          />
        </div>
      );
    }

    throw new Error(
      process.env.NODE_ENV === "development"
        ? `Unable to load suppliers: ${error.message}`
        : "Unable to load suppliers.",
    );
  }

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Procurement"
        title="Suppliers"
        description="Maintain a lightweight supplier list so reorders can turn into purchase orders quickly."
      />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/suppliers/analytics"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Open supplier analytics
        </Link>
      </div>

      <SupplierManager
        suppliers={((suppliers ?? []) as SupplierRecord[]).map((supplier) => ({
          id: supplier.id,
          name: supplier.name,
          contactPerson: supplier.contact_person,
          phone: supplier.phone,
          email: supplier.email,
          notes: supplier.notes,
          createdAt: supplier.created_at,
        }))}
      />
    </div>
  );
}
