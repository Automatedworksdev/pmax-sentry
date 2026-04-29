-- Add new categories to master_junk_list
-- First, update existing entries with new categories where appropriate

-- Update Utility Apps (flashlight, weather, calculator, etc.)
UPDATE master_junk_list 
SET category = 'Utility Apps' 
WHERE channel_name ILIKE '%flashlight%' 
   OR channel_name ILIKE '%weather%' 
   OR channel_name ILIKE '%calculator%'
   OR channel_name ILIKE '%scanner%'
   OR channel_name ILIKE '%vpn%'
   OR channel_name ILIKE '%cleaner%'
   OR channel_name ILIKE '%booster%'
   OR channel_name ILIKE '%battery%'
   OR channel_name ILIKE '%compass%'
   OR channel_name ILIKE '%level%'
   OR channel_name ILIKE '%ruler%'
   OR channel_name ILIKE '%converter%'
   OR channel_name ILIKE '%translator%'
   OR channel_name ILIKE '%keyboard%'
   OR channel_name ILIKE '%launcher%';

-- Update Foreign Language (detect non-English characters)
UPDATE master_junk_list 
SET category = 'Foreign Language' 
WHERE channel_name ~ '[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF\u0600-\u06FF\u0400-\u04FF]'
   OR channel_name ILIKE '%español%' 
   OR channel_name ILIKE '%deutsch%'
   OR channel_name ILIKE '%français%'
   OR channel_name ILIKE '%português%'
   OR channel_name ILIKE '%русский%'
   OR channel_name ILIKE '%中文%'
   OR channel_name ILIKE '%日本語%'
   OR channel_name ILIKE '%한국어%'
   OR channel_name ILIKE '%العربية%'
   OR channel_name ILIKE '%hindi%'
   OR channel_name ILIKE '%bengali%'
   OR channel_name ILIKE '%vietnamese%'
   OR channel_name ILIKE '%thai%'
   OR channel_name ILIKE '%indonesian%';

-- Verify the categories
SELECT category, COUNT(*) as count 
FROM master_junk_list 
GROUP BY category 
ORDER BY count DESC;