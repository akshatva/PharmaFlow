import { NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import {
  createCsvDownloadResponse,
  getLowStockExportRows,
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
    const rows = await getLowStockExportRows(context.supabase, context.organizationId);
    const dateStamp = new Date().toISOString().slice(0, 10);

    return createCsvDownloadResponse({
      filename: `pharmaflow-low-stock-${dateStamp}.csv`,
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? `Unable to export low stock report: ${error.message}`
            : "Unable to export low stock report.",
      },
      { status: 500 },
    );
  }
}
