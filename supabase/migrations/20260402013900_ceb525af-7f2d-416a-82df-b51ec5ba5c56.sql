
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  requested_role text;
BEGIN
  requested_role := NEW.raw_user_meta_data->>'requested_role';
  
  IF requested_role = 'reseller' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'reseller'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    INSERT INTO public.resellers (user_id, commission_percent, credit_limit, is_active, is_verified)
    VALUES (NEW.id, 10, 0, true, false)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  IF NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'reseller');
    
    INSERT INTO public.resellers (user_id, commission_percent, credit_limit, is_active, is_verified)
    VALUES (NEW.id, 10, 0, true, false)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;
