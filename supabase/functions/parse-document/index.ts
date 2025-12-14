import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Tesseract from "https://esm.sh/tesseract.js@5.0.4";

// =====================================================
// DEV MODE FLAG - Set to true to bypass AI API calls
// and use mock data when credits are exhausted.
// Set to false for production use.
// =====================================================
const DEV_MODE = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PRE-FLIGHT: Validate environment variables
function validateEnvironment(): { valid: boolean; error?: string } {
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  for (const varName of requiredVars) {
    if (!Deno.env.get(varName)) {
      return { valid: false, error: `Missing required environment variable: ${varName}` };
    }
  }
  return { valid: true };
}

// Sanitize text for PostgreSQL TEXT column
function sanitizeText(text: string): string {
  return text
    .replace(/\u0000/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\uFFFD/g, '') // Remove replacement characters
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '') // Remove 4-byte UTF-8 characters
    .trim();
}

// =====================================================
// READABILITY CHECK: Detect if text is real human-readable content
// Returns false for binary garbage, decoded junk, or insufficient content
// =====================================================
function isReadableText(text: string): boolean {
  const trimmed = text.trim();
  
  // Too short to be meaningful
  if (trimmed.length < 200) {
    console.log('isReadableText: FAIL - too short:', trimmed.length);
    return false;
  }
  
  // Count alphabetic characters (letters)
  const alphaMatches = trimmed.match(/[a-zA-Z]/g);
  const alphaCount = alphaMatches ? alphaMatches.length : 0;
  const alphaRatio = alphaCount / trimmed.length;
  
  // If less than 30% alphabetic, it's likely binary garbage
  if (alphaRatio < 0.3) {
    console.log('isReadableText: FAIL - low alpha ratio:', alphaRatio.toFixed(2));
    return false;
  }
  
  // Check for long runs of non-alphanumeric junk (20+ chars of symbols/gibberish)
  const junkPattern = /[^a-zA-Z0-9\s.,;:?!'"\-()]{15,}/;
  if (junkPattern.test(trimmed)) {
    console.log('isReadableText: FAIL - detected long junk run');
    return false;
  }
  
  // Check for reasonable word-like patterns (at least some spaces between letters)
  const wordMatches = trimmed.match(/[a-zA-Z]{2,}/g);
  const wordCount = wordMatches ? wordMatches.length : 0;
  
  // Should have at least 20 word-like patterns for 200+ chars
  if (wordCount < 20) {
    console.log('isReadableText: FAIL - too few words:', wordCount);
    return false;
  }
  
  console.log('isReadableText: PASS - alphaRatio:', alphaRatio.toFixed(2), 'wordCount:', wordCount);
  return true;
}

// Semantic chunker: breaks text into 300-500 char chunks preserving sentence boundaries
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > 500) {
      if (currentChunk.length >= 300) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += ' ' + sentence;
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(c => c.length >= 100); // Filter out tiny chunks
}

// Generate embeddings using Lovable AI
async function generateEmbedding(text: string): Promise<number[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not found');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Embedding generation failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

// Vision-based document analysis using Lovable AI
async function analyzeDocumentWithVision(imageBase64: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not found');
  
  const visionPrompt = `Analyze this document image and extract structured content. Return ONLY valid JSON with this exact structure:
{
  "mode": "vision",
  "sections": [{"heading": "", "content": ""}],
  "problems": [{"number": "", "type": "", "question": "", "data": ""}],
  "concepts": ["concept1", "concept2"],
  "figures": [{"label": "", "meaning": ""}]
}

Rules:
- Extract all text regions, headings, lists, tables
- Identify numbered problems and their types (multiple choice, calculation, etc)
- List key concepts or vocabulary terms
- Describe any diagrams, charts, or labeled figures
- Be concise and structured
- Return ONLY the JSON, no markdown or explanatory text`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: visionPrompt },
            { 
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
            }
          ]
        }
      ],
      max_tokens: 4000
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Vision analysis failed: ${response.status}`);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  
  // Clean and parse JSON response - with safe fallback
  let cleanContent = content.trim();
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  }
  if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.replace(/```\n?/g, '');
  }
  
  try {
    return JSON.parse(cleanContent);
  } catch (parseError) {
    console.error('Vision JSON parse failed, returning text as content:', parseError);
    // Return the raw text as a section instead of crashing
    return {
      mode: 'vision',
      sections: [{ heading: 'Extracted Content', content: cleanContent }],
      concepts: [],
      problems: [],
      figures: []
    };
  }
}

