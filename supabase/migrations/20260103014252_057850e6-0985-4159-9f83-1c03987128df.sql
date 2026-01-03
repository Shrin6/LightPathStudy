-- Alpha keys should only be accessed via the activate_alpha_key function (SECURITY DEFINER)
-- No direct user access is needed, but we add a deny-all policy for safety
CREATE POLICY "No direct access to alpha keys"
ON public.alpha_keys
FOR ALL
USING (false);