import { z } from "zod";

export const SourceIdSchema = z.string();

export type SourceId = string;

export type MangaSummary = {
  sourceId: SourceId;
  sourceMangaId: string;
  title: string;
  description?: string;
  coverUrl?: string;
};

export type ChapterSummary = {
  sourceId: SourceId;
  sourceMangaId: string;
  sourceChapterId: string;
  title?: string;
  chapterNumber?: string;
  language?: string;
  publishedAt?: string;
};

export type PageRef = {
  index: number;
  url: string;
};