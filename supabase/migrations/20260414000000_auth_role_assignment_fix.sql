CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  requested_role text;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    assigned_role := 'super_admin'::public.app_role;
  ELSE
    requested_role := lower(COALESCE(NEW.raw_user_meta_data ->> 'requested_role', 'user'));
    assigned_role := CASE
      WHEN requested_role = 'reseller' THEN 'reseller'::public.app_role
      ELSE 'user'::public.app_role
    END;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;