// Detect document type (text-based vs image-based)
function detectDocumentMode(arrayBuffer: ArrayBuffer, extractedText: string): string {
  // If extracted text is substantial, it's text-based
  if (extractedText.length >= 500) {
    return 'text';
  }
  
  // If very little text extracted, likely image-based
  if (extractedText.length < 200) {
    return 'vision';
  }
  
  // Mixed content
  return 'hybrid';
}

// Convert structured vision output to text chunks
function structuredToText(structured: any): string {
  let text = '';
  
  // Add sections
  if (structured.sections && Array.isArray(structured.sections)) {
    for (const section of structured.sections) {
      if (section.heading) text += `\n\n${section.heading}\n`;
      if (section.content) text += section.content;
    }
  }
  
  // Add concepts
  if (structured.concepts && Array.isArray(structured.concepts)) {
    text += '\n\nKey Concepts:\n' + structured.concepts.join(', ');
  }
  
  // Add problems
  if (structured.problems && Array.isArray(structured.problems)) {
    text += '\n\nProblems:\n';
    for (const problem of structured.problems) {
      text += `\n${problem.number || ''} ${problem.question || ''} ${problem.data || ''}`;
    }
  }
  
  // Add figures
  if (structured.figures && Array.isArray(structured.figures)) {
    text += '\n\nFigures:\n';
    for (const fig of structured.figures) {
      text += `\n${fig.label || ''}: ${fig.meaning || ''}`;
    }
  }
  
  return text.trim();
}

// Count PDF pages
function countPDFPages(arrayBuffer: ArrayBuffer): number {
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
    const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
    return pageMatches ? pageMatches.length : 0;
  } catch {
    return 0;
  }
}

// Extract text from PDF (standard extraction only)
function extractPDFText(arrayBuffer: ArrayBuffer): string {
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
    
    // Method 1: Extract text between parentheses (PDF text objects)
    const textMatches = text.match(/\(([^)]+)\)/g);
    let extracted = '';
    
    if (textMatches && textMatches.length > 0) {
      extracted = textMatches
        .map(match => match.slice(1, -1))
        .join(' ')
        .replace(/\\[0-9]{3}/g, ' ')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\/g, '')
        .trim();
    }
    
    // Method 2: Extract readable ASCII text if Method 1 didn't work
    if (extracted.length < 200) {
      const asciiText = text
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (asciiText.length > extracted.length) {
        extracted = asciiText;
      }
    }
    
    return extracted;
  } catch (error) {
    console.error('PDF extraction error:', error);
    return '';
  }
}

