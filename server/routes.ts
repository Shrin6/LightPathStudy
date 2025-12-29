import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 },
});

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      displayName?: string | null;
      avatarUrl?: string | null;
    }
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export function registerRoutes(app: Express): void {
  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.json({ user: null });
    }
  });

  app.get("/api/collections", requireAuth, async (req, res) => {
    try {
      const collections = await storage.getCollections(req.user!.id);
      const collectionsWithFiles = await Promise.all(
        collections.map(async (c) => {
          const files = await storage.getUploadedFiles(c.id);
          return { ...c, uploaded_files: files };
        })
      );
      res.json({ collections: collectionsWithFiles });
    } catch (error) {
      console.error("Get collections error:", error);
      res.status(500).json({ error: "Failed to get collections" });
    }
  });

  app.post("/api/collections", requireAuth, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Collection name is required" });
      }
      const collection = await storage.createCollection({
        name: name.trim(),
        userId: req.user!.id,
      });
      res.json({ collection });
    } catch (error) {
      console.error("Create collection error:", error);
      res.status(500).json({ error: "Failed to create collection" });
    }
  });

  app.delete("/api/collections/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteCollection(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete collection error:", error);
      res.status(500).json({ error: "Failed to delete collection" });
    }
  });

  app.get("/api/collections/:id/files", requireAuth, async (req, res) => {
    try {
      const files = await storage.getUploadedFiles(req.params.id);
      res.json({ files });
    } catch (error) {
      console.error("Get files error:", error);
      res.status(500).json({ error: "Failed to get files" });
    }
  });

  app.post("/api/collections/:collectionId/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { collectionId } = req.params;
      const collection = await storage.getCollection(collectionId);
      if (!collection || collection.userId !== req.user!.id) {
        return res.status(404).json({ error: "Collection not found" });
      }

      const uploadedFile = await storage.createUploadedFile({
        collectionId,
        userId: req.user!.id,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        processing: true,
      });

      res.json({ file: uploadedFile });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.delete("/api/files/:id", requireAuth, async (req, res) => {
    try {
      const file = await storage.getUploadedFile(req.params.id);
      if (!file || file.userId !== req.user!.id) {
        return res.status(404).json({ error: "File not found" });
      }
      
      await storage.deleteDocumentChunksByFile(req.params.id);
      await storage.deleteUploadedFile(req.params.id, req.user!.id);
      
      if (file.filePath && fs.existsSync(file.filePath)) {
        fs.unlinkSync(file.filePath);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete file error:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  app.get("/api/collections/:id/flashcards", requireAuth, async (req, res) => {
    try {
      const flashcards = await storage.getFlashcards(req.params.id);
      res.json({ flashcards });
    } catch (error) {
      console.error("Get flashcards error:", error);
      res.status(500).json({ error: "Failed to get flashcards" });
    }
  });

  app.post("/api/flashcards", requireAuth, async (req, res) => {
    try {
      const { collectionId, front, back } = req.body;
      const flashcard = await storage.createFlashcard({
        collectionId,
        userId: req.user!.id,
        front,
        back,
      });
      res.json({ flashcard });
    } catch (error) {
      console.error("Create flashcard error:", error);
      res.status(500).json({ error: "Failed to create flashcard" });
    }
  });

  app.delete("/api/flashcards/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteFlashcard(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete flashcard error:", error);
      res.status(500).json({ error: "Failed to delete flashcard" });
    }
  });

  app.get("/api/collections/:id/chunks", requireAuth, async (req, res) => {
    try {
      const chunks = await storage.getDocumentChunks(req.params.id);
      res.json({ chunks });
    } catch (error) {
      console.error("Get chunks error:", error);
      res.status(500).json({ error: "Failed to get chunks" });
    }
  });

  app.post("/api/chat", requireAuth, async (req, res) => {
    try {
      const { messages, mode, collectionId } = req.body;
      
      if (!process.env.OPENROUTER_API_KEY) {
        return res.status(500).json({ error: "AI service not configured" });
      }

      const chunks = await storage.getDocumentChunks(collectionId);
      const collectionContext = chunks.map(c => c.chunkText).join("\n\n");

      const systemPrompt = getSystemPrompt(mode);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.REPLIT_DOMAINS?.split(",")[0] || "https://replit.com",
          "X-Title": "LightPath Study",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [
            { role: "system", content: systemPrompt + "\n\nStudy Materials:\n" + collectionContext },
            ...messages,
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("OpenRouter error:", error);
        return res.status(500).json({ error: "AI request failed" });
      }

      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      res.json({ content: data.choices?.[0]?.message?.content || "" });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Failed to process chat" });
    }
  });

  app.post("/api/feedback", requireAuth, async (req, res) => {
    try {
      const { subject, message } = req.body;
      const fb = await storage.createFeedback({
        userId: req.user!.id,
        subject,
        message,
      });
      res.json({ feedback: fb });
    } catch (error) {
      console.error("Create feedback error:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  app.post("/api/learning-events", requireAuth, async (req, res) => {
    try {
      const event = await storage.createLearningEvent({
        ...req.body,
        userId: req.user!.id,
      });
      res.json({ event });
    } catch (error) {
      console.error("Create learning event error:", error);
      res.status(500).json({ error: "Failed to log learning event" });
    }
  });

  app.post("/api/content-reports", requireAuth, async (req, res) => {
    try {
      const report = await storage.createContentReport({
        ...req.body,
        userId: req.user!.id,
      });
      res.json({ report });
    } catch (error) {
      console.error("Create content report error:", error);
      res.status(500).json({ error: "Failed to submit report" });
    }
  });

  app.post("/api/scrape-website", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = "https://" + normalizedUrl;
      }

      try {
        new URL(normalizedUrl);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      const businessInfo = await scrapeWebsite(normalizedUrl);
      res.json({ success: true, data: businessInfo });
    } catch (error) {
      console.error("Scrape endpoint error:", error);
      res.status(500).json({ error: "Failed to scrape website. Try manual mode." });
    }
  });
}

interface BusinessInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
  about: string;
  services: string[];
  tagline: string;
}

