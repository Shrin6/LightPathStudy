import { z } from "zod";

export interface ImageResult {
  title: string;
  thumbnail: string;
  pageUrl: string;
  source: "wikimedia" | "unsplash";
}

const wikiSchema = z.object({
  query: z.object({
    pages: z.record(
      z.object({
        title: z.string(),
        fullurl: z.string().optional(),
        thumbnail: z
          .object({
            source: z.string(),
          })
          .optional(),
      })
    ),
  }),
});

export async function searchWikimedia(term: string): Promise<ImageResult[]> {
  if (!term.trim()) return [];

  const query = `${term} diagram illustration`;
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "6");
  url.searchParams.set("prop", "pageimages|info");
  url.searchParams.set("inprop", "url");
  url.searchParams.set("pithumbsize", "480");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json().catch(() => null);
  const parsed = wikiSchema.safeParse(data);
  if (!parsed.success) return [];

  const pages = parsed.data.query.pages;
  const results: ImageResult[] = Object.values(pages)
    .filter((p) => p.thumbnail?.source)
    .map((p) => ({
      title: p.title,
      thumbnail: p.thumbnail!.source,
      pageUrl: p.fullurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
      source: "wikimedia" as const,
    }));

  return results;
}
