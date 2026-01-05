-- Create saved_sessions table for auto-save functionality
CREATE TABLE IF NOT EXISTS public.saved_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('quiz', 'worksheet', 'flashcards', 'notes')),
  
  -- Session content (JSONB for flexibility)
  session_data jsonb NOT NULL DEFAULT '{}',
  
  -- Progress tracking
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  current_index integer DEFAULT 0,
  total_items integer DEFAULT 0,
  
  -- Time tracking
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  duration_seconds integer,
  
  -- Completion status
  is_completed boolean DEFAULT false,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT valid_timestamps CHECK (
    ended_at IS NULL OR ended_at >= started_at
  ),
  CONSTRAINT valid_duration CHECK (
    duration_seconds IS NULL OR duration_seconds >= 0
  )
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_saved_sessions_user_id ON public.saved_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_sessions_collection_id ON public.saved_sessions(collection_id);
CREATE INDEX IF NOT EXISTS idx_saved_sessions_mode ON public.saved_sessions(mode);
CREATE INDEX IF NOT EXISTS idx_saved_sessions_user_collection ON public.saved_sessions(user_id, collection_id);
CREATE INDEX IF NOT EXISTS idx_saved_sessions_is_completed ON public.saved_sessions(is_completed);
CREATE INDEX IF NOT EXISTS idx_saved_sessions_created_at ON public.saved_sessions(created_at DESC);

-- Add time tracking columns to study_sessions
ALTER TABLE public.study_sessions 
ADD COLUMN IF NOT EXISTS started_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS ended_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS duration_seconds integer,
ADD COLUMN IF NOT EXISTS time_spent_minutes integer;

-- Create function to automatically calculate duration on update
CREATE OR REPLACE FUNCTION public.calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::integer;
    NEW.time_spent_minutes := NEW.duration_seconds / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for study_sessions
DROP TRIGGER IF EXISTS trigger_calculate_study_session_duration ON public.study_sessions;
CREATE TRIGGER trigger_calculate_study_session_duration
  BEFORE INSERT OR UPDATE ON public.study_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_session_duration();

-- Create trigger for saved_sessions
DROP TRIGGER IF EXISTS trigger_calculate_saved_session_duration ON public.saved_sessions;
CREATE TRIGGER trigger_calculate_saved_session_duration
  BEFORE INSERT OR UPDATE ON public.saved_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_session_duration();

-- Create atomic increment function to prevent race conditions
CREATE OR REPLACE FUNCTION public.increment_questions_used(
  p_user_id uuid,
  p_amount integer DEFAULT 1
)
RETURNS integer AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.profiles
  SET questions_used = questions_used + p_amount
  WHERE id = p_user_id
  RETURNING questions_used INTO new_count;
  
  RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on saved_sessions
ALTER TABLE public.saved_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for saved_sessions
DROP POLICY IF EXISTS "Users can view their own saved sessions" ON public.saved_sessions;
CREATE POLICY "Users can view their own saved sessions"
  ON public.saved_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own saved sessions" ON public.saved_sessions;
CREATE POLICY "Users can insert their own saved sessions"
  ON public.saved_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own saved sessions" ON public.saved_sessions;
CREATE POLICY "Users can update their own saved sessions"
  ON public.saved_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own saved sessions" ON public.saved_sessions;
CREATE POLICY "Users can delete their own saved sessions"
  ON public.saved_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create rate limiting table for API calls
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  request_count integer DEFAULT 0,
  window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(user_id, endpoint, window_start)
);

-- Index for rate limit lookups
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_user_endpoint ON public.api_rate_limits(user_id, endpoint, window_start);

-- Enable RLS on api_rate_limits
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for api_rate_limits
DROP POLICY IF EXISTS "Users can view their own rate limits" ON public.api_rate_limits;
CREATE POLICY "Users can view their own rate limits"
  ON public.api_rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own rate limits" ON public.api_rate_limits;
CREATE POLICY "Users can insert their own rate limits"
  ON public.api_rate_limits
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own rate limits" ON public.api_rate_limits;
CREATE POLICY "Users can update their own rate limits"
  ON public.api_rate_limits
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own rate limits" ON public.api_rate_limits;
CREATE POLICY "Users can delete their own rate limits"
  ON public.api_rate_limits
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to check and increment rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_max_requests integer,
  p_window_minutes integer DEFAULT 60
)
RETURNS boolean AS $$
DECLARE
  current_window_start timestamp with time zone;
  request_count integer;
BEGIN
  current_window_start := now() - (p_window_minutes || ' minutes')::interval;
  
  -- Clean up old entries
  DELETE FROM public.api_rate_limits
  WHERE user_id = p_user_id 
    AND endpoint = p_endpoint
    AND window_start < current_window_start;
  
  -- Get current request count
  SELECT COALESCE(SUM(request_count), 0) INTO request_count
  FROM public.api_rate_limits
  WHERE user_id = p_user_id 
    AND endpoint = p_endpoint
    AND window_start >= current_window_start;
  
  -- Check if under limit
  IF request_count >= p_max_requests THEN
    RETURN false;
  END IF;
  
  -- Increment counter
  INSERT INTO public.api_rate_limits (user_id, endpoint, request_count, window_start)
  VALUES (p_user_id, p_endpoint, 1, now())
  ON CONFLICT (user_id, endpoint, window_start) DO UPDATE
  SET request_count = request_count + 1, updated_at = now();
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.increment_questions_used TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_session_duration TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;
