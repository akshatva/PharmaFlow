import { NextResponse } from "next/server";

import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import {
  createCsvDownloadResponse,
  resolveRouteOrganizationContext,
} from "@/lib/reports/exports";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseRouteHandlerClient();
  const context = await resolveRouteOrganizationContext(supabase);

  if ("errorResponse" in context) {
    return context.errorResponse;
  }

  try {
    const { data: order, error } = await supabase
      .from("procurement_orders")
      .select(`
        id,
        medicine_name,
        quantity,
        unit_price,
        total_price,
        status,
        expected_delivery_date,
        notes,
        created_at,
        distributors(distributor_name),
        organizations(name)
      `)
      .eq("organization_id", context.organizationId)
      .eq("id", id)
      .single();

    if (error || !order) {
      return NextResponse.json(
        { error: "Purchase order not found or access denied." },
        { status: 404 },
      );
    }

    const data = order as any;

    const supplierName = Array.isArray(data.distributors)
      ? data.distributors[0]?.distributor_name
      : data.distributors?.distributor_name;

    const orgName = Array.isArray(data.organizations)
      ? data.organizations[0]?.name
      : data.organizations?.name;

    const row = {
      "Organization Name": orgName ?? "Not specified",
      "Supplier Name": supplierName ?? "Not specified",
      "Medicine Name": order.medicine_name,
      Quantity: order.quantity,
      "Unit Price": order.unit_price ?? "Not specified",
      "Total Price": order.total_price ?? "Not specified",
      "Expected Delivery Date": order.expected_delivery_date ?? "Not specified",
      "Order Status": order.status,
      Notes: order.notes ?? "Not specified",
      "Created Date": new Date(order.created_at).toISOString().split("T")[0],
      "PO Number": order.id,
    };

    const dateStamp = new Date().toISOString().slice(0, 10);

    return createCsvDownloadResponse({
      filename: `purchase-order-${order.id.slice(0, 8)}-${dateStamp}.csv`,
      rows: [row],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? `Unable to export purchase order: ${error.message}`
            : "Unable to export purchase order.",
      },
      { status: 500 },
    );
  }
}
