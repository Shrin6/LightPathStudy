-- Add is_custom field to track user-created flashcards
ALTER TABLE public.flashcards
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;

-- Add mastery_level to track user progress (0-100)
ALTER TABLE public.flashcards
ADD COLUMN IF NOT EXISTS mastery_level INTEGER DEFAULT 0;

-- Add last_reviewed timestamp
ALTER TABLE public.flashcards
ADD COLUMN IF NOT EXISTS last_reviewed TIMESTAMP WITH TIME ZONE;

-- Add color customization fields for memory retention
ALTER TABLE public.flashcards
ADD COLUMN IF NOT EXISTS front_color VARCHAR DEFAULT '#ffffff';

ALTER TABLE public.flashcards
ADD COLUMN IF NOT EXISTS back_color VARCHAR DEFAULT '#ffffff';

-- Create index for faster queries
CREATE INDEX idx_flashcards_user_collection ON public.flashcards(user_id, collection_id);
CREATE INDEX idx_flashcards_is_custom ON public.flashcards(user_id, is_custom);
