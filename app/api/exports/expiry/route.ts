import { NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import {
  createCsvDownloadResponse,
  getExpiryExportRows,
  resolveRouteOrganizationContext,
} from "@/lib/reports/exports";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseRouteHandlerClient();
  const context = await resolveRouteOrganizationContext(supabase);

  if ("errorResponse" in context) {
    return context.errorResponse;
  }

  try {
    const rows = await getExpiryExportRows(context.supabase, context.organizationId);
    const dateStamp = new Date().toISOString().slice(0, 10);

    return createCsvDownloadResponse({
      filename: `pharmaflow-expiry-report-${dateStamp}.csv`,
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? `Unable to export expiry report: ${error.message}`
            : "Unable to export expiry report.",
      },
      { status: 500 },
    );
  }
}
