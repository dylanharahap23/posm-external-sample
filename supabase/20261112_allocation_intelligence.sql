-- Schema only: follows 20261111_canonical_foundation.sql; no data or client write grants.
begin;
create table public.allocation_batches (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 stage text not null, source_file text not null, source_sheet text not null,
 unique(tenant_id,id), unique(tenant_id,source_file,source_sheet)
);
alter table public.allocations add constraint allocations_tenant_id_id_key unique(tenant_id,id);
alter table public.stores add constraint stores_tenant_id_id_key unique(tenant_id,id);
alter table public.projects add constraint projects_tenant_id_id_key unique(tenant_id,id);
alter table public.allocations
 add column allocation_batch_id uuid,
 add column source_file text,
 add column source_sheet text,
 add column source_row integer check(source_row > 0),
 add column store_name text,
 add column area text,
 add constraint allocation_source_identity unique (tenant_id, source_file, source_sheet, source_row),
 add constraint allocation_batch_tenant_fk foreign key(tenant_id,allocation_batch_id) references public.allocation_batches(tenant_id,id),
 add constraint allocation_source_complete check ((source_file is null and source_sheet is null and source_row is null) or (source_file is not null and source_sheet is not null and source_row is not null));
-- Existing rows may lack provenance. New importer must set all three source fields.
create table public.allocation_items (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
 allocation_id uuid not null, posm_key text not null, source_value jsonb not null,
 foreign key (tenant_id, allocation_id) references public.allocations(tenant_id,id),
 unique(tenant_id,allocation_id,posm_key)
);
create table public.allocation_store_links (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), allocation_id uuid not null,
 store_id uuid not null, method text not null check(length(trim(method)) > 0), confidence numeric not null check(confidence between 0 and 1),
 verification_status text not null check(verification_status in ('pending','verified','rejected')),
 actor text not null, created_at timestamptz not null default now(),
 foreign key (tenant_id, allocation_id) references public.allocations(tenant_id,id),
 foreign key (tenant_id,store_id) references public.stores(tenant_id,id), unique(tenant_id,allocation_id)
);
create table public.allocation_project_links (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), allocation_id uuid not null,
 project_id uuid not null, actor text not null, created_at timestamptz not null default now(),
 foreign key (tenant_id, allocation_id) references public.allocations(tenant_id,id),
 foreign key (tenant_id,project_id) references public.projects(tenant_id,id), unique(tenant_id,allocation_id,project_id)
);
create table public.allocation_reconciliation_events (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id), allocation_id uuid not null,
 actor text not null, action text not null, before_data jsonb, after_data jsonb not null, created_at timestamptz not null default now(),
 foreign key (tenant_id, allocation_id) references public.allocations(tenant_id,id)
);
create index allocation_store_links_store_idx on public.allocation_store_links(tenant_id,store_id,verification_status);
create index allocation_project_links_project_idx on public.allocation_project_links(tenant_id,project_id);
create index allocation_reconciliation_events_history_idx on public.allocation_reconciliation_events(tenant_id,allocation_id,created_at desc);
create index allocation_items_posm_idx on public.allocation_items(tenant_id,posm_key);
create index allocations_planning_batch_idx on public.allocations(tenant_id,allocation_batch_id);
-- DENY ALL until a reviewed parent-joined tenant + region policy is deployed.
-- Server/service importer must verify project.store_id equals the explicitly verified store.
-- No name, confidence, survey status or raw source store_id implies an accepted match.
do $$ declare t text; begin
 foreach t in array array['allocation_batches','allocation_items','allocation_store_links','allocation_project_links','allocation_reconciliation_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
commit;
