import { normalizeMedicineComparableName } from "@/services/inventory";

export type SupplierCatalogCandidate = {
  supplierId: string;
  supplierName: string;
  supplierActive: boolean;
  medicineName: string;
  unitPrice: number;
  availableQuantity: number | null;
  leadTimeDays: number | null;
  itemActive: boolean;
};

export type SupplierRecommendation = {
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  availableQuantity: number;
  leadTimeDays: number | null;
  score: number;
  reason: string;
  matchedSupplierCount: number;
};

export type ReorderUrgency = "urgent" | "high" | "normal";

type SupplierRecommendationInput = {
  medicineName: string;
  suggestedQuantity: number;
  candidates: SupplierCatalogCandidate[];
  urgency?: ReorderUrgency;
};

/**
 * Urgency-aware scoring weights.
 *
 * - "urgent": lead time is prioritised (45%) so the fastest supplier wins.
 * - "high": balanced with a slight lead-time preference (40/30/30).
 * - "normal": price is prioritised (45%) to minimise cost.
 *
 * All three dimensions always sum to 100 so scores remain comparable.
 */
function getScoringWeights(urgency: ReorderUrgency) {
  switch (urgency) {
    case "urgent":
      return { price: 20, leadTime: 45, availability: 35 };
    case "high":
      return { price: 30, leadTime: 40, availability: 30 };
    case "normal":
    default:
      return { price: 45, leadTime: 20, availability: 35 };
  }
}

function compareNullableLeadTime(first: number | null, second: number | null) {
  if (first === null && second === null) {
    return 0;
  }

  if (first === null) {
    return 1;
  }

  if (second === null) {
    return -1;
  }

  return first - second;
}

function buildRecommendationReason({
  availableQuantity,
  leadTimeDays,
  requiredQuantity,
  urgency,
}: {
  availableQuantity: number;
  leadTimeDays: number | null;
  requiredQuantity: number;
  urgency: ReorderUrgency;
}) {
  const hasEnoughAvailability = availableQuantity >= requiredQuantity;

  if (urgency === "urgent") {
    if (hasEnoughAvailability && leadTimeDays !== null) {
      return `Fastest available option with competitive pricing.`;
    }

    if (hasEnoughAvailability) {
      return "Best available supplier for urgent reorder.";
    }

    if (leadTimeDays !== null) {
      return `Fastest option, ${leadTimeDays}d lead time. Partial availability.`;
    }

    return "Best available supplier for urgent reorder.";
  }

  if (hasEnoughAvailability && leadTimeDays !== null) {
    return `Enough availability, ${leadTimeDays}d lead time, competitive price.`;
  }

  if (hasEnoughAvailability) {
    return "Enough availability with competitive price.";
  }

  if (leadTimeDays !== null) {
    return `Best available match, ${leadTimeDays}d lead time.`;
  }

  return "Best available active supplier.";
}

export function getSupplierRecommendationForMedicine({
  medicineName,
  suggestedQuantity,
  candidates,
  urgency = "normal",
}: SupplierRecommendationInput): SupplierRecommendation | null {
  const comparableMedicineName = normalizeMedicineComparableName(medicineName);
  const requiredQuantity = Math.max(1, Math.ceil(suggestedQuantity));

  const eligibleCandidates = candidates.filter((candidate) => {
    if (!candidate.supplierActive || !candidate.itemActive) {
      return false;
    }

    if (normalizeMedicineComparableName(candidate.medicineName) !== comparableMedicineName) {
      return false;
    }

    return (
      Number.isFinite(candidate.unitPrice) &&
      candidate.unitPrice > 0 &&
      candidate.availableQuantity !== null &&
      candidate.availableQuantity > 0
    );
  });

  if (!eligibleCandidates.length) {
    return null;
  }

  const lowestPrice = Math.min(...eligibleCandidates.map((candidate) => candidate.unitPrice));
  const knownLeadTimes = eligibleCandidates
    .map((candidate) => candidate.leadTimeDays)
    .filter((leadTime): leadTime is number => leadTime !== null && leadTime >= 0);
  const fastestLeadTime = knownLeadTimes.length ? Math.min(...knownLeadTimes) : null;

  const weights = getScoringWeights(urgency);

  const scoredCandidates = eligibleCandidates.map((candidate) => {
    const priceScore = (lowestPrice / candidate.unitPrice) * weights.price;
    const leadTimeScore =
      candidate.leadTimeDays !== null && fastestLeadTime !== null
        ? ((fastestLeadTime + 1) / (candidate.leadTimeDays + 1)) * weights.leadTime
        : 0;
    const availabilityScore =
      Math.min(candidate.availableQuantity! / requiredQuantity, 1) * weights.availability;
    const score = Math.round((priceScore + leadTimeScore + availabilityScore) * 100) / 100;

    return {
      candidate,
      score,
    };
  });

  scoredCandidates.sort((first, second) => {
    if (second.score !== first.score) {
      return second.score - first.score;
    }

    const leadTimeDifference = compareNullableLeadTime(
      first.candidate.leadTimeDays,
      second.candidate.leadTimeDays,
    );

    if (leadTimeDifference !== 0) {
      return leadTimeDifference;
    }

    if (first.candidate.unitPrice !== second.candidate.unitPrice) {
      return first.candidate.unitPrice - second.candidate.unitPrice;
    }

    if (second.candidate.availableQuantity !== first.candidate.availableQuantity) {
      return second.candidate.availableQuantity! - first.candidate.availableQuantity!;
    }

    return first.candidate.supplierName.localeCompare(second.candidate.supplierName);
  });

  const bestMatch = scoredCandidates[0];

  return {
    supplierId: bestMatch.candidate.supplierId,
    supplierName: bestMatch.candidate.supplierName,
    unitPrice: bestMatch.candidate.unitPrice,
    availableQuantity: bestMatch.candidate.availableQuantity!,
    leadTimeDays: bestMatch.candidate.leadTimeDays,
    score: bestMatch.score,
    reason: buildRecommendationReason({
      availableQuantity: bestMatch.candidate.availableQuantity!,
      leadTimeDays: bestMatch.candidate.leadTimeDays,
      requiredQuantity,
      urgency,
    }),
    matchedSupplierCount: eligibleCandidates.length,
  };
}
