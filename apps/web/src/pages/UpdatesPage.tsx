import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type UpdateFeedItem } from "../api";

export function UpdatesPage() {
  const [updates, setUpdates] = useState<UpdateFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setUpdates(await api.getUpdates());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load updates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <p className="muted">Loading updates...</p>;

  return (
    <section>
      <div className="pageHeader">
        <div>
          <h1>Updates</h1>
          <p className="muted">Recently detected chapters in your local library.</p>
        </div>

        <Link to="/" className="button subtle">
          Library
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="updatesList">
        {updates.map((chapter) => (
          <article className="updateRow" key={chapter.id}>
            {chapter.manga?.coverUrl ? (
              <img src={chapter.manga.coverUrl} alt={chapter.manga.title} />
            ) : (
              <div className="tinyCoverPlaceholder">No Cover</div>
            )}

            <div className="updateMain">
              <Link
                to={
                  chapter.manga
                    ? `/manga/${chapter.manga.id}/read/${chapter.id}`
                    : "#"
                }
              >
                <h2>
                  {chapter.manga?.title ?? "Unknown Manga"} — Chapter{" "}
                  {chapter.chapterNumber ?? "?"}
                </h2>
              </Link>

              <p className="muted">
                {chapter.title || "Untitled"} · {chapter.downloadStatus} ·{" "}
                {chapter.readStatus}
              </p>

              <p className="muted">
                Detected: {chapter.detectedAt}
                {chapter.releasedAt ? ` · Released: ${chapter.releasedAt}` : ""}
              </p>
            </div>

            {chapter.manga && (
              <Link to={`/manga/${chapter.manga.id}`} className="button subtle">
                Manga
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}