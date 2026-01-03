-- Create profile for existing user
INSERT INTO public.profiles (id, user_id)
VALUES ('84117a19-0d1d-4d59-acfa-cdb8b71e2be5', '84117a19-0d1d-4d59-acfa-cdb8b71e2be5')
ON CONFLICT (id) DO NOTHING;