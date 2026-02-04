-- FORECASTING MODULE SETUP

-- 1. Helper Function to Split Actuals/Forecast by Date
-- This allows us to "clean" imported data
create or replace function split_actuals_forecast(p_contract_id uuid, p_cutoff_date date)
returns void as $$
begin
    -- Reset everything to standard first (optional, but safer to assume we are re-classifying)
    
    -- REVENUE
    -- 1. Periods <= Cutoff -> Actual
    update contract_revenue
    set revenue_type = 'actual'
    from contract_periods cp
    where contract_revenue.contract_period_id = cp.id
      and cp.contract_id = p_contract_id
      and cp.period_month <= p_cutoff_date
      and revenue_type in ('actual', 'forecast'); -- Don't touch baseline

    -- 2. Periods > Cutoff -> Forecast
    update contract_revenue
    set revenue_type = 'forecast'
    from contract_periods cp
    where contract_revenue.contract_period_id = cp.id
      and cp.contract_id = p_contract_id
      and cp.period_month > p_cutoff_date
      and revenue_type in ('actual', 'forecast');

    -- COSTS
    -- 1. Periods <= Cutoff -> Actual
    update contract_costs
    set cost_type = 'actual'
    from contract_periods cp
    where contract_costs.contract_period_id = cp.id
      and cp.contract_id = p_contract_id
      and cp.period_month <= p_cutoff_date
      and cost_type in ('actual', 'forecast');

    -- 2. Periods > Cutoff -> Forecast
    update contract_costs
    set cost_type = 'forecast'
    from contract_periods cp
    where contract_costs.contract_period_id = cp.id
      and cp.contract_id = p_contract_id
      and cp.period_month > p_cutoff_date
      and cost_type in ('actual', 'forecast');

end;
$$ language plpgsql;


-- 2. Update Views to Pivot Data (Separate Actual vs Forecast Columns)

-- DROP VIEWS to allow schema changes
DROP VIEW IF EXISTS contract_monthly_summary_view CASCADE;
DROP VIEW IF EXISTS portfolio_summary_view CASCADE; -- Explicitly drop to be safe

-- Helper: Pivot Revenue
create or replace view view_period_revenue_pivoted as
select 
    contract_period_id,
    sum(case when revenue_type = 'baseline' then amount else 0 end) as revenue_baseline,
    sum(case when revenue_type = 'actual' then amount else 0 end) as revenue_actual,
    sum(case when revenue_type = 'forecast' then amount else 0 end) as revenue_forecast
from contract_revenue
group by contract_period_id;

-- Helper: Pivot Costs
create or replace view view_period_costs_pivoted as
select 
    contract_period_id,
    sum(case when cost_type = 'baseline' then amount else 0 end) as cost_baseline,
    sum(case when cost_type = 'actual' then amount else 0 end) as cost_actual,
    sum(case when cost_type = 'forecast' then amount else 0 end) as cost_forecast
from contract_costs
group by contract_period_id;

-- Main View: Contract Monthly Summary (Upgraded)
create or replace view contract_monthly_summary_view as
select
    cp.contract_id,
    cp.period_month,
    cp.version,
    cp.is_baseline,
    
    -- Revenue Columns
    coalesce(r.revenue_baseline, 0) as revenue_baseline,
    coalesce(r.revenue_actual, 0) as revenue_actual,
    coalesce(r.revenue_forecast, 0) as revenue_forecast,
    -- Legacy 'revenue' column for backward compatibility (Actual + Forecast)
    (coalesce(r.revenue_actual, 0) + coalesce(r.revenue_forecast, 0)) as revenue,

    -- Cost Columns
    coalesce(c.cost_baseline, 0) as cost_baseline,
    coalesce(c.cost_actual, 0) as cost_actual,
    coalesce(c.cost_forecast, 0) as cost_forecast,
    -- Legacy 'cost' column
    (coalesce(c.cost_actual, 0) + coalesce(c.cost_forecast, 0)) as cost,

    -- Margin Calculations (based on current view)
    ((coalesce(r.revenue_actual, 0) + coalesce(r.revenue_forecast, 0)) - (coalesce(c.cost_actual, 0) + coalesce(c.cost_forecast, 0))) as margin,
    
    case 
        when (coalesce(r.revenue_actual, 0) + coalesce(r.revenue_forecast, 0)) = 0 then 0 
        else (((coalesce(r.revenue_actual, 0) + coalesce(r.revenue_forecast, 0)) - (coalesce(c.cost_actual, 0) + coalesce(c.cost_forecast, 0))) / (coalesce(r.revenue_actual, 0) + coalesce(r.revenue_forecast, 0))) * 100 
    end as margin_pct

from contract_periods cp
left join view_period_revenue_pivoted r on cp.id = r.contract_period_id
left join view_period_costs_pivoted c on cp.id = c.contract_period_id;

-- Restore Portfolio View (Deleted by Cascade)
create or replace view portfolio_summary_view as
with financial_aggs as (
    select 
        cp.contract_id,
        sum(coalesce(r.amount, 0)) as total_revenue,
        sum(coalesce(c.amount, 0)) as total_cost
    from contract_periods cp
    left join contract_revenue r on cp.id = r.contract_period_id
    left join contract_costs c on cp.id = c.contract_period_id
    group by cp.contract_id
)
select 
    ct.id,
    ct.contract_code,
    ct.name,
    ct.portfolio,
    ct.sector,
    ct.status,
    ct.start_date,
    ct.end_date,
    ct.original_value,
    ct.target_margin_pct,
    -- Financials from actuals/forecasts
    coalesce(fa.total_revenue, 0) as current_forecast_revenue,
    coalesce(fa.total_cost, 0) as current_forecast_cost,
    (coalesce(fa.total_revenue, 0) - coalesce(fa.total_cost, 0)) as current_margin_amt,
    case 
        when coalesce(fa.total_revenue, 0) = 0 then 0
        else ((coalesce(fa.total_revenue, 0) - coalesce(fa.total_cost, 0)) / fa.total_revenue) * 100 
    end as current_margin_pct
from contracts ct
left join financial_aggs fa on ct.id = fa.contract_id
where ct.status != 'terminated';
