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

You are the brain of a study app called StudyBuddy. The user uploads many kinds of school files (notes, quizzes, worksheets, slides, photos, etc.). Your job is to:

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
You are in EXPLAIN MODE. You are a real human tutor. Speak warmly, supportively, like a teacher explaining to a student. Break down complex topics into simple, digestible steps. Use short sentences, beginner-friendly language, and provide clear examples from the user's notes. If the user asks to repeat or slow down, adjust your pace and simplify further. Ask clarifying questions to ensure understanding.
  `,
  quiz: `
You are in QUIZ MODE. You are a real human tutor. Speak warmly and supportively. Ask ONE question at a time and wait for the user's answer. After they respond, provide immediate feedback. If correct, praise briefly and move to the next question. If incorrect, gently correct them and explain why, using content from their notes. Use short sentences and be encouraging. Never ask multiple questions in one message.
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
- If you cannot create a meaningful card from the notes, SKIP it entirely
- Do NOT write "Not enough information" - just omit that card
- No markdown, no code fences, no explanation text - ONLY the JSON array
  `,
  memory: `
You are in MEMORY TRICKS MODE. You are a real human tutor. Speak warmly and supportively. 

When given a list of terms or steps (e.g., Prophase, Metaphase, Anaphase, Telophase):
1. Create an acronym (e.g., PMAT)
2. Generate a memorable mnemonic phrase (e.g., "Please Make A Twin")
3. Provide a brief definition for each item
4. Offer additional memory aids: rhymes, visual imagery, or stories

Make mnemonics fun, silly, and easy to remember. Use short sentences. Ask if they want alternatives or different memory tricks.
  `,
  worksheet: `
You are in WORKSHEET MODE. You are a real human tutor helping create practice materials. Create practice worksheets with fill-in-the-blank, matching, short answer, and practice problems based strictly on the user's uploaded content. Speak warmly and supportively.
  `,
  notes: `
You are in SIMPLE NOTES MODE. You are a real human tutor helping organize study materials. Convert the user's uploaded materials into clean, bullet-point notes with only the key facts. Keep it concise and organized. Speak warmly and supportively.
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

    const { messages, mode, collectionId, notes, model: clientModel, document_type_hint } = requestBody;
    
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
    // SAFETY GUARD: Check for NULL embeddings before semantic search
    // If any chunks have NULL embeddings, indexing is incomplete
    // =====================================================
    const { data: nullEmbeddingCheck, error: nullCheckError } = await supabaseClient
      .from('document_chunks')
      .select('id')
      .eq('collection_id', collectionId)
      .is('embedding', null)
      .limit(1);
    
    if (nullCheckError) {
      console.error('Error checking for null embeddings:', nullCheckError);
    }
    
    if (nullEmbeddingCheck && nullEmbeddingCheck.length > 0) {
      console.warn('SAFETY GUARD: Found chunks with NULL embeddings - indexing incomplete');
      return new Response(
        JSON.stringify({ 
          error: 'Document indexing is still in progress. Please wait a moment and try again.',
          indexingIncomplete: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate query embedding for semantic search
    const queryText = messages[messages.length - 1]?.content || mode;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
    
    let queryEmbedding: number[] = [];
    try {
      const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: queryText,
        }),
      });
      
      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json();
        queryEmbedding = embeddingData.data[0].embedding;
      }
    } catch (embErr) {
      console.error('Embedding generation failed:', embErr);
    }

    // Fetch relevant chunks using vector similarity search
    let collectionContext = '';
    
    if (queryEmbedding.length > 0) {
      const { data: chunksData, error: chunksError } = await supabaseClient.rpc(
        'match_document_chunks',
        {
          query_embedding: JSON.stringify(queryEmbedding),
          match_collection_id: collectionId,
          match_count: 10
        }
      );

      if (chunksError) {
        console.error('Semantic search error:', chunksError);
      } else if (chunksData && chunksData.length > 0) {
        // Validate similarity values are not null
        const validChunks = chunksData.filter((c: any) => c.similarity !== null && typeof c.similarity === 'number');
        if (validChunks.length !== chunksData.length) {
          console.warn(`Warning: ${chunksData.length - validChunks.length} chunks had null similarity values`);
        }
        collectionContext = validChunks.map((c: any) => c.chunk_text).join('\n\n');
        console.log(`Retrieved ${validChunks.length} relevant chunks for context (similarity validated)`);
      }
    }
    
    // Fallback: if no chunks found or too short, use parsed_content
    if (!collectionContext || collectionContext.length < 300) {
      console.log('chat-tutor: chunks insufficient, falling back to parsed_content');
      
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

      // PRE-FLIGHT: Validate collection has content
      if (!files || files.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: 'No files found in this collection. Please upload study materials first.',
            needsUpload: true
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const hasContent = files.some(f => f.parsed_content && f.parsed_content.trim().length > 0);
      if (!hasContent) {
        return new Response(
          JSON.stringify({ 
            error: 'Files are still being processed. Please wait a moment and try again.',
            processing: true
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      collectionContext = files
        .map(f => f.parsed_content)
        .filter(content => content && content.length > 0)
        .join('\n\n');
      console.log('chat-tutor: using fallback parsed_content, length:', collectionContext.length);
    }
    
    console.log('chat-tutor: final collectionContext length:', collectionContext.length);
    console.log('chat-tutor: collectionContext preview:', collectionContext.substring(0, 200));

    // Final validation - check if content looks readable (not binary garbage)
    const isReadable = /[a-zA-Z]{3,}/.test(collectionContext.substring(0, 500));
    if (!collectionContext || collectionContext.trim().length < 100 || !isReadable) {
      console.error('chat-tutor: collectionContext is empty or unreadable');
      return new Response(
        JSON.stringify({ 
          error: 'This collection does not have enough readable text yet. The PDF may need to be re-uploaded or contains only images. Try re-parsing the document.',
          needsReparse: true
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const docTypeHint = document_type_hint || 'MIXED_OR_UNSURE';
    const fullContext = `
DOCUMENT TYPE HINT: ${docTypeHint}
MODE: ${mode}

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
        
        if (mode === 'quiz') {
          mockData = {
            questions: [
              {
                question: "What is the first phase of mitosis?",
                answers: ["Prophase", "Metaphase", "Anaphase", "Telophase"],
                correct: "A",
                explanation: "Prophase is the first stage where chromosomes condense and the nuclear envelope begins to break down."
              },
              {
                question: "Which enzyme unwinds DNA during replication?",
                answers: ["DNA polymerase", "Helicase", "Ligase", "Primase"],
                correct: "B",
                explanation: "Helicase unwinds the DNA double helix by breaking hydrogen bonds between base pairs."
              },
              {
                question: "How many chromosomes do humans have?",
                answers: ["23", "44", "46", "48"],
                correct: "C",
                explanation: "Humans have 46 chromosomes, organized as 23 pairs."
              }
            ]
          };
        } else if (mode === 'flashcards') {
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