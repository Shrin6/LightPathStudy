import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Sparkles, ImageIcon, ShieldAlert, Loader2, RefreshCcw, Wand2, SlidersHorizontal } from "lucide-react";
import { searchWikimedia, type ImageResult } from "@/lib/imageSearch/wikiSearch";
import { searchUnsplash } from "@/lib/imageSearch/unsplashSearch";
import { ImagePickerModal } from "./ImagePickerModal";
import type { DocumentTypeHint } from "@/pages/Study";

const SUPABASE_URL = "https://dsvpodsvrxwgfqnuojcz.supabase.co";

const contentTypes = [
  "Steps/Process",
  "Vocabulary/Definitions",
  "Formula/Math",
  "Diagram/Pathway",
  "Timeline/History",
  "Mixed/Not sure",
];

const styleOptions = [
  "Acronym",
  "Mnemonic phrase",
  "Story method",
  "Visual anchor",
  "Step Ladder",
  "Rap/Chant",
];

type Difficulty = "Easy" | "Medium" | "Exam";

interface BreakdownItem {
  term: string;
  meaning: string;
}

interface SelfCheckItem {
  q: string;
  a: string;
}

interface MemoryPack {
  acronym?: string | null;
  mnemonic_phrase?: string | null;
  story?: string | null;
  breakdown: BreakdownItem[];
  self_check: SelfCheckItem[];
  visual_anchor_prompt?: string | null;
}

interface MemoryGameProps {
  collectionId: string | null;
  collectionContent: string;
  documentTypeHint: DocumentTypeHint;
  onUsageCheck?: () => Promise<boolean>;
}

function stripJson(raw: string): MemoryPack | null {
  try {
    let text = raw.trim();
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      text = text.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      acronym: parsed.acronym ?? null,
      mnemonic_phrase: parsed.mnemonic_phrase ?? null,
      story: parsed.story ?? null,
      breakdown: Array.isArray(parsed.breakdown) ? parsed.breakdown.map((b: any) => ({
        term: String(b.term ?? ""),
        meaning: String(b.meaning ?? ""),
      })).filter((b) => b.term || b.meaning) : [],
      self_check: Array.isArray(parsed.self_check) ? parsed.self_check.map((s: any) => ({
        q: String(s.q ?? ""),
        a: String(s.a ?? ""),
      })).filter((s) => s.q || s.a).slice(0, 3) : [],
      visual_anchor_prompt: parsed.visual_anchor_prompt ?? null,
    };
  } catch (err) {
    console.error("Memory parse error", err);
    return null;
  }
}

const randomExamples = [
  {
    topic: "Cardiac cycle phases and valve movements",
    contentType: "Steps/Process",
    styles: ["Acronym", "Mnemonic phrase", "Visual anchor"],
    difficulty: "Medium" as Difficulty,
    items: 6,
    context: "MCAT physiology",
  },
  {
    topic: "Key Supreme Court cases on free speech",
    contentType: "Timeline/History",
    styles: ["Story method", "Step Ladder"],
    difficulty: "Exam" as Difficulty,
    items: 5,
    context: "Constitutional law midterm",
  },
  {
    topic: "Oxidation states rules and examples",
    contentType: "Formula/Math",
    styles: ["Acronym", "Rap/Chant"],
    difficulty: "Medium" as Difficulty,
    items: 7,
    context: "General chemistry",
  },
];

