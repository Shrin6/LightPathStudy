-- Calendar converter schema
-- Stores extracted syllabus items and calendar generation history

CREATE TABLE IF NOT EXISTS extracted_syllabi_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  
  -- Course info
  course_id TEXT NOT NULL,
  course_name TEXT NOT NULL,
  
  -- Event details
  type TEXT NOT NULL CHECK (type IN ('class', 'assignment', 'exam', 'office-hours', 'project', 'reading')),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Timing
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  time_of_day TEXT, -- e.g., "9:00 AM - 10:00 AM"
  location TEXT,
  
  -- Recurrence for classes
  recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT, -- e.g., "MWF" or RRULE format
  
  -- Priority and confidence
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  
  -- Review status
  needs_review BOOLEAN DEFAULT false,
  review_notes TEXT,
  
  -- Metadata
  source_file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_extracted_user ON extracted_syllabi_items(user_id);
CREATE INDEX idx_extracted_collection ON extracted_syllabi_items(collection_id);
CREATE INDEX idx_extracted_course ON extracted_syllabi_items(course_id);
CREATE INDEX idx_extracted_needs_review ON extracted_syllabi_items(needs_review);

-- Store ICS import history and preferences
CREATE TABLE IF NOT EXISTS imported_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Calendar metadata
  calendar_name TEXT,
  calendar_source TEXT, -- 'google', 'outlook', 'apple', 'custom'
  
  -- Extracted events for pattern detection
  total_events INTEGER,
  event_categories JSONB, -- {class: 5, work: 10, personal: 3}
  
  -- Scheduling patterns detected
  busy_times JSONB, -- [{day: 'Monday', startHour: 9, endHour: 17}]
  preferred_reminders TEXT[], -- ['1 day before', '1 hour before']
  
  -- Original file
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_imported_user ON imported_calendars(user_id);

-- Store generated calendar exports
CREATE TABLE IF NOT EXISTS generated_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Calendar details
  calendar_name TEXT NOT NULL,
  calendar_description TEXT,
  
  -- Items included
  item_ids UUID[] NOT NULL,
  total_events INTEGER,
  
  -- Export details
  ics_content TEXT NOT NULL,
  filename TEXT NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ -- For cleanup
);

CREATE INDEX idx_generated_user ON generated_calendars(user_id);
