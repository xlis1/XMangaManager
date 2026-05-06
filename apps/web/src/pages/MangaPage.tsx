import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type MangaDetails } from "../api";
import { useRef } from "react";

export function MangaPage() {
  const { mangaId } = useParams();

  const [manga, setManga] = useState<MangaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [verifiedChapters, setVerifiedChapters] = useState<Record<string, boolean>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuDirection, setMenuDirection] = useState<Record<string, "up" | "down">>({});
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [mangaMenuOpen, setMangaMenuOpen] = useState(false);

  async function verifyChapter(chapterId: string) {
    try {
      setBusy(`verify-${chapterId}`);
      const result = await api.verifyChapter(chapterId);

      setVerifiedChapters((current) => ({
        ...current,
        [chapterId]: result.verified,
      }));

      await reloadWithoutJump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy("");
    }
  }

  async function repairChapter(chapterId: string) {
    try {
      setBusy(`repair-${chapterId}`);
      await api.repairChapter(chapterId);
      await verifyChapter(chapterId);
      await reloadWithoutJump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Repair failed");
    } finally {
      setBusy("");
    }
  }

  async function redownloadChapter(chapterId: string) {
    const confirmed = window.confirm(
      "Force redownload this chapter? Existing local page files will be overwritten.",
    );

    if (!confirmed) return;

    try {
      setBusy(`redownload-${chapterId}`);
      await api.redownloadChapter(chapterId);
      await verifyChapter(chapterId);
      await reloadWithoutJump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Redownload failed");
    } finally {
      setBusy("");
    }
  }

  async function load() {
    if (!mangaId) return;

    try {
      setLoading(true);
      setManga(await api.getManga(mangaId));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load manga");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;

      if (!menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    void load();
  }, [mangaId]);

  const chapters = useMemo(() => {
    return [...(manga?.chapters ?? [])].sort((a, b) => {
      const aNum = Number(a.chapterNumber ?? 0);
      const bNum = Number(b.chapterNumber ?? 0);

      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return bNum - aNum;
      }

      return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
    });
  }, [manga]);

  async function refresh() {
    if (!mangaId) return;

    try {
      setBusy("refresh");
      await api.refreshManga(mangaId);
      await reloadWithoutJump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setBusy("");
    }
  }

  async function saveDisplayTitle() {
    if (!mangaId) return;

    try {
      setBusy("title");
      const updated = await api.updateDisplayTitle(
        mangaId,
        titleDraft.trim() || null,
      );
      setManga(updated);
      setEditingTitle(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update title");
    } finally {
      setBusy("");
    }
  }

  async function resetDisplayTitle() {
    if (!mangaId) return;

    try {
      setBusy("title");
      const updated = await api.updateDisplayTitle(mangaId, null);
      setManga(updated);
      setTitleDraft(updated.title);
      setEditingTitle(false);
    } finally {
      setBusy("");
    }
  }

  async function cacheCover() {
    if (!mangaId) return;

    try {
      setBusy("cover");
      await api.cacheCover(mangaId);
      await reloadWithoutJump();
    } finally {
      setBusy("");
    }
  }

  async function verifyAll() {
    if (!mangaId) return;

    try {
      setBusy("verify-all");
      await api.verifyAllChapters(mangaId);
      await reloadWithoutJump();
    } finally {
      setBusy("");
    }
  }

  async function repairAll() {
    if (!mangaId) return;

    try {
      setBusy("repair-all");
      await api.repairAllChapters(mangaId);
      await reloadWithoutJump();
    } finally {
      setBusy("");
    }
  }

  async function markAllRead() {
    if (!mangaId) return;

    const updated = await api.markAllChaptersRead(mangaId);
    setManga(updated);
  }

  async function markAllUnread() {
    if (!mangaId) return;

    const confirmed = window.confirm("Mark every chapter as unread?");
    if (!confirmed) return;

    const updated = await api.markAllChaptersUnread(mangaId);
    setManga(updated);
  }

  async function downloadMissing() {
    if (!mangaId) return;

    try {
      setBusy("download-missing");
      await api.downloadMissing(mangaId);
      await reloadWithoutJump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy("");
    }
  }

  async function toggleAutoDownload() {
    if (!manga || !mangaId) return;

    try {
      setBusy("tracking");
      await api.setTracking(mangaId, {
        tracked: manga.tracked,
        autoDownload: !manga.autoDownload,
      });
      await reloadWithoutJump();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tracking update failed");
    } finally {
      setBusy("");
    }
  }

  async function reloadWithoutJump() {
    const x = window.scrollX;
    const y = window.scrollY;

    await load();

    requestAnimationFrame(() => {
      window.scrollTo(x, y);
    });
  }

  async function downloadChapter(chapterId: string) {
    try {
      setBusy(chapterId);
      await api.downloadChapter(chapterId);
      await reloadWithoutJump();

    } catch (err) {
      setError(err instanceof Error ? err.message : "Chapter download failed");
    } finally {
      setBusy("");
    }
  }

  async function markRead(chapterId: string) {
    const updated = await api.markRead(chapterId);

    setManga((current) => {
      if (!current) return current;

      return {
        ...current,
        chapters: current.chapters.map((chapter) =>
          chapter.id === chapterId
            ? {
              ...chapter,
              readStatus: updated.readStatus,
              lastReadPageIndex: updated.lastReadPageIndex,
            }
            : chapter,
        ),
      };
    });
  }

  async function deleteChapterLocalFiles(chapterId: string) {
    const confirmed = window.confirm(
      "Delete this chapter's local files and mark it as not downloaded?",
    );

    if (!confirmed) return;

    const updated = await api.deleteChapterLocalFiles(chapterId);

    setManga((current) => {
      if (!current) return current;

      return {
        ...current,
        chapters: current.chapters.map((chapter) =>
          chapter.id === chapterId
            ? {
              ...chapter,
              downloadStatus: updated.downloadStatus,
            }
            : chapter,
        ),
      };
    });
  }

  async function markUnread(chapterId: string) {
    const updated = await api.markUnread(chapterId);

    setManga((current) => {
      if (!current) return current;

      return {
        ...current,
        chapters: current.chapters.map((chapter) =>
          chapter.id === chapterId
            ? {
              ...chapter,
              readStatus: updated.readStatus,
              lastReadPageIndex: updated.lastReadPageIndex,
            }
            : chapter,
        ),
      };
    });
  }

  async function unfollow() {
    if (!mangaId) return;

    try {
      setBusy("unfollow");
      await api.unfollowManga(mangaId);
      await reloadWithoutJump();
    } finally {
      setBusy("");
    }
  }

  async function follow() {
    if (!mangaId) return;

    try {
      setBusy("follow");
      await api.followManga(mangaId);
      await reloadWithoutJump();
    } finally {
      setBusy("");
    }
  }

  async function deleteManga() {
    if (!mangaId || !manga) return;

    const confirmed = window.confirm(
      `Delete "${manga.title}" from library and remove downloaded files?`,
    );

    if (!confirmed) return;

    await api.deleteManga(mangaId);
    window.location.href = "/";
  }

  if (loading) return <p className="muted">Loading manga...</p>;
  if (!manga) return <p className="error">Manga not found.</p>;

  const allRead = chapters.length > 0 && chapters.every((c) => c.readStatus === "read");

  const allUnread =
    chapters.length > 0 && chapters.every((c) => c.readStatus === "unread");

  const hasBrokenDownloads = chapters.some(
    (c) => c.downloadStatus === "failed" || c.downloadStatus === "partial",
  );

  const hasMissingDownloads = chapters.some(
    (c) => c.downloadStatus !== "downloaded",
  );

  const coverCached = Boolean(manga.localCoverUrl);

  return (
    <section>
      <div className="mangaHero">
        {manga.coverUrl ? (
          <img src={manga.coverUrl} alt={manga.title} />
        ) : (
          <div className="coverPlaceholder">No Cover</div>
        )}

        <div>
          {editingTitle ? (
            <div className="titleEditor">
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
              />

              <button onClick={() => void saveDisplayTitle()} disabled={busy === "title"}>
                Save
              </button>

              <button onClick={() => setEditingTitle(false)}>Cancel</button>

              <button onClick={() => void resetDisplayTitle()} disabled={busy === "title"}>
                Reset
              </button>
            </div>
          ) : (
            <div className="titleLine">
              <h1>{manga.title}</h1>
              <button onClick={() => setEditingTitle(true)}>Rename</button>
            </div>
          )}

          {manga.originalTitle && manga.originalTitle !== manga.title && (
            <p className="muted">Original title: {manga.originalTitle}</p>
          )}
          <p className="muted">
            {manga.sourceId} · {chapters.length} chapters
          </p>

          <p className="description">
            {manga.description || "No description."}
          </p>

          <div className="actions">
            <button onClick={() => void refresh()} disabled={busy === "refresh"}>
              {busy === "refresh" ? "Refreshing..." : "Refresh Chapters"}
            </button>

            {hasMissingDownloads && (
              <button
                onClick={() => void downloadMissing()}
                disabled={busy === "download-missing"}
              >
                {busy === "download-missing" ? "Downloading..." : "Download Missing"}
              </button>
            )}

            <div className="mangaMenuWrap">
              <button
                className="iconButton"
                onClick={() => setMangaMenuOpen((open) => !open)}
              >
                ⋯
              </button>

              {mangaMenuOpen && (
                <div className="mangaMenu">
                  <button
                    onClick={() => {
                      setMangaMenuOpen(false);
                      void toggleAutoDownload();
                    }}
                    disabled={busy === "tracking"}
                  >
                    {manga.autoDownload ? "Disable Auto-download" : "Enable Auto-download"}
                  </button>

                  {manga.tracked ? (
                    <button
                      onClick={() => {
                        setMangaMenuOpen(false);
                        void unfollow();
                      }}
                      disabled={busy === "unfollow"}
                    >
                      Unfollow
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setMangaMenuOpen(false);
                        void follow();
                      }}
                      disabled={busy === "follow"}
                    >
                      Follow
                    </button>
                  )}

                  {!coverCached && manga.coverUrl && (
                    <button
                      onClick={() => {
                        setMangaMenuOpen(false);
                        void cacheCover();
                      }}
                      disabled={busy === "cover"}
                    >
                      Cache Cover
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setMangaMenuOpen(false);
                      void verifyAll();
                    }}
                    disabled={busy === "verify-all"}
                  >
                    Verify All Downloads
                  </button>

                  {hasBrokenDownloads && (
                    <button
                      onClick={() => {
                        setMangaMenuOpen(false);
                        void repairAll();
                      }}
                      disabled={busy === "repair-all"}
                    >
                      Repair Broken Downloads
                    </button>
                  )}

                  {!allRead && (
                    <button
                      onClick={() => {
                        setMangaMenuOpen(false);
                        void markAllRead();
                      }}
                    >
                      Mark All Read
                    </button>
                  )}

                  {!allUnread && (
                    <button
                      onClick={() => {
                        setMangaMenuOpen(false);
                        void markAllUnread();
                      }}
                    >
                      Mark All Unread
                    </button>
                  )}

                  <button
                    className="danger"
                    onClick={() => {
                      setMangaMenuOpen(false);
                      void deleteManga();
                    }}
                  >
                    Delete From Library
                  </button>
                </div>
              )}
            </div>
          </div>

          {manga.lastCheckedAt && (
            <p className="muted">Last checked: {manga.lastCheckedAt}</p>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <h2>Chapters</h2>

      <div className="chapterList">
        {chapters.map((chapter) => (
          <article
            className={`chapterRow ${chapter.readStatus === "reading"
              ? "chapterRowReading"
              : chapter.readStatus !== "read"
                ? "chapterRowUnread"
                : ""
              }`}
            key={chapter.id}
          >
            <Link to={`/manga/${manga.id}/read/${chapter.id}`} className="chapterMain">
              <div>
                <h3>
                  Chapter {chapter.chapterNumber ?? "?"}
                  {chapter.title ? ` — ${chapter.title}` : ""}
                </h3>

                <p className="muted">
                  {chapter.language ?? "?"} · {chapter.downloadStatus}
                  {verifiedChapters[chapter.id] === true ? " · verified" : ""}
                  {verifiedChapters[chapter.id] === false ? " · needs repair" : ""}
                  {" · "}
                  {chapter.readStatus}
                </p>
              </div>
            </Link>

            <div
              className="chapterMenuWrap"
              ref={openMenuId === chapter.id ? menuRef : null}
            >
              <button
                type="button"
                className="iconButton"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  const rect = event.currentTarget.getBoundingClientRect();
                  const estimatedMenuHeight = 260;
                  const shouldOpenUp = rect.bottom + estimatedMenuHeight > window.innerHeight;

                  setMenuDirection((current) => ({
                    ...current,
                    [chapter.id]: shouldOpenUp ? "up" : "down",
                  }));

                  setOpenMenuId((current) => (current === chapter.id ? null : chapter.id));
                }}
              >
                ⋯
              </button>

              {openMenuId === chapter.id && (
                <div
                  className={`chapterMenu ${menuDirection[chapter.id] === "up" ? "chapterMenuUp" : "chapterMenuDown"
                    }`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  {chapter.downloadStatus !== "downloaded" && (
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        void downloadChapter(chapter.id);
                      }}
                      disabled={busy === chapter.id}
                    >
                      {busy === chapter.id ? "Downloading..." : "Download"}
                    </button>
                  )}

                  {chapter.downloadStatus === "downloaded" && (
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        void verifyChapter(chapter.id);
                      }}
                      disabled={busy === `verify-${chapter.id}`}
                    >
                      Verify
                    </button>
                  )}

                  {verifiedChapters[chapter.id] === false && (
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        void repairChapter(chapter.id);
                      }}
                      disabled={busy === `repair-${chapter.id}`}
                    >
                      Repair
                    </button>
                  )}

                  {chapter.downloadStatus === "downloaded" && (
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        void redownloadChapter(chapter.id);
                      }}
                      disabled={busy === `redownload-${chapter.id}`}
                    >
                      Redownload
                    </button>
                  )}

                  {chapter.readStatus === "read" ? (
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        void markUnread(chapter.id);
                      }}
                    >
                      Mark Unread
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        void markRead(chapter.id);
                      }}
                    >
                      Mark Read
                    </button>
                  )}

                  {chapter.downloadStatus !== "not_downloaded" && (
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        void deleteChapterLocalFiles(chapter.id);
                      }}
                    >
                      Delete Local Files
                    </button>
                  )}

                  {(chapter.downloadStatus === "failed" || chapter.downloadStatus === "partial") && (
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        void repairChapter(chapter.id);
                      }}
                      disabled={busy === `repair-${chapter.id}`}
                    >
                      {busy === `repair-${chapter.id}` ? "Repairing..." : "Repair Chapter"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}