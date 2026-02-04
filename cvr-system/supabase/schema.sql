-- CVR System Schema (No RLS) - v2

-- 1. AUTHENTICATION & PROFILES
create type public.user_role as enum ('admin', 'bu_manager', 'contract_owner', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role public.user_role default 'viewer'::public.user_role,
  business_unit text,
  sector text,
  created_at timestamptz default now()
);

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'viewer');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. CONTRACTS & NARRATIVES
create type public.contract_status as enum ('active', 'on_hold', 'terminated', 'completed');

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  contract_code text unique not null,
  name text not null,
  owner_id uuid references public.profiles(id),
  business_unit text,
  sector text,
  customer_name text,
  start_date date not null,
  end_date date,
  original_value numeric,
  target_margin_pct numeric,
  status public.contract_status default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create type public.narrative_type as enum ('baseline', 'forecast_update', 'change', 'risk', 'opportunity', 'general');

create table public.contract_narratives (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  period_month date not null,
  type public.narrative_type not null,
  title text not null,
  body text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 3. TIME-PHASED FINANCIALS
create table public.contract_periods (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  period_month date not null,
  is_baseline boolean default false,
  version integer default 1,
  created_at timestamptz default now()
);

create type public.revenue_type as enum ('baseline', 'actual', 'forecast');

create table public.contract_revenue (
  id uuid primary key default gen_random_uuid(),
  contract_period_id uuid references public.contract_periods(id) on delete cascade,
  revenue_type public.revenue_type not null,
  amount numeric default 0
);

create type public.cost_type as enum ('baseline', 'actual', 'forecast');

-- NEW: Cost Categories Table
create table public.cost_categories (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  group_name text,
  is_active boolean default true,
  sort_order integer
);

create table public.contract_costs (
  id uuid primary key default gen_random_uuid(),
  contract_period_id uuid references public.contract_periods(id) on delete cascade,
  cost_type public.cost_type not null,
  category_id uuid references public.cost_categories(id),
  amount numeric default 0
);

-- Views

-- Helper view to aggregate costs per period and type
create or replace view public.view_period_costs as
select 
    contract_period_id,
    cost_type,
    sum(amount) as total_cost
from public.contract_costs
group by contract_period_id, cost_type;

-- Helper view to aggregate revenue per period and type
create or replace view public.view_period_revenue as
select
    contract_period_id,
    revenue_type,
    sum(amount) as total_revenue
from public.contract_revenue
group by contract_period_id, revenue_type;

-- Contract Monthly Summary View
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

-- 4. CONTRACT CHANGES & IMPACT MODELLING
create type public.change_type as enum ('scope_addition', 'scope_reduction', 'rate_change', 'duration_change', 'termination', 'other');
create type public.change_status as enum ('proposed', 'approved', 'rejected', 'implemented');
create type public.risk_level as enum ('low', 'medium', 'high'); 

create table public.contract_changes (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  change_code text,
  title text, -- NEW
  description text,
  reason_for_change text, -- NEW
  customer_reference text, -- NEW
  commercial_owner uuid references public.profiles(id), -- NEW
  technical_owner uuid references public.profiles(id), -- NEW
  customer_contact text, -- NEW
  effective_date date,
  applies_from_period date, -- NEW
  applies_to_period date, -- NEW
  is_retrospective boolean default false, -- NEW
  requires_rebaseline boolean default false, -- NEW
  change_type public.change_type,
  customer_share_pct numeric default 0,
  company_share_pct numeric default 100,
  revenue_delta numeric default 0,
  cost_delta numeric default 0,
  anticipated_disallowed_cost numeric default 0,
  conversion_probability_pct numeric default 100,
  status public.change_status default 'proposed',
  customer_approval_received boolean default false, -- NEW
  approval_date date, -- NEW
  commercial_approval_by uuid references public.profiles(id), -- NEW
  technical_approval_by uuid references public.profiles(id), -- NEW
  risk_level public.risk_level default 'low',
  tags text[],
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table public.contract_change_impacts (
  id uuid primary key default gen_random_uuid(),
  contract_change_id uuid references public.contract_changes(id) on delete cascade,
  period_month date not null,
  revenue_delta numeric default 0,
  cost_delta numeric default 0,
  cost_category_id uuid references public.cost_categories(id), -- NEW FK
  is_scenario_only boolean default false
);

-- 5. SCENARIOS & WHAT-IF MODELLING
create type public.scenario_type as enum ('termination', 'change_bundle', 'risk_case', 'opportunity_case', 'custom');

create table public.contract_scenarios (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  name text not null,
  description text,
  scenario_type public.scenario_type not null,
  termination_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table public.contract_scenario_changes (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid references public.contract_scenarios(id) on delete cascade,
  contract_change_id uuid references public.contract_changes(id) on delete cascade
);

-- 6. FORECAST FACTORS
create table public.contract_forecast_factors (
  id uuid primary key default gen_random_uuid(),
  contract_period_id uuid references public.contract_periods(id) on delete cascade,
  anticipated_forecast_cost numeric default 0,
  conversion_from_changes numeric default 0,
  potential_disallowed_costs numeric default 0,
  notes text
);

-- 8. MONTHLY SUMMARY FUNCTION
create or replace function public.get_contract_monthly_summary(p_contract_id uuid, p_period_month date)
returns json as $$
declare
    v_summary json;
begin
    select json_build_object(
        'contract_id', p_contract_id,
        'period', p_period_month,
        'financials', (select row_to_json(f) from (select * from public.contract_monthly_summary_view where contract_id = p_contract_id and period_month = p_period_month limit 1) f),
        'narratives', (select json_agg(n) from public.contract_narratives n where contract_id = p_contract_id and date_trunc('month', period_month) = date_trunc('month', p_period_month)),
        'effective_changes', (select json_agg(c) from public.contract_changes c where contract_id = p_contract_id and date_trunc('month', effective_date) = date_trunc('month', p_period_month)),
        'forecast_factors', (select row_to_json(ff) from public.contract_periods cp join public.contract_forecast_factors ff on cp.id = ff.contract_period_id where cp.contract_id = p_contract_id and cp.period_month = p_period_month limit 1)
    ) into v_summary;
    
    return v_summary;
end;
$$ language plpgsql stable;