// Run OCR on PDF with page-by-page processing
async function runOCR(arrayBuffer: ArrayBuffer, fileId: string, supabaseClient: any): Promise<string> {
  try {
    console.log('Starting OCR processing...');
    
    // Convert ArrayBuffer to Uint8Array for OCR processing
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Update status: processing
    await supabaseClient
      .from('uploaded_files')
      .update({ processing: true })
      .eq('id', fileId);
    
    console.log('Running Tesseract OCR...');
    
    // Run Tesseract OCR
    const { data: { text } } = await Tesseract.recognize(uint8Array, 'eng', {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    // Clean OCR text
    const cleanedText = cleanOCRText(text);
    
    console.log('OCR extracted text length:', cleanedText.length);
    
    // Update status: done processing
    await supabaseClient
      .from('uploaded_files')
      .update({ processing: false })
      .eq('id', fileId);
    
    return cleanedText;
  } catch (error) {
    console.error('OCR error:', error);
    
    // Update status: done processing (failed)
    await supabaseClient
      .from('uploaded_files')
      .update({ processing: false })
      .eq('id', fileId);
    
    return '';
  }
}

// Clean OCR text output
function cleanOCRText(text: string): string {
  return text
    .replace(/\u0000/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\uFFFD/g, '') // Remove replacement characters
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '') // Remove 4-byte UTF-8 characters
    .replace(/[*_#`~]/g, '') // Remove Markdown characters
    .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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

    const { fileId } = requestBody;

    if (!fileId || typeof fileId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'fileId is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing document with ID:', fileId);

    // PRE-FLIGHT: Check if file exists in database
    const { data: fileData, error: fileError } = await supabaseClient
      .from('uploaded_files')
      .select('*')
      .eq('id', fileId)
      .maybeSingle();

    if (fileError) {
      console.error('Error fetching file:', fileError);
      return new Response(
        JSON.stringify({ error: `Database error: ${fileError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!fileData) {
      return new Response(
        JSON.stringify({ error: `File with ID ${fileId} not found in database` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('File data:', fileData);

    // PRE-FLIGHT: Check if file exists in storage
    console.log('[parse-document] Attempting storage download:', {
      bucket: 'study-files',
      path: fileData.file_path
    });

    const { data: fileBlob, error: downloadError } = await supabaseClient
      .storage
      .from('study-files')
      .download(fileData.file_path);

    if (downloadError) {
      console.error('[parse-document] Download FAILED:', {
        bucket: 'study-files',
        path: fileData.file_path,
        errorCode: downloadError.message,
        errorMessage: downloadError.message
      });
      return new Response(
        JSON.stringify({ error: `Storage error: ${downloadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[parse-document] Download SUCCESS:', {
      bucket: 'study-files',
      path: fileData.file_path,
      blobSize: fileBlob?.size || 'unknown'
    });

    // =====================================================
    // DEV MODE: Generate mock data without calling AI APIs
    // This allows testing when credits are exhausted
    // =====================================================
    if (DEV_MODE) {
      console.log('DEV MODE ENABLED - Generating mock document data');
      
      // Mock chunks about cell biology (realistic study content)
      const mockChunks = [
        "Cell Division Overview: Cell division is the process by which a parent cell divides into two or more daughter cells. There are two main types: mitosis and meiosis. Mitosis produces identical daughter cells for growth and repair. Meiosis produces gametes with half the chromosomes for sexual reproduction.",
        "Phases of Mitosis: The cell cycle includes interphase and mitotic phase. The four stages of mitosis are Prophase (chromosomes condense, nuclear envelope breaks down), Metaphase (chromosomes align at cell equator), Anaphase (sister chromatids separate), and Telophase (nuclear envelopes reform, chromosomes decondense).",
        "DNA Replication: Before cell division, DNA must be copied. Replication occurs during the S phase of interphase. The process is semi-conservative, meaning each new DNA molecule contains one original strand and one new strand. Key enzymes include helicase (unwinds DNA) and DNA polymerase (adds nucleotides).",
        "Chromosomes and Genes: Chromosomes are structures made of DNA and proteins. Humans have 46 chromosomes (23 pairs). Genes are segments of DNA that code for proteins. Alleles are different versions of the same gene. Homologous chromosomes carry genes for the same traits but may have different alleles."
      ];
      
      // Generate mock embeddings (1536 dimensions to match text-embedding-3-small)
      const generateMockEmbedding = (seed: number): number[] => {
        const embedding: number[] = [];
        for (let i = 0; i < 1536; i++) {
          // Generate pseudo-random floats between -1 and 1
          embedding.push(Math.sin(seed * (i + 1)) * Math.cos(i * 0.1));
        }
        return embedding;
      };
      
      // Insert mock chunks into database
      const chunkInserts = mockChunks.map((chunk, index) => ({
        file_id: fileId,
        collection_id: fileData.collection_id,
        user_id: fileData.user_id,
        chunk_text: chunk,
        embedding: JSON.stringify(generateMockEmbedding(index + 1)),
        chunk_index: index,
        metadata: { length: chunk.length, dev_mode: true }
      }));
      
      const { error: chunkError } = await supabaseClient
        .from('document_chunks')
        .insert(chunkInserts);
      
      if (chunkError) {
        console.error('DEV MODE - Error inserting mock chunks:', chunkError);
      } else {
        console.log(`DEV MODE - Inserted ${chunkInserts.length} mock chunks`);
      }
      
      // Mock parsed content (summary)
      const mockParsedContent = mockChunks.join('\n\n');
      
      // Update file record
      const { error: updateError } = await supabaseClient
        .from('uploaded_files')
        .update({ 
          parsed_content: mockParsedContent,
          processing: false 
        })
        .eq('id', fileId);
      
      if (updateError) {
        console.error('DEV MODE - Error updating file:', updateError);
        return new Response(
          JSON.stringify({ error: `DEV MODE - Failed to save: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          parsedContent: mockParsedContent,
          contentLength: mockParsedContent.length,
          message: 'DEV MODE - Mock document data generated successfully',
          devMode: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // =====================================================
    // END DEV MODE BLOCK - Normal processing continues below
    // =====================================================

    // Mark as processing
    await supabaseClient
      .from('uploaded_files')
      .update({ processing: true })
      .eq('id', fileId);

    // Parse based on file type
    let parsedContent = '';
    let needsOCR = false;
    let documentMode = 'text';
    let structuredData: any = null;
    const fileType = fileData.file_type.toLowerCase();

    try {
      // NEVER run OCR on PPTX - always use XML extraction
      if (fileType.includes('pptx')) {
        const text = await fileBlob.text();
        parsedContent = sanitizeText(text.substring(0, 5000));
        console.log('PPTX extracted (no OCR needed)');
      } else if (fileType.includes('pdf')) {
        // Count pages first
        const arrayBuffer = await fileBlob.arrayBuffer();
        const pageCount = countPDFPages(arrayBuffer);
        
        console.log(`PDF has ${pageCount} pages`);
        
        // Large file protection: skip OCR if > 30 pages
        if (pageCount > 30) {
          parsedContent = extractPDFText(arrayBuffer);
          parsedContent = sanitizeText(parsedContent);
          
          if (parsedContent.length < 300) {
            parsedContent = 'Slide deck too large for OCR — using standard extraction. Limited text found.';
          }
          console.log('Large PDF - OCR skipped');
        } else {
          // Standard extraction first
          parsedContent = extractPDFText(arrayBuffer);
          
          // Detect document mode
          documentMode = detectDocumentMode(arrayBuffer, parsedContent);
          console.log(`Document mode detected: ${documentMode}`);
          
          // If vision or hybrid mode, use vision analysis
          if (documentMode === 'vision' || (documentMode === 'hybrid' && parsedContent.length < 500)) {
            console.log('Using vision-based analysis...');
            
            // Convert to base64 for vision API
            const uint8Array = new Uint8Array(arrayBuffer);
            const base64 = btoa(String.fromCharCode(...uint8Array));
            
            try {
              structuredData = await analyzeDocumentWithVision(base64);
              console.log('Vision analysis complete');
              
              // Convert structured data to text
              parsedContent = structuredToText(structuredData);
              parsedContent = sanitizeText(parsedContent);
              
              if (parsedContent.length < 200) {
                parsedContent = 'Document analyzed but minimal content extracted. Try a clearer image.';
              }
            } catch (visionError) {
              console.error('Vision analysis failed:', visionError);
              // Fall back to OCR
              console.log('Falling back to OCR...');
              const ocrText = await runOCR(arrayBuffer, fileId, supabaseClient);
              parsedContent = sanitizeText(parsedContent + '\n\n' + ocrText);
            }
          } else {
            // Text mode - check if OCR needed
            if (parsedContent.length >= 300) {
              parsedContent = sanitizeText(parsedContent);
              console.log('Standard extraction successful');
            } else {
              // Mark for OCR processing
              needsOCR = true;
              console.log('Text extraction < 300 chars, OCR needed');
              
              // Run OCR
              const ocrText = await runOCR(arrayBuffer, fileId, supabaseClient);
              
              // Merge extracted + OCR text
              const combinedText = `${parsedContent}\n\n${ocrText}`.trim();
              parsedContent = sanitizeText(combinedText);
              
              console.log('OCR processing complete');
            }
          }
        }
      } else if (fileType.includes('text') || fileType.includes('txt')) {
        parsedContent = await fileBlob.text();
        parsedContent = sanitizeText(parsedContent);
      } else if (fileType.includes('docx')) {
        const text = await fileBlob.text();
        parsedContent = sanitizeText(text.substring(0, 5000));
      } else if (fileType.includes('image')) {
        // Use vision analysis for images
        console.log('Processing image with vision analysis...');
        const arrayBuffer = await fileBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64 = btoa(String.fromCharCode(...uint8Array));
        
        try {
          structuredData = await analyzeDocumentWithVision(base64);
          parsedContent = structuredToText(structuredData);
          parsedContent = sanitizeText(parsedContent);
          documentMode = 'vision';
        } catch (visionError) {
          console.error('Image vision analysis failed:', visionError);
          parsedContent = `Image file uploaded: ${fileData.file_name}. Vision analysis failed.`;
        }
      } else {
        parsedContent = `File uploaded: ${fileData.file_name}. Format: ${fileData.file_type}`;
      }
    } catch (parseError) {
      console.error('Parsing error:', parseError);
      parsedContent = `File uploaded but parsing encountered an error. File name: ${fileData.file_name}`;
    }

    // CRITICAL: Sanitize content again
    parsedContent = sanitizeText(parsedContent);

    console.log('Parsed content length after sanitization:', parsedContent.length);

    // =====================================================
    // READABILITY GATE: Final check before chunking
    // =====================================================
    const contentIsReadable = isReadableText(parsedContent);
    console.log('parse-document: isReadableText =', contentIsReadable);

    // If content failed readability AND we haven't tried OCR/vision yet, try one more time
    if (!contentIsReadable && !needsOCR && (fileType.includes('pdf') || fileType.includes('image'))) {
      console.log('parse-document: Content unreadable, attempting OCR fallback...');
      try {
        const arrayBuffer = await fileBlob.arrayBuffer();
        const ocrText = await runOCR(arrayBuffer, fileId, supabaseClient);
        const sanitizedOCR = sanitizeText(ocrText);
        
        if (isReadableText(sanitizedOCR)) {
          console.log('parse-document: OCR fallback succeeded');
          parsedContent = sanitizedOCR;
        } else {
          console.log('parse-document: OCR fallback also failed readability check');
        }
      } catch (ocrError) {
        console.error('parse-document: OCR fallback error:', ocrError);
      }
    }

    // Re-check readability after potential OCR fallback
    const finalReadable = isReadableText(parsedContent);
    console.log('parse-document: Final readability =', finalReadable);

    // =====================================================
    // DELETE OLD CHUNKS: Protect against legacy corruption
    // Always delete old chunks before inserting new ones
    // =====================================================
    const { error: deleteChunksError } = await supabaseClient
      .from('document_chunks')
      .delete()
      .eq('file_id', fileId);
    
    if (deleteChunksError) {
      console.error('parse-document: Error deleting old chunks:', deleteChunksError);
    } else {
      console.log('parse-document: Cleared any existing chunks for file');
    }

    // =====================================================
    // HANDLE UNREADABLE CONTENT: Set clear warning, skip chunking
    // =====================================================
    if (!finalReadable) {
      console.log('parse-document: Document unreadable - storing warning message, skipping chunks');
      
      const warningMessage = 'Document unreadable — no real text detected. Try a clearer or text-based PDF.';
      
      // Update file with warning (no chunks)
      const { error: updateError } = await supabaseClient
        .from('uploaded_files')
        .update({ 
          parsed_content: warningMessage,
          processing: false 
        })
        .eq('id', fileId);

      if (updateError) {
        console.error('parse-document: Error updating with warning:', updateError);
        return new Response(
          JSON.stringify({ 
            error: `Failed to save: ${updateError.message}`,
            details: updateError.details || 'No additional details'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          parsedContent: warningMessage,
          contentLength: warningMessage.length,
          readable: false,
          chunksInserted: 0,
          message: 'Document parsed but content was unreadable. No chunks created.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // CONTENT IS READABLE: Proceed with chunking and embeddings
    // =====================================================
    
    // Limit length for storage
    const MAX_LENGTH = 50000;
    if (parsedContent.length > MAX_LENGTH) {
      parsedContent = parsedContent.substring(0, MAX_LENGTH) + 
        '\n\n[Content truncated for storage - full document available for AI analysis]';
    }

    // PRE-FLIGHT: Validate sanitized content before saving
    if (parsedContent.includes('\u0000')) {
      console.error('Sanitization failed - null bytes still present');
      parsedContent = parsedContent.replace(/\u0000/g, '');
    }

    // Chunk the content into semantic sections
    const chunks = chunkText(parsedContent);
    console.log(`parse-document: Created ${chunks.length} chunks from document`);

    // Generate embeddings and store chunks
    const chunkInserts = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Generating embedding for chunk ${i + 1}/${chunks.length}`);
      
      try {
        const embedding = await generateEmbedding(chunk);
        
        chunkInserts.push({
          file_id: fileId,
          collection_id: fileData.collection_id,
          user_id: fileData.user_id,
          chunk_text: chunk,
          embedding: JSON.stringify(embedding),
          chunk_index: i,
          metadata: { length: chunk.length }
        });
      } catch (embErr) {
        console.error(`Error generating embedding for chunk ${i}:`, embErr);
        // Continue with other chunks even if one fails - still save chunk without embedding
        chunkInserts.push({
          file_id: fileId,
          collection_id: fileData.collection_id,
          user_id: fileData.user_id,
          chunk_text: chunk,
          embedding: null,
          chunk_index: i,
          metadata: { length: chunk.length, embeddingFailed: true }
        });
      }
    }

    // Insert all chunks
    if (chunkInserts.length > 0) {
      const { error: chunkError } = await supabaseClient
        .from('document_chunks')
        .insert(chunkInserts);

      if (chunkError) {
        console.error('Error inserting chunks:', chunkError);
        // Don't fail the whole operation if chunking fails
      } else {
        console.log(`parse-document: Successfully inserted ${chunkInserts.length} chunks`);
      }
    }

    // Store content in parsed_content for backward compatibility (first 10k chars)
    const summary = parsedContent.substring(0, 10000);

    // Update database with parsed content and clear processing flag
    const { error: updateError } = await supabaseClient
      .from('uploaded_files')
      .update({ 
        parsed_content: summary,
        processing: false 
      })
      .eq('id', fileId);

    if (updateError) {
      console.error('Error updating parsed content:', updateError);
      return new Response(
        JSON.stringify({ 
          error: `Failed to save parsed content: ${updateError.message}`,
          details: updateError.details || 'No additional details'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        parsedContent: summary,
        contentLength: parsedContent.length,
        readable: true,
        chunksInserted: chunkInserts.length,
        message: 'Document parsed and saved successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in parse-document function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        type: 'PARSE_DOCUMENT_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});