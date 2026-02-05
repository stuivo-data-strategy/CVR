-- 1. Create Snapshots table for Historical EAC (Previous Forecast)
create table if not exists public.contract_financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  snapshot_period date not null, -- The month end date this snapshot represents
  category_id uuid references public.cost_categories(id),
  cost_eac numeric default 0,
  quantity_eac numeric default 0,
  created_at timestamptz default now(),
  unique(contract_id, snapshot_period, category_id)
);

create table if not exists public.contract_revenue_snapshots (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  snapshot_period date not null,
  revenue_eac numeric default 0,
  created_at timestamptz default now(),
  unique(contract_id, snapshot_period)
);

-- 2. Function to Capture Snapshot (Run at Month End)
-- This takes the CURRENT live EAC (Actuals + Forecast) and saves it as the snapshot for p_period.
create or replace function public.capture_monthly_snapshot(p_contract_id uuid, p_period date)
returns void as $$
begin
    -- COST SNAPSHOTS
    delete from public.contract_financial_snapshots
    where contract_id = p_contract_id and snapshot_period = p_period;

    insert into public.contract_financial_snapshots (contract_id, snapshot_period, category_id, cost_eac, quantity_eac)
    select
        cp.contract_id,
        p_period,
        cc.category_id,
        sum(cc.amount),
        sum(cc.quantity)
    from contract_costs cc
    join contract_periods cp on cc.contract_period_id = cp.id
    where cp.contract_id = p_contract_id
      and cc.cost_type in ('actual', 'forecast')
    group by cp.contract_id, cc.category_id;

    -- REVENUE SNAPSHOTS
    delete from public.contract_revenue_snapshots
    where contract_id = p_contract_id and snapshot_period = p_period;

    insert into public.contract_revenue_snapshots (contract_id, snapshot_period, revenue_eac)
    select
        cp.contract_id,
        p_period,
        sum(cr.amount)
    from contract_revenue cr
    join contract_periods cp on cr.contract_period_id = cp.id
    where cp.contract_id = p_contract_id
      and cr.revenue_type in ('actual', 'forecast')
    group by cp.contract_id;

end;
$$ language plpgsql;
