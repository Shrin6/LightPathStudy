/**
 * ICS file generator - creates .ics files from extracted syllabus items
 */

import { ExtractedSyllabusItem, formatToICSDate } from './icsUtils';

interface GenerateICSOptions {
  filename?: string;
  calendarName?: string;
  calendarDescription?: string;
}

/**
 * Generate ICS file content from extracted syllabus items
 */
export function generateICS(
  items: ExtractedSyllabusItem[],
  options: GenerateICSOptions = {}
): string {
  const {
    calendarName = 'Academic Calendar',
    calendarDescription = 'Course schedule and assignments',
  } = options;

  const now = new Date();
  const timestamp = formatToICSDate(now);

  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//absractWity//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${calendarName}
X-WR-TIMEZONE:UTC
X-WR-CALDESC:${calendarDescription}
DTSTAMP:${timestamp}Z
`;

  // Priority color mapping
  const priorityColors: { [key: string]: string } = {
    high: 'FF0000', // Red
    medium: 'FFA500', // Orange
    low: '00FF00', // Green
  };

  // Smart reminders based on priority
  const reminderMinutes: { [key: string]: number[] } = {
    high: [2880, 60], // 2 days + 1 hour
    medium: [1440], // 1 day
    low: [180], // 3 hours
  };

  for (const item of items) {
    const eventId = `${item.id}@lightpathstudy.com`;
    const color = priorityColors[item.priority] || '0000FF';

    let event = `BEGIN:VEVENT
UID:${eventId}
DTSTAMP:${timestamp}Z
DTSTART:${formatToICSDate(item.startDate)}
`;

    if (item.endDate) {
      event += `DTEND:${formatToICSDate(item.endDate || item.startDate)}
`;
    }

    event += `SUMMARY:${escapeICSString(item.title)}
DESCRIPTION:${escapeICSString(item.description || `${item.type} - Priority: ${item.priority}`)}
`;

    if (item.location) {
      event += `LOCATION:${escapeICSString(item.location)}
`;
    }

    // Recurrence rule for classes
    if (item.recurring && item.recurrencePattern) {
      let rrule = `FREQ=WEEKLY;BYDAY=${item.recurrencePattern}`;
      // Include UNTIL if user confirmed recurrence end date
      if ((item as any).recurrenceEndDate) {
        const untilStr = formatICSUntil((item as any).recurrenceEndDate as Date);
        rrule += `;UNTIL=${untilStr}`;
      }
      event += `RRULE:${rrule}
`;
    }

    // Color property (non-standard but widely supported)
    event += `COLOR:${color}
X-MICROSOFT-CDO-BUSYSTATUS:BUSY
X-MICROSOFT-CDO-INTENDEDSTATUS:BUSY
TRANSP:OPAQUE
`;

    // Add reminders
    const reminders = reminderMinutes[item.priority] || [1440];
    for (const minutes of reminders) {
      event += `BEGIN:VALARM
TRIGGER:-PT${minutes}M
ACTION:DISPLAY
DESCRIPTION:${escapeICSString(item.title)}
END:VALARM
`;
    }

    event += `END:VEVENT
`;

    ics += event;
  }

  ics += `END:VCALENDAR`;

  return ics;
}

/**
 * Escape special characters in ICS strings
 */
function escapeICSString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

/**
 * Download ICS file to user's device
 */
export function downloadICS(content: string, filename: string = 'calendar.ics'): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format a JS Date as UNTIL string for RRULE in UTC (YYYYMMDDT235959Z)
 */
export function formatICSUntil(date: Date): string {
  const d = new Date(date);
  // set to end of day UTC
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}T235959Z`;
}
/**
 * Suggest study blocks based on free time in existing calendar
 */
export function suggestStudyBlocks(
  busyTimes: Array<{ day: string; startHour: number; endHour: number }>,
  recommendedDuration: number = 2 // hours
): ExtractedSyllabusItem[] {
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const suggestions: ExtractedSyllabusItem[] = [];

  // For each day, find free slots (e.g., 6-8pm if not busy)
  for (const day of dayOrder) {
    const dayBusy = busyTimes.filter(t => t.day === day);

    // Find first free 2-hour block (simple heuristic: after 6pm if available)
    const isEvening6Free = !dayBusy.some(t => t.startHour < 20 && t.endHour > 18);

    if (isEvening6Free) {
      const startDate = getDateForDay(day);
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + recommendedDuration);

      suggestions.push({
        id: `study-block-${day.toLowerCase()}`,
        courseId: 'study-block',
        courseName: 'Study Block',
        type: 'assignment',
        title: `Suggested Study Time - ${day}`,
        description: 'AI-recommended study block based on your free time',
        startDate,
        endDate,
        priority: 'medium',
        confidenceScore: 70,
        needsReview: false,
      });
    }
  }

  return suggestions;
}

/**
 * Helper to get a date for a specific day of week
 */
function getDateForDay(dayName: string): Date {
  const dayMap: { [key: string]: number } = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const today = new Date();
  const targetDay = dayMap[dayName];
  const currentDay = today.getDay();
  const diff = (targetDay - currentDay + 7) % 7;

  const date = new Date(today);
  date.setDate(date.getDate() + (diff === 0 ? 7 : diff)); // Next occurrence
  date.setHours(18, 0, 0, 0); // 6 PM default

  return date;
}
