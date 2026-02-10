
-- Insert existing reseller users into resellers table
INSERT INTO public.resellers (user_id, company_name, commission_percent, credit_limit, is_active, is_verified)
SELECT ur.user_id, p.company_name, 10, 0, true, false
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = ur.user_id
WHERE ur.role = 'reseller'
AND NOT EXISTS (SELECT 1 FROM public.resellers r WHERE r.user_id = ur.user_id);

-- Create trigger to auto-create reseller record when user_role is inserted with role='reseller'
CREATE OR REPLACE FUNCTION public.auto_create_reseller_on_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'reseller' THEN
    INSERT INTO public.resellers (user_id, commission_percent, credit_limit, is_active, is_verified)
    VALUES (NEW.user_id, 10, 0, true, false)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_auto_create_reseller
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_reseller_on_role();

-- Create avatars storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('avatars', 'avatars', true, 5242880)
ON CONFLICT DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
