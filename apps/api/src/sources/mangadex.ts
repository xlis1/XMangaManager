import type { SourceAdapter } from "../source-adapter.js";

const API = "https://api.mangadex.org";

export const mangadexAdapter: SourceAdapter = {
  id: "mangadex",
  displayName: "MangaDex",

  async searchManga({ query, limit = 10 }) {
    const url = new URL(`${API}/manga`);
    url.searchParams.set("title", query);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("includes[]", "cover_art");

    const res = await fetch(url);
    if (!res.ok) throw new Error(`MangaDex search failed: ${res.status}`);

    const json = await res.json();

    return json.data.map((item: any) => {
      const title =
        item.attributes.title.en ??
        Object.values(item.attributes.title)[0] ??
        "Untitled";

      const coverRel = item.relationships?.find(
        (r: any) => r.type === "cover_art",
      );

      const fileName = coverRel?.attributes?.fileName;

      return {
        sourceId: "mangadex",
        sourceMangaId: item.id,
        title,
        description: item.attributes.description?.en,
        coverUrl: fileName
          ? `https://uploads.mangadex.org/covers/${item.id}/${fileName}.256.jpg`
          : undefined,
      };
    });
  },

  async getManga(sourceMangaId) {
    const res = await fetch(`${API}/manga/${sourceMangaId}?includes[]=cover_art`);
    if (!res.ok) throw new Error(`MangaDex manga fetch failed: ${res.status}`);

    const json = await res.json();
    const item = json.data;

    const title =
      item.attributes.title.en ??
      Object.values(item.attributes.title)[0] ??
      "Untitled";

    const coverRel = item.relationships?.find(
      (r: any) => r.type === "cover_art",
    );

    const fileName = coverRel?.attributes?.fileName;

    return {
      sourceId: "mangadex",
      sourceMangaId: item.id,
      title,
      description: item.attributes.description?.en,
      coverUrl: fileName
        ? `https://uploads.mangadex.org/covers/${item.id}/${fileName}.256.jpg`
        : undefined,
    };
  },

  async getChapters(sourceMangaId) {
    const url = new URL(`${API}/manga/${sourceMangaId}/feed`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("translatedLanguage[]", "en");
    url.searchParams.set("order[chapter]", "asc");

    const res = await fetch(url);
    if (!res.ok) throw new Error(`MangaDex chapter fetch failed: ${res.status}`);

    const json = await res.json();

    return json.data.map((item: any) => ({
      sourceId: "mangadex",
      sourceMangaId,
      sourceChapterId: item.id,
      title: item.attributes.title,
      chapterNumber: item.attributes.chapter,
      language: item.attributes.translatedLanguage,
      publishedAt: item.attributes.publishAt,
    }));
  },

  async getChapterPages(sourceChapterId) {
    const res = await fetch(
      `https://api.mangadex.org/at-home/server/${sourceChapterId}`,
    );

    if (!res.ok) {
      throw new Error(`MangaDex AtHome failed: ${res.status}`);
    }

    const json = await res.json();

    const baseUrl = json.baseUrl;
    const hash = json.chapter.hash;
    const data: string[] = json.chapter.data ?? [];

    return data.map((filename, index) => ({
      index,
      url: `${baseUrl}/data/${hash}/${filename}`,
    }));
  },
};