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

  return `/media/${encodeURIComponent(params.sourceId)}/${encodeURIComponent(
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

  return `/media/${encodeURIComponent(params.sourceId)}/${encodeURIComponent(
    params.sourceMangaId,
  )}/chapters/${encodeURIComponent(params.sourceChapterId)}/${pageNumber}${ext}`;
}

export async function downloadFileToPath(url: string, filePath: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "XMangaManager/0.1 personal archival reader",
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