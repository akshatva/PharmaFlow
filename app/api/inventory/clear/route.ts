import { NextResponse } from "next/server";

import { createStockAdjustmentLog } from "@/lib/stock-adjustments";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

export const runtime = "nodejs";

type InventoryBatchToDelete = {
  id: string;
  medicine_id: string;
  batch_number: string;
  quantity: number;
};

export async function POST() {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  console.info("[inventory-clear] authenticated user", {
    userId: user.id,
  });

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    console.error("[inventory-clear] unable to resolve organization", {
      userId: user.id,
      error: membershipError,
    });

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

  const organizationId = membership.organization_id;

  console.info("[inventory-clear] resolved organization", {
    userId: user.id,
    organizationId,
  });

  const { data: existingBatches, error: existingBatchesError } = await supabase
    .from("inventory_batches")
    .select("id, medicine_id, batch_number, quantity")
    .eq("organization_id", organizationId);

  if (existingBatchesError) {
    console.error("[inventory-clear] unable to load inventory batches", {
      userId: user.id,
      organizationId,
      error: existingBatchesError,
    });

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Unable to load inventory batches: ${existingBatchesError.message}`
            : "Unable to load inventory batches.",
      },
      { status: 500 },
    );
  }

  const batchesToDelete = (existingBatches ?? []) as InventoryBatchToDelete[];

  console.info("[inventory-clear] matched inventory rows", {
    userId: user.id,
    organizationId,
    rowCount: batchesToDelete.length,
  });

  if (!batchesToDelete.length) {
    console.info("[inventory-clear] 0 rows affected", {
      userId: user.id,
      organizationId,
    });

    return NextResponse.json({
      success: true,
      deleted_count: 0,
      message: "No inventory batches were available to clear.",
    });
  }

  const adjustmentLogErrors = await Promise.all(
    batchesToDelete.map((batch) =>
      createStockAdjustmentLog(supabase, {
        organizationId,
        medicineId: batch.medicine_id,
        inventoryBatchId: batch.id,
        userId: user.id,
        actionType: "batch_deleted",
        previousQuantity: batch.quantity,
        newQuantity: 0,
        quantityChange: -batch.quantity,
        note: "Inventory batch deleted through clear inventory action.",
        metadata: {
          source: "clear_inventory",
          batch_number: batch.batch_number,
        },
      }),
    ),
  );

  const firstAdjustmentLogError = adjustmentLogErrors.find(Boolean);

  if (firstAdjustmentLogError) {
    console.error("Unable to create stock adjustment logs for inventory clear", {
      userId: user.id,
      organizationId,
      code: firstAdjustmentLogError.code,
      message: firstAdjustmentLogError.message,
      details: firstAdjustmentLogError.details,
      hint: firstAdjustmentLogError.hint,
    });

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Unable to create audit logs before clearing inventory: ${firstAdjustmentLogError.message}`
            : "Unable to create audit logs before clearing inventory.",
      },
      { status: 500 },
    );
  }

  const batchIds = batchesToDelete.map((batch) => batch.id);

  const { data: deletedRows, error: deleteError } = await supabase
    .from("inventory_batches")
    .delete()
    .eq("organization_id", organizationId)
    .in("id", batchIds)
    .select("id");

  console.info("[inventory-clear] delete response", {
    userId: user.id,
    organizationId,
    data: deletedRows,
    error: deleteError,
  });

  if (deleteError) {
    console.error("Unable to clear inventory", {
      userId: user.id,
      organizationId,
      code: deleteError.code,
      message: deleteError.message,
      details: deleteError.details,
      hint: deleteError.hint,
    });

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Unable to clear inventory: ${deleteError.message}`
            : "Unable to clear inventory.",
      },
      { status: 500 },
    );
  }

  const deletedCount = deletedRows?.length ?? 0;

  if (deletedCount === 0) {
    console.warn("[inventory-clear] 0 rows affected", {
      userId: user.id,
      organizationId,
      requestedBatchIds: batchIds,
    });
  } else {
    console.info("[inventory-clear] inventory cleared", {
      userId: user.id,
      organizationId,
      deletedCount,
    });
  }

  return NextResponse.json({
    success: deletedCount > 0,
    deleted_count: deletedCount,
    message:
      deletedCount > 0
        ? "Inventory cleared successfully."
        : "No inventory batches were deleted.",
  });
}
