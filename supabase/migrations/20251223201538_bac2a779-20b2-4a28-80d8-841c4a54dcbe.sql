-- Create learning_events table for adaptive learning
CREATE TABLE public.learning_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  concept TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own learning events"
ON public.learning_events
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning events"
ON public.learning_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_learning_events_user_collection ON public.learning_events(user_id, collection_id, created_at DESC);