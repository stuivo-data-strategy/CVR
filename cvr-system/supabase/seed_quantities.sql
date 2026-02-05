-- Backfill Quantity (Hours) for Direct Labour Costs
-- Assumes 'Direct Labour' group exists in cost_categories

DO $$
DECLARE
    v_labour_category_id uuid;
BEGIN
    -- 1. Find a category that looks like Labour
    SELECT id INTO v_labour_category_id FROM cost_categories WHERE name ILIKE '%Labour%' OR group_name ILIKE '%Labour%' LIMIT 1;

    IF v_labour_category_id IS NOT NULL THEN
        
        -- 2. Update Baseline Costs (Random hours between 100-1000)
        UPDATE contract_costs
        SET quantity = floor(random() * 900 + 100)
        WHERE category_id = v_labour_category_id
          AND quantity IS NULL OR quantity = 0;

        -- 3. Update Actual Costs
        UPDATE contract_costs
        SET quantity = floor(random() * 500 + 50)
        WHERE category_id = v_labour_category_id
          AND cost_type = 'actual'
          AND (quantity IS NULL OR quantity = 0);

        -- 4. Update Forecast Costs
        UPDATE contract_costs
        SET quantity = floor(random() * 800 + 100)
        WHERE category_id = v_labour_category_id
          AND cost_type = 'forecast'
          AND (quantity IS NULL OR quantity = 0);

    END IF;

    -- 5. Update Change Impacts (Quantity Delta)
    -- Give some random hours delta to approved changes
    UPDATE contract_change_impacts
    SET quantity_delta = floor(random() * 50 + 10)
    WHERE quantity_delta IS NULL OR quantity_delta = 0;

END $$;
