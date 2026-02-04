-- Migration: Rename business_unit to portfolio and clean up data hierarchy

-- 1. Rename the column
ALTER TABLE public.contracts RENAME COLUMN business_unit TO portfolio;

-- 2. Update data to ensure unique Portfolio IDs per Sector
-- We will assign codes PF00001, PF00002, etc. based on unique Sector/Old-Name pairs.

-- Infrastructure + Public -> PF00001
UPDATE public.contracts 
SET portfolio = 'PF00001' 
WHERE portfolio = 'Infrastructure' AND sector = 'Public';

-- Construction + Public -> PF00002
UPDATE public.contracts 
SET portfolio = 'PF00002' 
WHERE portfolio = 'Construction' AND sector = 'Public';

-- Services + Public -> PF00003
UPDATE public.contracts 
SET portfolio = 'PF00003' 
WHERE portfolio = 'Services' AND sector = 'Public';

-- Construction + Commercial -> PF00004
UPDATE public.contracts 
SET portfolio = 'PF00004' 
WHERE portfolio = 'Construction' AND sector = 'Commercial';

-- Services + Commercial -> PF00005
UPDATE public.contracts 
SET portfolio = 'PF00005' 
WHERE portfolio = 'Services' AND sector = 'Commercial';

-- Infrastructure + Commercial (if any) -> PF00006
UPDATE public.contracts 
SET portfolio = 'PF00006' 
WHERE portfolio = 'Infrastructure' AND sector = 'Commercial';

-- 3. Cleanup/Verification (Optional comments)
-- Now every portfolio belongs to exactly one sector.
-- PF00001 -> Public
-- PF00002 -> Public
-- PF00004 -> Commercial
-- (Construction is now split into PF00002 and PF00004)
