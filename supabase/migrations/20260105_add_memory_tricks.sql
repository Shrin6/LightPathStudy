-- Create user_memory_tricks table to store saved memory tricks
CREATE TABLE IF NOT EXISTS public.user_memory_tricks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
  concept TEXT NOT NULL,
  question TEXT,
  answer TEXT,
  memory_trick TEXT NOT NULL,
  style_preference VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_reviewed TIMESTAMP WITH TIME ZONE,
  times_reviewed INTEGER DEFAULT 0,
  helpful_rating INTEGER CHECK (helpful_rating BETWEEN 1 AND 5)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_memory_tricks_user ON public.user_memory_tricks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memory_tricks_collection ON public.user_memory_tricks(user_id, collection_id);

-- Enable RLS
ALTER TABLE public.user_memory_tricks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own memory tricks"
  ON public.user_memory_tricks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memory tricks"
  ON public.user_memory_tricks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memory tricks"
  ON public.user_memory_tricks
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memory tricks"
  ON public.user_memory_tricks
  FOR DELETE
  USING (auth.uid() = user_id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
