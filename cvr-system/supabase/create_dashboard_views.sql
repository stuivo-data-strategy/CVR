-- Create a high-level view for Portfolio Dashboarding
-- Aggregates total financial performance per contract

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
where ct.status != 'terminated'; -- Exclude terminated from general portfolio stats usually, or keep them? Let's keep them filterable in UI, but maybe default view is active.
-- Actually, let's keep all and let frontend filter.
