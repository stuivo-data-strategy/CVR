-- UPDATED FINANCIAL REVIEW VIEWS
-- Includes Quantity Tracking and Previous Forecast Integration

-- 1. Financial Review COSTS View
DROP VIEW IF EXISTS view_financial_review_costs CASCADE;
create or replace view view_financial_review_costs as
with baseline as (
    select 
        cp.contract_id,
        cc.category_id,
        sum(cc.amount) as amount,
        sum(cc.quantity) as quantity
    from contract_costs cc
    join contract_periods cp on cc.contract_period_id = cp.id
    where cc.cost_type = 'baseline' and cp.is_baseline = true
    group by cp.contract_id, cc.category_id
),
agreed_vars as (
    select 
        c.contract_id,
        cci.cost_category_id as category_id,
        sum(cci.cost_delta) as amount,
        sum(cci.quantity_delta) as quantity_delta
    from contract_changes c
    join contract_change_impacts cci on c.id = cci.contract_change_id
    where c.status = 'approved'
    group by c.contract_id, cci.cost_category_id
),
unsigned_vars as (
    select 
        c.contract_id,
        cci.cost_category_id as category_id,
        sum(cci.cost_delta) as amount,
        sum(cci.quantity_delta) as quantity_delta
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
        sum(cc.quantity) as quantity
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
        sum(cc.quantity) as quantity
    from contract_costs cc
    join contract_periods cp on cc.contract_period_id = cp.id
    where cc.cost_type = 'forecast'
    group by cp.contract_id, cc.category_id
),
-- PREVIOUS FORECAST (Snapshot)
-- Fetches the snapshot from the previous month relative to CURRENT DATE (or fixed logic)
-- For this view, we'll try to join to the "Latest Snapshot prior to this month".
prev_forecast as (
    select distinct on (contract_id, category_id)
        contract_id, 
        category_id, 
        cost_eac,
        quantity_eac,
        snapshot_period
    from contract_financial_snapshots
    -- In a real app, we might pass a parameter for "Current Period", but views are static.
    -- We'll assume "Previous Forecast" means "Last Saved Snapshot".
    order by contract_id, category_id, snapshot_period desc
)
select 
    cats.id as category_id,
    cats.name as category_name,
    cats.group_name,
    cats.sort_order,
    c.id as contract_id,
    
    -- FINANCIALS ($)
    coalesce(b.amount, 0) as original_budget,
    coalesce(av.amount, 0) as agreed_variations,
    coalesce(uv.amount, 0) as unsigned_variations,
    (coalesce(b.amount, 0) + coalesce(av.amount, 0)) as estimated_final_budget,
    
    coalesce(a.amount, 0) as actual_cost,
    coalesce(f.amount, 0) as forecast_to_complete,
    (coalesce(a.amount, 0) + coalesce(f.amount, 0)) as eac_cost,
    
    -- Previous Forecast
    coalesce(pf.cost_eac, 0) as previous_forecast,
    coalesce(pf.quantity_eac, 0) as previous_forecast_qty,

    -- Variance: Estimated Budget - EAC
    ((coalesce(b.amount, 0) + coalesce(av.amount, 0)) - (coalesce(a.amount, 0) + coalesce(f.amount, 0))) as variance,

    -- QUANTITY (Units/Hours)
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
left join agreed_vars av on cats.id = av.category_id and c.id = av.contract_id
left join unsigned_vars uv on cats.id = uv.category_id and c.id = uv.contract_id
left join actuals a on cats.id = a.category_id and c.id = a.contract_id
left join forecast f on cats.id = f.category_id and c.id = f.contract_id
left join prev_forecast pf on cats.id = pf.category_id and c.id = pf.contract_id
where c.status = 'active';

-- 2. Financial Review REVENUE View
DROP VIEW IF EXISTS view_financial_review_revenue CASCADE;
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
),
prev_rev as (
    select distinct on (contract_id)
        contract_id,
        revenue_eac,
        snapshot_period
    from contract_revenue_snapshots
    order by contract_id, snapshot_period desc
)
select
    c.id as contract_id,
    coalesce(br.amount, 0) as original_revenue,
    coalesce(ar.amount, 0) as agreed_variations_revenue,
    coalesce(ur.amount, 0) as unsigned_variations_revenue,
    (coalesce(br.amount, 0) + coalesce(ar.amount, 0)) as estimated_final_revenue,
    
    coalesce(act.amount, 0) as actual_revenue,
    coalesce(fc.amount, 0) as forecast_revenue,
    (coalesce(act.amount, 0) + coalesce(fc.amount, 0)) as eac_revenue,

    -- Previous Revenue Forecast
    coalesce(pr.revenue_eac, 0) as previous_forecast_revenue

from contracts c
left join base_rev br on c.id = br.contract_id
left join agreed_vars_rev ar on c.id = ar.contract_id
left join unsigned_vars_rev ur on c.id = ur.contract_id
left join actual_rev act on c.id = act.contract_id
left join forecast_rev fc on c.id = fc.contract_id
left join prev_rev pr on c.id = pr.contract_id;

-- 3. Itemized Changes View (for Adjustments Section)
DROP VIEW IF EXISTS view_financial_review_changes CASCADE;
create or replace view view_financial_review_changes as
select
    c.id as change_id,
    c.contract_id,
    c.change_code,
    c.title,
    c.status,
    c.change_type,
    
    -- Financials
    coalesce(c.revenue_delta, 0) as revenue_delta,
    coalesce(c.cost_delta, 0) as cost_delta,
    
    -- Quantity (Aggregated from impacts)
    (select coalesce(sum(quantity_delta), 0) from contract_change_impacts where contract_change_id = c.id) as quantity_delta

from contract_changes c
where c.status in ('approved', 'proposed');
