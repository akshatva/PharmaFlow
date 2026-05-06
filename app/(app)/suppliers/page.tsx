import { redirect } from "next/navigation";

import {
  DistributorManager,
  type DistributorListItem,
} from "@/components/distributors/distributor-manager";
import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SuppliersPageProps = {
  searchParams?: Promise<{
    query?: string;
    status?: string;
  }>;
};

type SupplierRecord = {
  id: string;
  distributor_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
  created_at: string;
};

type CatalogCountRecord = {
  distributor_id: string;
};

function normalizeStatus(value: string | undefined): "all" | "active" | "inactive" {
  return value === "active" || value === "inactive" ? value : "all";
}

function matchesSearch(supplier: DistributorListItem, query: string) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  return [
    supplier.distributorName,
    supplier.contactName,
    supplier.phone,
    supplier.email,
    supplier.city,
    supplier.state,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
}

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const params = await searchParams;
  const query = String(params?.query ?? "").trim();
  const status = normalizeStatus(params?.status);

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
    .from("distributors")
    .select("id, distributor_name, contact_name, phone, email, city, state, active, created_at")
    .eq("organization_id", membership.organization_id)
    .order("distributor_name", { ascending: true });

  if (error) {
    if (isMissingRelationError(error, "distributors")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Procurement"
            title="Suppliers"
            description="Supplier directory and catalog foundation."
          />
          <SetupNotice
            title="Suppliers not ready"
            description="Apply the supplier foundation migration and refresh."
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

  const supplierRows = (suppliers ?? []) as SupplierRecord[];
  const supplierIds = supplierRows.map((supplier) => supplier.id);
  const catalogCounts = new Map<string, number>();

  if (supplierIds.length) {
    const { data: catalogRows, error: catalogError } = await supabase
      .from("distributor_catalog")
      .select("distributor_id")
      .in("distributor_id", supplierIds);

    if (catalogError) {
      if (isMissingRelationError(catalogError, "distributor_catalog")) {
        return (
          <div className="space-y-6">
            <SectionIntro
              eyebrow="Procurement"
              title="Suppliers"
              description="Supplier directory and catalog foundation."
            />
            <SetupNotice
              title="Supplier catalog not ready"
              description="Apply the supplier catalog migration and refresh."
            />
          </div>
        );
      }

      throw new Error(
        process.env.NODE_ENV === "development"
          ? `Unable to load supplier catalog counts: ${catalogError.message}`
          : "Unable to load supplier catalog counts.",
      );
    }

    ((catalogRows ?? []) as CatalogCountRecord[]).forEach((row) => {
      catalogCounts.set(row.distributor_id, (catalogCounts.get(row.distributor_id) ?? 0) + 1);
    });
  }

  const rows = supplierRows
    .map((supplier): DistributorListItem => ({
      id: supplier.id,
      distributorName: supplier.distributor_name,
      contactName: supplier.contact_name,
      phone: supplier.phone,
      email: supplier.email,
      city: supplier.city,
      state: supplier.state,
      active: supplier.active,
      catalogCount: catalogCounts.get(supplier.id) ?? 0,
      createdAt: supplier.created_at,
    }))
    .filter((supplier) => {
      if (status === "active" && !supplier.active) {
        return false;
      }

      if (status === "inactive" && supplier.active) {
        return false;
      }

      return matchesSearch(supplier, query);
    });

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Procurement"
        title="Suppliers"
        description="Supplier directory and catalog foundation."
      />

      <DistributorManager distributors={rows} query={query} status={status} basePath="/suppliers" />
    </div>
  );
}
