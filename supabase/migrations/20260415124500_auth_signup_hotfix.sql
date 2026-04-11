-- Hotfix: never let signup fail due to profile/role trigger side effects

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  requested_role_text text;
BEGIN
  -- Profile write should not block auth signup
  BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(COALESCE(NEW.email, ''), '@', 1))
    )
    ON CONFLICT (user_id) DO UPDATE
      SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  EXCEPTION
    WHEN undefined_table OR undefined_column OR insufficient_privilege THEN
      NULL;
    WHEN OTHERS THEN
      NULL;
  END;

  -- Role write should not block auth signup
  BEGIN
    requested_role_text := lower(COALESCE(NEW.raw_user_meta_data ->> 'requested_role', 'user'));

    IF requested_role_text NOT IN ('super_admin', 'admin', 'master_reseller', 'reseller', 'support', 'user') THEN
      requested_role_text := 'user';
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    SELECT NEW.id, requested_role_text::public.app_role
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = NEW.id
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION
    WHEN undefined_table OR undefined_column OR undefined_object OR invalid_text_representation OR insufficient_privilege THEN
      NULL;
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
