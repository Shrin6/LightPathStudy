-- Create alpha_keys table
CREATE TABLE IF NOT EXISTS public.alpha_keys (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used')),
    used_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    used_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.alpha_keys ENABLE ROW LEVEL SECURITY;

-- Function to validate and mark key as used
CREATE OR REPLACE FUNCTION public.handle_new_user_alpha_key()
RETURNS TRIGGER AS $$
DECLARE
    submitted_key TEXT;
    key_record RECORD;
BEGIN
    -- Get the key from metadata
    submitted_key := new.raw_user_meta_data->>'alpha_key';

    -- If no key provided, raise error
    IF submitted_key IS NULL OR submitted_key = '' THEN
        RAISE EXCEPTION 'Alpha key is required for signup.';
    END IF;

    -- Check if key exists and is active
    SELECT * INTO key_record FROM public.alpha_keys WHERE key = submitted_key AND status = 'active' FOR UPDATE;

    IF key_record IS NULL THEN
        RAISE EXCEPTION 'Invalid or already used alpha key.';
    END IF;

    -- Update the key status
    UPDATE public.alpha_keys
    SET status = 'used', used_by = new.id, used_at = now()
    WHERE id = key_record.id;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_auth_user_created_check_key ON auth.users;
CREATE TRIGGER on_auth_user_created_check_key
    BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_alpha_key();

-- Insert the requested alpha key
INSERT INTO public.alpha_keys (key) VALUES 
('idrinksodaieatpizza')
ON CONFLICT (key) DO NOTHING;
