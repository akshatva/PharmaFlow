"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type CopySupplierMessageButtonProps = {
  supplierName: string;
  medicineName: string;
  quantity: number;
  unitPrice: number | null;
  expectedDeliveryDate: string | null;
  organizationName: string;
};

export function CopySupplierMessageButton({
  supplierName,
  medicineName,
  quantity,
  unitPrice,
  expectedDeliveryDate,
  organizationName,
}: CopySupplierMessageButtonProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const formattedSupplier = supplierName === "No supplier selected" ? "Supplier" : supplierName;
    const formattedDate = expectedDeliveryDate
      ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(expectedDeliveryDate))
      : null;
    const formattedPrice = unitPrice
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(unitPrice)
      : null;

    let message = `Hello ${formattedSupplier},\n\nWe would like to order ${quantity} units of ${medicineName} for ${organizationName}.`;

    if (formattedPrice) {
      message += ` The expected unit price is ${formattedPrice}.`;
    }

    if (formattedDate) {
      message += ` Our requested delivery timeline is by ${formattedDate}.`;
    }

    message += `\n\nPlease confirm availability, final price, and expected delivery timeline.\n\nThank you,\n${organizationName}`;

    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={copied}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        copied
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-50 text-slate-600 hover:bg-slate-100"
      }`}
      title="Prepare supplier request message"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy Message"}
    </button>
  );
}
