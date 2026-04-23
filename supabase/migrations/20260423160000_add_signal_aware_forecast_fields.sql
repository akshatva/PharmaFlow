begin;

alter table public.forecast_results
  add column if not exists baseline_daily_demand numeric,
  add column if not exists active_uplift_percentage numeric,
  add column if not exists demand_signal_title text,
  add column if not exists signal_explanation text;

update public.forecast_results
set
  baseline_daily_demand = coalesce(baseline_daily_demand, daily_demand_avg),
  active_uplift_percentage = coalesce(active_uplift_percentage, 0)
where baseline_daily_demand is null
   or active_uplift_percentage is null;

notify pgrst, 'reload schema';

commit;
