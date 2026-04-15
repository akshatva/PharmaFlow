import { SalesUpload } from "@/components/sales/sales-upload";
import { SectionIntro } from "@/components/layout/section-intro";

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <SectionIntro
        eyebrow="Revenue"
        title="Sales"
        description="Upload validated sales records for medicines that already exist in your organization workspace."
      />
      <SalesUpload />
    </div>
  );
}
