-- 1) Check current user's JWT claims (run this as the authenticated dashboard user)
SELECT 
  auth.uid() as user_id,
  auth.role() as user_role,
  auth.jwt() ->> 'empresa_id' as jwt_empresa_id,
  auth.jwt() ->> 'app_metadata' as app_metadata,
  auth.jwt() ->> 'user_metadata' as user_metadata,
  auth.jwt() ->> 'email' as email;

-- 2) Check if there's a users/empresas table and how it relates
-- Adjust table names if they are different
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('users', 'empresas', 'user_profiles') 
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3) Check existing RLS policies on facturas (to see what's already there)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'facturas';

-- 4) Check a sample factura to see the empresa_id column type and values
SELECT id, empresa_id, user_businessname 
FROM facturas 
WHERE id = 173  -- replace with your test factura id
LIMIT 1;
