-- Policy to allow dashboard users to UPDATE facturas of their empresa_id
-- Replace 'dashboard_users' with the actual role name of your dashboard users if different
-- Assumes the user has a JWT claim empresa_id that matches the factura's empresa_id

-- 1) First, ensure RLS is enabled on the table (run this once)
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;

-- 2) Create or replace the policy for dashboard users
-- If you already have a policy for SELECT, you can either:
--   a) Add UPDATE to the existing policy, or
--   b) Create this separate policy (multiple policies are OR'ed)

CREATE POLICY "Enable dashboard users to update their own empresa facturas" ON facturas
FOR UPDATE
USING (
  -- Adjust the role name if your dashboard users have a different role
  -- Common options: 'authenticated', 'anon', or a custom role like 'dashboard_user'
  -- If you use auth.uid() mapping to a users table, you may need to join here
  -- For now, we assume the JWT contains empresa_id claim or you use a custom role
  (auth.jwt()->>'empresa_id')::text = empresa_id::text
  -- OR if you identify users by auth.uid() -> users.empresa_id:
  -- EXISTS (
  --   SELECT 1 FROM users WHERE users.id = auth.uid() AND users.empresa_id = facturas.empresa_id
  -- )
);

-- 3) If you already have a SELECT policy for dashboard users, make sure it exists too
-- Example (adjust role name as needed):
CREATE POLICY "Enable dashboard users to read their own empresa facturas" ON facturas
FOR SELECT
USING (
  (auth.jwt()->>'empresa_id')::text = empresa_id::text
  -- OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.empresa_id = facturas.empresa_id)
);

-- 4) Optional: If you also need INSERT and DELETE policies for dashboard users
-- Uncomment and adjust as needed:

-- CREATE POLICY "Enable dashboard users to insert their own empresa facturas" ON facturas
-- FOR INSERT
-- WITH CHECK (
--   (auth.jwt()->>'empresa_id')::text = empresa_id::text
-- );

-- CREATE POLICY "Enable dashboard users to delete their own empresa facturas" ON facturas
-- FOR DELETE
-- USING (
--   (auth.jwt()->>'empresa_id')::text = empresa_id::text
-- );

-- 5) Verify policies are in place (run this to check)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'facturas';

-- 6) Test with a manual update (run this in Supabase SQL Editor as a test user)
-- UPDATE facturas SET factura_revisada = true, reviewed_at = NOW() WHERE id = <TEST_FACTURA_ID>;
-- It should affect 1 row if the policy works; 0 rows if not.
