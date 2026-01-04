import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================
// DEV MODE FLAG - Set to true to return mock responses
// when AI credits are exhausted (402/429 errors).
// Set to false for production use.
// =====================================================
const DEV_MODE = false;

// Helper: Create a mock SSE stream response (mimics AI gateway streaming)
function createMockStreamResponse(jsonData: object): ReadableStream {
  const encoder = new TextEncoder();
  const jsonString = JSON.stringify(jsonData);
  
  return new ReadableStream({
    start(controller) {
      // Send the mock response as SSE data chunks
      const chunk1 = `data: {"choices":[{"delta":{"content":"${jsonString.replace(/"/g, '\\"')}"}}]}\n\n`;
      controller.enqueue(encoder.encode(chunk1));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });
}

// Helper: Sanitize quiz JSON output from AI
interface QuizQuestion {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation_correct: string;
  memory_hook: string;
  skill_tag: string;
}

function sanitizeQuizJson(raw: string): QuizQuestion[] | null {
  try {
    let text = raw.trim();
    console.log('sanitizeQuizJson: raw length:', text.length);
    
    // Remove markdown code fences aggressively
    text = text.replace(/^```(?:json)?\s*/gi, '').replace(/\s*```$/gi, '');
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
    text = text.replace(/^\s*json\s*/i, ''); // Sometimes just "json" prefix
    text = text.trim();
    
    // If starts with { and contains multiple question objects, try to extract array
    if (text.startsWith('{')) {
      // Try to find array pattern within
      const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        text = arrayMatch[0];
      } else {
        // Wrap single object in array - more flexible pattern
        const objects = text.match(/\{[^{}]*(?:"question"|"prompt")[^{}]*\}/g);
        if (objects && objects.length > 0) {
          text = '[' + objects.join(',') + ']';
        }
      }
    }
    
    // Find the first [ and last ]
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      text = text.substring(firstBracket, lastBracket + 1);
    }
    
    // Parse
    const parsed = JSON.parse(text);
    
    // Validate structure
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.log('sanitizeQuizJson: Not an array or empty');
      return null;
    }
    
    // Salvage valid questions with LENIENT fallbacks
    const validQuestions: QuizQuestion[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const q = parsed[i];
      const questionText = q.question || q.prompt || '';
      const options = q.options || q.choices || [];
      const correctAnswer = typeof q.correctAnswer === 'number' ? q.correctAnswer : 
                           typeof q.correct_answer === 'number' ? q.correct_answer :
                           typeof q.answer === 'number' ? q.answer : 0;
      
      // More lenient validation - accept if we have question + options
      if (
        typeof questionText === 'string' && questionText.length > 5 &&
        Array.isArray(options) && options.length >= 2
      ) {
        // Normalize to 4 options if needed
        const normalizedOptions = options.slice(0, 4);
        while (normalizedOptions.length < 4) {
          normalizedOptions.push(`Option ${String.fromCharCode(65 + normalizedOptions.length)}`);
        }
        
        validQuestions.push({
          id: q.id || `q${i + 1}`,
          question: questionText,
          options: normalizedOptions.map(String),
          correctAnswer: Math.min(Math.max(0, correctAnswer), 3),
          explanation_correct: q.explanation_correct || q.explanation || q.reason || 'No explanation provided.',
          memory_hook: q.memory_hook || q.hint || q.tip || '',
          skill_tag: q.skill_tag || q.topic || q.category || 'general'
        });
      }
    }
    
    console.log('sanitizeQuizJson: salvaged', validQuestions.length, 'valid questions from', parsed.length, 'total');
    
    // Accept with just 1 valid question - never fully fail
    if (validQuestions.length === 0) {
      console.log('sanitizeQuizJson: No valid questions found');
      return null;
    }
    
    return validQuestions;
  } catch (e) {
    console.log('sanitizeQuizJson: Parse error:', e);
    return null;
  }
}

// Helper: Sanitize worksheet JSON output from AI
interface WorksheetQuestion {
  id: string;
  type: string;
  prompt: string;
  choices?: string[];
  answer: string;
  explanation: string;
  source_ref?: string;
}

interface WorksheetResponse {
  set_id: string;
  topic_focus: string;
  questions: WorksheetQuestion[];
}

