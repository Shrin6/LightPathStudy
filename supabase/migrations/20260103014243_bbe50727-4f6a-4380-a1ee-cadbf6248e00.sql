-- Create alpha_keys table
CREATE TABLE public.alpha_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  used_by uuid,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.alpha_keys ENABLE ROW LEVEL SECURITY;

-- Insert the JJK-themed alpha keys
INSERT INTO public.alpha_keys (key, status) VALUES
  ('domain-expansion', 'active'),
  ('infinite-void', 'active'),
  ('malevolent-shrine', 'active'),
  ('hollow-purple', 'active'),
  ('black-flash', 'active'),
  ('six-eyes', 'active'),
  ('limitless-void', 'active'),
  ('cursed-technique', 'active'),
  ('reverse-cursed', 'active'),
  ('heavenly-restriction', 'active'),
  ('special-grade', 'active'),
  ('shibuya-incident', 'active'),
  ('culling-game', 'active');