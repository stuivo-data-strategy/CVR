-- 1. Deactivate categories that are no longer needed
-- (They will be hidden from the UI but data remains preserved)
UPDATE public.cost_categories 
SET is_active = false 
WHERE name IN (
    'Subsistence', 
    'Travel', 
    'Office Costs', 
    'Internal Billings', 
    'Hardware', 
    'Internal Labour' -- Removing the "existing" one to replace with renamed "Labour"
);

-- 2. Rename 'Labour' to 'Internal Labour'
-- This preserves the relationships for the main Labour category
UPDATE public.cost_categories 
SET name = 'Internal Labour' 
WHERE name = 'Labour';

-- 3. Confirm results
SELECT name, code, is_active 
FROM public.cost_categories 
ORDER BY is_active DESC, name;