async function scrapeWebsite(url: string): Promise<Partial<BusinessInfo>> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PageBuilder/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    
    const extractMeta = (name: string): string => {
      const match = html.match(new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`, 'i'));
      return match?.[1]?.trim() || "";
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const name = titleMatch?.[1]?.trim().split(/[|\-–—]/)[0]?.trim() || "";
    
    const description = extractMeta("description") || extractMeta("og:description");
    
    const phoneMatch = html.match(/(?:tel:|href="tel:)?([\+]?[(]?[0-9]{1,3}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,9})/i)
      || html.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
    const phone = phoneMatch?.[1]?.trim() || "";
    
    const emailMatch = html.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const email = emailMatch?.[1] || "";
    
    const addressMatch = html.match(/(\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)[,\s]+[\w\s]+,?\s*[A-Z]{2}\s*\d{5})/i);
    const address = addressMatch?.[1]?.trim() || "";
    
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const tagline = h1Match?.[1]?.trim() !== name ? h1Match?.[1]?.trim() : description.slice(0, 100) || "";

    return {
      name,
      phone,
      email,
      address,
      about: description,
      tagline,
      services: [],
      hours: "",
    };
  } catch (error) {
    console.error("Scrape error:", error);
    throw error;
  }
}

function getSystemPrompt(mode: string): string {
  const basePrompt = `You are "Light", the AI tutor for a study app called Lightpath Study.`;
  
  const modePrompts: Record<string, string> = {
    explain: `${basePrompt} Explain concepts clearly and simply. Use examples when helpful.`,
    quiz: `${basePrompt} Generate quiz questions. Return a JSON array of questions with id, question, options (array of 4), correctAnswer (0-3), explanation_correct, memory_hook, and skill_tag.`,
    flashcards: `${basePrompt} Generate flashcards. Return ONLY a JSON array: [{"front": "...", "back": "..."}, ...]`,
    notes: `${basePrompt} Summarize the study materials into clear, organized notes.`,
    worksheet: `${basePrompt} Generate practice problems. Return JSON with set_id, topic_focus, and questions array.`,
  };
  
  return modePrompts[mode] || basePrompt;
}
