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
  bean.created_at,
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
  bean.created_at,
  bean.updated_at;
