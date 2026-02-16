
-- Create a function that auto-inserts user role after signup
-- It reads the raw_user_meta_data.requested_role from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text;
BEGIN
  -- Get the requested role from user metadata
  requested_role := NEW.raw_user_meta_data->>'requested_role';
  
  -- Only assign if it's a valid role
  IF requested_role = 'reseller' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'reseller'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Also create reseller record if resellers table exists
    INSERT INTO public.resellers (user_id, status, commission_rate)
    VALUES (NEW.id, 'pending', 10.00)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for new signups
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();
