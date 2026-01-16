/**
 * Syllabus extractor - uses AI to parse course documents and extract calendar events
 */

import { supabase } from '@/integrations/supabase/client';
import { ExtractedSyllabusItem } from './icsUtils';

export interface ParsedSyllabus {
  courseId: string;
  courseName: string;
  meetings: ClassMeeting[];
  assignments: CalendarAssignment[];
  exams: CalendarExam[];
  officeHours: OfficeHours[];
  projects: Project[];
  rawContent: string;
  // Optional suggested end date for the course/semester
  suggestedEndDate?: string | null;
  suggestedEndDateConfidence?: number | null;
}

export interface ClassMeeting {
  days: string[]; // ['Monday', 'Wednesday', 'Friday']
  startTime: string; // "9:00 AM"
  endTime: string; // "10:00 AM"
  location?: string;
  confidence: number;
}

export interface CalendarAssignment {
  title: string;
  dueDate: string; // ISO date
  description?: string;
  confidence: number;
}

export interface CalendarExam {
  title: string;
  date: string; // ISO date
  startTime?: string;
  endTime?: string;
  location?: string;
  confidence: number;
}

export interface OfficeHours {
  days: string[];
  startTime: string;
  endTime: string;
  location?: string;
  professor?: string;
  confidence: number;
}

export interface Project {
  title: string;
  startDate?: string;
  dueDate: string;
  description?: string;
  confidence: number;
}

/**
 * Extract syllabus items from uploaded files
 * Calls the parse-document edge function and then uses AI to structure the data
 */
