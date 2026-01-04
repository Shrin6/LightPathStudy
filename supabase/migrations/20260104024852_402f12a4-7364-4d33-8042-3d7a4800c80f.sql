-- Add questions_used column to profiles table to track lifetime usage
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS questions_used integer NOT NULL DEFAULT 0;

-- Add stripe_customer_id for linking to Stripe
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Add subscribed flag for quick subscription check
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscribed boolean NOT NULL DEFAULT false;

-- Add subscription_end for tracking subscription expiry
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_end timestamp with time zone;