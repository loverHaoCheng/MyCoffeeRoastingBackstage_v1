alter table if exists public.green_beans
  add column if not exists grade text;

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
  bean.grade,
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
