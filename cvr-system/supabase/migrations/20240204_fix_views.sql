-- Re-run View definitions to ensure they are correct and robust
-- Bug Fix: 100% Margin issue implies Costs are 0.
-- This might happen if view_period_costs is empty or join fails.
-- Or if contract_costs table was cleared but not re-seeded correctly (though seeding script seemed fine).

-- 1. Ensure view_period_costs aggregates correctly
create or replace view public.view_period_costs as
select 
    contract_period_id,
    cost_type,
    sum(coalesce(amount, 0)) as total_cost
from public.contract_costs
group by contract_period_id, cost_type;

-- 2. Ensure view_period_revenue aggregates correctly
create or replace view public.view_period_revenue as
select
    contract_period_id,
    revenue_type,
    sum(coalesce(amount, 0)) as total_revenue
from public.contract_revenue
group by contract_period_id, revenue_type;

-- 3. Update Summary View to handle NULLs explicitly and ensure logic is sound
create or replace view public.contract_monthly_summary_view as
select
    cp.contract_id,
    cp.period_month,
    cp.version,
    cp.is_baseline,
    -- Join Revenue
    coalesce(r.total_revenue, 0) as revenue,
    -- Join Costs
    -- WE SUM COST TYPES HERE to get Total Cost for the period regardless of type mismatch in join
    coalesce(c.total_cost, 0) as cost,
    
    (coalesce(r.total_revenue, 0) - coalesce(c.total_cost, 0)) as margin,
    
    case 
        when coalesce(r.total_revenue, 0) = 0 then 0 
        else ((coalesce(r.total_revenue, 0) - coalesce(c.total_cost, 0)) / r.total_revenue) * 100 
    end as margin_pct

from public.contract_periods cp
left join (
    select contract_period_id, sum(amount) as total_revenue 
    from public.contract_revenue 
    group by contract_period_id
) r on cp.id = r.contract_period_id
left join (
    select contract_period_id, sum(amount) as total_cost 
    from public.contract_costs 
    group by contract_period_id
) c on cp.id = c.contract_period_id;
