/**
 * ICS File utilities for parsing and generating calendar files
 */

export interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: Date;
  dtend: Date;
  rrule?: string; // Recurrence rule (e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR)
  location?: string;
  color?: string;
}

export interface ExtractedSyllabusItem {
  id: string;
  courseId: string;
  courseName: string;
  type: 'class' | 'assignment' | 'exam' | 'office-hours' | 'project' | 'reading';
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  timeOfDay?: string; // e.g., "9:00 AM - 10:00 AM"
  location?: string;
  priority: 'high' | 'medium' | 'low';
  confidenceScore: number; // 0-100, how confident AI is about this extraction
  recurring?: boolean;
  recurrencePattern?: string; // e.g., "MWF" for Mon/Wed/Fri
  // Suggested recurrence end date detected from syllabus (AI heuristic)
  suggestedEndDate?: Date | null;
  suggestedEndDateConfidence?: number | null; // 0-100
  // User-confirmed recurrence end date to use for UNTIL in RRULE
  recurrenceEndDate?: Date | null;
  notes?: string;
  needsReview: boolean;
}

/**
 * Parse an ICS file and extract events
 */
export function parseICS(icsContent: string): ICSEvent[] {
  const events: ICSEvent[] = [];
  const lines = icsContent.split('\n');
  let currentEvent: Partial<ICSEvent> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (trimmed === 'END:VEVENT' && currentEvent) {
      if (currentEvent.uid && currentEvent.summary && currentEvent.dtstart) {
        events.push(currentEvent as ICSEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (trimmed.startsWith('UID:')) {
        currentEvent.uid = trimmed.slice(4);
      } else if (trimmed.startsWith('SUMMARY:')) {
        currentEvent.summary = trimmed.slice(8);
      } else if (trimmed.startsWith('DESCRIPTION:')) {
        currentEvent.description = trimmed.slice(12);
      } else if (trimmed.startsWith('DTSTART')) {
        currentEvent.dtstart = parseICSDate(trimmed.split(':').slice(1).join(':'));
      } else if (trimmed.startsWith('DTEND')) {
        currentEvent.dtend = parseICSDate(trimmed.split(':').slice(1).join(':'));
      } else if (trimmed.startsWith('RRULE:')) {
        currentEvent.rrule = trimmed.slice(6);
      } else if (trimmed.startsWith('LOCATION:')) {
        currentEvent.location = trimmed.slice(9);
      }
    }
  }

  return events;
}

/**
 * Parse ICS date format (YYYYMMDDTHHMMSS or YYYYMMDD)
 */
function parseICSDate(dateStr: string): Date {
  const withoutZ = dateStr.replace('Z', '');
  if (withoutZ.length === 8) {
    // Date only: YYYYMMDD
    const year = parseInt(withoutZ.slice(0, 4));
    const month = parseInt(withoutZ.slice(4, 6)) - 1;
    const day = parseInt(withoutZ.slice(6, 8));
    return new Date(year, month, day);
  } else {
    // DateTime: YYYYMMDDTHHMMSS
    const year = parseInt(withoutZ.slice(0, 4));
    const month = parseInt(withoutZ.slice(4, 6)) - 1;
    const day = parseInt(withoutZ.slice(6, 8));
    const hour = parseInt(withoutZ.slice(9, 11));
    const minute = parseInt(withoutZ.slice(11, 13));
    const second = parseInt(withoutZ.slice(13, 15));
    return new Date(year, month, day, hour, minute, second);
  }
}

/**
 * Format date to ICS format (YYYYMMDDTHHMMSS)
 */
export function formatToICSDate(date: Date, hasTime: boolean = true): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (!hasTime) {
    return `${year}${month}${day}`;
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Detect scheduling patterns from existing ICS events
 * Returns info like "typically studies 6-8pm" or "has work 9-5pm weekdays"
 */
export function detectSchedulingPatterns(events: ICSEvent[]): {
  busyTimes: Array<{ day: string; startHour: number; endHour: number }>;
  freeTimes: Array<{ day: string; startHour: number; endHour: number }>;
  preferredReminders?: string[];
} {
  const dayMap: { [key: number]: string } = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  };

  const busyTimesByDay: { [key: string]: Set<number> } = {};

  for (const event of events) {
    const day = dayMap[event.dtstart.getDay()];
    if (!busyTimesByDay[day]) {
      busyTimesByDay[day] = new Set();
    }

    const startHour = event.dtstart.getHours();
    const endHour = event.dtend?.getHours() || startHour + 1;

    for (let h = startHour; h < endHour; h++) {
      busyTimesByDay[day].add(h);
    }
  }

  const busyTimes = [];
  for (const [day, hours] of Object.entries(busyTimesByDay)) {
    const sortedHours = Array.from(hours).sort((a, b) => a - b);
    if (sortedHours.length > 0) {
      busyTimes.push({
        day,
        startHour: sortedHours[0],
        endHour: sortedHours[sortedHours.length - 1] + 1,
      });
    }
  }

  return {
    busyTimes,
    freeTimes: [], // Could calculate free times as inverse
  };
}

/**
 * Check for conflicts between two events
 */
export function detectConflict(event1: ICSEvent, event2: ICSEvent): boolean {
  // Simple overlap check
  return event1.dtstart < event2.dtend && event1.dtend > event2.dtstart;
}
