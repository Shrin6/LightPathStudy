import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const requiredVars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
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
    .replace(/\u0000/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/[\u{10000}-\u{10FFFF}]/gu, "")
    .trim();
}

// =====================================================
// READABILITY CHECK: For standard text extraction
// =====================================================
function isReadableText(text: string): boolean {
  const trimmed = text.trim();

  if (trimmed.length < 200) {
    console.log("isReadableText: FAIL - too short:", trimmed.length);
    return false;
  }

  const alphaMatches = trimmed.match(/[a-zA-Z]/g);
  const alphaCount = alphaMatches ? alphaMatches.length : 0;
  const alphaRatio = alphaCount / trimmed.length;

  if (alphaRatio < 0.3) {
    console.log("isReadableText: FAIL - low alpha ratio:", alphaRatio.toFixed(2));
    return false;
  }

  const junkPattern = /[^a-zA-Z0-9\s.,;:?!'"\-()]{15,}/;
  if (junkPattern.test(trimmed)) {
    console.log("isReadableText: FAIL - detected long junk run");
    return false;
  }

  const wordMatches = trimmed.match(/[a-zA-Z]{2,}/g);
  const wordCount = wordMatches ? wordMatches.length : 0;

  if (wordCount < 20) {
    console.log("isReadableText: FAIL - too few words:", wordCount);
    return false;
  }

  console.log("isReadableText: PASS - alphaRatio:", alphaRatio.toFixed(2), "wordCount:", wordCount);
  return true;
}

// =====================================================
// VISION READABILITY CHECK: More lenient for diagrams
// =====================================================
function isVisionContentReadable(text: string, docKind: string): boolean {
  const trimmed = text.trim();
  
  // For diagrams, we're more lenient - even 50 chars of explanation is valid
  const minLength = docKind === "DIAGRAM" || docKind === "CHART" ? 50 : 100;
  
  if (trimmed.length < minLength) {
    console.log(`isVisionContentReadable: FAIL - too short for ${docKind}:`, trimmed.length);
    return false;
  }

  // Check for some alphabetic content
  const alphaMatches = trimmed.match(/[a-zA-Z]/g);
  const alphaCount = alphaMatches ? alphaMatches.length : 0;
  
  if (alphaCount < 20) {
    console.log("isVisionContentReadable: FAIL - too few letters:", alphaCount);
    return false;
  }

  console.log(`isVisionContentReadable: PASS - docKind=${docKind}, length=${trimmed.length}`);
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

  // For vision content, allow smaller chunks (50+ chars)
  return chunks.filter((c) => c.length >= 50);
}

// =====================================================
// EMBEDDING GENERATION using OpenRouter API
// =====================================================
const OPENROUTER_EMBEDDING_ENDPOINT = "https://openrouter.ai/api/v1/embeddings";
const OPENROUTER_EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EXPECTED_EMBEDDING_DIMS = 1536;

let embeddingsAvailable: boolean | null = null;

class EmbeddingError extends Error {
  status: number;
  responseText?: string;

  constructor(status: number, message: string, responseText?: string) {
    super(message);
    this.name = "EmbeddingError";
    this.status = status;
    this.responseText = responseText;
  }
}

async function checkEmbeddingCapability(): Promise<boolean> {
  if (embeddingsAvailable !== null) return embeddingsAvailable;

  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OPENROUTER_API_KEY) {
    console.log("EMBEDDINGS_CHECK: No OPENROUTER_API_KEY - embeddings disabled");
    embeddingsAvailable = false;
    return false;
  }

  try {
    console.log("EMBEDDINGS_CHECK: Testing OpenRouter embeddings endpoint...");
    const testResponse = await fetch(OPENROUTER_EMBEDDING_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://studybuddy.lovable.app",
        "X-Title": "StudyBuddy",
      },
      body: JSON.stringify({
        model: OPENROUTER_EMBEDDING_MODEL,
        input: "test embedding capability",
      }),
    });

    const responseText = await testResponse.text();
    console.log("EMBEDDINGS_CHECK status:", testResponse.status);
    console.log("EMBEDDINGS_CHECK response preview:", responseText.substring(0, 300));

    if (!testResponse.ok) {
      console.log("EMBEDDINGS_CHECK: OpenRouter returned error - embeddings disabled");
      embeddingsAvailable = false;
      return false;
    }

    try {
      const data = JSON.parse(responseText);
      const testEmbedding = data?.data?.[0]?.embedding;
      if (Array.isArray(testEmbedding) && testEmbedding.length > 0) {
        console.log(`EMBEDDINGS_CHECK: SUCCESS! Got ${testEmbedding.length}-dim embedding`);
        embeddingsAvailable = true;
        return true;
      }
    } catch (e) {
      console.warn("EMBEDDINGS_CHECK: Failed to parse response:", e);
    }

    embeddingsAvailable = false;
    return false;
  } catch (err) {
    console.warn("EMBEDDINGS_CHECK: Error during capability check:", err);
    embeddingsAvailable = false;
    return false;
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  if (embeddingsAvailable === false) {
    throw new EmbeddingError(400, "Embeddings not available (OpenRouter not configured or failed)");
  }

  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not found");

  const response = await fetch(OPENROUTER_EMBEDDING_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://studybuddy.lovable.app",
      "X-Title": "StudyBuddy",
    },
    body: JSON.stringify({
      model: OPENROUTER_EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.warn("OpenRouter embedding error:", response.status, (errorText || "").substring(0, 200));
    throw new EmbeddingError(response.status, `Embedding generation failed: ${response.status}`, errorText);
  }

  const data = await response.json();
  const embedding = data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Invalid embedding response: embedding is missing or empty");
  }

  if (!embedding.every((v: unknown) => typeof v === "number")) {
    throw new Error("Invalid embedding response: embedding contains non-numeric values");
  }

  console.log(`Generated embedding with ${embedding.length} dimensions`);
  return embedding;
}

