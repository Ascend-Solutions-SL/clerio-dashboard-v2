-- Correct RLS policies using auth_users table mapping
-- This matches your schema: auth.uid() -> auth_users.empresa_id -> facturas.empresa_id

-- 1) First, drop any existing problematic policies
DROP POLICY IF EXISTS "Enable dashboard users to update their own empresa facturas" ON facturas;
DROP POLICY IF EXISTS "Enable dashboard users to read their own empresa facturas" ON facturas;

-- 2) Create policies using auth_users table
CREATE POLICY "Enable dashboard users to update their own empresa facturas" ON facturas
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM auth_users 
    WHERE auth_users.user_uid = auth.uid() 
      AND auth_users.empresa_id = facturas.empresa_id
  )
);

-- 3) Create SELECT policy (you probably already have this, but including for completeness)
CREATE POLICY "Enable dashboard users to read their own empresa facturas" ON facturas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM auth_users 
    WHERE auth_users.user_uid = auth.uid() 
      AND auth_users.empresa_id = facturas.empresa_id
  )
);

-- 4) Optional: If you also need INSERT and DELETE policies
CREATE POLICY "Enable dashboard users to insert their own empresa facturas" ON facturas
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM auth_users 
    WHERE auth_users.user_uid = auth.uid() 
      AND auth_users.empresa_id = facturas.empresa_id
  )
);

CREATE POLICY "Enable dashboard users to delete their own empresa facturas" ON facturas
FOR DELETE
USING (
  EXISTS (
    SELECT 1 
    FROM auth_users 
    WHERE auth_users.user_uid = auth.uid() 
      AND auth_users.empresa_id = facturas.empresa_id
  )
);

-- 5) Verify all policies are in place
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'facturas'
ORDER BY policyname;

-- 6) Test the policy (run this as a dashboard user)
-- This should now return 1 row affected if the policy works
-- UPDATE facturas SET factura_revisada = true, reviewed_at = NOW() WHERE id = 173;
