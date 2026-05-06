import { notFound, redirect } from "next/navigation";

import {
  DistributorCatalogManager,
  type DistributorCatalogItem,
  type DistributorDetail,
} from "@/components/distributors/distributor-catalog-manager";
import { SectionIntro } from "@/components/layout/section-intro";
import { SetupNotice } from "@/components/layout/setup-notice";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DistributorDetailPageProps = {
  params: Promise<{
    supplierId: string;
  }>;
  searchParams?: Promise<{
    query?: string;
    status?: string;
  }>;
};

type DistributorRecord = {
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

type CatalogRecord = {
  id: string;
  medicine_name: string;
  sku: string | null;
  category: string | null;
  unit_price: number | string;
  available_quantity: number | null;
  lead_time_days: number | null;
  active: boolean;
  created_at: string;
};

function normalizeStatus(value: string | undefined): "all" | "active" | "inactive" {
  return value === "active" || value === "inactive" ? value : "all";
}

function matchesSearch(item: DistributorCatalogItem, query: string) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  return [item.medicineName, item.sku, item.category]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
}

export default async function DistributorDetailPage({
  params,
  searchParams,
}: DistributorDetailPageProps) {
  const { supplierId } = await params;
  const queryParams = await searchParams;
  const query = String(queryParams?.query ?? "").trim();
  const status = normalizeStatus(queryParams?.status);

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

  const { data: distributor, error: distributorError } = await supabase
    .from("distributors")
    .select("id, distributor_name, contact_name, phone, email, city, state, active, created_at")
    .eq("organization_id", membership.organization_id)
    .eq("id", supplierId)
    .maybeSingle();

  if (distributorError) {
    if (isMissingRelationError(distributorError, "distributors")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Supply Chain"
            title="Supplier"
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
        ? `Unable to load supplier: ${distributorError.message}`
        : "Unable to load supplier.",
    );
  }

  if (!distributor) {
    notFound();
  }

  const { data: catalogItems, error: catalogError } = await supabase
    .from("distributor_catalog")
    .select("id, medicine_name, sku, category, unit_price, available_quantity, lead_time_days, active, created_at")
    .eq("distributor_id", supplierId)
    .order("medicine_name", { ascending: true });

  if (catalogError) {
    if (isMissingRelationError(catalogError, "distributor_catalog")) {
      return (
        <div className="space-y-6">
          <SectionIntro
            eyebrow="Supply Chain"
            title={(distributor as DistributorRecord).distributor_name}
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
        ? `Unable to load supplier catalog: ${catalogError.message}`
        : "Unable to load supplier catalog.",
    );
  }

  const distributorRecord = distributor as DistributorRecord;
  const catalogRows = ((catalogItems ?? []) as CatalogRecord[])
    .map((item): DistributorCatalogItem => ({
      id: item.id,
      medicineName: item.medicine_name,
      sku: item.sku,
      category: item.category,
      unitPrice: Number(item.unit_price),
      availableQuantity: item.available_quantity,
      leadTimeDays: item.lead_time_days,
      active: item.active,
      createdAt: item.created_at,
    }))
    .filter((item) => {
      if (status === "active" && !item.active) {
        return false;
      }

      if (status === "inactive" && item.active) {
        return false;
      }

      return matchesSearch(item, query);
    });

  const distributorDetail: DistributorDetail = {
    id: distributorRecord.id,
    distributorName: distributorRecord.distributor_name,
    contactName: distributorRecord.contact_name,
    phone: distributorRecord.phone,
    email: distributorRecord.email,
    city: distributorRecord.city,
    state: distributorRecord.state,
    active: distributorRecord.active,
    createdAt: distributorRecord.created_at,
  };

  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Supply Chain"
        title={distributorDetail.distributorName}
        description="Supplier profile and catalog."
      />

      <DistributorCatalogManager
        distributor={distributorDetail}
        catalogItems={catalogRows}
        query={query}
        status={status}
        basePath="/suppliers"
      />
    </div>
  );
}
