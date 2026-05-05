import type { ChapterSummary, MangaSummary, PageRef } from "@xmanga/shared";

export type SearchMangaParams = {
  query: string;
  limit?: number;
};

export interface SourceAdapter {
  id: string;
  displayName: string;

  searchManga(params: SearchMangaParams): Promise<MangaSummary[]>;

  getManga(sourceMangaId: string): Promise<MangaSummary>;

  getChapters(sourceMangaId: string): Promise<ChapterSummary[]>;

  getChapterPages(sourceChapterId: string): Promise<PageRef[]>;
}