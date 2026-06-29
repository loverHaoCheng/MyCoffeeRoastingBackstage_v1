alter table if exists public.green_beans
  alter column harvest_season drop not null,
  alter column origin_country drop not null,
  alter column origin_region drop not null;

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

create index if not exists cost_calculations_bean_id_idx
  on public.cost_calculations(bean_id, updated_at desc);

create index if not exists cost_calculations_updated_at_idx
  on public.cost_calculations(updated_at desc);

drop trigger if exists set_cost_calculations_updated_at on public.cost_calculations;
create trigger set_cost_calculations_updated_at
before update on public.cost_calculations
for each row
execute function public.set_updated_at();

create or replace view public.green_bean_inventory_overview as
select
  bean.id,
  bean.code,
  bean.created_at,
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
  bean.created_at,
  bean.display_name,
  bean.origin_country,
  bean.origin_region,
  bean.origin_area,
  bean.variety,
  bean.process_method,
  bean.harvest_season,
  bean.default_roast_input_grams,
  bean.updated_at;
