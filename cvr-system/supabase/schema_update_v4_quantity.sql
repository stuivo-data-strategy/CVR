-- Phase 10: Add Quantity/Hours Tracking

-- 1. Add quantity to contract_costs (for Baseline, Actual, Forecast Hours)
alter table public.contract_costs 
add column if not exists quantity numeric default 0;

-- 2. Add quantity_delta to contract_change_impacts (for Variations Hours)
alter table public.contract_change_impacts 
add column if not exists quantity_delta numeric default 0;

-- 3. Update Monthly Summary View to potentially include Hours? 
-- For now, the Financial Review View is separate, so we will handle aggregation there.
