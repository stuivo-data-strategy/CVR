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
-- 4. FINANCIAL REVIEW (COSTS)
-- Aggregates financial positions by Cost Category for the detailed report.
create or replace view view_financial_review_costs as
with baseline as (
    select 
        cc.contract_period_id,
        cp.contract_id,
        cc.category_id,
        sum(cc.amount) as amount,
        sum(cc.quantity) as quantity -- NEW
    from contract_costs cc
    join contract_periods cp on cc.contract_period_id = cp.id
    where cc.cost_type = 'baseline' and cp.is_baseline = true
    group by cc.contract_period_id, cp.contract_id, cc.category_id
),
agreed_vars as (
    select 
        c.contract_id,
        cci.cost_category_id,
        sum(cci.cost_delta) as amount,
        sum(cci.quantity_delta) as quantity_delta -- NEW
    from contract_changes c
    join contract_change_impacts cci on c.id = cci.contract_change_id
    where c.status = 'approved'
    group by c.contract_id, cci.cost_category_id
),
unsigned_vars as (
    select 
        c.contract_id,
        cci.cost_category_id,
        sum(cci.cost_delta) as amount,
        sum(cci.quantity_delta) as quantity_delta -- NEW
    from contract_changes c
    join contract_change_impacts cci on c.id = cci.contract_change_id
    where c.status = 'proposed'
    group by c.contract_id, cci.cost_category_id
),
actuals as (
    select 
        cp.contract_id,
        cc.category_id,
        sum(cc.amount) as amount,
        sum(cc.quantity) as quantity -- NEW
    from contract_costs cc
    join contract_periods cp on cc.contract_period_id = cp.id
    where cc.cost_type = 'actual'
    group by cp.contract_id, cc.category_id
),
forecast as (
    select 
        cp.contract_id,
        cc.category_id,
        sum(cc.amount) as amount,
        sum(cc.quantity) as quantity -- NEW
    from contract_costs cc
    join contract_periods cp on cc.contract_period_id = cp.id
    where cc.cost_type = 'forecast'
    group by cp.contract_id, cc.category_id
),
-- PREVIOUS FORECAST LOGIC
-- Gets the forecast version immediately preceding the current one (Current Version - 1)
-- Note: This is simplified. Robust logic would check effective dates. 
prev_forecast as (
    select 
        cp.contract_id,
        cc.category_id,
        sum(cc.amount) as amount
    from contract_costs cc
    join contract_periods cp on cc.contract_period_id = cp.id
    where cc.cost_type = 'forecast' 
    -- Logic: We'd need to identify the "Previous" period or version. 
    -- For now, let's assume we want the Previous Month's forecast for the same periods?
    -- Scaling complexity: Let's placeholder this as 0 until we have version history fully active.
    and 1=0 
    group by cp.contract_id, cc.category_id
)
select 
    cats.id as category_id,
    cats.name as category_name,
    cats.group_name,
    cats.sort_order,
    c.id as contract_id,
    
    -- Financials
    coalesce(b.amount, 0) as original_budget,
    coalesce(av.amount, 0) as agreed_variations,
    coalesce(uv.amount, 0) as unsigned_variations,
    (coalesce(b.amount, 0) + coalesce(av.amount, 0)) as estimated_final_budget,
    
    coalesce(a.amount, 0) as actual_cost,
    coalesce(f.amount, 0) as forecast_to_complete,
    (coalesce(a.amount, 0) + coalesce(f.amount, 0)) as eac_cost,
    
    -- Previous Forecast (Placeholder)
    coalesce(pf.amount, 0) as previous_forecast,

    -- Variance: Estimated Budget - EAC
    ((coalesce(b.amount, 0) + coalesce(av.amount, 0)) - (coalesce(a.amount, 0) + coalesce(f.amount, 0))) as variance,

    -- QUANTITY (HOURS)
    coalesce(b.quantity, 0) as original_qty,
    coalesce(av.quantity_delta, 0) as agreed_qty,
    coalesce(uv.quantity_delta, 0) as unsigned_qty,
    (coalesce(b.quantity, 0) + coalesce(av.quantity_delta, 0)) as est_final_qty,
    coalesce(a.quantity, 0) as actual_qty,
    coalesce(f.quantity, 0) as forecast_qty,
    (coalesce(a.quantity, 0) + coalesce(f.quantity, 0)) as eac_qty

from cost_categories cats
cross join contracts c
left join baseline b on cats.id = b.category_id and c.id = b.contract_id
left join agreed_vars av on cats.id = av.cost_category_id and c.id = av.contract_id
left join unsigned_vars uv on cats.id = uv.cost_category_id and c.id = uv.contract_id
left join actuals a on cats.id = a.category_id and c.id = a.contract_id
left join forecast f on cats.id = f.category_id and c.id = f.contract_id
left join prev_forecast pf on cats.id = pf.category_id and c.id = pf.contract_id
where c.status = 'active';

-- 6. ITEMIZED CHANGES VIEW
-- Lists individual changes for the "Adjustments" section
create or replace view view_financial_review_changes as
select
    c.contract_id,
    c.change_code,
    c.title,
    c.status,
    c.change_type,
    
    -- Revenue Impact
    c.revenue_delta,
    
    -- Cost Impact
    c.cost_delta,

    -- Hours Impact (Sum of deltas in impacts)
    (select sum(quantity_delta) from contract_change_impacts where contract_change_id = c.id) as quantity_delta

from contract_changes c
where c.status in ('approved', 'proposed');

-- 5. FINANCIAL REVIEW (REVENUE)
-- Similar structure but for single-line revenue summary
create or replace view view_financial_review_revenue as
with base_rev as (
    select cp.contract_id, sum(cr.amount) as amount
    from contract_revenue cr
    join contract_periods cp on cr.contract_period_id = cp.id
    where cr.revenue_type = 'baseline' and cp.is_baseline = true
    group by cp.contract_id
),
agreed_vars_rev as (
    select contract_id, sum(revenue_delta) as amount
    from contract_changes
    where status = 'approved'
    group by contract_id
),
unsigned_vars_rev as (
    select contract_id, sum(revenue_delta) as amount
    from contract_changes
    where status = 'proposed'
    group by contract_id
),
actual_rev as (
    select cp.contract_id, sum(cr.amount) as amount
    from contract_revenue cr
    join contract_periods cp on cr.contract_period_id = cp.id
    where cr.revenue_type = 'actual'
    group by cp.contract_id
),
forecast_rev as (
    select cp.contract_id, sum(cr.amount) as amount
    from contract_revenue cr
    join contract_periods cp on cr.contract_period_id = cp.id
    where cr.revenue_type = 'forecast'
    group by cp.contract_id
)
select
    c.id as contract_id,
    coalesce(br.amount, 0) as original_revenue,
    coalesce(ar.amount, 0) as agreed_variations_revenue,
    coalesce(ur.amount, 0) as unsigned_variations_revenue,
    (coalesce(br.amount, 0) + coalesce(ar.amount, 0)) as estimated_final_revenue,
    
    coalesce(act.amount, 0) as actual_revenue,
    coalesce(fc.amount, 0) as forecast_revenue,
    (coalesce(act.amount, 0) + coalesce(fc.amount, 0)) as eac_revenue
from contracts c
left join base_rev br on c.id = br.contract_id
left join agreed_vars_rev ar on c.id = ar.contract_id
left join unsigned_vars_rev ur on c.id = ur.contract_id
left join actual_rev act on c.id = act.contract_id
left join forecast_rev fc on c.id = fc.contract_id;

