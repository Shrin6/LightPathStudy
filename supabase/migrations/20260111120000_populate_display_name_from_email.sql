-- Populate display_name with email for existing profiles
-- This fills in the email as display name for profiles created before we added this feature

UPDATE public.profiles p
SET display_name = u.email
FROM auth.users u
WHERE p.user_id = u.id
AND (p.display_name IS NULL OR p.display_name = '');

