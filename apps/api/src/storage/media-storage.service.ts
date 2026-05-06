import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const MEDIA_ROOT = path.resolve("data/media");

function getExtensionFromUrl(url: string) {
  const cleanUrl = url.split("?")[0] ?? url;
  const ext = path.extname(cleanUrl);

  if (ext && ext.length <= 6) return ext;

  return ".jpg";
}

export function getChapterMediaDir(params: {
  sourceId: string;
  sourceMangaId: string;
  sourceChapterId: string;
}) {
  return path.join(
    MEDIA_ROOT,
    params.sourceId,
    params.sourceMangaId,
    "chapters",
    params.sourceChapterId,
  );
}

function encodePath(value: string) {
  return value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function isUsableDownloadedFile(filePath: string | null | undefined) {
  if (!filePath) return false;
  if (!existsSync(filePath)) return false;

  const stat = statSync(filePath);

  return stat.isFile() && stat.size >= 1024;
}

export function deleteFileIfExists(filePath: string | null | undefined) {
  if (!filePath) return;

  if (existsSync(filePath)) {
    rmSync(filePath, { force: true });
  }
}

export function getCoverFilePath(params: {
  sourceId: string;
  sourceMangaId: string;
  remoteUrl: string;
}) {
  const dir = getMangaMediaDir({
    sourceId: params.sourceId,
    sourceMangaId: params.sourceMangaId,
  });

  mkdirSync(dir, { recursive: true });

  const ext = getExtensionFromUrl(params.remoteUrl);

  return path.join(dir, `cover${ext}`);
}

export function getCoverLocalUrl(params: {
  sourceId: string;
  sourceMangaId: string;
  remoteUrl: string;
}) {
  const ext = getExtensionFromUrl(params.remoteUrl);

  return `/media/${encodePath(params.sourceId)}/${encodePath(
    params.sourceMangaId,
  )}/cover${ext}`;
}

export function getPageFilePath(params: {
  sourceId: string;
  sourceMangaId: string;
  sourceChapterId: string;
  pageIndex: number;
  remoteUrl: string;
}) {
  const dir = getChapterMediaDir(params);
  mkdirSync(dir, { recursive: true });

  const pageNumber = String(params.pageIndex + 1).padStart(4, "0");
  const ext = getExtensionFromUrl(params.remoteUrl);

  return path.join(dir, `${pageNumber}${ext}`);
}

export function getPageLocalUrl(params: {
  sourceId: string;
  sourceMangaId: string;
  sourceChapterId: string;
  pageIndex: number;
  remoteUrl: string;
}) {
  const pageNumber = String(params.pageIndex + 1).padStart(4, "0");
  const ext = getExtensionFromUrl(params.remoteUrl);

  return `/media/${encodePath(params.sourceId)}/${encodePath(
    params.sourceMangaId,
  )}/chapters/${encodePath(params.sourceChapterId)}/${pageNumber}${ext}`;
}

export async function downloadFirstWorkingUrlToPath(
  urls: string[],
  filePath: string,
  options?: {
    referer?: string;
  },
) {
  const errors: string[] = [];

  for (const url of urls) {
    try {
      await downloadFileToPath(url, filePath, options);
      return url;
    } catch (error) {
      errors.push(
        `${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new Error(`All download attempts failed: ${errors.join(" | ")}`);
}

export async function downloadFileToPath(
  url: string,
  filePath: string,
  options?: {
    referer?: string;
  },
) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: options?.referer ?? "https://newm.mangahere.cc/",
      Origin: "https://newm.mangahere.cc",
    },
  });

  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  writeFileSync(filePath, buffer);
}

export function getMangaMediaDir(params: {
  sourceId: string;
  sourceMangaId: string;
}) {
  return path.join(MEDIA_ROOT, params.sourceId, params.sourceMangaId);
}

export function deleteMangaMedia(params: {
  sourceId: string;
  sourceMangaId: string;
}) {
  const dir = getMangaMediaDir(params);

  if (existsSync(dir)) {
    rmSync(dir, {
      recursive: true,
      force: true,
    });
  }
}