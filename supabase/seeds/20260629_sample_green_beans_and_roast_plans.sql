begin;

insert into public.green_beans (
  id,
  code,
  display_name,
  origin_country,
  origin_region,
  origin_area,
  variety,
  harvest_season,
  process_method,
  altitude_meters_min,
  altitude_meters_max,
  moisture_percent,
  density_g_per_l,
  mill_name,
  default_roast_input_grams,
  notes
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'GB-TEST-001',
    '埃塞俄比亚 古吉 布谷阿贝 水洗 G1',
    '埃塞俄比亚',
    '古吉',
    '乌拉嘎',
    '74110',
    '2025/2026',
    '水洗',
    2050,
    2280,
    10.40,
    735.00,
    '布谷阿贝处理厂',
    200,
    '用于手冲浅烘测试与风味记录。'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'GB-TEST-002',
    '肯尼亚 祈里尼亚加 AA 水洗',
    '肯尼亚',
    '祈里尼亚加',
    '卡拉蒂娜',
    'SL28 / SL34',
    '2025/2026',
    '水洗',
    1700,
    1900,
    10.80,
    760.00,
    '卡拉蒂娜处理厂',
    200,
    '用于高明亮度手冲烘焙计划测试。'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'GB-TEST-003',
    '哥伦比亚 慧兰 粉红波旁 日晒',
    '哥伦比亚',
    '慧兰',
    '圣奥古斯丁',
    'Pink Bourbon',
    '2025/2026',
    '日晒',
    1750,
    1950,
    10.10,
    718.00,
    '拉普拉德拉处理厂',
    300,
    '用于 SOE 与甜感表现测试。'
  )
on conflict (code) do update
set
  display_name = excluded.display_name,
  origin_country = excluded.origin_country,
  origin_region = excluded.origin_region,
  origin_area = excluded.origin_area,
  variety = excluded.variety,
  harvest_season = excluded.harvest_season,
  process_method = excluded.process_method,
  altitude_meters_min = excluded.altitude_meters_min,
  altitude_meters_max = excluded.altitude_meters_max,
  moisture_percent = excluded.moisture_percent,
  density_g_per_l = excluded.density_g_per_l,
  mill_name = excluded.mill_name,
  default_roast_input_grams = excluded.default_roast_input_grams,
  notes = excluded.notes;

insert into public.green_bean_purchase_batches (
  id,
  green_bean_id,
  supplier_name,
  invoice_no,
  purchased_weight_grams,
  purchased_total_price,
  remaining_weight_grams,
  received_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '测试供应商 A',
    'TEST-PO-001',
    30000,
    1260.00,
    24700,
    '2026-06-10'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '测试供应商 B',
    'TEST-PO-002',
    25000,
    1550.00,
    18900,
    '2026-06-12'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    '测试供应商 C',
    'TEST-PO-003',
    18000,
    1380.00,
    14100,
    '2026-06-15'
  )
on conflict (id) do update
set
  green_bean_id = excluded.green_bean_id,
  supplier_name = excluded.supplier_name,
  invoice_no = excluded.invoice_no,
  purchased_weight_grams = excluded.purchased_weight_grams,
  purchased_total_price = excluded.purchased_total_price,
  remaining_weight_grams = excluded.remaining_weight_grams,
  received_at = excluded.received_at;

insert into public.bean_sale_specs (
  id,
  green_bean_id,
  channel,
  is_default,
  unit_weight_grams,
  unit_price
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'default',
    true,
    250,
    98.00
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'default',
    true,
    250,
    128.00
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    'default',
    true,
    100,
    88.00
  )
on conflict (id) do update
set
  green_bean_id = excluded.green_bean_id,
  channel = excluded.channel,
  is_default = excluded.is_default,
  unit_weight_grams = excluded.unit_weight_grams,
  unit_price = excluded.unit_price;

insert into public.roast_profiles (
  id,
  green_bean_id,
  name,
  batch_weight_grams,
  target_roast_level,
  roast_purpose,
  status,
  steps,
  is_active
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '古吉 水洗 手冲浅烘测试',
    200,
    '手冲浅烘',
    '手冲',
    'draft',
    '[
      {"time":"0:00","event":"入豆","operation":"入豆","temperature":"232°C","firePower":"88%"},
      {"time":"1:25","event":"回温点","operation":"保持","temperature":"-","firePower":"88%"},
      {"time":"4:50","event":"转黄","operation":"降火","temperature":"155°C","firePower":"72%"},
      {"time":"8:55","event":"一爆开始","operation":"保持","temperature":"203°C","firePower":"60%"}
    ]'::jsonb,
    true
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '肯尼亚 AA 高频酸甜平衡',
    220,
    '手冲浅中烘',
    '手冲',
    'draft',
    '[
      {"time":"0:00","event":"入豆","operation":"入豆","temperature":"235°C","firePower":"90%"},
      {"time":"1:20","event":"回温点","operation":"保持","temperature":"-","firePower":"90%"},
      {"time":"5:00","event":"转黄","operation":"降火","temperature":"157°C","firePower":"76%"},
      {"time":"9:10","event":"一爆开始","operation":"保持","temperature":"206°C","firePower":"63%"}
    ]'::jsonb,
    true
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    '粉红波旁 SOE 甜感强化',
    300,
    '浅中烘',
    'SOE',
    'draft',
    '[
      {"time":"0:00","event":"入豆","operation":"入豆","temperature":"225°C","firePower":"82%"},
      {"time":"1:35","event":"回温点","operation":"保持","temperature":"-","firePower":"82%"},
      {"time":"5:20","event":"转黄","operation":"降火","temperature":"158°C","firePower":"68%"},
      {"time":"9:00","event":"一爆开始","operation":"保持","temperature":"204°C","firePower":"58%"}
    ]'::jsonb,
    true
  )
on conflict (id) do update
set
  green_bean_id = excluded.green_bean_id,
  name = excluded.name,
  batch_weight_grams = excluded.batch_weight_grams,
  target_roast_level = excluded.target_roast_level,
  roast_purpose = excluded.roast_purpose,
  status = excluded.status,
  steps = excluded.steps,
  is_active = excluded.is_active;

insert into public.roast_records (
  id,
  green_bean_id,
  purchase_batch_id,
  roast_profile_id,
  roast_date,
  input_weight_grams,
  output_weight_grams,
  roaster_name,
  note
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '2026-06-20T08:30:00+08:00',
    200,
    171,
    '测试烘焙师',
    '风味偏柑橘、白花。'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    '2026-06-21T14:10:00+08:00',
    220,
    188,
    '测试烘焙师',
    '酸甜轮廓清晰，尾段略短。'
  )
on conflict (id) do update
set
  green_bean_id = excluded.green_bean_id,
  purchase_batch_id = excluded.purchase_batch_id,
  roast_profile_id = excluded.roast_profile_id,
  roast_date = excluded.roast_date,
  input_weight_grams = excluded.input_weight_grams,
  output_weight_grams = excluded.output_weight_grams,
  roaster_name = excluded.roaster_name,
  note = excluded.note;

commit;
