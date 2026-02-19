-- Alternative policy using auth.uid() -> users.empresa_id mapping
-- Use this if your JWT does NOT contain empresa_id but you have a users table

-- 1) First, drop the problematic policy if it was created
DROP POLICY IF EXISTS "Enable dashboard users to update their own empresa facturas" ON facturas;
DROP POLICY IF EXISTS "Enable dashboard users to read their own empresa facturas" ON facturas;

-- 2) Create policies using users table mapping
-- Replace 'users' with your actual table name if different (user_profiles, etc.)

CREATE POLICY "Enable dashboard users to update their own empresa facturas" ON facturas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
      AND users.empresa_id = facturas.empresa_id
  )
);

CREATE POLICY "Enable dashboard users to read their own empresa facturas" ON facturas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
      AND users.empresa_id = facturas.empresa_id
  )
);

-- 3) If you also use user_businessname instead of empresa_id, add this alternative:
-- Uncomment and use if needed

-- CREATE POLICY "Enable dashboard users to update by business name" ON facturas
-- FOR UPDATE
-- USING (
--   EXISTS (
--     SELECT 1 
--     FROM users 
--     WHERE users.id = auth.uid() 
--       AND users.business_name = facturas.user_businessname
--   )
-- );

-- 4) Verify the new policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'facturas';
