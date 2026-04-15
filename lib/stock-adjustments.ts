import type { SupabaseClient } from "@supabase/supabase-js";

export type StockAdjustmentActionType =
  | "batch_created"
  | "batch_updated"
  | "batch_deleted"
  | "stock_received"
  | "manual_adjustment";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type StockAdjustmentLogInput = {
  organizationId: string;
  medicineId?: string | null;
  inventoryBatchId?: string | null;
  userId?: string | null;
  actionType: StockAdjustmentActionType;
  previousQuantity?: number | null;
  newQuantity?: number | null;
  quantityChange?: number | null;
  note?: string | null;
  metadata?: Record<string, JsonValue> | null;
};

export async function createStockAdjustmentLog(
  supabase: SupabaseClient,
  input: StockAdjustmentLogInput,
) {
  const { error } = await supabase.from("stock_adjustment_logs").insert({
    organization_id: input.organizationId,
    medicine_id: input.medicineId ?? null,
    inventory_batch_id: input.inventoryBatchId ?? null,
    user_id: input.userId ?? null,
    action_type: input.actionType,
    previous_quantity: input.previousQuantity ?? null,
    new_quantity: input.newQuantity ?? null,
    quantity_change: input.quantityChange ?? null,
    note: input.note ?? null,
    metadata: input.metadata ?? null,
  });

  return error;
}
