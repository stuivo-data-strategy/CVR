-- Enable RLS and create permissive policies for development
-- This fixes the "violates row-level security policy" error during seeding

do $$ 
begin
    -- 1. Contract Costs
    alter table public.contract_costs enable row level security;
    drop policy if exists "Enable all access for all users" on public.contract_costs;
    create policy "Enable all access for all users" on public.contract_costs for all using (true) with check (true);
    
    -- 2. Contract Revenue
    alter table public.contract_revenue enable row level security;
    drop policy if exists "Enable all access for all users" on public.contract_revenue;
    create policy "Enable all access for all users" on public.contract_revenue for all using (true) with check (true);
    
    -- 3. Cost Categories
    alter table public.cost_categories enable row level security;
    drop policy if exists "Enable all access for all users" on public.cost_categories;
    create policy "Enable all access for all users" on public.cost_categories for all using (true) with check (true);

    -- 4. Contracts
    alter table public.contracts enable row level security;
    drop policy if exists "Enable all access for all users" on public.contracts;
    create policy "Enable all access for all users" on public.contracts for all using (true) with check (true);

    -- 5. Contract Periods
    alter table public.contract_periods enable row level security;
    drop policy if exists "Enable all access for all users" on public.contract_periods;
    create policy "Enable all access for all users" on public.contract_periods for all using (true) with check (true);

    -- 6. Contract Changes
    alter table public.contract_changes enable row level security;
    drop policy if exists "Enable all access for all users" on public.contract_changes;
    create policy "Enable all access for all users" on public.contract_changes for all using (true) with check (true);
    
    -- 7. Contract Change Impacts
    alter table public.contract_change_impacts enable row level security;
    drop policy if exists "Enable all access for all users" on public.contract_change_impacts;
    create policy "Enable all access for all users" on public.contract_change_impacts for all using (true) with check (true);
end $$;
