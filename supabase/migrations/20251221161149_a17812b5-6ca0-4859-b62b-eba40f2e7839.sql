-- Create content_reports table for user feedback on AI-generated content
CREATE TABLE public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  collection_id uuid NULL,
  feature text NOT NULL,
  reason text NOT NULL,
  comment text NULL,
  status text NOT NULL DEFAULT 'submitted',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Enable Row Level Security
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own reports
CREATE POLICY "Users can create their own reports"
ON public.content_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to view their own reports
CREATE POLICY "Users can view their own reports"
ON public.content_reports
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow authenticated users to delete their own reports
CREATE POLICY "Users can delete their own reports"
ON public.content_reports
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create index for faster user queries
CREATE INDEX idx_content_reports_user_id ON public.content_reports(user_id);
CREATE INDEX idx_content_reports_created_at ON public.content_reports(created_at DESC);