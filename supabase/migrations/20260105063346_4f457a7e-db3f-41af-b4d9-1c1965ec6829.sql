-- Create a trigger function that protects sensitive profile fields
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If this is being called with service role, allow the update
  -- Service role bypasses RLS, so we check if the current role is authenticated
  -- When called via service role, current_setting returns 'service_role'
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For regular authenticated users, prevent modification of sensitive fields
  IF OLD.questions_used IS DISTINCT FROM NEW.questions_used THEN
    RAISE EXCEPTION 'Cannot modify questions_used directly';
  END IF;

  IF OLD.subscribed IS DISTINCT FROM NEW.subscribed THEN
    RAISE EXCEPTION 'Cannot modify subscribed status directly';
  END IF;

  IF OLD.subscription_end IS DISTINCT FROM NEW.subscription_end THEN
    RAISE EXCEPTION 'Cannot modify subscription_end directly';
  END IF;

  IF OLD.stripe_customer_id IS DISTINCT FROM NEW.stripe_customer_id THEN
    RAISE EXCEPTION 'Cannot modify stripe_customer_id directly';
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_fields();