export async function extractSyllabusItems(
  fileId: string,
  fileName: string
): Promise<ParsedSyllabus | null> {
  try {
    // First, get the file path from database
    const { data: file, error: fileError } = await supabase
      .from('uploaded_files')
      .select('file_path, parsed_content')
      .eq('id', fileId)
      .single();

    if (fileError || !file) {
      console.error('Error fetching file:', fileError);
      return null;
    }

    // If already parsed, use cached content
    let parsedContent = file.parsed_content;

    if (!parsedContent) {
      // Call parse-document edge function to extract text
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No authenticated session');
        return null;
      }

      const { data: parseData, error: parseError } = await supabase.functions.invoke(
        'parse-document',
        {
          body: { file_path: file.file_path },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (parseError) {
        console.error('Error parsing document:', parseError);
        return null;
      }

      // parse-document returns { parsedContent: string } or raw string
      if (parseData && typeof parseData === 'object' && 'parsedContent' in parseData) {
        parsedContent = parseData.parsedContent;
      } else if (typeof parseData === 'string') {
        parsedContent = parseData;
      } else {
        parsedContent = JSON.stringify(parseData);
      }
    }

    // Now structure the parsed content using AI
    const syllabus = await structureSyllabusWithAI(parsedContent, fileName);
    return syllabus;
  } catch (error) {
    console.error('Error extracting syllabus:', error);
    return null;
  }
}

/**
 * Use AI to structure extracted text into calendar events
 * This would typically be done via Claude API call to an edge function
 */
async function structureSyllabusWithAI(
  rawContent: string,
  fileName: string
): Promise<ParsedSyllabus> {
  // Fallback lightweight parser when AI doesn't run: extract obvious dates and meetings
  const courseName = extractCourseNameFromFileName(fileName);

  const lines = (rawContent || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const meetings: ClassMeeting[] = [];
  const assignments: CalendarAssignment[] = [];
  const exams: CalendarExam[] = [];
  const officeHours: OfficeHours[] = [];
  const projects: Project[] = [];

  // Helpers
  function parseDateString(s: string): string | null {
    // Try ISO first
    let d = Date.parse(s);
    if (!isNaN(d)) return new Date(d).toISOString();

    // Try common formats like "March 15" or "Mar 15" or "3/15" (assume current year)
    const monthDay = s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/i);
    if (monthDay) {
      const yr = new Date().getFullYear();
      const dateStr = `${monthDay[0]} ${yr}`;
      d = Date.parse(dateStr);
      if (!isNaN(d)) return new Date(d).toISOString();
    }

    const numeric = s.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (numeric) {
      let [_, m, day, y] = numeric;
      const year = y ? (y.length === 2 ? `20${y}` : y) : String(new Date().getFullYear());
      const dateStr = `${year}-${m.padStart(2,'0')}-${day.padStart(2,'0')}`;
      d = Date.parse(dateStr);
      if (!isNaN(d)) return new Date(d).toISOString();
    }

    return null;
  }

  function normalizeTime(raw: string, period?: string): string | null {
    // raw: "9", "9:00", "09:30"
    const m = raw.match(/(\d{1,2})(?::(\d{2}))?/);
    if (!m) return null;
    let hour = parseInt(m[1]);
    const min = m[2] ? parseInt(m[2]) : 0;

    if (period) {
      const p = period.toUpperCase();
      if (p === 'PM' && hour !== 12) hour += 12;
      if (p === 'AM' && hour === 12) hour = 0;
    } else {
      // If no period and hour between 1-7, assume AM for morning
      if (hour >= 1 && hour <= 7) {
        // default to AM
      }
      // For hours >=8, assume 24h (no change)
    }

    return `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  }

  function parseTimeToDate(timeStr: string): Date {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  function formatTimeFromDate(d: Date): string {
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function parseTimeRange(s: string): { start: string; end: string } | null {
    // Common forms: "9-10am", "9:00-10:15 AM", "9am - 10am", "09:00 - 10:15"
    const m = s.match(/(\d{1,2}(?::\d{2})?)\s*(AM|PM|am|pm)?\s*[-–to]+\s*(\d{1,2}(?::\d{2})?)\s*(AM|PM|am|pm)?/i);
    if (m) {
      const rawStart = m[1];
      const rawStartPeriod = m[2];
      const rawEnd = m[3];
      const rawEndPeriod = m[4];

      const normStart = normalizeTime(rawStart, rawStartPeriod);
      const normEnd = normalizeTime(rawEnd, rawEndPeriod);

      if (normStart && normEnd) return { start: normStart, end: normEnd };
    }

    // Try pattern like "9am" single time - treat as 1 hour default
    const single = s.match(/(\d{1,2}(?::\d{2})?)\s*(AM|PM|am|pm)/i);
    if (single) {
      const start = normalizeTime(single[1], single[2]);
      if (start) {
        // add 1 hour
        const d = parseTimeToDate(start);
        d.setHours(d.getHours() + 1);
        const end = formatTimeFromDate(d);
        return { start, end };
      }
    }

    return null;
  }

  // Patterns
  const dayPattern = /\b(Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|MWF|TR|T R|M W F)\b/gi;
  const duePattern = /\b(due|deadline|due date)[:\s]*([^\-\n,]{3,100})/i;
  const examPattern = /\b(exam|midterm|final)[:\s]*([^\-\n,]{3,100})/i;

  // Helper to detect course/semester end dates from raw content
  function detectEndDateFromContent(text: string): { date?: string; confidence?: number } | null {
    if (!text) return null;

    // Look for explicit phrases like "semester ends April 30" or "last class: May 5"
    const explicit = text.match(/(?:semester ends|last class|last day|course ends)[:\s]*([A-Za-z0-9 ,\/.-]{3,50})/i);
    if (explicit) {
      const maybe = parseDateString(explicit[1]);
      if (maybe) return { date: maybe, confidence: 90 };
    }

    // Look for date ranges like "Jan 10 - May 5" or "Jan 10 – May 5"
    const range = text.match(/([A-Za-z]+\s+\d{1,2})\s*[-–]\s*([A-Za-z]+\s+\d{1,2})(?:,?\s*(\d{4}))?/i);
    if (range) {
      const end = range[2] + (range[3] ? ` ${range[3]}` : ` ${new Date().getFullYear()}`);
      const maybe = parseDateString(end);
      if (maybe) return { date: maybe, confidence: 85 };
    }

    // Look for semester lines like "Spring 2025 (Jan 10 - May 5)"
    const semRange = text.match(/(Spring|Fall|Summer)\s+\d{4}[\s\S]{0,80}?([A-Za-z]+\s+\d{1,2})\s*[-–]\s*([A-Za-z]+\s+\d{1,2})/i);
    if (semRange) {
      const end = semRange[3] + ` ${new Date().getFullYear()}`;
      const maybe = parseDateString(end);
      if (maybe) return { date: maybe, confidence: 90 };
    }

    return null;
  }

  // Try to detect an overall course end date (semester end) from content
  const overallEnd = detectEndDateFromContent(lines.join('\n'));

  for (const line of lines) {
    // Assignments / Deadlines
    const dueMatch = line.match(duePattern);
    if (dueMatch) {
      const maybeDate = parseDateString(dueMatch[2]);
      assignments.push({ title: dueMatch[2].trim(), dueDate: maybeDate || new Date().toISOString(), confidence: maybeDate ? 80 : 45 });
      continue;
    }

    // Exams
    const examMatch = line.match(examPattern);
    if (examMatch) {
      const maybeDate = parseDateString(examMatch[2]);
      exams.push({ title: examMatch[2].trim(), date: maybeDate || new Date().toISOString(), confidence: maybeDate ? 90 : 50 });
      continue;
    }

    // Meetings (simple heuristics: look for day names + time ranges)
    if (dayPattern.test(line)) {
      const timeRange = parseTimeRange(line);
      if (timeRange) {
        const dayMatches = line.match(dayPattern) || [];
        const days = dayMatches.map(d => d.replace(/\s+/g, ''));
        meetings.push({ days, startTime: timeRange.start, endTime: timeRange.end, location: '', confidence: 70 });
        continue;
      }
    }

    // Projects
    if (/project|milestone/i.test(line)) {
      const dateMatch = line.match(/(due|deadline)[:\s]*([^\-\n,]{3,100})/i);
      const due = dateMatch ? parseDateString(dateMatch[2]) : null;
      projects.push({ title: line.slice(0, 80), startDate: null as any, dueDate: due || new Date().toISOString(), description: line, confidence: due ? 70 : 40 });
      continue;
    }
  }

  // Attach suggested end date if detected
  const suggestedEndDateISO = overallEnd?.date ? new Date(overallEnd.date).toISOString() : null;


  return {
    courseId: courseName.toLowerCase().replace(/\s+/g, '-'),
    courseName,
    meetings,
    assignments,
    exams,
    officeHours,
    projects,
    rawContent,
    // Suggested course end date (may be null)
    // @ts-ignore - allow extra property for later wiring
    suggestedEndDate: suggestedEndDateISO,
    // Also pass confidence if detected
    // @ts-ignore
    suggestedEndDateConfidence: overallEnd?.confidence || null,
  } as unknown as ParsedSyllabus;
}

/**
 * Extract course name from filename (e.g., "Bio 101 Syllabus.pdf" -> "Bio 101")
 */
function extractCourseNameFromFileName(fileName: string): string {
  // Remove common suffixes
  let name = fileName
    .replace(/\.pdf$/i, '')
    .replace(/\.docx?$/i, '')
    .replace(/\.txt$/i, '')
    .replace(/\s*syllabus\s*/i, '')
    .replace(/\s*course\s*outline\s*/i, '')
    .trim();

  return name || 'Untitled Course';
}

/**
 * Convert parsed syllabus to ExtractedSyllabusItem array
 */
export function syllabusToItems(parsed: ParsedSyllabus): ExtractedSyllabusItem[] {
  const items: ExtractedSyllabusItem[] = [];
  const baseDate = new Date();

  // Add class meetings
  for (const meeting of parsed.meetings) {
    // Combine days into one recurring event with BYDAY pattern (e.g., MO,WE,FR)
    const dayToByDay: { [key: string]: string } = {
      Mon: 'MO', Tue: 'TU', Tues: 'TU', Wed: 'WE', Thu: 'TH', Thur: 'TH', Fri: 'FR', Sat: 'SA', Sun: 'SU',
      Monday: 'MO', Tuesday: 'TU', Wednesday: 'WE', Thursday: 'TH', Friday: 'FR', Saturday: 'SA', Sunday: 'SU',
      MWF: 'MO,WE,FR', TR: 'TU,TH', 'M W F': 'MO,WE,FR'
    };

    const byDays = meeting.days.map(d => (dayToByDay[d] || d.slice(0,2).toUpperCase())).filter(Boolean);
    const recurrencePattern = Array.from(new Set(byDays)).join(',');

    // Choose the first meeting day as the first occurrence date
    const firstDay = meeting.days[0];
    const startDate = createDateForDayOfWeek(baseDate, firstDay, meeting.startTime);
    const endDate = createDateForDayOfWeek(baseDate, firstDay, meeting.endTime);

    items.push({
      id: `${parsed.courseId}-class-${meeting.days.join('-')}`,
      courseId: parsed.courseId,
      courseName: parsed.courseName,
      type: 'class',
      title: `${parsed.courseName}`,
      startDate,
      endDate,
      location: meeting.location,
      priority: 'high',
      confidenceScore: meeting.confidence,
      recurring: true,
      recurrencePattern,
      needsReview: meeting.confidence < 70,
    });
  }

  // Add assignments
  for (const assignment of parsed.assignments) {
    items.push({
      id: `${parsed.courseId}-assignment-${assignment.title.toLowerCase().replace(/\s+/g, '-')}`,
      courseId: parsed.courseId,
      courseName: parsed.courseName,
      type: 'assignment',
      title: `${assignment.title} (${parsed.courseName})`,
      description: assignment.description,
      startDate: new Date(assignment.dueDate),
      endDate: new Date(assignment.dueDate),
      priority: 'medium',
      confidenceScore: assignment.confidence,
      needsReview: assignment.confidence < 70,
    });
  }

  // Add exams
  for (const exam of parsed.exams) {
    items.push({
      id: `${parsed.courseId}-exam-${exam.title.toLowerCase().replace(/\s+/g, '-')}`,
      courseId: parsed.courseId,
      courseName: parsed.courseName,
      type: 'exam',
      title: `${exam.title} (${parsed.courseName})`,
      startDate: new Date(exam.date),
      endDate: exam.endTime ? new Date(exam.date) : new Date(exam.date),
      location: exam.location,
      priority: 'high',
      confidenceScore: exam.confidence,
      needsReview: exam.confidence < 70,
    });
  }

  // Add office hours
  for (const oh of parsed.officeHours) {
    for (const day of oh.days) {
      items.push({
        id: `${parsed.courseId}-oh-${day}`,
        courseId: parsed.courseId,
        courseName: parsed.courseName,
        type: 'office-hours',
        title: `Office Hours - ${parsed.courseName}`,
        startDate: createDateForDayOfWeek(new Date(), day, oh.startTime),
        endDate: createDateForDayOfWeek(new Date(), day, oh.endTime),
        location: oh.location,
        priority: 'low',
        confidenceScore: oh.confidence,
        needsReview: oh.confidence < 70,
      });
    }
  }

  // Add projects
  for (const project of parsed.projects) {
    items.push({
      id: `${parsed.courseId}-project-${project.title.toLowerCase().replace(/\s+/g, '-')}`,
      courseId: parsed.courseId,
      courseName: parsed.courseName,
      type: 'project',
      title: `${project.title} (${parsed.courseName})`,
      description: project.description,
      startDate: project.startDate ? new Date(project.startDate) : new Date(),
      endDate: new Date(project.dueDate),
      priority: 'high',
      confidenceScore: project.confidence,
      needsReview: project.confidence < 70,
    });
  }

  return items;
}

/**
 * Helper to create a date for a specific day of week
 */
function createDateForDayOfWeek(baseDate: Date, dayName: string, timeStr: string): Date {
  const dayMap: { [key: string]: number } = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
    Sunday: 0,
  };

  const targetDay = dayMap[dayName];
  const currentDay = baseDate.getDay();
  const diff = (targetDay - currentDay + 7) % 7;

  const date = new Date(baseDate);
  date.setDate(date.getDate() + (diff === 0 ? 7 : diff));

  // Parse time string (e.g., "9:00 AM")
  const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i;
  const match = timeStr.match(timeRegex);

  if (match) {
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3]?.toUpperCase();

    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    date.setHours(hours, minutes, 0, 0);
  }

  return date;
}
