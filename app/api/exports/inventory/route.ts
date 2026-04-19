import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import {
  createCsvDownloadResponse,
  getInventoryExportRows,
  resolveRouteOrganizationContext,
} from "@/lib/reports/exports";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseRouteHandlerClient();
  const context = await resolveRouteOrganizationContext(supabase);

  if ("errorResponse" in context) {
    return context.errorResponse;
  }

  const rows = await getInventoryExportRows(context.supabase, context.organizationId);
  const dateStamp = new Date().toISOString().slice(0, 10);

  return createCsvDownloadResponse({
    filename: `pharmaflow-inventory-${dateStamp}.csv`,
    rows,
  });
}
