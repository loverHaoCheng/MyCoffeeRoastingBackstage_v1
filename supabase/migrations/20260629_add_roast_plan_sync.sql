alter table if exists public.roast_profiles
  add column if not exists batch_weight_grams integer;

update public.roast_profiles
set batch_weight_grams = coalesce(batch_weight_grams, 200)
where batch_weight_grams is null;

alter table if exists public.roast_profiles
  alter column batch_weight_grams set default 200;

alter table if exists public.roast_profiles
  alter column batch_weight_grams set not null;

alter table if exists public.roast_profiles
  add column if not exists status text;

update public.roast_profiles
set status = coalesce(nullif(status, ''), 'draft')
where status is null or status = '';

alter table if exists public.roast_profiles
  alter column status set default 'draft';

alter table if exists public.roast_profiles
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'roast_profiles_batch_weight_check'
  ) then
    alter table public.roast_profiles
      add constraint roast_profiles_batch_weight_check
      check (batch_weight_grams > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'roast_profiles_status_check'
  ) then
    alter table public.roast_profiles
      add constraint roast_profiles_status_check
      check (status in ('draft', 'inProgress', 'completed', 'cancelled'));
  end if;
end
$$;

create index if not exists roast_profiles_status_idx
  on public.roast_profiles(status, updated_at desc);

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
join public.green_beans as bean
  on bean.id = profile.green_bean_id
where profile.is_active = true;
