export type InsightWorkflowStatus = "open" | "reviewed" | "needs_reorder" | "monitor";
export type PersistedInsightWorkflowStatus = Exclude<InsightWorkflowStatus, "open">;
export type InsightWorkflowType =
  | "stockout_risk"
  | "expiry_risk"
  | "dead_stock"
  | "reorder_suggestion";

export function getInsightWorkflowKey({
  insightType,
  medicineId,
  inventoryBatchId,
}: {
  insightType: InsightWorkflowType;
  medicineId?: string | null;
  inventoryBatchId?: string | null;
}) {
  if (inventoryBatchId) {
    return `${insightType}:batch:${inventoryBatchId}`;
  }

  if (medicineId) {
    return `${insightType}:medicine:${medicineId}`;
  }

  throw new Error("Insight workflow key requires a medicine or batch identifier.");
}

export function getInsightWorkflowStatusLabel(status: InsightWorkflowStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "reviewed":
      return "Reviewed";
    case "needs_reorder":
      return "Needs reorder";
    default:
      return "Monitor";
  }
}

export function getInsightWorkflowTypeLabel(insightType: InsightWorkflowType) {
  switch (insightType) {
    case "stockout_risk":
      return "Stockout risk";
    case "expiry_risk":
      return "Expiry risk";
    case "dead_stock":
      return "Dead stock";
    default:
      return "Reorder suggestion";
  }
}