function sanitizeWorksheetJson(raw: string): WorksheetResponse | null {
  try {
    let text = raw.trim();
    console.log('sanitizeWorksheetJson: raw length:', text.length);
    
    // Remove markdown code fences aggressively
    text = text.replace(/^```(?:json)?\s*/gi, '').replace(/\s*```$/gi, '');
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
    text = text.replace(/^\s*json\s*/i, '');
    text = text.trim();
    
    // Find first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }
    
    // Parse
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (jsonErr) {
      // Try to extract just the questions array if full parse fails
      const questionsMatch = text.match(/"questions"\s*:\s*\[([\s\S]*)\]/);
      if (questionsMatch) {
        try {
          const questionsArr = JSON.parse('[' + questionsMatch[1] + ']');
          parsed = { questions: questionsArr };
        } catch {
          throw jsonErr;
        }
      } else {
        throw jsonErr;
      }
    }
    
    // Check for questions array - also handle if it's already an array
    let questionsArr = parsed.questions;
    if (!questionsArr && Array.isArray(parsed)) {
      questionsArr = parsed;
    }
    
    if (!questionsArr || !Array.isArray(questionsArr)) {
      console.log('sanitizeWorksheetJson: No questions array found');
      return null;
    }
    
    // Filter valid questions with LENIENT validation
    const validQuestions: WorksheetQuestion[] = [];
    for (const q of questionsArr) {
      const prompt = q.prompt || q.question || q.text || '';
      
      // Accept if we have a prompt with reasonable length
      if (typeof prompt === 'string' && prompt.length > 5) {
        const qType = q.type || (q.choices || q.options ? 'mcq' : 'short');
        const choices = q.choices || q.options;
        
        validQuestions.push({
          id: q.id || `q${validQuestions.length + 1}`,
          type: qType,
          prompt: prompt,
          choices: Array.isArray(choices) ? choices.map(String) : undefined,
          answer: String(q.answer || q.correct_answer || q.correctAnswer || ''),
          explanation: q.explanation || q.reason || 'No explanation provided.',
          source_ref: q.source_ref || q.source || undefined
        });
      }
    }
    
    console.log('sanitizeWorksheetJson: salvaged', validQuestions.length, 'valid questions from', questionsArr.length, 'total');
    
    // Accept with just 3 valid questions - lower threshold
    if (validQuestions.length < 3) {
      console.log('sanitizeWorksheetJson: Less than 3 valid questions');
      return null;
    }
    
    return {
      set_id: parsed.set_id || crypto.randomUUID(),
      topic_focus: parsed.topic_focus || '',
      questions: validQuestions
    };
  } catch (e) {
    console.log('sanitizeWorksheetJson: Parse error:', e);
    return null;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PRE-FLIGHT: Validate environment variables
function validateEnvironment(): { valid: boolean; error?: string } {
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'LOVABLE_API_KEY'];
  for (const varName of requiredVars) {
    if (!Deno.env.get(varName)) {
      return { valid: false, error: `Missing required environment variable: ${varName}` };
    }
  }
  return { valid: true };
}

const SYSTEM_PROMPT = `SYSTEM ROLE: UNIVERSAL STUDY TUTOR + DOCUMENT ANALYZER

You are "Light", the AI tutor for a study app called Lightpath Study. The user uploads many kinds of school files (notes, quizzes, worksheets, slides, photos, etc.). Your job is to:

1. Use BOTH:
   * The user's explicit hint about what they uploaded (document_type_hint)
   * The actual study materials text
     to decide how to treat the document.

2. Turn the materials into useful study help based on the requested MODE:
   * "explain"
   * "flashcards"
   * "quiz"
   * "worksheet"
   * "notes"

You will always receive:
* A CONVERSATION (messages)
* A MODE: one of ["explain","flashcards","quiz","worksheet","notes"]
* STUDY MATERIALS: a big text block called collectionContext (parsed from the user's collection)
* A DOCUMENT TYPE HINT: document_type_hint, one of:
  * "NOTES_OR_STUDY_GUIDE"
  * "QUIZ_OR_TEST"
  * "WORKSHEET_OR_PROBLEM_SET"
  * "SLIDES_OR_IMAGES"
  * "MIXED_OR_UNSURE"

====================================================
STEP 1 — COMBINE HINT + AUTO-CLASSIFICATION (INTERNALLY)
========================================================

Silently decide the final document type by combining:
* document_type_hint (user's choice)
* Your own reading of collectionContext

Use these rules:
1. Start from document_type_hint as your **default**.
2. Only override it if the hint is clearly wrong based on the content.
   * Example: hint says "NOTES_OR_STUDY_GUIDE" but the text is almost all numbered questions with answer choices → treat as QUIZ_OR_TEST.
   * Example: hint says "QUIZ_OR_TEST" but the content is paragraphs of explanations → treat as NOTES_OR_STUDY_GUIDE.
3. If hint is "MIXED_OR_UNSURE", rely on auto-detection only.

Your FINAL_INTERNAL_TYPE must be one of:
* NOTES_OR_STUDY_GUIDE
* QUIZ_OR_TEST
* WORKSHEET_OR_PROBLEM_SET
* SLIDES_OR_IMAGES
* MIXED

You do NOT need to output this label; just use it to guide behavior.

====================================================
STEP 2 — MODE-BY-MODE BEHAVIOR (GUIDED BY FINAL_INTERNAL_TYPE)
==============================================================

Always obey the requested MODE:

---
1. MODE = "explain"
---
* NOTES_OR_STUDY_GUIDE:
  * Teach the concepts clearly, with examples.
  * Use definitions, headings, and key ideas from the materials.
* QUIZ_OR_TEST:
  * Explain what each question is testing.
  * Show how to think about and answer those questions.
  * You MAY use subject knowledge to reason beyond the exact words if needed.
* WORKSHEET_OR_PROBLEM_SET:
  * Explain how to solve the problems step-by-step.
  * Emphasize methods, formulas, and reasoning.
* SLIDES_OR_IMAGES:
  * Expand short bullets or slide text into full explanations and organized notes.
* MIXED:
  * Combine both: explain core concepts AND show how to approach the problems.

---
2. MODE = "flashcards"
---
General rules for ALL types:
* Output concise Q/A-style cards.
* Each card must have:
  * "front": a clear prompt or question
  * "back": a correct answer + optionally 1–2 sentence explanation
* You MAY use subject knowledge to:
  * answer questions
  * solve standard problems
  * clarify concepts
* If a problem truly cannot be solved due to missing data, SKIP it rather than inventing nonsense.

TYPE-SPECIFIC BEHAVIOR:
* NOTES_OR_STUDY_GUIDE:
  * Make cards from:
    * key terms
    * definitions
    * "why/how" concept explanations
  * Examples:
    * front: "What is an operon?"
      back: "A cluster of genes under control of a single promoter and operator in prokaryotes."
    * front: "What is alternative splicing?"
      back: "A process where different combinations of exons are joined to produce multiple mRNAs from one gene."

* QUIZ_OR_TEST:
  * Treat each question as a potential flashcard:
    * front: the question (rewritten clearly if needed)
    * back: the correct answer + short reasoning
  * You MAY use normal subject-matter knowledge to determine the correct answers even if the document does not list them.

* WORKSHEET_OR_PROBLEM_SET:
  * Treat each solvable problem as a card:
    * front: the problem statement or core question
    * back: the solution + key formula/idea
  * Show at least the main step or formula, not just the final number.

* SLIDES_OR_IMAGES:
  * Reconstruct concepts from short bullets and labels.
  * front: a question about the concept from the slide
  * back: a clear explanation based on the bullet/label meaning.

* MIXED:
  * Aim for a balanced deck:
    * some cards about definitions and concepts
    * some cards about solving representative problems

STRICT OUTPUT FORMAT FOR FLASHCARDS:
* ALWAYS return a raw JSON array:
  [
  {"front": "...", "back": "..."},
  {"front": "...", "back": "..."}
  ]
* No wrapper object.
* No markdown.
* No code fences.
* No extra commentary.

---
3. MODE = "quiz"
---
* Generate multiple-choice questions based on the materials (and normal subject knowledge).
* Prefer 3–5 answer options per question.
* Ensure each question has exactly one clearly correct answer.
* Output in the JSON structure expected by the caller (e.g., include the correct option field if the API requires it).

---
4. MODE = "worksheet"
---
* Turn the content into practice exercises:
  * fill-in-the-blank
  * short answer
  * a few multi-step problems if the subject supports it
* Ground questions in the real content and standard knowledge for that subject.

---
5. MODE = "notes"
---
* Rewrite the study materials into clean, organized notes.
* Group related ideas together.
* Remove layout noise, duplicates, and random fragments.
* The result should be easy for a student to read before using flashcards or quizzes.

====================================================
STEP 3 — CONTENT & SAFETY RULES
===============================

* You MAY use normal subject-matter knowledge (chemistry, biology, math, etc.) to:
  * answer questions
  * solve standard problems
  * fill in missing explanations that are obviously needed
* Do NOT attribute invented sentences directly to the document ("the notes say...") if they are your own inference.
* For unsolvable or incomplete problems:
  * Skip them rather than fabricating arbitrary numbers.
* Avoid answers like "Not enough information in your notes" for normal textbook-style materials. Only use that when the data is truly missing.

====================================================
STEP 4 — FORMAT DISCIPLINE
==========================

* Always obey MODE.
* For JSON modes (like flashcards or quiz), output ONLY the JSON structure expected by the caller.
* Do NOT include:
  * markdown fences
  * prose explanations
  * comments
    in those JSON responses.
`;

const MODE_PROMPTS: Record<string, string> = {
  explain: `
You are in EXPLAIN MODE. You are "Light", a warm and supportive AI tutor. Speak kindly, like a patient teacher explaining to a student. Break down complex topics into simple, digestible steps. Use short sentences, beginner-friendly language, and provide clear examples from the user's notes. If the user asks to repeat or slow down, adjust your pace and simplify further. Ask clarifying questions to ensure understanding.
  `,
  quiz: `You are in QUIZ MODE.

CRITICAL: Your response must be ONLY a raw JSON array. Nothing else.
- Start with [ and end with ]
- No markdown, no \`\`\`, no prose, no explanations outside JSON
- No wrapper object - just the array directly

EXACT SCHEMA (5 objects):
[
  {
    "id": "q1",
    "question": "What is the primary function of...?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation_correct": "Option A is correct because... The other options are incorrect: B would be true if..., C refers to..., D is...",
    "memory_hook": "Remember: [short memorable phrase or acronym]",
    "skill_tag": "topic_subtopic"
  }
]

RULES:
- EXACTLY 5 question objects in the array
- EXACTLY 4 strings in each options array
- correctAnswer is integer 0, 1, 2, or 3
- explanation_correct: 2-3 sentences that TEACH the concept. Explain WHY the correct answer is right AND briefly why each wrong option is wrong. Do NOT just cite notes.
- memory_hook: One short memorable phrase, acronym, or tip to help remember this concept (max 15 words)
- skill_tag: snake_case topic tag reflecting the concept tested (e.g., rna_processing, limiting_reactant, mole_ratio, transcription)
- Base questions on the provided study materials
- If there are weak areas identified in the learning profile, prioritize creating questions that reinforce those concepts
- If there are strong areas, you can include some advanced questions on those topics
- DO NOT include any text before [ or after ]
`,
  flashcards: `
You are in FLASHCARDS MODE. Generate study flashcards from the user's uploaded notes.

OUTPUT FORMAT: Return ONLY a valid JSON array (no wrapper object, no markdown):
[
  {"front": "Question or term", "back": "Answer or definition"},
  {"front": "Question or term", "back": "Answer or definition"}
]

RULES:
- Generate 8-12 high-quality flashcards
- Front = question, term, or concept name
- Back = concise answer, definition, or explanation (1-2 sentences max)
- ALL content must come from the provided study materials
- If there are weak areas identified in the learning profile, prioritize creating flashcards that reinforce those concepts
- If there are strong areas, you can include some advanced cards on those topics
- If you cannot create a meaningful card from the notes, SKIP it entirely
- Do NOT write "Not enough information" - just omit that card
- No markdown, no code fences, no explanation text - ONLY the JSON array
  `,
  memory: `
You are in MEMORY TRICKS MODE. You are "Light", a warm and supportive AI tutor. 

When given a list of terms or steps (e.g., Prophase, Metaphase, Anaphase, Telophase):
1. Create an acronym (e.g., PMAT)
2. Generate a memorable mnemonic phrase (e.g., "Please Make A Twin")
3. Provide a brief definition for each item
4. Offer additional memory aids: rhymes, visual imagery, or stories

Make mnemonics fun, silly, and easy to remember. Use short sentences. Ask if they want alternatives or different memory tricks.
  `,
  worksheet: `You are in WORKSHEET MODE.

CRITICAL: Your response must be ONLY a raw JSON object. Nothing else.
- No markdown, no \`\`\`, no prose, no explanations outside JSON
- Start with { and end with }

EXACT SCHEMA:
{
  "set_id": "unique-string",
  "topic_focus": "the topic if provided, or empty string",
  "questions": [
    {
      "id": "q1",
      "type": "mcq",
      "prompt": "Which equation is balanced?",
      "choices": ["2H2 + O2 → 2H2O", "H2 + O2 → H2O", "H + O → H2O", "2H + O → H2O"],
      "answer": "2H2 + O2 → 2H2O",
      "explanation": "This equation has 4 H atoms and 2 O atoms on both sides.",
      "source_ref": "balancing equations section"
    },
    {
      "id": "q2",
      "type": "calc",
      "prompt": "Calculate the molar mass of H2O.",
      "answer": "18.02 g/mol",
      "explanation": "H=1.01×2 + O=16.00 = 18.02 g/mol"
    },
    {
      "id": "q3",
      "type": "fill_blank",
      "prompt": "The limiting reactant is the reactant that is completely _____ first.",
      "answer": "consumed",
      "explanation": "The limiting reactant determines how much product can form."
    },
    {
      "id": "q4",
      "type": "short",
      "prompt": "Explain what limiting reactant means.",
      "answer": "The reactant that runs out first and limits product formation.",
      "explanation": "Once the limiting reactant is gone, no more product can form."
    }
  ]
}

RULES:
- Generate EXACTLY the number of questions requested (default 20)
- type must be one of: "mcq", "short", "calc", "fill_blank"
- For mcq: include exactly 4 choices
- For calc: include realistic numbers requiring calculation
- answer: the correct answer
- explanation: 1-3 sentences explaining why (required)
- source_ref: optional short quote from the notes
- If topic_focus provided, prioritize that topic
- If there are weak areas identified in the learning profile, prioritize creating questions that reinforce those concepts
- If there are strong areas, you can include some advanced questions on those topics
- Base questions on the provided study materials
- DO NOT include any text before { or after }
`,
  notes: `
You are in SIMPLE NOTES MODE. You are "Light", a warm and supportive AI tutor helping organize study materials. Convert the user's uploaded materials into clean, bullet-point notes with only the key facts. Keep it concise and organized.
  `,
};

const VALID_MODES = ['explain', 'quiz', 'flashcards', 'memory', 'worksheet', 'notes'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // PRE-FLIGHT: Check environment
    const envCheck = validateEnvironment();
    if (!envCheck.valid) {
      console.error('Environment validation failed:', envCheck.error);
      return new Response(
        JSON.stringify({ error: envCheck.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PRE-FLIGHT: Validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages, mode, collectionId, notes, model: clientModel, document_type_hint, worksheet_mode, topic_focus, question_count } = requestBody;
    
    // PRE-FLIGHT: Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages is required and must be an array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!mode || typeof mode !== 'string') {
      return new Response(
        JSON.stringify({ error: 'mode is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!VALID_MODES.includes(mode)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid mode: ${mode}. Must be one of: ${VALID_MODES.join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!collectionId || typeof collectionId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'collectionId is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Relaxed notes check - real validation happens on collectionContext later
    if (!notes || typeof notes !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Notes field is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('chat-tutor: notes field length:', notes.length);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header is required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Chat tutor request - Mode:', mode, 'Collection:', collectionId, 'User:', user.id);

    // PRE-FLIGHT: Check if collection exists and belongs to user
    const { data: collection, error: collectionError } = await supabaseClient
      .from('collections')
      .select('id, name')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (collectionError) {
      console.error('Collection lookup error:', collectionError);
      return new Response(
        JSON.stringify({ error: `Database error: ${collectionError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!collection) {
      return new Response(
        JSON.stringify({ error: 'Collection not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // ADAPTIVE LEARNING: Fetch recent learning events
    // =====================================================
    let learningProfile = '';
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: learningEvents, error: leError } = await supabaseClient
        .from('learning_events')
        .select('event_type, concept, payload, created_at')
        .eq('user_id', user.id)
        .eq('collection_id', collectionId)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!leError && learningEvents && learningEvents.length > 0) {
        const weakAreas: string[] = [];
        const strongAreas: string[] = [];

        for (const event of learningEvents) {
          const concept = event.concept || (event.payload as any)?.question?.substring(0, 50) || 'unknown';
          if (event.event_type === 'QUIZ_WRONG' || event.event_type === 'PROOF_NOT_SURE' || event.event_type === 'WORKSHEET_WRONG' || event.event_type === 'WORKSHEET_IDK') {
            if (!weakAreas.includes(concept)) weakAreas.push(concept);
          } else if (event.event_type === 'QUIZ_RIGHT' || event.event_type === 'PROOF_GOT_IT' || event.event_type === 'WORKSHEET_CORRECT') {
            if (!strongAreas.includes(concept)) strongAreas.push(concept);
          }
        }

        if (weakAreas.length > 0 || strongAreas.length > 0) {
          learningProfile = `
LEARNING PROFILE (from recent study sessions):
- Weak areas (needs practice): ${weakAreas.length > 0 ? weakAreas.slice(0, 3).join(', ') : 'None identified'}
- Strong areas: ${strongAreas.length > 0 ? strongAreas.slice(0, 3).join(', ') : 'None identified'}

ADAPTIVE INSTRUCTION: If the user has weak areas and the mode is explain, quiz, flashcards, or worksheet, start your response by asking ONE short follow-up question targeting their top weak area to reinforce learning. Be encouraging and supportive.
`;
          console.log('chat-tutor: Learning profile generated with', weakAreas.length, 'weak areas,', strongAreas.length, 'strong areas');
        }
      }
    } catch (leErr) {
      console.log('chat-tutor: Error fetching learning events (non-fatal):', leErr);
    }

    // =====================================================
    // CONTEXT RETRIEVAL WITH GRACEFUL FALLBACKS
    // Priority: VECTOR_SEARCH (OpenRouter) > CHUNKS_FALLBACK > PARSED_CONTENT_FALLBACK
    // =====================================================
    
    let collectionContext = '';
    let contextSource = 'NONE';
    
    // Helper: Generate query embedding using OpenRouter
    async function generateQueryEmbedding(query: string): Promise<number[] | null> {
      const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
      if (!OPENROUTER_API_KEY) {
        console.log('No OPENROUTER_API_KEY - skipping vector search');
        return null;
      }
      
      try {
        const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://studybuddy.lovable.app',
            'X-Title': 'StudyBuddy',
          },
          body: JSON.stringify({
            model: 'openai/text-embedding-3-small',
            input: query,
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.warn('Query embedding failed:', response.status, errorText.substring(0, 200));
          return null;
        }
        
        const data = await response.json();
        const embedding = data?.data?.[0]?.embedding;
        
        if (Array.isArray(embedding) && embedding.length > 0) {
          console.log(`Generated query embedding: ${embedding.length} dimensions`);
          return embedding;
        }
        return null;
      } catch (err) {
        console.warn('Query embedding error:', err);
        return null;
      }
    }
    
    // Get the latest user message for semantic search
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
    const searchQuery = lastUserMessage?.content || '';
    
    // ATTEMPT 1: Vector search via match_document_chunks RPC
    if (searchQuery && searchQuery.length > 10) {
      console.log('Attempting VECTOR_SEARCH via OpenRouter embedding...');
      const queryEmbedding = await generateQueryEmbedding(searchQuery);
      
      if (queryEmbedding) {
        // Format embedding as Postgres vector literal
        const embeddingVector = `[${queryEmbedding.join(',')}]`;
        
        const { data: semanticChunks, error: semanticError } = await supabaseClient
          .rpc('match_document_chunks', {
            query_embedding: embeddingVector,
            match_collection_id: collectionId,
            match_user_id: user.id,
            match_count: 10,
          });
        
        if (semanticError) {
          console.warn('RPC match_document_chunks error:', semanticError.message);
        } else if (semanticChunks && semanticChunks.length > 0) {
          const validChunks = semanticChunks
            .filter((c: any) => c.chunk_text && c.similarity !== null)
            .sort((a: any, b: any) => (b.similarity || 0) - (a.similarity || 0));
          
          if (validChunks.length > 0) {
            collectionContext = validChunks.map((c: any) => c.chunk_text).join('\n\n');
            contextSource = 'VECTOR_SEARCH';
            console.log(`[${contextSource}] Retrieved ${validChunks.length} chunks, top similarity: ${validChunks[0]?.similarity?.toFixed(3)}`);
          }
        }
      }
    }

    // ATTEMPT 2: Direct chunk retrieval (fallback - no embeddings needed)
    if (!collectionContext || collectionContext.length < 300) {
      console.log('Using CHUNKS_FALLBACK...');
      
      const { data: directChunks, error: directChunksError } = await supabaseClient
        .from('document_chunks')
        .select('chunk_text, chunk_index')
        .eq('collection_id', collectionId)
        .order('chunk_index', { ascending: true })
        .limit(15);

      if (directChunksError) {
        console.warn('Direct chunks query error:', directChunksError.message);
      } else if (directChunks && directChunks.length > 0) {
        const chunkTexts = directChunks
          .filter((c: any) => c.chunk_text && c.chunk_text.length > 0)
          .map((c: any) => c.chunk_text);
        
        if (chunkTexts.length > 0) {
          collectionContext = chunkTexts.join('\n\n');
          contextSource = 'CHUNKS_FALLBACK';
          console.log(`[${contextSource}] Retrieved ${chunkTexts.length} chunks directly`);
        }
      }
    }

    // ATTEMPT 3: Parsed content fallback (last resort)
    if (!collectionContext || collectionContext.length < 300) {
      console.log('Trying PARSED_CONTENT_FALLBACK...');
      
      const { data: files, error: filesError } = await supabaseClient
        .from('uploaded_files')
        .select('file_name, parsed_content')
        .eq('collection_id', collectionId)
        .eq('user_id', user.id);

      if (filesError) {
        console.error('Files lookup error:', filesError);
        return new Response(
          JSON.stringify({ error: `Failed to fetch collection files: ${filesError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!files || files.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: 'No files found in this collection. Please upload study materials first.',
            needsUpload: true
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const contentParts = files
        .filter((f: any) => f.parsed_content && f.parsed_content.trim().length > 0)
        .map((f: any) => f.parsed_content);

      if (contentParts.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: 'Files are still being processed. Please wait a moment and try again.',
            processing: true
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      collectionContext = contentParts.join('\n\n');
      contextSource = 'PARSED_CONTENT_FALLBACK';
      console.log(`[${contextSource}] Using parsed_content, length: ${collectionContext.length}`);
    }
    
    console.log('chat-tutor: final collectionContext length:', collectionContext.length);
    console.log('chat-tutor: collectionContext preview:', collectionContext.substring(0, 200));

    // Final validation - allow short context (best-effort) but still block truly empty/unreadable content
    const trimmedContext = collectionContext.trim();
    const isReadable = /[a-zA-Z]{3,}/.test(trimmedContext.substring(0, 500));

    if (!trimmedContext || trimmedContext.length < 30 || !isReadable) {
      console.error('chat-tutor: collectionContext is empty or unreadable');
      return new Response(
        JSON.stringify({ 
          error: 'This collection does not have enough readable text yet. Please upload or re-parse your study materials.',
          needsReparse: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (trimmedContext.length < 300) {
      console.log(`[${contextSource}] Context is short (<300 chars) — proceeding best-effort`);
    }

    const docTypeHint = document_type_hint || 'MIXED_OR_UNSURE';
    const fullContext = `
DOCUMENT TYPE HINT: ${docTypeHint}
MODE: ${mode}
${learningProfile}
STUDY MATERIALS (User's uploaded notes):
${collectionContext}
    `;

    // Build complete system prompt
    const modePrompt = MODE_PROMPTS[mode as keyof typeof MODE_PROMPTS] || MODE_PROMPTS.explain;
    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n${modePrompt}${fullContext}`;

    // MODEL ROUTING: Select appropriate model based on mode
    let selectedModel = clientModel; // Allow client to override
    if (!selectedModel) {
      // Default routing based on mode
      if (['explain', 'quiz', 'worksheet'].includes(mode)) {
        selectedModel = 'google/gemini-2.5-flash'; // More powerful for complex tasks
      } else {
        selectedModel = 'google/gemini-2.5-flash'; // Faster for simple tasks (flashcards, memory, notes)
      }
    }

    console.log('Calling AI - Mode:', mode, 'Model:', selectedModel, 'Content length:', notes.length);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
    
    // QUIZ MODE: Non-streaming with JSON sanitization
    if (mode === 'quiz') {
      console.log('chat-tutor: Quiz mode - using non-streaming with JSON sanitization');
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: fullSystemPrompt },
            ...messages,
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'AI credits exhausted. Please add credits to your workspace.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const errorText = await response.text();
        console.error('AI gateway error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'AI service unavailable. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      let rawContent = data.choices?.[0]?.message?.content || '';
      console.log('chat-tutor: Quiz raw output length:', rawContent.length);
      console.log('chat-tutor: Quiz raw output preview:', rawContent.substring(0, 300));

      // Sanitize quiz JSON
      let sanitizedJson = sanitizeQuizJson(rawContent);
      
      if (!sanitizedJson) {
        console.log('chat-tutor: First sanitization failed, retrying with correction prompt');
        // Retry once with correction prompt
        const retryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: 'system', content: fullSystemPrompt },
              ...messages,
              { role: 'assistant', content: rawContent },
              { role: 'user', content: 'Your last output was invalid JSON. Return ONLY the JSON array with 5 quiz questions. Start with [ and end with ]. No markdown, no backticks, no extra text.' }
            ],
            stream: false,
          }),
        });

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          rawContent = retryData.choices?.[0]?.message?.content || '';
          console.log('chat-tutor: Quiz retry output:', rawContent.substring(0, 300));
          sanitizedJson = sanitizeQuizJson(rawContent);
        }
      }

      if (!sanitizedJson) {
        console.error('chat-tutor: Quiz JSON sanitization failed after retry');
        return new Response(
          JSON.stringify({ error: 'Quiz generation failed. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('chat-tutor: Quiz sanitized successfully, questions:', sanitizedJson.length);

      // Return as SSE stream format for frontend compatibility
      const encoder = new TextEncoder();
      const jsonString = JSON.stringify(sanitizedJson);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: {"choices":[{"delta":{"content":${JSON.stringify(jsonString)}}}]}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    }

    // WORKSHEET MODE: Non-streaming with JSON sanitization
    if (mode === 'worksheet') {
      const wsMode = worksheet_mode || 'onsite';
      const wsTopicFocus = topic_focus || '';
      const wsQuestionCount = question_count || 20;
      
      console.log('chat-tutor: Worksheet mode -', wsMode, 'topic:', wsTopicFocus, 'count:', wsQuestionCount);
      
      // Build worksheet-specific user message
      const worksheetUserMessage = {
        role: 'user',
        content: `Generate a worksheet with EXACTLY ${wsQuestionCount} practice questions.${wsTopicFocus ? ` Focus on: ${wsTopicFocus}` : ''} 
Return ONLY the JSON object with set_id, topic_focus, and questions array. No markdown, no backticks.`
      };
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: fullSystemPrompt },
            worksheetUserMessage,
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'AI credits exhausted. Please add credits to your workspace.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const errorText = await response.text();
        console.error('AI gateway error:', response.status, errorText);
        return new Response(
          JSON.stringify({ error: 'AI service unavailable. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      let rawContent = data.choices?.[0]?.message?.content || '';
      console.log('chat-tutor: Worksheet raw output length:', rawContent.length);
      console.log('chat-tutor: Worksheet raw output preview:', rawContent.substring(0, 400));

      // Sanitize worksheet JSON
      let sanitizedWorksheet = sanitizeWorksheetJson(rawContent);
      
      if (!sanitizedWorksheet) {
        console.log('chat-tutor: First worksheet sanitization failed, retrying with correction prompt');
        // Retry once with correction prompt
        const retryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: 'system', content: fullSystemPrompt },
              worksheetUserMessage,
              { role: 'assistant', content: rawContent },
              { role: 'user', content: 'Your last output was invalid JSON. Return ONLY the JSON object with set_id, topic_focus, and questions array. Start with { and end with }. No markdown, no backticks, no extra text.' }
            ],
            stream: false,
          }),
        });

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          rawContent = retryData.choices?.[0]?.message?.content || '';
          console.log('chat-tutor: Worksheet retry output:', rawContent.substring(0, 400));
          sanitizedWorksheet = sanitizeWorksheetJson(rawContent);
        }
      }

      if (!sanitizedWorksheet) {
        console.error('chat-tutor: Worksheet JSON sanitization failed after retry');
        return new Response(
          JSON.stringify({ error: 'Worksheet generation failed. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('chat-tutor: Worksheet sanitized successfully, questions:', sanitizedWorksheet.questions.length);

      // Return as SSE stream format for frontend compatibility
      const encoder = new TextEncoder();
      const jsonString = JSON.stringify(sanitizedWorksheet);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: {"choices":[{"delta":{"content":${JSON.stringify(jsonString)}}}]}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    }
    
    // ALL OTHER MODES: Streaming
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      // =====================================================
      // DEV MODE: Return mock responses for 402/429 errors
      // =====================================================
      if (DEV_MODE && (response.status === 402 || response.status === 429)) {
        console.log(`DEV MODE - AI gateway returned ${response.status}, returning mock ${mode} response`);
        
        let mockData: object;
        
        if (mode === 'flashcards') {
          mockData = {
            cards: [
              { front: "Mitosis", back: "Cell division that produces two identical daughter cells" },
              { front: "Meiosis", back: "Cell division that produces four gametes with half the chromosomes" },
              { front: "DNA Polymerase", back: "Enzyme that adds nucleotides during DNA replication" },
              { front: "Helicase", back: "Enzyme that unwinds the DNA double helix" }
            ]
          };
        } else if (mode === 'worksheet') {
          mockData = {
            worksheet: {
              fill_in_the_blank: [
                "The four stages of mitosis are Prophase, ___, Anaphase, and Telophase.",
                "DNA replication is ___, meaning each new molecule has one old and one new strand."
              ],
              short_answer: [
                "Explain the difference between mitosis and meiosis.",
                "What is the role of helicase in DNA replication?"
              ],
              matching: [
                { left: "Prophase", right: "Chromosomes condense" },
                { left: "Metaphase", right: "Chromosomes align at equator" },
                { left: "Anaphase", right: "Sister chromatids separate" }
              ]
            }
          };
        } else if (mode === 'memory') {
          mockData = {
            acronym: "PMAT",
            mnemonic: "Please Make A Twin",
            items: [
              { name: "Prophase", meaning: "Chromosomes condense, nuclear envelope breaks down" },
              { name: "Metaphase", meaning: "Chromosomes align at the cell's equator" },
              { name: "Anaphase", meaning: "Sister chromatids separate and move apart" },
              { name: "Telophase", meaning: "Nuclear envelopes reform, chromosomes decondense" }
            ]
          };
        } else {
          // Default for explain/notes modes
          mockData = {
            summary: "DEV MODE: This is mock content about cell division. The cell cycle includes interphase and mitotic phase. Mitosis has four stages: Prophase, Metaphase, Anaphase, and Telophase.",
            key_points: [
              "Mitosis produces identical daughter cells",
              "Meiosis produces gametes with half the chromosomes",
              "DNA replication is semi-conservative"
            ]
          };
        }
        
        const mockStream = createMockStreamResponse(mockData);
        return new Response(mockStream, {
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
        });
      }
      // =====================================================
      // END DEV MODE BLOCK - Normal error handling below
      // =====================================================
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'AI service unavailable. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Error in chat-tutor function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        type: 'CHAT_TUTOR_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});