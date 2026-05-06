import * as cheerio from "cheerio";
import type { SourceAdapter } from "../source-adapter.js";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE_URL = "https://newm.mangahere.cc";

async function fetchHtml(url: string) {
    const res = await fetch(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: BASE_URL,
        },
    });

    if (!res.ok) {
        throw new Error(`MangaHere request failed: ${res.status} ${res.statusText}`);
    }

    return res.text();
}

export function getMangaHereImageFallbacks(url: string) {
  const fallbacks: string[] = [];

  const candidates = [
    url.replace("https://zjcdn.mangahere.org/", "https://fmcdn.mangahere.com/"),
    url.replace("https://zjcdn.mangahere.org/", "https://zjcdn.mangahere.com/"),
    url.replace("https://zjcdn.mangahere.org/", "https://fmcdn.mangahere.org/"),
  ];

  for (const candidate of candidates) {
    if (candidate !== url && !fallbacks.includes(candidate)) {
      fallbacks.push(candidate);
    }
  }

  return fallbacks;
}

function extractPackedMangaHereImages(html: string) {
    const packedScript = html.match(
        /eval\(function\(p,a,c,k,e,d\)[\s\S]*?\)\)\s*<\/script>/i,
    )?.[0];

    if (!packedScript) return [];

    const payloadMatch = packedScript.match(
        /\}\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/,
    );

    if (!payloadMatch) return [];

    let payload = payloadMatch[1];
    const base = Number(payloadMatch[2]);
    const count = Number(payloadMatch[3]);
    const dictionary = payloadMatch[4].split("|");

    function decodeToken(num: number): string {
        const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (num < base) return chars[num];

        let result = "";
        while (num > 0) {
            result = chars[num % base] + result;
            num = Math.floor(num / base);
        }

        return result;
    }

    for (let i = count - 1; i >= 0; i--) {
        const key = decodeToken(i);
        const value = dictionary[i] || key;

        payload = payload.replace(new RegExp(`\\b${key}\\b`, "g"), value);
    }

    const matches = [...payload.matchAll(/\/\/[^'"\]]+?\.(?:jpg|jpeg|png|webp)/gi)];

    return matches.map((match) => absoluteUrl(match[0]));
}

function dumpDebugHtml(name: string, html: string) {
    mkdirSync("data/debug", { recursive: true });
    writeFileSync(`data/debug/${name}.html`, html);
}

function absoluteUrl(url: string) {
    if (url.startsWith("//")) {
        return `https:${url}`;
    }

    return new URL(url, BASE_URL).toString();
}

function normalizeSourceId(url: string) {
    const parsed = new URL(url, BASE_URL);

    return parsed.pathname.replace(/^\/+|\/+$/g, "");
}
function normalizeChapterId(url: string) {
    const parsed = new URL(url, BASE_URL);

    return parsed.pathname
        .replace(/^\/+|\/+$/g, "")
        .replace(/\/\d+\.html$/i, "");
}

function chapterNumberFromText(text: string) {
    return text.match(/ch\.?\s*([\d.]+)/i)?.[1] ?? text.match(/chapter\s*([\d.]+)/i)?.[1];
}

function cleanText(text: string) {
    return text.replace(/\s+/g, " ").trim();
}

const MANGAHERE_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: BASE_URL,
    Cookie:
        "isAdult=1; adult=1; ageConfirmed=1; warning=1; " +
        "mangahere_adult=1; mh_adult=1; readAdult=1; checkAdult=1",
};

async function fetchMangaPageHtml(url: string) {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    const isAdultBlock =
        $("#checkAdult").length > 0 ||
        $(".block-bottom-fix").length > 0 ||
        html.includes("checkAdult");

    if (!isAdultBlock) {
        return html;
    }

    console.warn("[MangaHere] Adult warning page detected, retrying with cookies", {
        url,
        title: $("title").text(),
    });

    const retry = await fetch(url, {
        headers: {
            ...MANGAHERE_HEADERS,
            Cookie:
                "isAdult=1; adult=1; ageConfirmed=1; warning=1; " +
                "mangahere_adult=1; mh_adult=1; readAdult=1; checkAdult=1; " +
                "mangahere_comic_adult=1; comic_adult=1",
        },
    });

    if (!retry.ok) {
        throw new Error(`MangaHere adult retry failed: ${retry.status}`);
    }

    return retry.text();
}

export const mangahereAdapter: SourceAdapter = {
    id: "mangahere",
    displayName: "MangaHere",

    async searchManga({ query, limit = 10 }) {
        const url = new URL(`${BASE_URL}/search`);
        url.searchParams.set("title", query);
        url.searchParams.set("type", "=1");

        const html = await fetchHtml(url.toString());
        const $ = cheerio.load(html);

        const results = $("a[href*='/manga/']")
            .toArray()
            .map((element) => {
                const link = $(element);
                const href = link.attr("href");
                const title = cleanText(link.text());

                if (!href || !title) return null;
                if (href.includes("/c")) return null;
                if (title.length < 2) return null;

                const container =
                    link.closest("li").length > 0
                        ? link.closest("li")
                        : link.closest("div");

                const img = container.find("img").first();

                const coverRaw =
                    img.attr("data-src") ??
                    img.attr("data-original") ??
                    img.attr("src");

                const description = undefined;

                return {
                    sourceId: "mangahere",
                    sourceMangaId: normalizeSourceId(href),
                    title,
                    description,
                    coverUrl: undefined
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
        const html = await fetchMangaPageHtml(url);
        const $ = cheerio.load(html);

        const title =
            cleanText($("h1").first().text()) ||
            cleanText($("title").first().text()).replace(/- MangaHere.*$/i, "");

        const coverRaw =
            $("meta[property='og:image']").attr("content") ??
            $("meta[name='og:image']").attr("content") ??
            $(".detail-top-bar-cover img").first().attr("src") ??
            $(".detail-top-bar-cover img").first().attr("data-src") ??
            undefined;

        const coverUrl = coverRaw ? absoluteUrl(coverRaw) : undefined;

        const bodyText = cleanText($("body").text());
        const description =
            bodyText
                .split("Author：")[1]
                ?.split("Chapters Comment")[0]
                ?.replace(/^.*?more/i, "")
                ?.trim() || undefined;

        return {
            sourceId: "mangahere",
            sourceMangaId,
            title,
            description,
            coverUrl,
        };
    },

    async getChapters(sourceMangaId) {
        const url = `${BASE_URL}/${sourceMangaId}/`;
        const html = await fetchMangaPageHtml(url);
        const $ = cheerio.load(html);

        const chapters = $(".detail-chapters-list a[href*='/manga/']")
            .toArray()
            .map((element) => {
                const href = $(element).attr("href");
                const title = $(element).attr("title")?.trim() || cleanText($(element).text());

                if (!href) return null;

                const parsed = new URL(href, BASE_URL);
                const path = parsed.pathname;

                if (!path.includes(`/${sourceMangaId}/`)) return null;
                if (!/\/c[\d.]+\/1\.html$/i.test(path)) return null;

                const chapterNumber =
                    path.match(/\/c([\d.]+)\/1\.html$/i)?.[1] ??
                    chapterNumberFromText(title);

                return {
                    sourceId: "mangahere",
                    sourceMangaId,
                    sourceChapterId: normalizeChapterId(href),
                    title: title || `Chapter ${chapterNumber ?? "?"}`,
                    chapterNumber,
                    language: "en",
                    publishedAt: undefined,
                };
            })
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .filter((item, index, array) => {
                return (
                    array.findIndex((other) => other.sourceChapterId === item.sourceChapterId) ===
                    index
                );
            });

        return chapters;
    },

    async getChapterPages(sourceChapterId) {
        const chapterUrl = `${BASE_URL}/${sourceChapterId}/1.html`;
        const html = await fetchHtml(chapterUrl);
        const $ = cheerio.load(html);

        const cheerioImages = $(".read-img-bar img, img.reader-main-img")
            .toArray()
            .map((element) => {
                return (
                    $(element).attr("data-src") ??
                    $(element).attr("data-original") ??
                    $(element).attr("src")
                );
            })
            .filter((src): src is string => Boolean(src));

        const packedImages = extractPackedMangaHereImages(html);

        const imageUrls = [...cheerioImages, ...packedImages]
            .map(absoluteUrl)
            .filter((src) => {
                return (
                    src.includes("/store/manga/") &&
                    /\.(jpg|jpeg|png|webp)(\?|$)/i.test(src) &&
                    !src.includes("static.mangahere") &&
                    !src.includes("nopicture") &&
                    !src.includes("logo") &&
                    !src.includes("blank") &&
                    !src.includes("placeholder")
                );
            })
            .filter((src, index, array) => array.indexOf(src) === index);

        if (imageUrls.length === 0) {
            throw new Error(`No MangaHere pages found for chapter ${sourceChapterId}`);
        }

        return imageUrls.map((url, index) => ({
            index,
            url,
        }));
    },
};