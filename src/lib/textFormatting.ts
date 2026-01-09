/**
 * Clean up text formatting for display
 * - Removes excessive markdown formatting (**, **, _, etc.)
 * - Removes unnecessary asterisks and dashes
 * - Cleans up repeating punctuation
 * - Preserves essential text content
 */

export function cleanTextForDisplay(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Remove markdown bold (**text** -> text)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');

  // Remove markdown italic (*text* -> text)
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');

  // Remove markdown italic (__text__ -> text, _text_ -> text)
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');

  // Remove code formatting (`text` -> text)
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // Remove leading/trailing asterisks, dashes, and underscores
  cleaned = cleaned.replace(/^[\s*\-_]+/, '').replace(/[\s*\-_]+$/, '');

  // Clean up excessive bullet points and dashes at start of lines
  cleaned = cleaned.replace(/^[\s]*[*\-+]\s+/gm, '');

  // Remove multiple consecutive asterisks or dashes (** * *** -> clean)
  cleaned = cleaned.replace(/[*\-_]{2,}/g, ' ');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Format explanation text for nice display
 * Cleans markdown, removes unnecessary formatting, ensures good readability
 */
export function formatExplanation(text: string): string {
  return cleanTextForDisplay(text);
}

/**
 * Format quiz/worksheet question text
 * Ensures clean display without markdown artifacts
 */
export function formatQuestion(text: string): string {
  return cleanTextForDisplay(text);
}

/**
 * Format answer options
 * Removes markdown formatting while preserving content
 */
export function formatAnswer(text: string): string {
  return cleanTextForDisplay(text);
}

/**
 * Format notes for display in Notes panel
 * Cleans excessive markdown but preserves structure with line breaks
 */
export function formatNotes(text: string): string {
  if (!text) return '';

  let formatted = text;

  // Remove markdown bold (**text** -> text)
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '$1');

  // Remove markdown italic (*text* -> text)
  formatted = formatted.replace(/\*([^*]+)\*/g, '$1');

  // Remove code formatting (`text` -> text)
  formatted = formatted.replace(/`([^`]+)`/g, '$1');

  // Remove leading bullet points and dashes but preserve line structure
  formatted = formatted.replace(/^[\s]*[*\-+]\s+/gm, '• ');

  // Clean up excessive dashes/underlines (--- -> clear formatting)
  formatted = formatted.replace(/[-_]{3,}/g, '');

  // Preserve line breaks but clean whitespace
  formatted = formatted
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');

  return formatted;
}
