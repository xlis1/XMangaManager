import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AppConfig, type Manga } from "../api";

type SortMode =
  | "titleAsc"
  | "titleDesc"
  | "recentlyReadDesc"
  | "recentlyReadAsc"
  | "recentlyUpdatedDesc"
  | "recentlyUpdatedAsc"
  | "unreadDesc"
  | "unreadAsc";

export function LibraryPage() {
  const [library, setLibrary] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("titleAsc");
  const [config, setConfig] = useState<AppConfig | null>(null);

  async function load() {
    try {
      setLoading(true);

      const [libraryResult, configResult] = await Promise.all([
        api.getLibrary(),
        api.getConfig(),
      ]);

      setLibrary(libraryResult);
      setConfig(configResult);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library");
    } finally {
      setLoading(false);
    }
  }

  async function checkAll() {
    try {
      setChecking(true);
      await api.runCheckAllJob();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update check failed");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredLibrary = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = query
      ? library.filter((manga) => manga.title.toLowerCase().includes(query))
      : library;

    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case "titleAsc":
          return a.title.localeCompare(b.title);

        case "titleDesc":
          return b.title.localeCompare(a.title);

        case "recentlyReadDesc":
          return (b.recentlyReadAt ?? "").localeCompare(a.recentlyReadAt ?? "");

        case "recentlyReadAsc":
          return (a.recentlyReadAt ?? "").localeCompare(b.recentlyReadAt ?? "");

        case "recentlyUpdatedDesc":
          return (b.latestChapterAt ?? "").localeCompare(a.latestChapterAt ?? "");

        case "recentlyUpdatedAsc":
          return (a.latestChapterAt ?? "").localeCompare(b.latestChapterAt ?? "");

        case "unreadDesc":
          return (b.unreadChapterCount ?? 0) - (a.unreadChapterCount ?? 0);

        case "unreadAsc":
          return (a.unreadChapterCount ?? 0) - (b.unreadChapterCount ?? 0);
      }
    });
  }, [library, search, sortMode]);

  if (loading) return <p className="muted">Loading library...</p>;

  return (
    <section>
      <div className="pageHeader">
        <div>
          <h1>Library</h1>
          <p className="muted">Tracked manga stored in your local library.</p>
        </div>

        <div className="actions">
          <button onClick={() => void checkAll()} disabled={checking}>
            {checking ? "Checking..." : "Check All Followed"}
          </button>

          <Link to="/updates" className="button subtle">
            Updates
          </Link>

          <Link to="/search" className="button">
            Search Manga
          </Link>
        </div>
      </div>

      <div className="libraryControls">
        <input
          value={search}
          placeholder="Search local library..."
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as SortMode)}
        >
          <option value="titleAsc">A → Z</option>
          <option value="titleDesc">Z → A</option>
          <option value="recentlyReadDesc">Recently read</option>
          <option value="recentlyReadAsc">Least recently read</option>
          <option value="recentlyUpdatedDesc">Recently updated</option>
          <option value="recentlyUpdatedAsc">Oldest updated</option>
          <option value="unreadDesc">Most unread chapters</option>
          <option value="unreadAsc">Fewest unread chapters</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      {filteredLibrary.length === 0 ? (
        <div className="empty">
          <h2>No matching manga.</h2>
          <p className="muted">Try a different search or import something.</p>
        </div>
      ) : (
        <div
          className="grid"
          style={
            {
              "--library-columns-mobile": config?.libraryColumnsMobile ?? 3,
              "--library-columns-desktop": config?.libraryColumnsDesktop ?? 6,
            } as React.CSSProperties
          }
        >
          {filteredLibrary.map((manga) => (
            <Link to={`/manga/${manga.id}`} className="mangaCard" key={manga.id}>
              <div className="coverWrap">
                {manga.coverUrl ? (
                  <img src={manga.coverUrl} alt={manga.title} />
                ) : (
                  <div className="coverPlaceholder">No Cover</div>
                )}

                {(manga.unreadChapterCount ?? 0) > 0 && (
                  <span className="unreadBadge">
                    {manga.unreadChapterCount} unread
                  </span>
                )}

                {!manga.tracked && (
                  <span className="unfollowedBadge">
                    Unfollowed
                  </span>
                )}

                {(manga.failedChapterCount ?? 0) > 0 && (
                  <span className="failureBadge">
                    {manga.failedChapterCount} broken
                  </span>
                )}
              </div>

              <div className="mangaCardBody">
                <h2>{manga.title}</h2>
                <p className="muted">
                  {manga.chapterCount ?? 0} chapters ·{" "}
                  {manga.autoDownload ? "Auto-download" : "Manual"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}