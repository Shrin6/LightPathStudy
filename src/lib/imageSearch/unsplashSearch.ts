import { z } from "zod";
import type { ImageResult } from "./wikiSearch";

const unsplashSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      alt_description: z.string().nullable(),
      description: z.string().nullable(),
      urls: z.object({
        small: z.string(),
      }),
      links: z.object({
        html: z.string(),
      }),
      user: z.object({
        name: z.string(),
        links: z.object({
          html: z.string(),
        }),
      }),
    })
  ),
});

export async function searchUnsplash(term: string): Promise<ImageResult[]> {
  const key = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  if (!key || !term.trim()) return [];

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", term);
  url.searchParams.set("per_page", "6");
  url.searchParams.set("content_filter", "high");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Client-ID ${key}`,
    },
  });

  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const parsed = unsplashSchema.safeParse(data);
  if (!parsed.success) return [];

  return parsed.data.results.map((r) => ({
    title: r.description || r.alt_description || "Unsplash image",
    thumbnail: r.urls.small,
    pageUrl: r.links.html,
    source: "unsplash" as const,
  }));
}
