-- Phase 2 Schema Upgrade (Idempotent)

-- 1. Create Cost Categories if not exists
create table if not exists public.cost_categories (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  group_name text,
  is_active boolean default true,
  sort_order integer
);

-- Seed basic categories (on conflict do nothing)
insert into public.cost_categories (code, name, group_name, sort_order) values
('LAB', 'Labour', 'Direct Rates', 10),
('MAT', 'Materials', 'Direct Expenses', 20),
('SUB', 'Subcontractors', 'Direct Expenses', 30),
('EXP', 'Expenses', 'Overheads', 40),
('INT', 'Internal Billings', 'Companies', 50),
('ACC', 'Accruals', 'Adjustments', 60)
on conflict (code) do nothing;

-- 2. Migrate Contract Costs
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'contract_costs' and column_name = 'category_id') then
    alter table public.contract_costs add column category_id uuid references public.cost_categories(id);
  end if;
  
  if exists (select 1 from information_schema.columns where table_name = 'contract_costs' and column_name = 'category') then
     alter table public.contract_costs drop column category;
  end if;
end $$;

-- Drop type if it exists and is unused (handling dependency errors might be tricky in script, so we leave it or wrap in exception block)
do $$ begin
    drop type public.cost_category;
exception when others then
    raise notice 'Type cost_category might be in use, skipping drop.';
end $$;


-- 3. Migrate Contract Change Impacts
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'contract_change_impacts' and column_name = 'cost_category_id') then
    alter table public.contract_change_impacts add column cost_category_id uuid references public.cost_categories(id);
  end if;

  if exists (select 1 from information_schema.columns where table_name = 'contract_change_impacts' and column_name = 'cost_category') then
    alter table public.contract_change_impacts drop column cost_category;
  end if;
end $$;


-- 4. Extend Contract Changes
do $$
begin
    -- Add columns if they don't exist
    if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'title') then
        alter table public.contract_changes add column title text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'reason_for_change') then
        alter table public.contract_changes add column reason_for_change text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'customer_reference') then
        alter table public.contract_changes add column customer_reference text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'commercial_owner') then
        alter table public.contract_changes add column commercial_owner uuid references public.profiles(id);
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'technical_owner') then
        alter table public.contract_changes add column technical_owner uuid references public.profiles(id);
    end if;
     if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'customer_contact') then
        alter table public.contract_changes add column customer_contact text;
    end if;
     if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'applies_from_period') then
        alter table public.contract_changes add column applies_from_period date;
    end if;
     if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'applies_to_period') then
        alter table public.contract_changes add column applies_to_period date;
    end if;
     if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'is_retrospective') then
        alter table public.contract_changes add column is_retrospective boolean default false;
    end if;
     if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'requires_rebaseline') then
        alter table public.contract_changes add column requires_rebaseline boolean default false;
    end if;
     if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'customer_approval_received') then
        alter table public.contract_changes add column customer_approval_received boolean default false;
    end if;
     if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'approval_date') then
        alter table public.contract_changes add column approval_date date;
    end if;
     if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'commercial_approval_by') then
        alter table public.contract_changes add column commercial_approval_by uuid references public.profiles(id);
    end if;
     if not exists (select 1 from information_schema.columns where table_name = 'contract_changes' and column_name = 'technical_approval_by') then
        alter table public.contract_changes add column technical_approval_by uuid references public.profiles(id);
    end if;
end $$;


-- Update Views (Re-run safely)
create or replace view public.view_period_costs as
select 
    contract_period_id,
    cost_type,
    sum(amount) as total_cost
from public.contract_costs
group by contract_period_id, cost_type;

create or replace view public.contract_monthly_summary_view as
select
    cp.contract_id,
    cp.period_month,
    cp.version,
    cp.is_baseline,
    coalesce(r.total_revenue, 0) as revenue,
    coalesce(c.total_cost, 0) as cost,
    (coalesce(r.total_revenue, 0) - coalesce(c.total_cost, 0)) as margin,
    case when coalesce(r.total_revenue, 0) = 0 then 0 else ((coalesce(r.total_revenue, 0) - coalesce(c.total_cost, 0)) / r.total_revenue) * 100 end as margin_pct
from public.contract_periods cp
left join public.view_period_revenue r on cp.id = r.contract_period_id
left join public.view_period_costs c on cp.id = c.contract_period_id;
