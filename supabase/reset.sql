-- ============================================================================
-- MyCoffeeRoastingBackstage
-- Supabase 重置脚本
-- 用途：彻底清空当前项目相关对象，然后重新执行 init.sql
-- ============================================================================

begin;

drop view if exists public.roast_batch_overview;
drop view if exists public.roast_plan_overview;
drop view if exists public.green_bean_inventory_overview;

drop table if exists public.cost_calculations cascade;
drop table if exists public.app_settings cascade;
drop table if exists public.roast_batches cascade;
drop table if exists public.roast_records cascade;
drop table if exists public.roast_profiles cascade;
drop table if exists public.bean_sale_specs cascade;
drop table if exists public.green_bean_purchase_batches cascade;
drop table if exists public.green_beans cascade;

drop function if exists public.set_updated_at();

commit;
