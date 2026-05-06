import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Boxes,
  Bell,
  ClipboardList,
  FileSpreadsheet,
  History,
  ArrowRight,
} from "lucide-react";

import { SectionIntro } from "@/components/layout/section-intro";
import { DashboardFeatures } from "@/components/blocks/dashboard-features";
import { isMissingColumnError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLocalDemandSignals } from "@/services/insights";
import {
  formatWeatherLocationInput,
  getLocalWeatherSnapshot,
  getMissingWeatherLocationFields,
} from "@/services/weather";

const quickActions = [
  {
    href: "/inventory",
    title: "Manage inventory",
    icon: Boxes,
  },
  {
    href: "/alerts",
    title: "Review alerts",
    icon: Bell,
  },
  {
    href: "/reorders",
    title: "Handle reorders",
    icon: ClipboardList,
  },
  {
    href: "/procurement",
    title: "Manage procurement",
    icon: FileSpreadsheet,
  },
  {
    href: "/stock-adjustments",
    title: "Audit stock changes",
    icon: History,
  },
];

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const [organizationQuery, medicinesQuery] = await Promise.all([
    supabase
      .from("organizations")
      .select("city, state, country")
      .eq("id", membership.organization_id)
      .maybeSingle(),
    supabase
      .from("medicines")
      .select("demand_category")
      .eq("organization_id", membership.organization_id),
  ]);

  const organization =
    isMissingColumnError(organizationQuery.error, "city") ||
    isMissingColumnError(organizationQuery.error, "state") ||
    isMissingColumnError(organizationQuery.error, "country")
      ? null
      : organizationQuery.data;

  const medicines = isMissingColumnError(medicinesQuery.error, "demand_category")
    ? []
    : medicinesQuery.data;

  const localWeather = await getLocalWeatherSnapshot(organization ?? undefined);
  const localDemandSignals = getLocalDemandSignals({
    location: organization ?? undefined,
    weather: localWeather,
    availableCategories: ((medicines ?? []) as Array<{ demand_category: string | null }>)
      .map((medicine) => medicine.demand_category ?? "")
      .filter(Boolean),
  });
  const missingLocationFields = getMissingWeatherLocationFields(organization ?? undefined);
  const hasRequiredWeatherLocation = missingLocationFields.length === 0;
  const weatherAwareSignals = localDemandSignals.filter(
    (signal) => signal.source === "weather" || signal.source === "seasonal_weather",
  );
  const weatherStatus = !hasRequiredWeatherLocation
    ? "missing_location"
    : !localWeather
      ? "weather_unavailable"
      : weatherAwareSignals.length
        ? "live_active"
        : "live_non_triggering";
  const fallbackUsed = !localWeather || weatherAwareSignals.length === 0;
  const weatherStatusMessage =
    weatherStatus === "missing_location"
      ? "Add pharmacy location to activate weather."
      : weatherStatus === "weather_unavailable"
        ? "Weather unavailable. Seasonal signals active."
        : weatherStatus === "live_non_triggering"
          ? "Live weather active. No weather uplift."
          : "Live weather active.";

  return (
    <div className="space-y-8">
      <SectionIntro
        eyebrow="Overview"
        title="Dashboard"
        description="Command center."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group app-card p-5 transition-colors hover:border-slate-300"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-blue-500" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <DashboardFeatures />

      <section className="app-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Demand Signals</h3>
            {!hasRequiredWeatherLocation ? (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Location needed for weather.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              weatherStatus === "live_active"
                ? "border-blue-200 bg-blue-50 text-blue-800"
                : weatherStatus === "live_non_triggering"
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {weatherStatusMessage}
          </div>

          {process.env.NODE_ENV === "development" ? (
            <details className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Diagnostics
              </summary>
              <div className="mt-3 space-y-1 text-xs text-slate-600">
                <p>Org location used: {formatWeatherLocationInput(organization ?? undefined)}</p>
                <p>
                  Missing required fields:{" "}
                  {missingLocationFields.length ? missingLocationFields.join(", ") : "none"}
                </p>
                <p>Weather status: {weatherStatus}</p>
                <p>Fallback used: {fallbackUsed ? "yes" : "no"}</p>
                <p>
                  Resolved weather location: {localWeather?.locationName ?? "not resolved"}
                </p>
                <p>Weather snapshot: {localWeather?.summary ?? "not available"}</p>
                <p>
                  Triggered weather rules:{" "}
                  {weatherAwareSignals.length
                    ? weatherAwareSignals.map((signal) => signal.categoryLabel).join(", ")
                    : "none"}
                </p>
              </div>
            </details>
          ) : null}

          {localDemandSignals.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {localDemandSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{signal.title}</p>
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      +{signal.upliftPercentage}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    {signal.categoryLabel}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="app-empty-state">
              <h4 className="app-empty-title">No active signals</h4>
              <p className="app-empty-copy">There are no unusual demand patterns detected in your region.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
