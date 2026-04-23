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
    description: "Add batches, fix quantities, and handle daily stock corrections.",
    icon: Boxes,
  },
  {
    href: "/alerts",
    title: "Review alerts",
    description: "Low stock, near-expiry, and expired items needing attention.",
    icon: Bell,
  },
  {
    href: "/reorders",
    title: "Handle reorders",
    description: "Turn insights into tracked reorder decisions and supplier actions.",
    icon: ClipboardList,
  },
  {
    href: "/purchase-orders",
    title: "Receive purchase orders",
    description: "Move placed orders forward and bring received stock into batches.",
    icon: FileSpreadsheet,
  },
  {
    href: "/stock-adjustments",
    title: "Audit stock changes",
    description: "Trace manual edits, deletions, and received stock history.",
    icon: History,
  },
];

const workflowChecks = [
  "Use Inventory for the fastest daily add, edit, and delete workflow on batches.",
  "Use Alerts when you want action-oriented low stock and expiry review instead of raw tables.",
  "Use Reorders and Purchase Orders together when moving from insight to supplier execution.",
  "Use Stock Adjustments when something looks off and you need a trustworthy trail.",
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
      ? `Live weather is inactive because the organization is missing ${missingLocationFields.join(", ")}. Add these in Settings > Pharmacy Location. Seasonal fallback is active.`
      : weatherStatus === "weather_unavailable"
        ? `Live weather could not be loaded for ${formatWeatherLocationInput(organization ?? undefined)}. Seasonal fallback is active.`
        : weatherStatus === "live_non_triggering"
          ? `Live weather is available for ${localWeather?.locationName}, but no weather-specific rules are active right now. Seasonal signals are shown where relevant.`
          : `Live weather is active for ${localWeather?.locationName}. Weather-aware demand signals are included below.`;

  return (
    <div className="space-y-8">
      <SectionIntro
        eyebrow="Overview"
        title="Dashboard"
        description="Operational home for inventory, alerts, forecast-aware reorders, and local demand context."
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
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{action.description}</p>
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
            <h3 className="text-sm font-semibold text-slate-900">Local demand signals</h3>
            <p className="mt-1 text-sm text-slate-500">
              Seasonal category signals, strengthened with live local weather when available.
            </p>
            {localWeather ? (
              <p className="mt-2 text-xs font-medium text-slate-600">
                Live weather: {localWeather.summary} in {localWeather.locationName}
              </p>
            ) : null}
            {!hasRequiredWeatherLocation ? (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Add Pharmacy Location in Settings to activate live weather.
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
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Weather debug
              </p>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
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
            </div>
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
                  <p className="mt-2 text-sm leading-6 text-slate-600">{signal.explanation}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="app-empty-state">
              No active local demand signals for your current medicine categories this month.
            </div>
          )}
        </div>
      </section>

      <section className="app-card p-6">
        <h3 className="text-sm font-semibold text-slate-900">Workflow guide</h3>
        <p className="mt-1 text-sm text-slate-500">How each section fits into the daily operating rhythm.</p>
        <div className="mt-4 space-y-2">
          {workflowChecks.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600"
            >
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                {index + 1}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
