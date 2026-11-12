-- Panako Intelligence normalized foundation. Schema only; not applied by this ingestion task.
create extension if not exists postgis;
create extension if not exists pgcrypto;

create table public.tenants (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table public.regions (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), code text not null, name text not null, unique(tenant_id, code));
create table public.distributors (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), name text not null);
create table public.depots (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), distributor_id uuid references public.distributors(id), name text not null);
create table public.brands (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), name text not null);
create table public.channels (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), name text not null);
create table public.stores (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), store_id text not null, name text, address text, region_id uuid references public.regions(id), location geography(Point,4326), source_ref jsonb not null default '{}', unique(tenant_id, store_id));
create index stores_location_gix on public.stores using gist(location);
create table public.batches (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), name text not null, stage text not null);
create table public.projects (id uuid primary key, tenant_id uuid not null references public.tenants(id), store_id uuid not null references public.stores(id), request_date date, request_date_raw text, request_type text, channel_id uuid references public.channels(id), region_id uuid references public.regions(id), job_status text, source_ref jsonb not null);
create table public.project_stages (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), project_id uuid not null references public.projects(id), stage text not null, status text, observed_at timestamptz);
create table public.allocations (id uuid primary key, tenant_id uuid not null references public.tenants(id), batch_id uuid references public.batches(id), store_id uuid references public.stores(id), brand_id uuid references public.brands(id), tier text, channel_id uuid references public.channels(id), region_id uuid references public.regions(id), status_survey text, source_ref jsonb not null);
create table public.approvals (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), project_id uuid references public.projects(id), status text, approved_at timestamptz);
create table public.issues (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), project_id uuid references public.projects(id), severity text, status text, description text);
create table public.project_documents (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), project_id uuid references public.projects(id), storage_key text not null, document_type text);
create table public.project_activities (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), project_id uuid references public.projects(id), activity text not null, actor uuid, occurred_at timestamptz not null default now());
create table public.audit_logs (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), actor uuid, action text not null, entity text, entity_id uuid, before_data jsonb, after_data jsonb, created_at timestamptz not null default now());
create table public.import_batches (id uuid primary key default gen_random_uuid(), tenant_id uuid references public.tenants(id), file_name text not null, sha256 text not null, role text not null, imported_at timestamptz not null default now());
create table public.market_areas (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), region_id uuid references public.regions(id), name text not null, boundary geography(MultiPolygon,4326));
create index market_areas_boundary_gix on public.market_areas using gist(boundary);
create table public.market_indicators (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), area_id uuid references public.market_areas(id), indicator text not null, value numeric, observed_on date, source_ref jsonb);
create table public.competitor_observations (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), store_id uuid references public.stores(id), brand text not null, observed_on date, source_ref jsonb);
create table public.store_brand_presence (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), store_id uuid references public.stores(id), brand_id uuid references public.brands(id), observed_on date, status text, source_ref jsonb);
create table public.location_candidates (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), area_id uuid references public.market_areas(id), name text, location geography(Point,4326), source_ref jsonb);
create index location_candidates_gix on public.location_candidates using gist(location);
create table public.location_scores (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), candidate_id uuid references public.location_candidates(id), factor text not null, score numeric, weight numeric, model_version text);
create table public.recommendation_runs (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), model_version text not null, run_at timestamptz not null default now());
create table public.expansion_scenarios (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), name text not null, budget numeric, target_count integer, strategy text);
create table public.expansion_scenario_items (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), scenario_id uuid references public.expansion_scenarios(id), candidate_id uuid references public.location_candidates(id), rank integer);
create table public.project_outcomes (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), project_id uuid references public.projects(id), outcome text, observed_on date, value numeric);

-- Claims are trusted only from app_metadata (never editable user_metadata).
-- Master/reference tables require tenant_admin; operational reads require an explicit region grant.
create or replace function public.can_read_region(target_tenant uuid, target_region uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
 select coalesce((auth.jwt()->'app_metadata'->'tenant_ids') ? target_tenant::text,false)
 and (coalesce(auth.jwt()->'app_metadata'->>'role' = 'tenant_admin',false)
      or (target_region is not null and coalesce((auth.jwt()->'app_metadata'->'region_ids') ? target_region::text,false)));
$$;

do $$ declare t text; begin
  foreach t in array array['tenants','regions','distributors','depots','brands','channels','stores','batches','projects','project_stages','allocations','approvals','issues','project_documents','project_activities','audit_logs','import_batches','market_areas','market_indicators','competitor_observations','store_brand_presence','location_candidates','location_scores','recommendation_runs','expansion_scenarios','expansion_scenario_items','project_outcomes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
  foreach t in array array['stores','projects','allocations','market_areas'] loop
    execute format('create policy regional_read on public.%I for select to authenticated using (public.can_read_region(tenant_id,region_id))', t);
  end loop;
end $$;
-- All remaining tables have no policies and are DENY ALL, including membership/configuration,
-- imports, audit, child and intelligence records. No client writes granted anywhere.
-- A service-role server importer bypasses RLS: validate tenant + parent/child ownership before writes.
-- Region identifiers in signed app_metadata are globally unique UUIDs. Null-region rows are admin-only.
-- Production additions must join parent records and check BOTH tenant and region, never tenant alone.
