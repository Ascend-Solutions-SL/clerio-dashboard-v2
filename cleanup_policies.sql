-- Clean up RLS policies: keep only what's needed
-- Keep: SELECT for all tabs, UPDATE for revisions
-- Remove: duplicate SELECT policies, INSERT (not needed), DELETE (not needed)

-- 1) Remove duplicate/unnecessary policies
DROP POLICY IF EXISTS "Enable dashboard users to read their own empresa facturas" ON facturas;  -- duplicate SELECT
DROP POLICY IF EXISTS "Enable dashboard users to insert their own empresa facturas" ON facturas;  -- not needed
DROP POLICY IF EXISTS "Enable dashboard users to delete their own empresa facturas" ON facturas;  -- not needed

-- 2) Keep these existing policies (they cover SELECT for all tabs):
-- - facturas_select_by_empresa (for empresa_id matching)
-- - facturas_select_by_empresa_or_businessname (for businessname fallback)

-- 3) Keep only the UPDATE policy for revisions:
-- "Enable dashboard users to update their own empresa facturas" (already exists)

-- 4) Verify final policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'facturas'
ORDER BY cmd, policyname;
