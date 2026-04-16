import type { Metadata } from "next";

import { PharmaFlowLandingPage } from "@/components/marketing/pharmaflow-landing-page";

export const metadata: Metadata = {
  title: "PharmaFlow | Pharmacy Operations System",
  description:
    "PharmaFlow helps pharmacy teams manage inventory, expiry, reordering, suppliers, purchase orders, forecasting, and daily workflows in one place.",
};

export default function HomePage() {
  return <PharmaFlowLandingPage />;
}
