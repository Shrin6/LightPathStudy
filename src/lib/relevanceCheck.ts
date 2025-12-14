/**
 * Relevance Check System for StudyBuddy AI
 * Classifies user intent and validates content for flashcard generation
 */

export type UserIntent = 
  | 'STUDY_INTENT'        // Academic content, homework, exams, notes, concepts
  | 'LEARNING_HELP'       // Confusion, asking to explain an idea, correcting spelling
  | 'NON_ACADEMIC'        // Jokes, pets, personal decisions, random talking
  | 'EMOTIONAL_SOCIAL'    // Venting, chatting, meta comments
  | 'INVALID_FOR_FLASHCARDS'; // Content that has nothing to do with studying

// Academic keywords that indicate study intent
const ACADEMIC_KEYWORDS = [
  'definition', 'concept', 'theory', 'formula', 'equation', 'process',
  'step', 'stage', 'phase', 'cycle', 'function', 'structure', 'system',
  'cell', 'molecule', 'atom', 'element', 'compound', 'reaction',
  'chapter', 'lecture', 'exam', 'test', 'quiz', 'homework', 'assignment',
  'study', 'learn', 'understand', 'explain', 'describe', 'compare',
  'biology', 'chemistry', 'physics', 'math', 'history', 'science',
  'vocabulary', 'term', 'principle', 'law', 'theorem', 'hypothesis',
  'analysis', 'synthesis', 'evaluation', 'application', 'comprehension',
  'mitosis', 'meiosis', 'photosynthesis', 'respiration', 'dna', 'rna',
  'stoichiometry', 'calculus', 'algebra', 'geometry', 'statistics'
];

// Non-academic keywords that indicate personal/social content
const NON_ACADEMIC_KEYWORDS = [
  'dog', 'cat', 'pet', 'name my', 'should i', 'what should',
  'favorite', 'like', 'hate', 'feel', 'feeling', 'bored',
  'joke', 'funny', 'lol', 'haha', 'random', 'anyway',
  'personal', 'life', 'friend', 'relationship', 'date'
];

// Emotional/social indicators
const EMOTIONAL_KEYWORDS = [
  'stressed', 'anxious', 'tired', 'frustrated', 'confused',
  'help me feel', 'im worried', 'i feel', 'sad', 'happy',
  'just chatting', 'talking', 'venting', 'rant'
];

/**
 * Classify user intent based on message content
 */
export function classifyIntent(message: string): UserIntent {
  const lowerMessage = message.toLowerCase();
  
  // Check for emotional/social content first
  if (EMOTIONAL_KEYWORDS.some(keyword => lowerMessage.includes(keyword))) {
    return 'EMOTIONAL_SOCIAL';
  }
  
  // Check for non-academic content (jokes, personal decisions)
  if (NON_ACADEMIC_KEYWORDS.some(keyword => lowerMessage.includes(keyword))) {
    // Exception: if it also has academic context, it might be learning help
    const hasAcademicContext = ACADEMIC_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
    if (!hasAcademicContext) {
      return 'NON_ACADEMIC';
    }
  }
  
  // Check for learning help (confusion, asking for explanation)
  const learningHelpPatterns = [
    /i don'?t understand/i,
    /what (is|does|are|do)/i,
    /can you explain/i,
    /how (does|do|is)/i,
    /confused about/i,
    /help me (understand|learn)/i,
    /what'?s the difference/i,
    /repeat/i,
    /say (it )?again/i,
    /simplify/i,
    /slower/i
  ];
  
  if (learningHelpPatterns.some(pattern => pattern.test(lowerMessage))) {
    return 'LEARNING_HELP';
  }
  
  // Check for study intent
  if (ACADEMIC_KEYWORDS.some(keyword => lowerMessage.includes(keyword))) {
    return 'STUDY_INTENT';
  }
  
  // Default: if the content seems structured or educational, treat as study intent
  // Otherwise, mark as invalid
  const hasStructuredContent = /\d+\.|•|-\s|\n/.test(message) && message.length > 100;
  return hasStructuredContent ? 'STUDY_INTENT' : 'INVALID_FOR_FLASHCARDS';
}

/**
 * Check if content is valid for flashcard generation
 */
export function isValidForFlashcards(intent: UserIntent): boolean {
  return intent === 'STUDY_INTENT' || intent === 'LEARNING_HELP';
}

/**
 * Validate that collection content is suitable for academic flashcards
 */
export function validateCollectionContent(content: string): {
  isValid: boolean;
  reason?: string;
  academicScore: number;
} {
  if (!content || content.length < 300) {
    return {
      isValid: false,
      reason: 'Not enough content to generate meaningful flashcards.',
      academicScore: 0
    };
  }
  
  const lowerContent = content.toLowerCase();
  
  // Count academic keywords present
  const academicMatches = ACADEMIC_KEYWORDS.filter(keyword => 
    lowerContent.includes(keyword)
  );
  
  // Calculate academic score (0-100)
  const academicScore = Math.min(100, (academicMatches.length / 10) * 100);
  
  // Content should have at least 20% academic relevance
  if (academicScore < 20) {
    return {
      isValid: false,
      reason: 'Content does not appear to be academic study material. Upload lecture notes, textbook content, or study guides.',
      academicScore
    };
  }
  
  // Check for meaningful structure (definitions, lists, concepts)
  const hasDefinitions = /:\s|–\s|—\s|is\s+(the|a|an)\s/i.test(content);
  const hasLists = /^\s*[-•*\d]\s/m.test(content);
  const hasHeadings = /^[A-Z][^.!?]*$/m.test(content);
  
  const structureScore = (hasDefinitions ? 30 : 0) + (hasLists ? 30 : 0) + (hasHeadings ? 20 : 0);
  
  if (structureScore < 30) {
    return {
      isValid: true, // Still allow, but warn
      reason: 'Content may not have enough structure for high-quality flashcards. Consider uploading more detailed notes.',
      academicScore
    };
  }
  
  return {
    isValid: true,
    academicScore
  };
}

/**
 * Filter out non-meaningful flashcard suggestions
 */
export function filterMeaningfulCards<T extends { front: string; back: string }>(
  cards: T[]
): T[] {
  return cards.filter(card => {
    const front = card.front.toLowerCase();
    const back = card.back.toLowerCase();
    
    // Filter out cards with generic/useless content
    const invalidPatterns = [
      /not enough information/i,
      /no information/i,
      /cannot find/i,
      /not found in/i,
      /not in your notes/i,
      /^n\/a$/i,
      /^none$/i,
      /^unknown$/i
    ];
    
    if (invalidPatterns.some(pattern => pattern.test(back))) {
      return false;
    }
    
    // Filter out very short or generic cards
    if (front.length < 3 || back.length < 5) {
      return false;
    }
    
    // Filter out cards that are just questions without real answers
    if (back === front || back.includes('?')) {
      return false;
    }
    
    return true;
  });
}

/**
 * Generate a gentle rejection message for non-academic content
 */
export function getRejectMessage(intent: UserIntent): string {
  switch (intent) {
    case 'NON_ACADEMIC':
      return "I can only create flashcards from your study materials. Try asking about concepts from your uploaded notes!";
    case 'EMOTIONAL_SOCIAL':
      return "I'm here to help you study! If you're feeling stressed, take a break and come back when you're ready. Need help with any topics from your notes?";
    case 'INVALID_FOR_FLASHCARDS':
      return "This content doesn't seem suitable for flashcards. Upload academic materials like lecture notes, textbook chapters, or study guides.";
    default:
      return "I couldn't generate flashcards from this content. Try uploading more detailed study materials.";
  }
}
