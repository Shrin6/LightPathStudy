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
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PRE-FLIGHT: Validate environment variables
function validateEnvironment(): { valid: boolean; error?: string } {
  const requiredVars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "LOVABLE_API_KEY"];
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
    .replace(/\u0000/g, "") // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control characters
    .replace(/\uFFFD/g, "") // Remove replacement characters
    .replace(/[\u{10000}-\u{10FFFF}]/gu, "") // Remove 4-byte UTF-8 characters
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
    console.log("isReadableText: FAIL - too short:", trimmed.length);
    return false;
  }

  // Count alphabetic characters (letters)
  const alphaMatches = trimmed.match(/[a-zA-Z]/g);
  const alphaCount = alphaMatches ? alphaMatches.length : 0;
  const alphaRatio = alphaCount / trimmed.length;

  // If less than 30% alphabetic, it's likely binary garbage
  if (alphaRatio < 0.3) {
    console.log("isReadableText: FAIL - low alpha ratio:", alphaRatio.toFixed(2));
    return false;
  }

  // Check for long runs of non-alphanumeric junk (20+ chars of symbols/gibberish)
  const junkPattern = /[^a-zA-Z0-9\s.,;:?!'"\-()]{15,}/;
  if (junkPattern.test(trimmed)) {
    console.log("isReadableText: FAIL - detected long junk run");
    return false;
  }

  // Check for reasonable word-like patterns (at least some spaces between letters)
  const wordMatches = trimmed.match(/[a-zA-Z]{2,}/g);
  const wordCount = wordMatches ? wordMatches.length : 0;

  // Should have at least 20 word-like patterns for 200+ chars
  if (wordCount < 20) {
    console.log("isReadableText: FAIL - too few words:", wordCount);
    return false;
  }

  console.log("isReadableText: PASS - alphaRatio:", alphaRatio.toFixed(2), "wordCount:", wordCount);
  return true;
}

// Semantic chunker: breaks text into 300-500 char chunks preserving sentence boundaries
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > 500) {
      if (currentChunk.length >= 300) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += " " + sentence;
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((c) => c.length >= 100); // Filter out tiny chunks
}

// =====================================================
// EMBEDDING GENERATION - REQUIRED, NOT OPTIONAL
// Must return valid numeric array or throw error
// =====================================================
class EmbeddingGatewayError extends Error {
  status: number;
  responseText?: string;

  constructor(status: number, message: string, responseText?: string) {
    super(message);
    this.name = "EmbeddingGatewayError";
    this.status = status;
    this.responseText = responseText;
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not found");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new EmbeddingGatewayError(
      response.status,
      `Embedding generation failed: ${response.status}`,
      errorText,
    );
  }

  const data = await response.json();
  const embedding = data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Invalid embedding response: embedding is missing or empty");
  }

  if (!embedding.every((v: unknown) => typeof v === "number")) {
    throw new Error("Invalid embedding response: embedding contains non-numeric values");
  }

  return embedding;
}

