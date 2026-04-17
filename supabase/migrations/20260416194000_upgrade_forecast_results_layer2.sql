alter table public.forecast_results
  drop constraint if exists forecast_results_organization_id_medicine_id_model_name_key;

alter table public.forecast_results
  add column if not exists error_metric_name text,
  add column if not exists error_metric_value numeric,
  add column if not exists history_days_used integer;

alter table public.forecast_results
  drop constraint if exists forecast_results_organization_id_medicine_id_key;

alter table public.forecast_results
  add constraint forecast_results_organization_id_medicine_id_key
  unique (organization_id, medicine_id);

create index if not exists forecast_results_organization_id_confidence_level_idx
  on public.forecast_results (organization_id, confidence_level);
