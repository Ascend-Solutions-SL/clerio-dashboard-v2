-- If policies should be for authenticated role instead of public
-- Run this only if the test above fails

-- Drop existing policies
DROP POLICY IF EXISTS "Enable dashboard users to update their own empresa facturas" ON facturas;
DROP POLICY IF EXISTS "Enable dashboard users to read their own empresa facturas" ON facturas;
DROP POLICY IF EXISTS "Enable dashboard users to insert their own empresa facturas" ON facturas;
DROP POLICY IF EXISTS "Enable dashboard users to delete their own empresa facturas" ON facturas;

-- Recreate with authenticated role
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
