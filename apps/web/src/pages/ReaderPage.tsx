import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type MangaDetails, type Page } from "../api";

type ReaderSettings = {
  readerClickMode: "normal" | "flipped";
  readerPageFit: "width" | "height" | "customWidth" | "customHeight" | "original";
  readerCustomWidth: number;
  readerCustomHeight: number;
  readerPagePadding: number;
};

const fallbackSettings: ReaderSettings = {
  readerClickMode: "normal",
  readerPageFit: "width",
  readerCustomWidth: 900,
  readerCustomHeight: 1200,
  readerPagePadding: 16,
};

export function ReaderPage() {
  const { mangaId, chapterId } = useParams();
  const navigate = useNavigate();

  const [manga, setManga] = useState<MangaDetails | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);

  const settings: ReaderSettings = {
    readerClickMode:
      manga?.readerClickMode === "flipped" ? "flipped" : fallbackSettings.readerClickMode,
    readerPageFit:
      manga?.readerPageFit === "height" ||
        manga?.readerPageFit === "customWidth" ||
        manga?.readerPageFit === "customHeight" ||
        manga?.readerPageFit === "original"
        ? manga.readerPageFit
        : fallbackSettings.readerPageFit,
    readerCustomWidth: manga?.readerCustomWidth ?? fallbackSettings.readerCustomWidth,
    readerCustomHeight: manga?.readerCustomHeight ?? fallbackSettings.readerCustomHeight,
    readerPagePadding: manga?.readerPagePadding ?? fallbackSettings.readerPagePadding,
  };

  async function load() {
    if (!mangaId || !chapterId) return;

    try {
      setLoading(true);
      const [mangaResult, pageResult] = await Promise.all([
        api.getManga(mangaId),
        api.getChapterPages(chapterId),
      ]);

      setManga(mangaResult);
      setPages(pageResult);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reader");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [mangaId, chapterId]);

  useEffect(() => {
    let lastY = window.scrollY;

    function onScroll() {
      const currentY = window.scrollY;
      setNavVisible(currentY < lastY || currentY < 24);
      lastY = currentY;
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sortedPages = useMemo(() => {
    return [...pages].sort((a, b) => a.pageIndex - b.pageIndex);
  }, [pages]);

  const chapters = useMemo(() => {
    return [...(manga?.chapters ?? [])].sort((a, b) => {
      const aNum = Number(a.chapterNumber ?? 0);
      const bNum = Number(b.chapterNumber ?? 0);

      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return aNum - bNum;
      }

      return (a.publishedAt ?? "").localeCompare(b.publishedAt ?? "");
    });
  }, [manga]);

  const currentChapterIndex = chapters.findIndex((c) => c.id === chapterId);
  const previousChapter = chapters[currentChapterIndex - 1];
  const nextChapter = chapters[currentChapterIndex + 1];

  function isNearBottom() {
    const scrollTop = window.scrollY;
    const viewportHeight = window.innerHeight;
    const fullHeight = document.documentElement.scrollHeight;

    if (fullHeight <= viewportHeight) return true;

    const scrollPercent = (scrollTop + viewportHeight) / fullHeight;

    return scrollPercent >= 0.99;
  }

  function getCurrentPageIndex() {
    const viewportMiddle = window.scrollY + window.innerHeight / 2;
    const imageNodes = Array.from(
      document.querySelectorAll<HTMLImageElement>(".readerPages img"),
    );

    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const image of imageNodes) {
      const rect = image.getBoundingClientRect();
      const imageMiddle = window.scrollY + rect.top + rect.height / 2;
      const distance = Math.abs(viewportMiddle - imageMiddle);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = Number(image.dataset.pageIndex ?? 0);
      }
    }

    return closestIndex;
  }

  function scrollToPage(pageIndex: number) {
    const image = document.querySelector<HTMLImageElement>(
      `.readerPages img[data-page-index="${pageIndex}"]`,
    );

    image?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function goPreviousPage() {
    const current = getCurrentPageIndex();

    if (current <= 0) {
      if (previousChapter && mangaId) {
        navigate(`/manga/${mangaId}/read/${previousChapter.id}`);
      }

      return;
    }

    scrollToPage(current - 1);
  }

  async function goNextPage() {
    if (!chapterId || !mangaId) return;

    const current = getCurrentPageIndex();

    if (current >= sortedPages.length - 1 || isNearBottom()) {
      await api.markRead(chapterId);

      if (nextChapter) {
        navigate(`/manga/${mangaId}/read/${nextChapter.id}`);
      } else {
        navigate(`/manga/${mangaId}`);
      }

      return;
    }

    scrollToPage(current + 1);
  }

  async function goPreviousChapter() {
    if (!mangaId) return;

    if (previousChapter) {
      navigate(`/manga/${mangaId}/read/${previousChapter.id}`);
    } else {
      navigate(`/manga/${mangaId}`);
    }
  }

  async function goNextChapter() {
    if (!mangaId || !chapterId) return;

    await api.markRead(chapterId);

    if (nextChapter) {
      navigate(`/manga/${mangaId}/read/${nextChapter.id}`);
    } else {
      navigate(`/manga/${mangaId}`);
    }
  }

  async function handleZoneClick(side: "left" | "right") {
    const flipped = settings.readerClickMode === "flipped";

    const action =
      side === "right"
        ? flipped
          ? goPreviousPage
          : goNextPage
        : flipped
          ? goNextPage
          : goPreviousPage;

    await action();
  }


  async function saveSettings(partial: Partial<ReaderSettings>) {
    if (!mangaId) return;

    const next = {
      ...settings,
      ...partial,
    };

    const updated = await api.updateMangaReaderSettings(mangaId, next);
    setManga(updated);
  }

  const imageStyle =
    settings.readerPageFit === "width"
      ? { width: "100%", maxWidth: "100%" }
      : settings.readerPageFit === "height"
        ? { height: "calc(100vh - 32px)", width: "auto" }
        : settings.readerPageFit === "customWidth"
          ? { width: `${settings.readerCustomWidth}px`, maxWidth: "100%" }
          : settings.readerPageFit === "customHeight"
            ? { height: `${settings.readerCustomHeight}px`, width: "auto" }
            : { width: "auto", height: "auto", maxWidth: "100%" };

  if (loading) return <p className="muted">Loading reader...</p>;

  return (
    <section
      className="reader readerFullscreen"
      style={
        {
          "--reader-page-padding": `${settings.readerPagePadding}px`,
        } as React.CSSProperties
      }
    >
      <div
        className={`readerNav ${navVisible ? "visible" : ""}`}
        onMouseEnter={() => setNavVisible(true)}
      >
        <button onClick={() => setSidebarOpen(true)}>☰</button>

        <Link to={mangaId ? `/manga/${mangaId}` : "/"} className="button subtle">
          Manga
        </Link>

        <button onClick={() => void goPreviousChapter()}>Prev Chapter</button>
        <button onClick={() => void goNextChapter()}>Next Chapter</button>

        <span className="muted">
          {sortedPages.length} pages
        </span>
      </div>

      <button
        className="readerTopHotspot"
        onMouseEnter={() => setNavVisible(true)}
        aria-label="Show navigation"
      />

      <aside className={`readerSidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebarHeader">
          <h2>Reader Settings</h2>
          <button onClick={() => setSidebarOpen(false)}>Close</button>
        </div>

        <label>
          Page fit
          <select
            value={settings.readerPageFit}
            onChange={(event) =>
              void saveSettings({
                readerPageFit: event.target.value as ReaderSettings["readerPageFit"],
              })
            }
          >
            <option value="width">Fit width</option>
            <option value="height">Fit height</option>
            <option value="customWidth">Custom width</option>
            <option value="customHeight">Custom height</option>
            <option value="original">Original size</option>
          </select>
        </label>

        {settings.readerPageFit === "customWidth" && (
          <label>
            Custom width
            <input
              type="number"
              min={200}
              max={3000}
              value={settings.readerCustomWidth}
              onChange={(event) =>
                void saveSettings({
                  readerCustomWidth: Number(event.target.value),
                })
              }
            />
          </label>
        )}

        {settings.readerPageFit === "customHeight" && (
          <label>
            Custom height
            <input
              type="number"
              min={200}
              max={3000}
              value={settings.readerCustomHeight}
              onChange={(event) =>
                void saveSettings({
                  readerCustomHeight: Number(event.target.value),
                })
              }
            />
          </label>
        )}

        <label>
          Page padding
          <input
            type="number"
            min={0}
            max={200}
            value={settings.readerPagePadding}
            onChange={(event) =>
              void saveSettings({
                readerPagePadding: Number(event.target.value),
              })
            }
          />
        </label>

        <label>
          Click zones
          <select
            value={settings.readerClickMode}
            onChange={(event) =>
              void saveSettings({
                readerClickMode: event.target.value as ReaderSettings["readerClickMode"],
              })
            }
          >
            <option value="normal">Right next / left previous</option>
            <option value="flipped">Left next / right previous</option>
          </select>
        </label>
      </aside>

      {sidebarOpen && (
        <div
          className="sidebarBackdrop"
          onClick={() => setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
        />
      )}

      {error && <p className="error">{error}</p>}

      <button
        className="readerClickZone left"
        onClick={() => void handleZoneClick("left")}
        aria-label="Previous page"
      />

      <button
        className="readerClickZone right"
        onClick={() => void handleZoneClick("right")}
        aria-label="Next page"
      />

      <div className="readerPages">
        {sortedPages.map((page) => {
          const src = page.localUrl ?? page.remoteUrl;

          return (
            <img
              key={page.id}
              data-page-index={page.pageIndex}
              src={src}
              alt={`Page ${page.pageIndex + 1}`}
              loading="lazy"
              style={imageStyle}
              onLoad={() => {
                if (chapterId) {
                  void api.updateProgress(chapterId, page.pageIndex);
                }
              }}
            />
          );
        })}
      </div>
    </section>
  );
}