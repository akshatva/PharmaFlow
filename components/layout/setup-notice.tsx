import { AlertTriangle } from "lucide-react";

export function SetupNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5">
      <div className="flex gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
        <div>
          <h3 className="text-sm font-semibold text-amber-900">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-amber-800">{description}</p>
        </div>
      </div>
    </div>
  );
}
