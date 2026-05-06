export type Manga = {
  id: string;
  sourceId: string;
  sourceMangaId: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  tracked: boolean;
  autoDownload: boolean;
  lastCheckedAt?: string | null;

  unreadChapterCount?: number;
  latestChapterAt?: string | null;
  recentlyReadAt?: string | null;
  chapterCount?: number;

  readerDirection?: "ltr" | "rtl" | "vertical" | null;
  readerClickMode?: "normal" | "flipped" | null;
  readerPageFit?:
  | "width"
  | "height"
  | "customWidth"
  | "customHeight"
  | "original"
  | null;
  readerCustomWidth?: number | null;
  readerCustomHeight?: number | null;
  readerPagePadding?: number | null;
  originalTitle?: string | null;
  displayTitle?: string | null;
  localCoverUrl?: string | null;
  failedChapterCount?: number;
};

export type UpdateFeedItem = Chapter & {
  detectedAt: string;
  releasedAt?: string | null;
  manga: {
    id: string;
    title: string;
    coverUrl?: string | null;
    sourceId: string;
  } | null;
};

export type Chapter = {
  id: string;
  mangaId: string;
  sourceChapterId: string;
  title?: string | null;
  chapterNumber?: string | null;
  language?: string | null;
  publishedAt?: string | null;
  downloadStatus: string;
  readStatus: string;
  lastReadPageIndex: number;
};

export type MangaDetails = Manga & {
  chapters: Chapter[];
};

export type Page = {
  id: string;
  chapterId: string;
  pageIndex: number;
  remoteUrl: string;
  localUrl?: string | null;
  downloadStatus: string;
};

export type SearchResult = {
  sourceId: string;
  sourceMangaId: string;
  title: string;
  description?: string;
  coverUrl?: string;
};

export type AppConfig = {
  theme: "dark" | "light";
  libraryPath: string;
  downloadPages: boolean;
  defaultSource: string;
  preferredLanguages: string[];
  readerDirection: "ltr" | "rtl" | "vertical";
  pageFit: "width" | "height" | "original";
  updateIntervalMinutes: number;
  autoCheckOnStartup: boolean;
  requestDelayMs: number;
  chapterDownloadDelayMs: number;
  libraryColumnsMobile: number;
  libraryColumnsDesktop: number;
};

export type ChapterVerification = {
  chapterId: string;
  verified: boolean;
  totalPages: number;
  brokenPageCount: number;
  brokenPages: {
    id: string;
    pageIndex: number;
    downloadStatus: string;
    localPath?: string | null;
    localUrl?: string | null;
  }[];
};

export type JobState = {
  status: "idle" | "running" | "failed" | "completed";
  jobName: string | null;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  lastResult: unknown | null;
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

export const api = {
  getLibrary: () => request<Manga[]>("/api/library"),

  searchManga: (query: string) =>
    request<SearchResult[]>(
      `/api/sources/mangadex/search?q=${encodeURIComponent(query)}`,
    ),

  checkAll: () =>
    request<{ checkedCount: number; results: unknown[] }>(
      "/api/library/check-all",
      {
        method: "POST",
      },
    ),

  followManga: (mangaId: string) =>
    request<MangaDetails>(`/api/library/${mangaId}/follow`, {
      method: "POST",
    }),

  unfollowManga: (mangaId: string) =>
    request<MangaDetails>(`/api/library/${mangaId}/unfollow`, {
      method: "POST",
    }),

  deleteManga: (mangaId: string) =>
    request<{ deleted: boolean; mangaId: string; title: string }>(
      `/api/library/${mangaId}`,
      {
        method: "DELETE",
      },
    ),

  importManga: (sourceId: string, sourceMangaId: string) =>
    request<MangaDetails>("/api/library/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sourceId, sourceMangaId }),
    }),

  getManga: (mangaId: string) =>
    request<MangaDetails>(`/api/library/${mangaId}`),

  refreshManga: (mangaId: string) =>
    request<{ manga: MangaDetails; newChapterCount: number }>(
      `/api/library/${mangaId}/refresh`,
      {
        method: "POST",
      },
    ),

  downloadMissing: (mangaId: string) =>
    request(`/api/library/${mangaId}/download-missing`, {
      method: "POST",
    }),

  verifyChapter: (chapterId: string) =>
    request<ChapterVerification>(`/api/chapters/${chapterId}/verify`),

  repairChapter: (chapterId: string) =>
    request(`/api/chapters/${chapterId}/repair`, {
      method: "POST",
    }),

  redownloadChapter: (chapterId: string) =>
    request(`/api/chapters/${chapterId}/redownload`, {
      method: "POST",
    }),

  setTracking: (
    mangaId: string,
    body: { tracked?: boolean; autoDownload?: boolean },
  ) =>
    request<MangaDetails>(`/api/library/${mangaId}/tracking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),

  getChapterPages: (chapterId: string) =>
    request<Page[]>(`/api/chapters/${chapterId}/pages`),

  downloadChapter: (chapterId: string) =>
    request(`/api/chapters/${chapterId}/download`, {
      method: "POST",
    }),

  markRead: (chapterId: string) =>
    request<Chapter>(`/api/chapters/${chapterId}/mark-read`, {
      method: "POST",
    }),

  markUnread: (chapterId: string) =>
    request<Chapter>(`/api/chapters/${chapterId}/mark-unread`, {
      method: "POST",
    }),

  updateProgress: (chapterId: string, pageIndex: number) =>
    request(`/api/chapters/${chapterId}/progress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pageIndex }),
    }),

  getConfig: () => request<AppConfig>("/api/config"),

  updateConfig: (body: Partial<AppConfig>) =>
    request<AppConfig>("/api/config", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),

  getJobStatus: () => request<JobState>("/api/jobs/status"),

  runCheckAllJob: () =>
    request("/api/jobs/check-all", {
      method: "POST",
    }),

  cacheCover: (mangaId: string) =>
    request(`/api/library/${mangaId}/cache-cover`, {
      method: "POST",
    }),

  updateDisplayTitle: (mangaId: string, displayTitle: string | null) =>
    request<MangaDetails>(`/api/library/${mangaId}/display-title`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayTitle }),
    }),

  verifyAllChapters: (mangaId: string) =>
    request(`/api/library/${mangaId}/verify-all`, {
      method: "POST",
    }),

  repairAllChapters: (mangaId: string) =>
    request(`/api/library/${mangaId}/repair-all`, {
      method: "POST",
    }),

  markAllChaptersRead: (mangaId: string) =>
    request<MangaDetails>(`/api/library/${mangaId}/mark-all-read`, {
      method: "POST",
    }),

  markAllChaptersUnread: (mangaId: string) =>
    request<MangaDetails>(`/api/library/${mangaId}/mark-all-unread`, {
      method: "POST",
    }),

  getUpdates: () => request<UpdateFeedItem[]>("/api/library/updates"),

  updateMangaReaderSettings: (
    mangaId: string,
    body: {
      readerDirection?: string | null;
      readerClickMode?: string | null;
      readerPageFit?: string | null;
      readerCustomWidth?: number | null;
      readerCustomHeight?: number | null;
      readerPagePadding?: number | null;
    },
  ) =>
    request<MangaDetails>(`/api/library/${mangaId}/reader-settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
};