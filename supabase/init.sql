-- ============================================================================
-- MyCoffeeRoastingBackstage
-- Supabase 标准初始化脚本
-- 用途：新库首次初始化 / 重置后重新建库
-- 特点：按当前项目实际结构整理，可在 Supabase SQL Editor 一次性执行
-- ============================================================================

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.green_beans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  origin_country text,
  origin_region text,
  origin_area text,
  variety text not null,
  harvest_season text,
  process_method text not null,
  altitude_meters_min integer,
  altitude_meters_max integer,
  moisture_percent numeric(5, 2),
  density_g_per_l numeric(6, 2),
  mill_name text,
  default_roast_input_grams integer not null check (default_roast_input_grams > 0),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint green_beans_altitude_range_check
    check (
      altitude_meters_min is null
      or altitude_meters_max is null
      or altitude_meters_min <= altitude_meters_max
    ),
  constraint green_beans_moisture_check
    check (moisture_percent is null or moisture_percent between 0 and 100),
  constraint green_beans_density_check
    check (density_g_per_l is null or density_g_per_l > 0)
);

create table if not exists public.green_bean_purchase_batches (
  id uuid primary key default gen_random_uuid(),
  green_bean_id uuid not null references public.green_beans(id) on delete restrict,
  supplier_name text,
  invoice_no text,
  purchased_weight_grams integer not null check (purchased_weight_grams > 0),
  purchased_total_price numeric(12, 2) not null check (purchased_total_price >= 0),
  purchased_unit_price_per_kg numeric(12, 2) generated always as (
    round((purchased_total_price / purchased_weight_grams::numeric) * 1000, 2)
  ) stored,
  remaining_weight_grams integer not null check (
    remaining_weight_grams >= 0
    and remaining_weight_grams <= purchased_weight_grams
  ),
  received_at date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bean_sale_specs (
  id uuid primary key default gen_random_uuid(),
  green_bean_id uuid not null references public.green_beans(id) on delete cascade,
  channel text not null default 'default',
  is_default boolean not null default false,
  unit_weight_grams integer not null check (unit_weight_grams > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.roast_profiles (
  id uuid primary key default gen_random_uuid(),
  green_bean_id uuid references public.green_beans(id) on delete cascade,
  name text not null,
  target_roast_level text,
  roast_purpose text,
  steps jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  batch_weight_grams integer not null default 200,
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint roast_profiles_steps_is_array
    check (jsonb_typeof(steps) = 'array'),
  constraint roast_profiles_batch_weight_check
    check (batch_weight_grams > 0),
  constraint roast_profiles_status_check
    check (status in ('draft', 'inProgress', 'completed', 'cancelled'))
);

create table if not exists public.roast_records (
  id uuid primary key default gen_random_uuid(),
  green_bean_id uuid not null references public.green_beans(id) on delete restrict,
  purchase_batch_id uuid references public.green_bean_purchase_batches(id) on delete set null,
  roast_profile_id uuid references public.roast_profiles(id) on delete set null,
  roast_date timestamptz not null default timezone('utc', now()),
  input_weight_grams integer not null check (input_weight_grams > 0),
  output_weight_grams integer check (
    output_weight_grams is null
    or (
      output_weight_grams >= 0
      and output_weight_grams <= input_weight_grams
    )
  ),
  weight_loss_ratio numeric(6, 4) generated always as (
    case
      when output_weight_grams is null then null
      else round(
        ((input_weight_grams - output_weight_grams)::numeric / input_weight_grams::numeric),
        4
      )
    end
  ) stored,
  roaster_name text,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.roast_batches (
  id uuid primary key default gen_random_uuid(),
  roast_date timestamptz not null default timezone('utc', now()),
  green_bean_id uuid not null references public.green_beans(id) on delete restrict,
  roasted_bean_name text,
  roast_plan_id uuid references public.roast_profiles(id) on delete set null,
  input_weight_grams integer not null check (input_weight_grams > 0),
  output_weight_grams integer not null default 0 check (
    output_weight_grams >= 0
    and output_weight_grams <= input_weight_grams
  ),
  roast_level text not null default '',
  development_ratio numeric(5, 2),
  first_crack_time integer,
  total_roast_time integer,
  notes text,
  image_urls jsonb default '[]'::jsonb,
  status text not null default 'completed' check (status in ('completed', 'draft')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint roast_batches_image_urls_array_check
    check (image_urls is null or jsonb_typeof(image_urls) = 'array')
);

create table if not exists public.cost_calculations (
  id uuid primary key default gen_random_uuid(),
  bean_id text not null,
  bean_name text not null,
  calculation_name text not null,
  purchase_cost_per_kg numeric(12, 2) not null check (purchase_cost_per_kg >= 0),
  dehydration_rate numeric(6, 2) not null check (dehydration_rate >= 0 and dehydration_rate <= 100),
  roast_input_weight_grams integer not null check (roast_input_weight_grams > 0),
  packaging_cost numeric(12, 2) not null default 0 check (packaging_cost >= 0),
  energy_cost numeric(12, 2) not null default 0 check (energy_cost >= 0),
  labor_cost numeric(12, 2) not null default 0 check (labor_cost >= 0),
  other_cost numeric(12, 2) not null default 0 check (other_cost >= 0),
  sale_unit_weight_grams integer not null check (sale_unit_weight_grams > 0),
  sale_unit_price numeric(12, 2) not null default 0 check (sale_unit_price >= 0),
  target_profit_rate numeric(8, 2) not null default 0 check (target_profit_rate >= 0),
  roasted_output_weight_grams numeric(12, 2) not null check (roasted_output_weight_grams >= 0),
  sale_unit_count numeric(12, 2) not null check (sale_unit_count >= 0),
  total_batch_cost numeric(12, 2) not null check (total_batch_cost >= 0),
  cost_per_roasted_kg numeric(12, 2) not null check (cost_per_roasted_kg >= 0),
  cost_per_sale_unit numeric(12, 2) not null check (cost_per_sale_unit >= 0),
  suggested_sale_price numeric(12, 2) not null check (suggested_sale_price >= 0),
  profit_per_sale_unit numeric(12, 2) not null,
  profit_rate numeric(8, 2) not null,
  data_source text not null check (data_source in ('greenBean', 'roastedBean')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists green_bean_purchase_batches_green_bean_id_idx
  on public.green_bean_purchase_batches(green_bean_id, received_at desc);

create index if not exists bean_sale_specs_green_bean_id_idx
  on public.bean_sale_specs(green_bean_id);

create unique index if not exists bean_sale_specs_default_idx
  on public.bean_sale_specs(green_bean_id)
  where is_default;

create index if not exists roast_profiles_green_bean_id_idx
  on public.roast_profiles(green_bean_id, is_active);

create index if not exists roast_profiles_status_idx
  on public.roast_profiles(status, updated_at desc);

create index if not exists roast_records_green_bean_id_idx
  on public.roast_records(green_bean_id, roast_date desc);

create index if not exists roast_batches_green_bean_id_idx
  on public.roast_batches(green_bean_id, roast_date desc);

create index if not exists roast_batches_roast_plan_id_idx
  on public.roast_batches(roast_plan_id);

create index if not exists cost_calculations_bean_id_idx
  on public.cost_calculations(bean_id, updated_at desc);

create index if not exists cost_calculations_updated_at_idx
  on public.cost_calculations(updated_at desc);

create index if not exists app_settings_updated_at_idx
  on public.app_settings(updated_at desc);

drop trigger if exists set_green_beans_updated_at on public.green_beans;
create trigger set_green_beans_updated_at
before update on public.green_beans
for each row
execute function public.set_updated_at();

drop trigger if exists set_green_bean_purchase_batches_updated_at on public.green_bean_purchase_batches;
create trigger set_green_bean_purchase_batches_updated_at
before update on public.green_bean_purchase_batches
for each row
execute function public.set_updated_at();

drop trigger if exists set_bean_sale_specs_updated_at on public.bean_sale_specs;
create trigger set_bean_sale_specs_updated_at
before update on public.bean_sale_specs
for each row
execute function public.set_updated_at();

drop trigger if exists set_roast_profiles_updated_at on public.roast_profiles;
create trigger set_roast_profiles_updated_at
before update on public.roast_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_roast_records_updated_at on public.roast_records;
create trigger set_roast_records_updated_at
before update on public.roast_records
for each row
execute function public.set_updated_at();

drop trigger if exists set_roast_batches_updated_at on public.roast_batches;
create trigger set_roast_batches_updated_at
before update on public.roast_batches
for each row
execute function public.set_updated_at();

drop trigger if exists set_cost_calculations_updated_at on public.cost_calculations;
create trigger set_cost_calculations_updated_at
before update on public.cost_calculations
for each row
execute function public.set_updated_at();

drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

create or replace view public.green_bean_inventory_overview as
with latest_purchase_batch as (
  select distinct on (green_bean_id)
    green_bean_id,
    purchased_weight_grams as total_purchased_weight_grams,
    remaining_weight_grams as total_remaining_weight_grams,
    purchased_total_price as total_purchased_total_price,
    supplier_name,
    updated_at as latest_purchase_updated_at
  from public.green_bean_purchase_batches
  order by green_bean_id, received_at desc, created_at desc
),
default_sale_spec as (
  select distinct on (green_bean_id)
    green_bean_id,
    unit_weight_grams as default_sale_unit_weight_grams,
    unit_price as default_sale_unit_price,
    updated_at as latest_sale_updated_at
  from public.bean_sale_specs
  where is_default = true
  order by green_bean_id, updated_at desc, created_at desc
),
roast_batch_agg as (
  select
    green_bean_id,
    count(*) as roast_record_count,
    max(updated_at) as latest_batch_updated_at
  from public.roast_batches
  group by green_bean_id
)
select
  bean.id,
  bean.code,
  bean.display_name,
  bean.origin_country,
  bean.origin_region,
  bean.origin_area,
  bean.variety,
  bean.process_method,
  bean.harvest_season,
  bean.default_roast_input_grams,
  bean.created_at,
  coalesce(latest_purchase_batch.total_purchased_weight_grams, 0) as total_purchased_weight_grams,
  coalesce(latest_purchase_batch.total_remaining_weight_grams, 0) as total_remaining_weight_grams,
  coalesce(
    round(
      (latest_purchase_batch.total_purchased_total_price / nullif(latest_purchase_batch.total_purchased_weight_grams, 0)::numeric) * 1000,
      2
    ),
    0
  ) as weighted_cost_per_kg,
  latest_purchase_batch.supplier_name as latest_supplier_name,
  default_sale_spec.default_sale_unit_weight_grams,
  default_sale_spec.default_sale_unit_price,
  coalesce(roast_batch_agg.roast_record_count, 0) as roast_record_count,
  greatest(
    bean.updated_at,
    coalesce(latest_purchase_batch.latest_purchase_updated_at, bean.updated_at),
    coalesce(default_sale_spec.latest_sale_updated_at, bean.updated_at),
    coalesce(roast_batch_agg.latest_batch_updated_at, bean.updated_at)
  ) as updated_at
from public.green_beans as bean
left join latest_purchase_batch on latest_purchase_batch.green_bean_id = bean.id
left join default_sale_spec on default_sale_spec.green_bean_id = bean.id
left join roast_batch_agg on roast_batch_agg.green_bean_id = bean.id;

create or replace view public.roast_plan_overview as
select
  profile.id,
  profile.green_bean_id,
  bean.display_name as bean_name,
  profile.name,
  profile.batch_weight_grams,
  round(profile.batch_weight_grams::numeric / 1000, 3) as planned_batch_kg,
  profile.target_roast_level,
  profile.roast_purpose,
  profile.status,
  profile.steps,
  profile.created_at,
  profile.updated_at
from public.roast_profiles as profile
left join public.green_beans as bean
  on bean.id = profile.green_bean_id
where profile.is_active = true;

create or replace view public.roast_batch_overview as
select
  batch.id,
  batch.roast_date,
  batch.green_bean_id,
  bean.display_name as green_bean_name,
  batch.roasted_bean_name,
  batch.roast_plan_id,
  plan.name as roast_plan_name,
  batch.input_weight_grams,
  batch.output_weight_grams,
  batch.roast_level,
  batch.development_ratio,
  batch.first_crack_time,
  batch.total_roast_time,
  batch.notes,
  batch.image_urls,
  batch.status,
  batch.created_at,
  batch.updated_at
from public.roast_batches as batch
left join public.green_beans as bean on bean.id = batch.green_bean_id
left join public.roast_profiles as plan on plan.id = batch.roast_plan_id;

do $$
declare
  table_name text;
  target_tables text[] := array[
    'green_beans',
    'green_bean_purchase_batches',
    'bean_sale_specs',
    'roast_profiles',
    'roast_records',
    'roast_batches',
    'cost_calculations',
    'app_settings'
  ];
begin
  foreach table_name in array target_tables
  loop
    execute format('alter table public.%I enable row level security;', table_name);
    execute format('drop policy if exists %I_anon_all on public.%I;', table_name, table_name);
    execute format('drop policy if exists %I_auth_all on public.%I;', table_name, table_name);
    execute format(
      'create policy %I_anon_all on public.%I for all to anon using (true) with check (true);',
      table_name,
      table_name
    );
    execute format(
      'create policy %I_auth_all on public.%I for all to authenticated using (true) with check (true);',
      table_name,
      table_name
    );
  end loop;
end
$$;

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table
  public.green_beans,
  public.green_bean_purchase_batches,
  public.bean_sale_specs,
  public.roast_profiles,
  public.roast_records,
  public.roast_batches,
  public.cost_calculations,
  public.app_settings
to anon, authenticated;

grant select on table
  public.green_bean_inventory_overview,
  public.roast_plan_overview,
  public.roast_batch_overview
to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare
  table_name text;
  target_tables text[] := array[
    'green_beans',
    'green_bean_purchase_batches',
    'bean_sale_specs',
    'roast_profiles',
    'roast_records',
    'roast_batches',
    'cost_calculations',
    'app_settings'
  ];
begin
  foreach table_name in array target_tables
  loop
    if not exists (
      select 1
      from pg_publication publication
      join pg_publication_rel relation on publication.oid = relation.prpubid
      join pg_class class_table on class_table.oid = relation.prrelid
      where publication.pubname = 'supabase_realtime'
        and class_table.relname = table_name
    ) then
      execute format('alter publication supabase_realtime add table %I', table_name);
    end if;
  end loop;
end $$;

alter table public.green_beans replica identity full;
alter table public.green_bean_purchase_batches replica identity full;
alter table public.bean_sale_specs replica identity full;
alter table public.roast_profiles replica identity full;
alter table public.roast_records replica identity full;
alter table public.roast_batches replica identity full;
alter table public.cost_calculations replica identity full;
alter table public.app_settings replica identity full;

commit;
