-- Phase 9: Reporting & Analytics Layer

-- 1. CUMULATIVE TREND VIEW
-- Calculates the running total of Revenue, Cost, and Margin over time for every contract.
-- This powers the "Margin Evolution" chart.

create or replace view view_contract_cumulative_financials as
select
    contract_id,
    period_month,
    -- Monthly Values (Actual + Forecast)
    (revenue_actual + revenue_forecast) as monthly_revenue,
    (cost_actual + cost_forecast) as monthly_cost,
    
    -- Cumulative Values (Running Total)
    sum(revenue_actual + revenue_forecast) over (partition by contract_id order by period_month) as cum_revenue,
    sum(cost_actual + cost_forecast) over (partition by contract_id order by period_month) as cum_cost

from contract_monthly_summary_view;

create or replace view view_contract_cumulative_trend as
select
    contract_id,
    period_month,
    monthly_revenue,
    monthly_cost,
    cum_revenue,
    cum_cost,
    -- Calculated Cumulative Margin
    (cum_revenue - cum_cost) as cum_margin,
    case 
        when cum_revenue = 0 then 0 
        else ((cum_revenue - cum_cost) / cum_revenue) * 100 
    end as cum_margin_pct
from view_contract_cumulative_financials;


-- 2. PORTFOLIO RISK VIEW
-- Identifies "At Risk" contracts by comparing Current Forecast vs Target.
-- "Final Position" is determined by the last available period in the trend view.

create or replace view view_portfolio_risk as
with final_positions as (
    select distinct on (contract_id) 
        contract_id, 
        cum_revenue as final_revenue,
        cum_cost as final_cost,
        cum_margin as final_margin,
        cum_margin_pct as final_margin_pct
    from view_contract_cumulative_trend
    order by contract_id, period_month desc
)
select 
    c.id as contract_id,
    c.contract_code,
    c.name as contract_name,
    c.business_unit, -- or portfolio if column renamed
    c.owner_id,
    p.full_name as owner_name,
    
    -- Margins
    c.target_margin_pct,
    coalesce(fp.final_margin_pct, 0) as current_forecast_margin_pct,
    
    -- Variance (Negative means erosion)
    (coalesce(fp.final_margin_pct, 0) - coalesce(c.target_margin_pct, 0)) as margin_variance,
    
    -- Risk Flag
    case 
        when (coalesce(fp.final_margin_pct, 0) - coalesce(c.target_margin_pct, 0)) < -5 then 'high' -- >5% Erosion
        when (coalesce(fp.final_margin_pct, 0) - coalesce(c.target_margin_pct, 0)) < 0 then 'medium' -- Any Erosion
        else 'low' -- On Target
    end as risk_status,

    -- Financial Magnitude of Risk
    fp.final_revenue,
    fp.final_cost,
    fp.final_margin

from contracts c
left join final_positions fp on c.id = fp.contract_id
left join profiles p on c.owner_id = p.id
where c.status = 'active';

-- 3. NARRATIVE & EVENTS OVERLAY
-- Helper to fetch "Key Events" for the timeline chart
create or replace view view_contract_timeline_events as
select 
    contract_id,
    period_month as event_date,
    'narrative' as event_type,
    type::text as category,
    title as description,
    created_by
from contract_narratives
where type in ('risk', 'opportunity', 'change', 'forecast_update')
UNION ALL
select
    contract_id,
    effective_date as event_date,
    'change' as event_type,
    change_type::text as category,
    change_code || ': ' || coalesce(title, 'Contract Change') as description,
    created_by
from contract_changes
where status = 'approved';
