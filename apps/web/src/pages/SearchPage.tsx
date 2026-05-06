import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type SearchResult } from "../api";

export function SearchPage() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState("");
  const [error, setError] = useState("");
  const [sourceId, setSourceId] = useState("mangadex");

  async function search() {
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError("");
      setResults(await api.searchManga(sourceId, query));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function importManga(result: SearchResult) {
    try {
      setImportingId(result.sourceMangaId);
      const imported = await api.importManga(
        result.sourceId,
        result.sourceMangaId,
      );
      navigate(`/manga/${imported.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportingId("");
    }
  }

  return (
    <section>
      <div className="pageHeader">
        <div>
          <h1>Search</h1>
          <p className="muted">Search MangaDex and import manga locally.</p>
        </div>
      </div>
      <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
        <option value="mangadex">MangaDex</option>
        <option value="mangahere">MangaHere</option>
      </select>
      <div className="searchBar">
        <input
          value={query}
          placeholder="Search manga..."
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void search();
          }}
        />
        <button onClick={() => void search()} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="resultList">
        {results.map((result) => (
          <article className="resultCard" key={result.sourceMangaId}>
            {result.coverUrl ? (
              <img src={result.coverUrl} alt={result.title} />
            ) : (
              <div className="smallCoverPlaceholder">No Cover</div>
            )}

            <div>
              <h2>{result.title}</h2>
              <p className="muted lineClamp">
                {result.description || "No description."}
              </p>

              <button
                onClick={() => void importManga(result)}
                disabled={importingId === result.sourceMangaId}
              >
                {importingId === result.sourceMangaId
                  ? "Importing..."
                  : "Import"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}