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
  origin_country text not null,
  origin_region text not null,
  origin_area text,
  variety text not null,
  harvest_season text not null,
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

create unique index if not exists bean_sale_specs_default_idx
  on public.bean_sale_specs(green_bean_id)
  where is_default;

create table if not exists public.roast_profiles (
  id uuid primary key default gen_random_uuid(),
  green_bean_id uuid not null references public.green_beans(id) on delete cascade,
  name text not null,
  target_roast_level text,
  roast_purpose text,
  steps jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint roast_profiles_steps_is_array
    check (jsonb_typeof(steps) = 'array')
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

create index if not exists green_bean_purchase_batches_green_bean_id_idx
  on public.green_bean_purchase_batches(green_bean_id, received_at desc);

create index if not exists bean_sale_specs_green_bean_id_idx
  on public.bean_sale_specs(green_bean_id);

create index if not exists roast_profiles_green_bean_id_idx
  on public.roast_profiles(green_bean_id, is_active);

create index if not exists roast_records_green_bean_id_idx
  on public.roast_records(green_bean_id, roast_date desc);

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

create or replace view public.green_bean_inventory_overview as
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
  coalesce(sum(purchase.purchased_weight_grams), 0) as total_purchased_weight_grams,
  coalesce(sum(purchase.remaining_weight_grams), 0) as total_remaining_weight_grams,
  coalesce(
    round(
      (sum(purchase.purchased_total_price) / nullif(sum(purchase.purchased_weight_grams), 0)::numeric) * 1000,
      2
    ),
    0
  ) as weighted_cost_per_kg,
  (
    select purchase_latest.supplier_name
    from public.green_bean_purchase_batches as purchase_latest
    where purchase_latest.green_bean_id = bean.id
    order by purchase_latest.received_at desc, purchase_latest.created_at desc
    limit 1
  ) as latest_supplier_name,
  max(sale.unit_weight_grams) filter (where sale.is_default) as default_sale_unit_weight_grams,
  max(sale.unit_price) filter (where sale.is_default) as default_sale_unit_price,
  count(distinct roast.id) as roast_record_count,
  greatest(
    bean.updated_at,
    coalesce(max(purchase.updated_at), bean.updated_at),
    coalesce(max(sale.updated_at), bean.updated_at),
    coalesce(max(roast.updated_at), bean.updated_at)
  ) as updated_at
from public.green_beans as bean
left join public.green_bean_purchase_batches as purchase on purchase.green_bean_id = bean.id
left join public.bean_sale_specs as sale on sale.green_bean_id = bean.id
left join public.roast_records as roast on roast.green_bean_id = bean.id
group by
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
  bean.updated_at;
