import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="flex h-[50vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        <p className="text-sm font-medium text-slate-500">Loading data...</p>
      </div>
    </div>
  );
}