export const MemoryGame = ({ collectionId, collectionContent, documentTypeHint, onUsageCheck }: MemoryGameProps) => {
  const [topic, setTopic] = useState("");
  const [contentType, setContentType] = useState<string>("Mixed/Not sure");
  const [styles, setStyles] = useState<string[]>(["Acronym", "Mnemonic phrase"]);
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [items, setItems] = useState<number>(5);
  const [context, setContext] = useState("");
  const [theme, setTheme] = useState("");
  const [includeImage, setIncludeImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MemoryPack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageOptions, setImageOptions] = useState<ImageResult[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageResult | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const styleAnchorRef = useRef<HTMLDivElement | null>(null);

  const toggleStyle = (style: string) => {
    setStyles((prev) => (prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]));
  };

  const runImageSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!includeImage || !trimmed) return;
    const primary = await searchWikimedia(trimmed);
    let images = primary;
    if (images.length === 0) {
      images = await searchUnsplash(trimmed);
    }
    setImageOptions(images);
    setImageModalOpen(images.length > 0);
    if (images.length === 0) {
      toast.info("No image found — skipping.");
    }
  };

  useEffect(() => {
    if (result && includeImage) {
      const themedQuery = `${theme ? theme + " " : ""}${topic} ${contentType}`;
      void runImageSearch(result.visual_anchor_prompt || themedQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const styleChips = useMemo(
    () => styleOptions.map((opt) => {
      const active = styles.includes(opt);
      return (
        <Button
          key={opt}
          type="button"
          variant={active ? "default" : "outline"}
          size="sm"
          className="justify-start"
          onClick={() => toggleStyle(opt)}
        >
          {opt}
        </Button>
      );
    }),
    [styles]
  );

  const pickRandom = () => {
    const sample = randomExamples[Math.floor(Math.random() * randomExamples.length)];
    setTopic(sample.topic);
    setContentType(sample.contentType);
    setStyles(sample.styles);
    setDifficulty(sample.difficulty);
    setItems(sample.items);
    setContext(sample.context);
  };

  const buildUserMessage = (diff: Difficulty) => {
    const styleList = styles.length ? styles.join(", ") : "Any";
    return [
      `Topic: ${topic}`,
      `Content type: ${contentType}`,
      `Difficulty: ${diff}`,
      `Items: ${items}`,
      `Preferred style: ${styleList}`,
      `Context: ${context || "N/A"}`,
      `Theme/tie-in to weave in (shows/memes/songs/etc.): ${theme || "None"}`,
      "Output EXACTLY in JSON: { \"acronym\": \"string or null\", \"mnemonic_phrase\": \"string or null\", \"story\": \"string or null\", \"breakdown\": [{\"term\":\"\", \"meaning\":\"\"}], \"self_check\": [{\"q\":\"\", \"a\":\"\"}, {\"q\":\"\", \"a\":\"\"}, {\"q\":\"\", \"a\":\"\"}], \"visual_anchor_prompt\": \"string or null (a short description for an image to search)\" }",
      "Make acronym, mnemonic phrase, story, and breakdown lightly reflect the theme if provided (keep it clean).",
    ].join("\n");
  };


  const handleGenerate = async (overrideDifficulty?: Difficulty) => {
    if (!collectionId) {
      toast.error("Select a collection first.");
      return;
    }
    if (!topic.trim()) {
      toast.error("Topic is required.");
      return;
    }
    if (!collectionContent || collectionContent.length < 200) {
      toast.error("Your notes look empty. Upload or select a richer collection.");
      return;
    }

    // Check usage limit
    if (onUsageCheck) {
      const allowed = await onUsageCheck();
      if (!allowed) return;
    }
    const diff = overrideDifficulty || difficulty;
    if (overrideDifficulty) setDifficulty(overrideDifficulty);

    setLoading(true);
    setError(null);
    setSelectedImage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("Session expired. Please sign in again.");
        setLoading(false);
        return;
      }

      const userMessage = buildUserMessage(diff);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-tutor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a study memory coach. Produce a structured 'Memory Pack'." },
            { role: "user", content: userMessage },
          ],
          mode: "memory",
          collectionId,
          notes: collectionContent,
          document_type_hint: documentTypeHint,
        }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || `Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(payload);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
            }
          } catch (err) {
            console.warn("Stream chunk parse error", err);
          }
        }
      }

      const parsed = stripJson(assistantContent);
      if (!parsed) {
        setError("Could not parse the AI response. Please try again.");
        return;
      }

      setResult(parsed);
    } catch (err: any) {
      console.error("Memory generation failed", err);
      setError(err?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = () => handleGenerate();
  const handleSimpler = () => handleGenerate("Easy");
  const handleExam = () => handleGenerate("Exam");

  const scrollToStyles = () => {
    if (styleAnchorRef.current) {
      styleAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="border-b px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Memory Tricks</p>
          <h2 className="text-lg font-semibold">Memory Tricks Game</h2>
          <p className="text-sm text-muted-foreground">Turn your topic into a clean, structured memory pack. Game mode is on by default.</p>
        </div>
        <Badge variant="outline" className="gap-1"><Sparkles className="h-4 w-4" />Game Mode</Badge>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr_1fr] h-full overflow-auto">
        <Card className="p-4 space-y-4 shadow-sm border-muted">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="font-semibold">Set up your memory pack</h3>
              <p className="text-sm text-muted-foreground">Provide a focused topic. Choose style and difficulty. We keep the rest tidy.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={pickRandom} className="text-xs">Random Example</Button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Topic / What to remember<span className="text-destructive"> *</span></Label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Photosynthesis steps, Krebs cycle checkpoints, or key cases on free speech..."
                className="min-h-[90px]"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Content Type</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick content type" />
                  </SelectTrigger>
                  <SelectContent>
                    {contentTypes.map((ct) => (
                      <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5" ref={styleAnchorRef}>
                <Label>Output Style (multi-select)</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {styleChips}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Difficulty</Label>
                <div className="grid grid-cols-3 gap-1">
                  {["Easy", "Medium", "Exam"].map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant={difficulty === d ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDifficulty(d as Difficulty)}
                    >
                      {d}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label># of items</Label>
                <Input
                  type="number"
                  min={3}
                  max={20}
                  value={items}
                  onChange={(e) => setItems(Math.min(20, Math.max(3, Number(e.target.value) || 5)))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Context (optional)</Label>
                <Input
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="AP Bio unit 3, Contracts exam..."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Theme / tie-in (optional)</Label>
              <Input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="E.g., Lord of the Rings vibe, SpongeBob meme, Taylor Swift song"
              />
              <p className="text-xs text-muted-foreground">We will weave this tone into the acronym, mnemonic, story, and visual anchor.</p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border bg-card/60 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Switch checked={includeImage} onCheckedChange={setIncludeImage} id="image-toggle" />
                <div>
                  <Label htmlFor="image-toggle">Add a related image</Label>
                  <p className="text-xs text-muted-foreground">Wikimedia Commons first; Unsplash fallback. Attribution included.</p>
                </div>
              </div>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={() => handleGenerate()} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate
              </Button>
              <Button variant="ghost" size="sm" onClick={pickRandom} disabled={loading}>Try a random example</Button>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <ShieldAlert className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-0 h-full flex flex-col overflow-hidden shadow-sm border-muted">
          <div className="border-b px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Output</p>
              <h3 className="font-semibold">Your Memory Pack</h3>
            </div>
            {result && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={loading} className="gap-1">
                  <RefreshCcw className="h-4 w-4" /> Regenerate
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSimpler} disabled={loading}>Make it simpler</Button>
                <Button variant="ghost" size="sm" onClick={handleExam} disabled={loading}>Make it more exam-level</Button>
                <Button variant="ghost" size="sm" onClick={scrollToStyles} disabled={loading} className="gap-1">
                  <SlidersHorizontal className="h-4 w-4" /> Change style
                </Button>
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 p-4">
            {!result ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm text-center px-4">
                <div className="space-y-1">
                  <p>Generate to see acronyms, mnemonics, stories, and a breakdown tailored to your topic.</p>
                  <p className="text-xs">We keep classic memory mode intact — you can still switch back if needed.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {includeImage && selectedImage && (
                  <div className="space-y-2">
                    <img src={selectedImage.thumbnail} alt={selectedImage.title} className="rounded-lg border" />
                    <p className="text-xs text-muted-foreground">
                      Source: <a className="underline" href={selectedImage.pageUrl} target="_blank" rel="noreferrer">{selectedImage.title}</a>
                    </p>
                  </div>
                )}

                {result.acronym && (
                  <div className="space-y-1">
                    <h4 className="font-semibold">Acronym</h4>
                    <p className="text-sm leading-relaxed">{result.acronym}</p>
                  </div>
                )}

                {result.mnemonic_phrase && (
                  <div className="space-y-1">
                    <h4 className="font-semibold">Mnemonic phrase</h4>
                    <p className="text-sm leading-relaxed">{result.mnemonic_phrase}</p>
                  </div>
                )}

                {result.story && (
                  <div className="space-y-1">
                    <h4 className="font-semibold">Short story</h4>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.story}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-semibold">Breakdown list</h4>
                  <div className="space-y-1">
                    {result.breakdown?.map((item, idx) => (
                      <div key={`${item.term}-${idx}`} className="flex gap-2 text-sm">
                        <Badge variant="outline" className="mt-0.5">{idx + 1}</Badge>
                        <div>
                          <p className="font-medium leading-tight">{item.term}</p>
                          <p className="text-muted-foreground text-sm leading-relaxed">{item.meaning}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <h4 className="font-semibold">Quick self-check</h4>
                  <div className="space-y-2">
                    {result.self_check?.map((qa, idx) => (
                      <div key={`qa-${idx}`} className="rounded-md border bg-card/60 px-3 py-2">
                        <p className="text-sm font-medium">{qa.q}</p>
                        <p className="text-sm text-muted-foreground">Answer: {qa.a}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={loading} className="gap-1">
                    <RefreshCcw className="h-4 w-4" /> Regenerate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleSimpler} disabled={loading}>Make it simpler</Button>
                  <Button size="sm" variant="ghost" onClick={handleExam} disabled={loading}>Make it more exam-level</Button>
                  <Button size="sm" variant="ghost" onClick={scrollToStyles} disabled={loading}>Change style</Button>
                  <Button size="sm" variant="outline" disabled className="opacity-70">Save to collection (Coming soon)</Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>

      <ImagePickerModal
        open={imageModalOpen}
        onOpenChange={setImageModalOpen}
        images={imageOptions}
        onSelect={(img) => {
          setSelectedImage(img);
          setImageModalOpen(false);
        }}
      />
    </div>
  );
};
