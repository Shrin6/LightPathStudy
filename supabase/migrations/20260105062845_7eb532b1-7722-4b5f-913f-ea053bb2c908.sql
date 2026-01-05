CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_max_requests integer,
  p_window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_window_start timestamptz;
  v_request_count integer;
BEGIN
  current_window_start := now() - (p_window_minutes || ' minutes')::interval;

  -- Clean up old entries
  DELETE FROM public.api_rate_limits arl
  WHERE arl.user_id = p_user_id
    AND arl.endpoint = p_endpoint
    AND arl.window_start < current_window_start;

  -- Get current request count
  SELECT COALESCE(SUM(arl.request_count), 0)
    INTO v_request_count
  FROM public.api_rate_limits arl
  WHERE arl.user_id = p_user_id
    AND arl.endpoint = p_endpoint
    AND arl.window_start >= current_window_start;

  IF v_request_count >= p_max_requests THEN
    RETURN false;
  END IF;

  INSERT INTO public.api_rate_limits (user_id, endpoint, request_count, window_start)
  VALUES (p_user_id, p_endpoint, 1, now())
  ON CONFLICT (user_id, endpoint, window_start) DO UPDATE
  SET request_count = public.api_rate_limits.request_count + 1,
      updated_at = now();

  RETURN true;
END;
$$;