// =====================================================
// Vision-based document analysis using Lovable AI
// Returns structured JSON for both text pages and diagrams
// =====================================================
async function analyzeDocumentWithVision(imageBase64: string, mimeType: string = "image/jpeg"): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not found");

  console.log("parse-document: IMAGE_VISION → calling vision API");

  const visionPrompt = `You are a document and image analysis assistant.

Analyze the provided image and determine what type of content it contains.

Return ONLY valid JSON with this exact structure:
{
  "mode": "vision",
  "doc_kind": "TEXT_PAGE" | "DIAGRAM" | "CHART" | "MIXED",
  "title": "",
  "sections": [{"heading": "", "content": ""}],
  "figures": [{"label": "", "what_it_shows": "", "key_takeaway": ""}],
  "concepts": ["", ""],
  "questions_found": [{"question": "", "answer_choices": ""}]
}

Rules based on content type:

IF IT'S MOSTLY TEXT (doc_kind="TEXT_PAGE"):
- Extract ALL visible text exactly as written
- Put the text into sections[].content
- Preserve headings, lists, formulas, tables
- Keep math symbols, units, punctuation exactly
- If questions/problems are visible, add them to questions_found

IF IT'S A DIAGRAM (doc_kind="DIAGRAM"):
- Identify all labels, arrows, connections
- Describe what the diagram shows in sections[0].content
- Add each labeled component to figures[] with what_it_shows and key_takeaway
- Extract key concepts shown
- Explain the relationships between components

IF IT'S A CHART/GRAPH (doc_kind="CHART"):
- Identify the chart type and axes
- Extract data labels and values
- Explain what the chart represents in sections[0].content
- Add figure entries for important data points

IF IT'S MIXED (doc_kind="MIXED"):
- Extract both the text and describe the figures
- Fill both sections and figures arrays

CRITICAL:
- Return ONLY valid JSON, no markdown, no explanation outside JSON
- Do not refuse or say "not enough information"
- Always provide some content - even if image is unclear, describe what IS visible`;

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
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("Vision API error:", response.status, errorText.substring(0, 200));
    throw new Error(`Vision analysis failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Parse JSON from response
  let cleanContent = content.trim();
  if (cleanContent.startsWith("```json")) {
    cleanContent = cleanContent.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  }
  if (cleanContent.startsWith("```")) {
    cleanContent = cleanContent.replace(/```\n?/g, "");
  }

  try {
    const parsed = JSON.parse(cleanContent);
    console.log(`parse-document: vision doc_kind=${parsed.doc_kind || "unknown"}`);
    return parsed;
  } catch (parseError) {
    console.error("Vision JSON parse failed, wrapping raw content:", parseError);
    // Return raw content as a section if JSON parsing fails
    return {
      mode: "vision",
      doc_kind: "TEXT_PAGE",
      title: "",
      sections: [{ heading: "Extracted Content", content: cleanContent }],
      figures: [],
      concepts: [],
      questions_found: [],
    };
  }
}

// Detect document type (text-based vs image-based)
function detectDocumentMode(arrayBuffer: ArrayBuffer, extractedText: string): string {
  if (extractedText.length >= 500) {
    return "text";
  }
  if (extractedText.length < 200) {
    return "vision";
  }
  return "hybrid";
}

// Convert structured vision output to text chunks
function structuredToText(structured: any): string {
  let text = "";
  const docKind = structured.doc_kind || "TEXT_PAGE";

  // Add title if present
  if (structured.title) {
    text += `${structured.title}\n\n`;
  }

  // Add sections
  if (structured.sections && Array.isArray(structured.sections)) {
    for (const section of structured.sections) {
      if (section.heading) text += `\n\n${section.heading}\n`;
      if (section.content) text += section.content;
    }
  }

  // Add figures (for diagrams/charts)
  if (structured.figures && Array.isArray(structured.figures) && structured.figures.length > 0) {
    text += "\n\nFigures and Components:\n";
    for (const fig of structured.figures) {
      if (fig.label) {
        text += `\n• ${fig.label}`;
        if (fig.what_it_shows) text += `: ${fig.what_it_shows}`;
        if (fig.key_takeaway) text += ` (Key point: ${fig.key_takeaway})`;
      }
    }
  }

  // Add concepts
  if (structured.concepts && Array.isArray(structured.concepts) && structured.concepts.length > 0) {
    const validConcepts = structured.concepts.filter((c: string) => c && c.trim());
    if (validConcepts.length > 0) {
      text += "\n\nKey Concepts: " + validConcepts.join(", ");
    }
  }

  // Add questions found
  if (structured.questions_found && Array.isArray(structured.questions_found) && structured.questions_found.length > 0) {
    text += "\n\nQuestions Found:\n";
    for (const q of structured.questions_found) {
      if (q.question) {
        text += `\n• ${q.question}`;
        if (q.answer_choices) text += ` [${q.answer_choices}]`;
      }
    }
  }

  // Legacy support for old format
  if (structured.problems && Array.isArray(structured.problems) && structured.problems.length > 0) {
    text += "\n\nProblems:\n";
    for (const problem of structured.problems) {
      text += `\n${problem.number || ""} ${problem.question || ""} ${problem.data || ""}`;
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

// =====================================================
// PPTX TEXT EXTRACTION: ZIP → slide XML → <a:t> text runs
// =====================================================
async function extractPptxText(uint8Array: Uint8Array): Promise<string> {
  const slides: { slideNum: number; text: string }[] = [];
  let offset = 0;
  const data = uint8Array;
  const dataLength = data.length;

  console.log(`extractPptxText: Starting extraction, file size: ${dataLength} bytes`);

  // Walk through ZIP local file headers
  while (offset < dataLength - 30) {
    // Check for local file header signature: 0x04034B50 (little-endian: 50 4B 03 04)
    if (data[offset] !== 0x50 || data[offset + 1] !== 0x4B || 
        data[offset + 2] !== 0x03 || data[offset + 3] !== 0x04) {
      offset++;
      continue;
    }

    // Parse local file header
    const compressionMethod = data[offset + 8] | (data[offset + 9] << 8);
    const compressedSize = data[offset + 18] | (data[offset + 19] << 8) | 
                          (data[offset + 20] << 16) | (data[offset + 21] << 24);
    const uncompressedSize = data[offset + 22] | (data[offset + 23] << 8) | 
                            (data[offset + 24] << 16) | (data[offset + 25] << 24);
    const fileNameLength = data[offset + 26] | (data[offset + 27] << 8);
    const extraFieldLength = data[offset + 28] | (data[offset + 29] << 8);

    if (fileNameLength === 0 || fileNameLength > 500) {
      offset++;
      continue;
    }

    const fileNameBytes = data.subarray(offset + 30, offset + 30 + fileNameLength);
    const fileName = new TextDecoder("utf-8", { fatal: false }).decode(fileNameBytes);
    
    const dataStart = offset + 30 + fileNameLength + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    // Check if this is a slide XML file (ppt/slides/slide<N>.xml)
    const slideMatch = fileName.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    
    if (slideMatch && dataEnd <= dataLength) {
      const slideNum = parseInt(slideMatch[1], 10);
      const compressedData = data.subarray(dataStart, dataEnd);
      
      console.log(`extractPptxText: Found slide xml: ${fileName}, compression: ${compressionMethod}, bytes: ${compressedSize}`);

      try {
        let xmlContent: string;

        if (compressionMethod === 0) {
          // Stored (no compression)
          xmlContent = new TextDecoder("utf-8", { fatal: false }).decode(compressedData);
        } else if (compressionMethod === 8) {
          // Deflate compression
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          const reader = ds.readable.getReader();
          
          writer.write(new Uint8Array(compressedData));
          writer.close();
          
          const chunks: Uint8Array[] = [];
          let done = false;
          while (!done) {
            const result = await reader.read();
            if (result.done) {
              done = true;
            } else {
              chunks.push(result.value);
            }
          }
          
          const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
          const decompressed = new Uint8Array(totalLength);
          let pos = 0;
          for (const chunk of chunks) {
            decompressed.set(chunk, pos);
            pos += chunk.length;
          }
          
          xmlContent = new TextDecoder("utf-8", { fatal: false }).decode(decompressed);
        } else {
          console.log(`extractPptxText: Unsupported compression method ${compressionMethod} for ${fileName}`);
          offset = dataEnd;
          continue;
        }

        // Extract text from <a:t> tags
        const textRuns: string[] = [];
        const atMatches = xmlContent.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g);
        for (const match of atMatches) {
          const text = match[1].trim();
          if (text) {
            textRuns.push(text);
          }
        }

        if (textRuns.length > 0) {
          slides.push({ slideNum, text: textRuns.join(" ") });
        }
      } catch (decompressionError) {
        console.warn(`extractPptxText: Failed to decompress ${fileName}:`, decompressionError);
      }
    }

    // Move to next entry
    offset = dataEnd > offset ? dataEnd : offset + 1;
  }

  // Sort slides by number and join
  slides.sort((a, b) => a.slideNum - b.slideNum);
  const fullText = slides.map(s => `[Slide ${s.slideNum}]\n${s.text}`).join("\n\n");
  
  console.log(`extractPptxText: Extracted slides: ${slides.length}, total text length: ${fullText.length}`);
  
  return fullText;
}

// =====================================================
// DOCX TEXT EXTRACTION: ZIP → document.xml → <w:t> text runs
// =====================================================
async function extractDocxText(uint8Array: Uint8Array): Promise<string> {
  let offset = 0;
  const data = uint8Array;
  const dataLength = data.length;

  console.log(`extractDocxText: Starting extraction, file size: ${dataLength} bytes`);

  // Walk through ZIP local file headers
  while (offset < dataLength - 30) {
    // Check for local file header signature
    if (data[offset] !== 0x50 || data[offset + 1] !== 0x4B || 
        data[offset + 2] !== 0x03 || data[offset + 3] !== 0x04) {
      offset++;
      continue;
    }

    const compressionMethod = data[offset + 8] | (data[offset + 9] << 8);
    const compressedSize = data[offset + 18] | (data[offset + 19] << 8) | 
                          (data[offset + 20] << 16) | (data[offset + 21] << 24);
    const fileNameLength = data[offset + 26] | (data[offset + 27] << 8);
    const extraFieldLength = data[offset + 28] | (data[offset + 29] << 8);

    if (fileNameLength === 0 || fileNameLength > 500) {
      offset++;
      continue;
    }

    const fileNameBytes = data.subarray(offset + 30, offset + 30 + fileNameLength);
    const fileName = new TextDecoder("utf-8", { fatal: false }).decode(fileNameBytes);
    
    const dataStart = offset + 30 + fileNameLength + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    // Look for word/document.xml
    if (fileName === "word/document.xml" && dataEnd <= dataLength) {
      const compressedData = data.subarray(dataStart, dataEnd);
      
      console.log(`extractDocxText: Found document.xml, compression: ${compressionMethod}, bytes: ${compressedSize}`);

      try {
        let xmlContent: string;

        if (compressionMethod === 0) {
          xmlContent = new TextDecoder("utf-8", { fatal: false }).decode(compressedData);
        } else if (compressionMethod === 8) {
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          const reader = ds.readable.getReader();
          
          writer.write(new Uint8Array(compressedData));
          writer.close();
          
          const chunks: Uint8Array[] = [];
          let done = false;
          while (!done) {
            const result = await reader.read();
            if (result.done) {
              done = true;
            } else {
              chunks.push(result.value);
            }
          }
          
          const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
          const decompressed = new Uint8Array(totalLength);
          let pos = 0;
          for (const chunk of chunks) {
            decompressed.set(chunk, pos);
            pos += chunk.length;
          }
          
          xmlContent = new TextDecoder("utf-8", { fatal: false }).decode(decompressed);
        } else {
          console.log(`extractDocxText: Unsupported compression method ${compressionMethod}`);
          return "";
        }

        // Extract text from <w:t> tags with paragraph breaks
        const paragraphs: string[] = [];
        const pMatches = xmlContent.matchAll(/<w:p[^>]*>([\s\S]*?)<\/w:p>/g);
        
        for (const pMatch of pMatches) {
          const pContent = pMatch[1];
          const textRuns: string[] = [];
          const wtMatches = pContent.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
          for (const tMatch of wtMatches) {
            textRuns.push(tMatch[1]);
          }
          if (textRuns.length > 0) {
            paragraphs.push(textRuns.join(""));
          }
        }

        const fullText = paragraphs.join("\n\n");
        console.log(`extractDocxText: Extracted paragraphs: ${paragraphs.length}, total text length: ${fullText.length}`);
        return fullText;
      } catch (decompressionError) {
        console.warn(`extractDocxText: Failed to decompress document.xml:`, decompressionError);
        return "";
      }
    }

    offset = dataEnd > offset ? dataEnd : offset + 1;
  }

  console.log("extractDocxText: document.xml not found in DOCX");
  return "";
}

// Get MIME type for images
function getImageMimeType(fileType: string): string {
  if (fileType.includes("png")) return "image/png";
  if (fileType.includes("gif")) return "image/gif";
  if (fileType.includes("webp")) return "image/webp";
  if (fileType.includes("bmp")) return "image/bmp";
  return "image/jpeg";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const envCheck = validateEnvironment();
    if (!envCheck.valid) {
      console.error("Environment validation failed:", envCheck.error);
      return new Response(JSON.stringify({ error: envCheck.error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

    // DEV MODE: Generate mock data
    if (DEV_MODE) {
      console.log("DEV MODE ENABLED - Generating mock document data");

      const mockChunks = [
        "Cell Division Overview: Cell division is the process by which a parent cell divides into two or more daughter cells.",
        "Phases of Mitosis: The four stages are Prophase, Metaphase, Anaphase, and Telophase.",
        "DNA Replication: Before cell division, DNA must be copied during the S phase of interphase.",
        "Chromosomes and Genes: Humans have 46 chromosomes (23 pairs). Genes are segments of DNA.",
      ];

      const generateMockEmbedding = (seed: number): number[] => {
        const embedding: number[] = [];
        for (let i = 0; i < 1536; i++) {
          embedding.push(Math.sin(seed * (i + 1)) * Math.cos(i * 0.1));
        }
        return embedding;
      };

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

    // Mark as processing
    await supabaseClient.from("uploaded_files").update({ processing: true }).eq("id", fileId);

    // Parse based on file type
    let parsedContent = "";
    let documentMode = "text";
    let structuredData: any = null;
    let docKind = "TEXT_PAGE";
    const fileType = fileData.file_type.toLowerCase();

  try {
      if (fileType.includes("pptx") || fileType.includes("presentationml")) {
        // =====================================================
        // PPTX PARSING: Extract text from ZIP → slide XML
        // =====================================================
        console.log("parse-document: Processing PPTX with native ZIP extraction...");
        const arrayBuffer = await fileBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        try {
          const extractedText = await extractPptxText(uint8Array);
          parsedContent = sanitizeText(extractedText);
          console.log(`parse-document: PPTX extracted length after sanitize: ${parsedContent.length}`);
          
          if (parsedContent.length < 50) {
            parsedContent = "PPTX contains no extractable text (may be images-only). For best results, export slides to PDF or upload slide images directly.";
            console.log("parse-document: PPTX appears to be images-only");
          }
        } catch (pptxError) {
          console.error("parse-document: PPTX extraction failed:", pptxError);
          parsedContent = `PPTX parsing encountered an error: ${pptxError instanceof Error ? pptxError.message : "Unknown error"}. Try exporting to PDF.`;
        }
      } else if (fileType.includes("pdf")) {
        const arrayBuffer = await fileBlob.arrayBuffer();
        const pageCount = countPDFPages(arrayBuffer);

        console.log(`PDF has ${pageCount} pages`);

        if (pageCount > 30) {
          parsedContent = extractPDFText(arrayBuffer);
          parsedContent = sanitizeText(parsedContent);

          if (parsedContent.length < 300) {
            parsedContent = "Large PDF with limited extractable text. Try uploading individual pages as images for better results.";
          }
          console.log("Large PDF - standard extraction only");
        } else {
          parsedContent = extractPDFText(arrayBuffer);
          documentMode = detectDocumentMode(arrayBuffer, parsedContent);
          console.log(`Document mode detected: ${documentMode}`);

          if (documentMode === "vision" || (documentMode === "hybrid" && parsedContent.length < 500)) {
            // For scanned PDFs, we cannot reliably convert to image
            // Store a helpful message instead
            console.log("Scanned/image-based PDF detected - image rendering not supported");
            parsedContent = "This appears to be a scanned or image-based PDF. For best results, please upload the pages as individual images (PNG/JPG). The system can analyze images directly with vision AI.";
            docKind = "TEXT_PAGE";
          } else {
            if (parsedContent.length >= 300) {
              parsedContent = sanitizeText(parsedContent);
              console.log("Standard extraction successful");
            } else {
              // Low text content but not image-based - just use what we have
              parsedContent = sanitizeText(parsedContent);
              if (parsedContent.length < 50) {
                parsedContent = "PDF has minimal extractable text. If this is a scanned document, try uploading as images.";
              }
            }
          }
        }
      } else if (fileType.includes("text") || fileType.includes("txt")) {
        parsedContent = await fileBlob.text();
        parsedContent = sanitizeText(parsedContent);
      } else if (fileType.includes("docx") || fileType.includes("wordprocessingml")) {
        // =====================================================
        // DOCX PARSING: Extract text from ZIP → document.xml
        // =====================================================
        console.log("parse-document: Processing DOCX with native ZIP extraction...");
        const arrayBuffer = await fileBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        try {
          const extractedText = await extractDocxText(uint8Array);
          parsedContent = sanitizeText(extractedText);
          console.log(`parse-document: DOCX extracted length after sanitize: ${parsedContent.length}`);
          
          if (parsedContent.length < 50) {
            parsedContent = "DOCX contains no extractable text. The document may be empty or contain only images.";
          }
        } catch (docxError) {
          console.error("parse-document: DOCX extraction failed:", docxError);
          parsedContent = `DOCX parsing encountered an error: ${docxError instanceof Error ? docxError.message : "Unknown error"}.`;
        }
      } else if (fileType.includes("image")) {
        // =====================================================
        // IMAGE PROCESSING: Use Vision API (NO Tesseract)
        // =====================================================
        console.log("parse-document: Processing IMAGE with vision analysis...");
        const arrayBuffer = await fileBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convert to base64 safely (handle large files)
        let base64 = "";
        const chunkSize = 32768;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, i + chunkSize);
          base64 += String.fromCharCode.apply(null, Array.from(chunk));
        }
        base64 = btoa(base64);

        const mimeType = getImageMimeType(fileType);
        console.log(`parse-document: Image MIME type: ${mimeType}, base64 length: ${base64.length}`);

        try {
          structuredData = await analyzeDocumentWithVision(base64, mimeType);
          docKind = structuredData.doc_kind || "TEXT_PAGE";
          parsedContent = structuredToText(structuredData);
          parsedContent = sanitizeText(parsedContent);
          documentMode = "vision";
          
          console.log(`parse-document: vision doc_kind=${docKind}, text length=${parsedContent.length}`);
        } catch (visionError) {
          console.error("parse-document: Image vision analysis failed:", visionError);
          parsedContent = `Image uploaded: ${fileData.file_name}. Vision analysis encountered an error. Please try re-uploading or use a different image format.`;
          docKind = "TEXT_PAGE";
        }
      } else {
        parsedContent = `File uploaded: ${fileData.file_name}. Format: ${fileData.file_type}`;
      }
    } catch (parseError) {
      console.error("Parsing error:", parseError);
      parsedContent = `File uploaded but parsing encountered an error. File name: ${fileData.file_name}`;
    }

    parsedContent = sanitizeText(parsedContent);
    console.log("parse-document: Parsed content length after sanitization:", parsedContent.length);

    // READABILITY GATE - use appropriate check based on mode
    let contentIsReadable: boolean;
    
    if (documentMode === "vision") {
      contentIsReadable = isVisionContentReadable(parsedContent, docKind);
      console.log(`isVisionContentReadable = ${contentIsReadable} (docKind=${docKind})`);
    } else {
      contentIsReadable = isReadableText(parsedContent);
      console.log("isReadableText =", contentIsReadable);
    }

    // DELETE OLD CHUNKS
    const { error: deleteChunksError } = await supabaseClient.from("document_chunks").delete().eq("file_id", fileId);

    if (deleteChunksError) {
      console.error("Error deleting old chunks:", deleteChunksError);
    } else {
      console.log("Cleared any existing chunks for file");
    }

    // HANDLE UNREADABLE CONTENT - but be more lenient for images
    if (!contentIsReadable) {
      console.log("parse-document: Content below readability threshold");
      
      // For images, store whatever we got instead of a generic warning
      let finalContent = parsedContent;
      if (documentMode === "vision" && parsedContent.length > 20) {
        // Keep the vision output even if short
        finalContent = parsedContent;
        console.log("parse-document: Keeping short vision content");
      } else if (parsedContent.length < 20) {
        finalContent = "Document could not be parsed. Please try a clearer image or text-based document.";
      }

      await supabaseClient
        .from("uploaded_files")
        .update({ parsed_content: finalContent, processing: false })
        .eq("id", fileId);

      // Still try to create chunks if we have some content
      if (finalContent.length >= 50) {
        const chunks = chunkText(finalContent);
        if (chunks.length > 0) {
          const chunkInserts = chunks.map((chunk, index) => ({
            file_id: fileId,
            collection_id: fileData.collection_id,
            user_id: fileData.user_id,
            chunk_text: chunk,
            embedding: null,
            chunk_index: index,
            metadata: { length: chunk.length, vision_mode: documentMode === "vision", doc_kind: docKind },
          }));

          const { error: insertError } = await supabaseClient.from("document_chunks").insert(chunkInserts);
          if (!insertError) {
            console.log(`parse-document: Inserted ${chunks.length} chunks (no embeddings) for short content`);
          }
        }
      }

      console.log(`parse-document: stored parsed_content length=${finalContent.length}`);

      return new Response(
        JSON.stringify({
          success: true,
          parsedContent: finalContent,
          contentLength: finalContent.length,
          readable: false,
          documentMode,
          docKind,
          chunksCreated: 0,
          embeddingsGenerated: 0,
          chunksInserted: 0,
          message: "Document parsed with limited content.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // =====================================================
    // CONTENT IS READABLE: Proceed with chunking and embeddings
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
    console.log(`parse-document: Created ${chunks.length} chunks from document`);

    // STEP 4: Check if embeddings are available
    const canGenerateEmbeddings = await checkEmbeddingCapability();
    console.log("Embedding capability:", canGenerateEmbeddings ? "AVAILABLE" : "NOT AVAILABLE (skipping)");

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

      let embedding: number[] | null = null;
      let embeddingFailed = false;
      let embeddingErrorStatus: number | undefined;
      let embeddingErrorMessage: string | undefined;

      if (canGenerateEmbeddings) {
        console.log(`Generating embedding for chunk ${i + 1}/${chunks.length}...`);
        try {
          embedding = await generateEmbedding(chunk);
          if (embedding.length !== EXPECTED_EMBEDDING_DIMS) {
            throw new Error(
              `Embedding dimension mismatch: expected ${EXPECTED_EMBEDDING_DIMS}, got ${embedding.length}`,
            );
          }
          embeddingSuccessCount++;
          console.log(`Embedding SUCCESS for chunk ${i}, dimensions: ${embedding.length}`);
        } catch (embErr) {
          embeddingFailCount++;
          embeddingFailed = true;
          embedding = null;
          embeddingErrorMessage = embErr instanceof Error ? embErr.message : String(embErr);

          if (embErr instanceof EmbeddingError) {
            embeddingErrorStatus = embErr.status;
            if (embErr.responseText) {
              embeddingErrorMessage = `${embeddingErrorMessage} - ${embErr.responseText.substring(0, 200)}`;
            }
          }

          console.error(`EMBEDDING FAILED for chunk ${i}:`, { status: embeddingErrorStatus, message: embeddingErrorMessage });

          if (embeddingFailureSamples.length < 3) {
            embeddingFailureSamples.push(`[${embeddingErrorStatus ?? "unknown"}] ${embeddingErrorMessage}`);
          }
        }
      } else {
        embeddingFailed = true;
        embeddingErrorMessage = "Embeddings not available (gateway does not support)";
      }

      const metadata: Record<string, unknown> = { 
        length: chunk.length,
        vision_mode: documentMode === "vision",
        doc_kind: docKind,
      };

      if (embeddingFailed) {
        metadata.embedding_status = "failed";
        metadata.embedding_error = (embeddingErrorMessage || "Embedding failed").substring(0, 200);
        metadata.embeddingFailed = true;
        if (embeddingErrorStatus) metadata.embeddingErrorStatus = embeddingErrorStatus;
        if (embeddingErrorMessage) metadata.embeddingErrorMessage = embeddingErrorMessage;
      } else if (embedding) {
        metadata.embedding_status = "ok";
        metadata.embeddingDimensions = embedding.length;
      }

      chunkInserts.push({
        file_id: fileId,
        collection_id: fileData.collection_id,
        user_id: fileData.user_id,
        chunk_text: chunk,
        embedding: embedding ? `[${embedding.join(",")}]` : null,
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

    // Insert chunks
    let chunksInserted = 0;
    if (chunkInserts.length > 0) {
      const { error: chunkError } = await supabaseClient.from("document_chunks").insert(chunkInserts);

      if (chunkError) {
        console.error("Error inserting chunks:", chunkError);

        try {
          await supabaseClient
            .from("uploaded_files")
            .update({ parsed_content: parsedContent.substring(0, 10000), processing: false })
            .eq("id", fileId);
        } catch (e) {
          console.error("Failed to persist partial data:", e);
        }

        return new Response(
          JSON.stringify({
            error: `Failed to insert document chunks: ${chunkError.message}`,
            parsedContent: parsedContent.substring(0, 500),
            embeddingSuccessCount,
            embeddingFailCount,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      chunksInserted = chunkInserts.length;
      console.log(`Successfully inserted ${chunksInserted} chunks (embeddings best-effort)`);
    }

    // Update uploaded_files with parsed content
    const { error: updateError } = await supabaseClient
      .from("uploaded_files")
      .update({ parsed_content: parsedContent, processing: false })
      .eq("id", fileId);

    if (updateError) {
      console.error("Error updating parsed_content:", updateError);
    }

    console.log(`parse-document: stored parsed_content length=${parsedContent.length}, chunks created=${chunksInserted}`);
    console.log("=== PARSE-DOCUMENT COMPLETE ===");
    console.log(`Final stats: ${embeddingSuccessCount} chunks inserted with embeddings`);

    return new Response(
      JSON.stringify({
        success: true,
        parsedContent: parsedContent.substring(0, 1000),
        contentLength: parsedContent.length,
        readable: true,
        documentMode,
        docKind,
        chunksCreated: chunks.length,
        embeddingsGenerated: embeddingSuccessCount,
        embeddingsFailed: embeddingFailCount,
        chunksInserted,
        message:
          embeddingFailCount > 0
            ? `Parsed and chunked. ${embeddingSuccessCount}/${chunks.length} embeddings generated.`
            : "Document parsed, chunked, and embeddings generated successfully.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("=== PARSE-DOCUMENT ERROR ===");
    console.error(error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error during document parsing",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