// Vision-based document analysis using Lovable AI
async function analyzeDocumentWithVision(imageBase64: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not found");

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

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: visionPrompt },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Vision analysis failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";

  // Clean and parse JSON response - with safe fallback
  let cleanContent = content.trim();
  if (cleanContent.startsWith("```json")) {
    cleanContent = cleanContent.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  }
  if (cleanContent.startsWith("```")) {
    cleanContent = cleanContent.replace(/```\n?/g, "");
  }

  try {
    return JSON.parse(cleanContent);
  } catch (parseError) {
    console.error("Vision JSON parse failed, returning text as content:", parseError);
    // Return the raw text as a section instead of crashing
    return {
      mode: "vision",
      sections: [{ heading: "Extracted Content", content: cleanContent }],
      concepts: [],
      problems: [],
      figures: [],
    };
  }
}

// Detect document type (text-based vs image-based)
function detectDocumentMode(arrayBuffer: ArrayBuffer, extractedText: string): string {
  // If extracted text is substantial, it's text-based
  if (extractedText.length >= 500) {
    return "text";
  }

  // If very little text extracted, likely image-based
  if (extractedText.length < 200) {
    return "vision";
  }

  // Mixed content
  return "hybrid";
}

// Convert structured vision output to text chunks
function structuredToText(structured: any): string {
  let text = "";

  // Add sections
  if (structured.sections && Array.isArray(structured.sections)) {
    for (const section of structured.sections) {
      if (section.heading) text += `\n\n${section.heading}\n`;
      if (section.content) text += section.content;
    }
  }

  // Add concepts
  if (structured.concepts && Array.isArray(structured.concepts)) {
    text += "\n\nKey Concepts:\n" + structured.concepts.join(", ");
  }

  // Add problems
  if (structured.problems && Array.isArray(structured.problems)) {
    text += "\n\nProblems:\n";
    for (const problem of structured.problems) {
      text += `\n${problem.number || ""} ${problem.question || ""} ${problem.data || ""}`;
    }
  }

  // Add figures
  if (structured.figures && Array.isArray(structured.figures)) {
    text += "\n\nFigures:\n";
    for (const fig of structured.figures) {
      text += `\n${fig.label || ""}: ${fig.meaning || ""}`;
    }
  }

  return text.trim();
}

// Count PDF pages
function countPDFPages(arrayBuffer: ArrayBuffer): number {
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
    const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
    return pageMatches ? pageMatches.length : 0;
  } catch {
    return 0;
  }
}

// Extract text from PDF (standard extraction only)
function extractPDFText(arrayBuffer: ArrayBuffer): string {
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);

    // Method 1: Extract text between parentheses (PDF text objects)
    const textMatches = text.match(/\(([^)]+)\)/g);
    let extracted = "";

    if (textMatches && textMatches.length > 0) {
      extracted = textMatches
        .map((match) => match.slice(1, -1))
        .join(" ")
        .replace(/\\[0-9]{3}/g, " ")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\/g, "")
        .trim();
    }

    // Method 2: Extract readable ASCII text if Method 1 didn't work
    if (extracted.length < 200) {
      const asciiText = text
        .replace(/[^\x20-\x7E\n\r\t]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (asciiText.length > extracted.length) {
        extracted = asciiText;
      }
    }

    return extracted;
  } catch (error) {
    console.error("PDF extraction error:", error);
    return "";
  }
}

// Run OCR on PDF with page-by-page processing
async function runOCR(arrayBuffer: ArrayBuffer, fileId: string, supabaseClient: any): Promise<string> {
  try {
    console.log("Starting OCR processing...");

    // Convert ArrayBuffer to Uint8Array for OCR processing
    const uint8Array = new Uint8Array(arrayBuffer);

    // Update status: processing
    await supabaseClient.from("uploaded_files").update({ processing: true }).eq("id", fileId);

    console.log("Running Tesseract OCR...");

    // Run Tesseract OCR
    const {
      data: { text },
    } = await Tesseract.recognize(uint8Array, "eng", {
      logger: (m: any) => {
        if (m.status === "recognizing text") {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    // Clean OCR text
    const cleanedText = cleanOCRText(text);

    console.log("OCR extracted text length:", cleanedText.length);

    // Update status: done processing
    await supabaseClient.from("uploaded_files").update({ processing: false }).eq("id", fileId);

    return cleanedText;
  } catch (error) {
    console.error("OCR error:", error);

    // Update status: done processing (failed)
    await supabaseClient.from("uploaded_files").update({ processing: false }).eq("id", fileId);

    return "";
  }
}

// Clean OCR text output
function cleanOCRText(text: string): string {
  return text
    .replace(/\u0000/g, "") // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control characters
    .replace(/\uFFFD/g, "") // Remove replacement characters
    .replace(/[\u{10000}-\u{10FFFF}]/gu, "") // Remove 4-byte UTF-8 characters
    .replace(/[*_#`~]/g, "") // Remove Markdown characters
    .replace(/\n{3,}/g, "\n\n") // Collapse multiple newlines
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // PRE-FLIGHT: Check environment
    const envCheck = validateEnvironment();
    if (!envCheck.valid) {
      console.error("Environment validation failed:", envCheck.error);
      return new Response(JSON.stringify({ error: envCheck.error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // PRE-FLIGHT: Validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileId } = requestBody;

    if (!fileId || typeof fileId !== "string") {
      return new Response(JSON.stringify({ error: "fileId is required and must be a string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("=== PARSE-DOCUMENT START ===");
    console.log("File ID:", fileId);

    // PRE-FLIGHT: Check if file exists in database
    const { data: fileData, error: fileError } = await supabaseClient
      .from("uploaded_files")
      .select("*")
      .eq("id", fileId)
      .maybeSingle();

    if (fileError) {
      console.error("Error fetching file:", fileError);
      return new Response(JSON.stringify({ error: `Database error: ${fileError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!fileData) {
      return new Response(JSON.stringify({ error: `File with ID ${fileId} not found in database` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("File metadata:", { name: fileData.file_name, type: fileData.file_type, size: fileData.file_size });

    // PRE-FLIGHT: Check if file exists in storage
    console.log("[parse-document] Downloading from storage:", fileData.file_path);

    const { data: fileBlob, error: downloadError } = await supabaseClient.storage
      .from("study-files")
      .download(fileData.file_path);

    if (downloadError) {
      console.error("[parse-document] Download FAILED:", downloadError.message);
      return new Response(JSON.stringify({ error: `Storage error: ${downloadError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[parse-document] Download SUCCESS, blob size:", fileBlob?.size);

    // =====================================================
    // DEV MODE: Generate mock data without calling AI APIs
    // =====================================================
    if (DEV_MODE) {
      console.log("DEV MODE ENABLED - Generating mock document data");

      const mockChunks = [
        "Cell Division Overview: Cell division is the process by which a parent cell divides into two or more daughter cells. There are two main types: mitosis and meiosis. Mitosis produces identical daughter cells for growth and repair. Meiosis produces gametes with half the chromosomes for sexual reproduction.",
        "Phases of Mitosis: The cell cycle includes interphase and mitotic phase. The four stages of mitosis are Prophase (chromosomes condense, nuclear envelope breaks down), Metaphase (chromosomes align at cell equator), Anaphase (sister chromatids separate), and Telophase (nuclear envelopes reform, chromosomes decondense).",
        "DNA Replication: Before cell division, DNA must be copied. Replication occurs during the S phase of interphase. The process is semi-conservative, meaning each new DNA molecule contains one original strand and one new strand. Key enzymes include helicase (unwinds DNA) and DNA polymerase (adds nucleotides).",
        "Chromosomes and Genes: Chromosomes are structures made of DNA and proteins. Humans have 46 chromosomes (23 pairs). Genes are segments of DNA that code for proteins. Alleles are different versions of the same gene. Homologous chromosomes carry genes for the same traits but may have different alleles.",
      ];

      const generateMockEmbedding = (seed: number): number[] => {
        const embedding: number[] = [];
        for (let i = 0; i < 1536; i++) {
          embedding.push(Math.sin(seed * (i + 1)) * Math.cos(i * 0.1));
        }
        return embedding;
      };

      // Delete old chunks first
      await supabaseClient.from("document_chunks").delete().eq("file_id", fileId);

      const chunkInserts = mockChunks.map((chunk, index) => ({
        file_id: fileId,
        collection_id: fileData.collection_id,
        user_id: fileData.user_id,
        chunk_text: chunk,
        embedding: JSON.stringify(generateMockEmbedding(index + 1)),
        chunk_index: index,
        metadata: { length: chunk.length, dev_mode: true },
      }));

      const { error: chunkError } = await supabaseClient.from("document_chunks").insert(chunkInserts);

      if (chunkError) {
        console.error("DEV MODE - Error inserting mock chunks:", chunkError);
      } else {
        console.log(`DEV MODE - Inserted ${chunkInserts.length} mock chunks with embeddings`);
      }

      const mockParsedContent = mockChunks.join("\n\n");

      await supabaseClient
        .from("uploaded_files")
        .update({ parsed_content: mockParsedContent, processing: false })
        .eq("id", fileId);

      return new Response(
        JSON.stringify({
          success: true,
          parsedContent: mockParsedContent,
          contentLength: mockParsedContent.length,
          chunksCreated: mockChunks.length,
          embeddingsGenerated: mockChunks.length,
          chunksInserted: mockChunks.length,
          message: "DEV MODE - Mock document data generated successfully",
          devMode: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // =====================================================
    // END DEV MODE BLOCK
    // =====================================================

    // Mark as processing
    await supabaseClient.from("uploaded_files").update({ processing: true }).eq("id", fileId);

    // Parse based on file type
    let parsedContent = "";
    let needsOCR = false;
    let documentMode = "text";
    let structuredData: any = null;
    const fileType = fileData.file_type.toLowerCase();

    try {
      if (fileType.includes("pptx")) {
        const text = await fileBlob.text();
        parsedContent = sanitizeText(text.substring(0, 5000));
        console.log("PPTX extracted (no OCR needed)");
      } else if (fileType.includes("pdf")) {
        const arrayBuffer = await fileBlob.arrayBuffer();
        const pageCount = countPDFPages(arrayBuffer);

        console.log(`PDF has ${pageCount} pages`);

        if (pageCount > 30) {
          parsedContent = extractPDFText(arrayBuffer);
          parsedContent = sanitizeText(parsedContent);

          if (parsedContent.length < 300) {
            parsedContent = "Slide deck too large for OCR — using standard extraction. Limited text found.";
          }
          console.log("Large PDF - OCR skipped");
        } else {
          parsedContent = extractPDFText(arrayBuffer);
          documentMode = detectDocumentMode(arrayBuffer, parsedContent);
          console.log(`Document mode detected: ${documentMode}`);

          if (documentMode === "vision" || (documentMode === "hybrid" && parsedContent.length < 500)) {
            console.log("Using vision-based analysis...");
            const uint8Array = new Uint8Array(arrayBuffer);
            const base64 = btoa(String.fromCharCode(...uint8Array));

            try {
              structuredData = await analyzeDocumentWithVision(base64);
              console.log("Vision analysis complete");
              parsedContent = structuredToText(structuredData);
              parsedContent = sanitizeText(parsedContent);

              if (parsedContent.length < 200) {
                parsedContent = "Document analyzed but minimal content extracted. Try a clearer image.";
              }
            } catch (visionError) {
              console.error("Vision analysis failed:", visionError);
              console.log("Falling back to OCR...");
              const ocrText = await runOCR(arrayBuffer, fileId, supabaseClient);
              parsedContent = sanitizeText(parsedContent + "\n\n" + ocrText);
            }
          } else {
            if (parsedContent.length >= 300) {
              parsedContent = sanitizeText(parsedContent);
              console.log("Standard extraction successful");
            } else {
              needsOCR = true;
              console.log("Text extraction < 300 chars, OCR needed");
              const ocrText = await runOCR(arrayBuffer, fileId, supabaseClient);
              const combinedText = `${parsedContent}\n\n${ocrText}`.trim();
              parsedContent = sanitizeText(combinedText);
              console.log("OCR processing complete");
            }
          }
        }
      } else if (fileType.includes("text") || fileType.includes("txt")) {
        parsedContent = await fileBlob.text();
        parsedContent = sanitizeText(parsedContent);
      } else if (fileType.includes("docx")) {
        const text = await fileBlob.text();
        parsedContent = sanitizeText(text.substring(0, 5000));
      } else if (fileType.includes("image")) {
        console.log("Processing image with vision analysis...");
        const arrayBuffer = await fileBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64 = btoa(String.fromCharCode(...uint8Array));

        try {
          structuredData = await analyzeDocumentWithVision(base64);
          parsedContent = structuredToText(structuredData);
          parsedContent = sanitizeText(parsedContent);
          documentMode = "vision";
        } catch (visionError) {
          console.error("Image vision analysis failed:", visionError);
          parsedContent = `Image file uploaded: ${fileData.file_name}. Vision analysis failed.`;
        }
      } else {
        parsedContent = `File uploaded: ${fileData.file_name}. Format: ${fileData.file_type}`;
      }
    } catch (parseError) {
      console.error("Parsing error:", parseError);
      parsedContent = `File uploaded but parsing encountered an error. File name: ${fileData.file_name}`;
    }

    parsedContent = sanitizeText(parsedContent);
    console.log("Parsed content length after sanitization:", parsedContent.length);

    // READABILITY GATE
    const contentIsReadable = isReadableText(parsedContent);
    console.log("isReadableText =", contentIsReadable);

    if (!contentIsReadable && !needsOCR && (fileType.includes("pdf") || fileType.includes("image"))) {
      console.log("Content unreadable, attempting OCR fallback...");
      try {
        const arrayBuffer = await fileBlob.arrayBuffer();
        const ocrText = await runOCR(arrayBuffer, fileId, supabaseClient);
        const sanitizedOCR = sanitizeText(ocrText);

        if (isReadableText(sanitizedOCR)) {
          console.log("OCR fallback succeeded");
          parsedContent = sanitizedOCR;
        } else {
          console.log("OCR fallback also failed readability check");
        }
      } catch (ocrError) {
        console.error("OCR fallback error:", ocrError);
      }
    }

    const finalReadable = isReadableText(parsedContent);
    console.log("Final readability =", finalReadable);

    // DELETE OLD CHUNKS
    const { error: deleteChunksError } = await supabaseClient.from("document_chunks").delete().eq("file_id", fileId);

    if (deleteChunksError) {
      console.error("Error deleting old chunks:", deleteChunksError);
    } else {
      console.log("Cleared any existing chunks for file");
    }

    // HANDLE UNREADABLE CONTENT
    if (!finalReadable) {
      console.log("Document unreadable - storing warning message, skipping chunks");

      const warningMessage = "Document unreadable — no real text detected. Try a clearer or text-based PDF.";

      await supabaseClient
        .from("uploaded_files")
        .update({ parsed_content: warningMessage, processing: false })
        .eq("id", fileId);

      return new Response(
        JSON.stringify({
          success: true,
          parsedContent: warningMessage,
          contentLength: warningMessage.length,
          readable: false,
          chunksCreated: 0,
          embeddingsGenerated: 0,
          chunksInserted: 0,
          message: "Document parsed but content was unreadable. No chunks created.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // =====================================================
    // CONTENT IS READABLE: Proceed with chunking and embeddings
    // CRITICAL: Enforce correct pipeline order:
    // 1. Extract text (done above)
    // 2. Sanitize text (done above)
    // 3. Chunk text
    // 4. Generate embedding (REQUIRED for each chunk)
    // 5. Insert chunk + embedding TOGETHER
    // =====================================================

    const MAX_LENGTH = 50000;
    if (parsedContent.length > MAX_LENGTH) {
      parsedContent =
        parsedContent.substring(0, MAX_LENGTH) +
        "\n\n[Content truncated for storage - full document available for AI analysis]";
    }

    if (parsedContent.includes("\u0000")) {
      console.error("Sanitization failed - null bytes still present");
      parsedContent = parsedContent.replace(/\u0000/g, "");
    }

    // STEP 3: Chunk the content
    const chunks = chunkText(parsedContent);
    console.log(`Created ${chunks.length} chunks from document`);

    // STEP 4 & 5: Generate embeddings and prepare inserts
    // CRITICAL: Only insert chunks that have valid embeddings
    // Prepare chunk inserts - embedding can be NULL if generation fails
    const chunkInserts: {
      file_id: string;
      collection_id: string;
      user_id: string;
      chunk_text: string;
      embedding: string | null;
      chunk_index: number;
      metadata: Record<string, unknown>;
    }[] = [];

    let embeddingSuccessCount = 0;
    let embeddingFailCount = 0;
    const embeddingFailureSamples: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Generating embedding for chunk ${i + 1}/${chunks.length}...`);

      let embedding: number[] | null = null;
      let embeddingFailed = false;
      let embeddingErrorStatus: number | undefined;
      let embeddingErrorMessage: string | undefined;

      try {
        embedding = await generateEmbedding(chunk);
        embeddingSuccessCount++;
        console.log(`Embedding SUCCESS for chunk ${i}, dimensions: ${embedding.length}`);
      } catch (embErr) {
        // Embedding failed - still insert chunk with NULL embedding
        embeddingFailCount++;
        embeddingFailed = true;

        embeddingErrorMessage = embErr instanceof Error ? embErr.message : String(embErr);

        if (embErr instanceof EmbeddingGatewayError) {
          embeddingErrorStatus = embErr.status;
          if (embErr.responseText) {
            const preview = embErr.responseText.substring(0, 200);
            embeddingErrorMessage = `${embeddingErrorMessage} - ${preview}`;
          }
        }

        console.error(`EMBEDDING FAILED for chunk ${i}:`, { 
          status: embeddingErrorStatus, 
          message: embeddingErrorMessage 
        });

        if (embeddingFailureSamples.length < 3) {
          embeddingFailureSamples.push(`[${embeddingErrorStatus ?? "unknown"}] ${embeddingErrorMessage}`);
        }
      }

      // Always insert the chunk - with or without embedding
      const metadata: Record<string, unknown> = { length: chunk.length };
      if (embeddingFailed) {
        metadata.embeddingFailed = true;
        if (embeddingErrorStatus) metadata.embeddingErrorStatus = embeddingErrorStatus;
        if (embeddingErrorMessage) metadata.embeddingErrorMessage = embeddingErrorMessage;
      } else if (embedding) {
        metadata.embeddingDimensions = embedding.length;
      }

      chunkInserts.push({
        file_id: fileId,
        collection_id: fileData.collection_id,
        user_id: fileData.user_id,
        chunk_text: chunk,
        embedding: embedding ? JSON.stringify(embedding) : null,
        chunk_index: i,
        metadata,
      });
    }

    console.log("=== EMBEDDING SUMMARY ===");
    console.log(`Chunks created: ${chunks.length}`);
    console.log(`Embeddings generated: ${embeddingSuccessCount}`);
    console.log(`Embeddings failed: ${embeddingFailCount}`);
    if (embeddingFailureSamples.length > 0) {
      console.log("Embedding failure samples:", embeddingFailureSamples);
    }

    // NOTE: We no longer abort if embeddings fail - chunks are always stored
    // This ensures the tutor can still work via fallback context retrieval

    // Insert chunks (only those with valid embeddings)
    let chunksInserted = 0;
    if (chunkInserts.length > 0) {
      const { error: chunkError } = await supabaseClient.from("document_chunks").insert(chunkInserts);

      if (chunkError) {
        console.error("Error inserting chunks:", chunkError);
        // This is a critical error - chunks with embeddings couldn't be saved
        return new Response(
          JSON.stringify({
            error: `Failed to insert chunks: ${chunkError.message}`,
            chunksCreated: chunks.length,
            embeddingsGenerated: embeddingSuccessCount,
            chunksInserted: 0,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } else {
        chunksInserted = chunkInserts.length;
        console.log(`Successfully inserted ${chunksInserted} chunks with embeddings`);
      }
    }

    // Store content in parsed_content for backward compatibility
    const summary = parsedContent.substring(0, 10000);

    const { error: updateError } = await supabaseClient
      .from("uploaded_files")
      .update({ parsed_content: summary, processing: false })
      .eq("id", fileId);

    if (updateError) {
      console.error("Error updating parsed content:", updateError);
      return new Response(
        JSON.stringify({
          error: `Failed to save parsed content: ${updateError.message}`,
          details: updateError.details || "No additional details",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("=== PARSE-DOCUMENT COMPLETE ===");
    console.log(`Final stats: ${chunksInserted} chunks inserted with embeddings`);

    // Build response - always success if we got here
    const responseData: Record<string, unknown> = {
      success: true,
      parsedContent: summary,
      contentLength: parsedContent.length,
      readable: true,
      chunksCreated: chunks.length,
      embeddingsGenerated: embeddingSuccessCount,
      embeddingsFailed: embeddingFailCount,
      chunksInserted: chunksInserted,
    };

    // Add warning if embeddings failed but parsing succeeded
    if (embeddingSuccessCount === 0 && chunks.length > 0) {
      responseData.warning = "Embeddings could not be generated (API unavailable). Semantic search will be limited, but the tutor can still use your content.";
      responseData.embeddingFailureSamples = embeddingFailureSamples;
      responseData.message = "Document parsed and saved. Semantic search unavailable.";
    } else if (embeddingFailCount > 0) {
      responseData.warning = `${embeddingFailCount} chunks have no embeddings due to API errors.`;
      responseData.message = `Document parsed. ${embeddingFailCount} chunks without embeddings.`;
    } else {
      responseData.message = "Document parsed and saved successfully";
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in parse-document function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({
        error: errorMessage,
        type: "PARSE_DOCUMENT_ERROR",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
