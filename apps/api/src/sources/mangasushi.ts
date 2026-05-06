import * as cheerio from "cheerio";
import type { SourceAdapter } from "../source-adapter.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const BASE_URL = "https://www.mangasushi.org";
const curlCommand = process.platform === "win32" ? "curl.exe" : "curl";


async function fetchHtml(url: string) {
    try {
        const res = await fetch(url, {
            redirect: "follow",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept:
                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        });

        const html = await res.text();

        if (!res.ok) {
            throw new Error(`MangaSushi request failed: ${res.status}`);
        }

        return html;
    } catch (error) {
        console.warn("[MangaSushi] fetch failed, falling back to PowerShell", {
            url,
            error: error instanceof Error ? error.message : String(error),
        });

        const { stdout } = await execFileAsync("powershell.exe", [
            "-NoProfile",
            "-Command",
            `
  $headers = @{
    "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    "Accept" = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    "Accept-Language" = "en-US,en;q=0.9"
  }

  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  $response = Invoke-WebRequest -Uri "${url}" -Headers $headers -UseBasicParsing
  $response.Content
  `,
        ]);

        console.log("[MangaSushi] PowerShell HTML length:", stdout.length);
        console.log("[MangaSushi] PowerShell preview:", stdout.slice(0, 500));

        return stdout;
    }
}

function absoluteUrl(url: string) {
    return new URL(url, BASE_URL).toString();
}

function normalizeSourceId(url: string) {
    const parsed = new URL(url, BASE_URL);

    return parsed.pathname
        .replace(/^\/+|\/+$/g, "")
        .replace(/\/page\/\d+\/?$/, "");
}

function chapterNumberFromTitle(title: string) {
    return title.match(/chapter\s+([\d.]+)/i)?.[1];
}

export const mangasushiAdapter: SourceAdapter = {
    id: "mangasushi",
    displayName: "MangaSushi",

    async searchManga({ query, limit = 10 }) {
        const url = new URL(BASE_URL);
        url.searchParams.set("s", query);
        url.searchParams.set("post_type", "wp-manga");

        const html = await fetchHtml(url.toString());
        const $ = cheerio.load(html);
        console.log(
            $("a[href*='/manga/']")
                .toArray()
                .slice(0, 20)
                .map((element) => ({
                    text: $(element).text().trim(),
                    href: $(element).attr("href"),
                })),
        );

        const results = $(".c-tabs-item__content, .page-item-detail, .row.c-tabs-item__content")
            .toArray()
            .map((element) => {
                const titleLink =
                    $(element).find(".post-title a").first().attr("href")
                        ? $(element).find(".post-title a").first()
                        : $(element).find("a[href*='/manga/']").first();

                const href = titleLink.attr("href");
                const title = titleLink.text().trim();


                if (!href || !title) return null;

                const coverSrc =
                    $(element).find("img").first().attr("data-src") ??
                    $(element).find("img").first().attr("src");

                return {
                    sourceId: "mangasushi",
                    sourceMangaId: normalizeSourceId(href),
                    title,
                    description: undefined,
                    coverUrl: coverSrc ? absoluteUrl(coverSrc) : undefined,
                };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .filter((item, index, array) => {
                return (
                    array.findIndex((other) => other.sourceMangaId === item.sourceMangaId) ===
                    index
                );
            })
            .slice(0, limit);

        return results;
    },

    async getManga(sourceMangaId) {
        const url = `${BASE_URL}/${sourceMangaId}/`;
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);

        const title = $("h1").first().text().trim();

        const description =
            $("h2, h3, h4")
                .filter((_, el) => $(el).text().trim().toLowerCase().includes("summary"))
                .first()
                .nextAll("p")
                .first()
                .text()
                .trim() || undefined;

        const coverUrl =
            $("img")
                .toArray()
                .map((el) => $(el).attr("src"))
                .find((src) => src && src.includes("/wp-content/uploads/")) ?? undefined;

        return {
            sourceId: "mangasushi",
            sourceMangaId,
            title,
            description,
            coverUrl: coverUrl ? absoluteUrl(coverUrl) : undefined,
        };
    },

    async getChapters(sourceMangaId) {
        const url = `${BASE_URL}/${sourceMangaId}/`;
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);

        const links = $("a")
            .toArray()
            .map((element) => {
                const title = $(element).text().trim();
                const href = $(element).attr("href");

                if (!href) return null;
                if (!href.includes("/chapter-")) return null;

                const fullUrl = absoluteUrl(href);

                return {
                    sourceId: "mangasushi",
                    sourceMangaId,
                    sourceChapterId: normalizeSourceId(fullUrl),
                    title,
                    chapterNumber: chapterNumberFromTitle(title),
                    language: "en",
                    publishedAt: undefined,
                };
            })
            .filter(Boolean)
            .filter((item, index, array) => {
                return (
                    array.findIndex(
                        (other) => other?.sourceChapterId === item?.sourceChapterId,
                    ) === index
                );
            });

        return links as any;
    },

    async getChapterPages(sourceChapterId) {
        const url = `${BASE_URL}/${sourceChapterId}/`;
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);

        const imageUrls = $("img")
            .toArray()
            .map((element) => $(element).attr("src"))
            .filter((src): src is string => Boolean(src))
            .map(absoluteUrl)
            .filter((src) => src.includes("/wp-content/uploads/WP-manga/data/"))
            .filter((src, index, array) => array.indexOf(src) === index);

        return imageUrls.map((url, index) => ({
            index,
            url,
        }));
    },
};