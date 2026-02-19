-- Test manual update as the current user
-- This should return "UPDATE 1" if the policy works

-- First, check current user
SELECT auth.uid() as current_user_id;

-- Then test the update
UPDATE facturas 
SET factura_revisada = true, reviewed_at = NOW() 
WHERE id = 173;  -- replace with your test factura id

-- Check if it was updated
SELECT id, factura_revisada, reviewed_at 
FROM facturas 
WHERE id = 173;
