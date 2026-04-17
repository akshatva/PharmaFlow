import { NextResponse } from "next/server";

import { generateForecastsForOrganization } from "@/lib/forecasting/service";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Unable to resolve your organization: ${membershipError?.message ?? "No membership found."}`
            : "Unable to resolve your organization.",
      },
      { status: 400 },
    );
  }

  const { forecastRows, preparationError } = await generateForecastsForOrganization({
    supabase,
    organizationId: membership.organization_id,
  });

  if (preparationError) {
    console.error("Forecast generation failed", {
      organizationId: membership.organization_id,
      code: preparationError.code,
      message: preparationError.message,
      details: preparationError.details,
      hint: preparationError.hint,
    });

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Forecast generation failed: ${preparationError.message}`
            : "Forecast generation failed.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    organizationId: membership.organization_id,
    generatedCount: forecastRows.length,
    selectedModels: forecastRows.slice(0, 5).map((row) => ({
      medicineId: row.medicineId,
      medicineName: row.medicineName,
      modelName: row.modelName,
      confidenceLevel: row.confidenceLevel,
      errorMetricName: row.errorMetricName,
      errorMetricValue: row.errorMetricValue,
    })),
  });
}
