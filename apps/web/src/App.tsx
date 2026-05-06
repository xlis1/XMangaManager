import { useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { LibraryPage } from "./pages/LibraryPage";
import { MangaPage } from "./pages/MangaPage";
import { ReaderPage } from "./pages/ReaderPage";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UpdatesPage } from "./pages/UpdatesPage";
import { QueueStatus } from "./components/QueueStatus";

export default function App() {
  const location = useLocation();
  const isReader = location.pathname.includes("/read/");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app">
      {!isReader && (
        <>
          <header className="topbar">
            <button
              className="iconButton"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              ☰
            </button>

            <Link to="/" className="brand">
              XManga Manager
            </Link>
          </header>

          {menuOpen && (
            <div
              className="appMenuBackdrop"
              onClick={() => setMenuOpen(false)}
              role="button"
              tabIndex={0}
              aria-label="Close navigation menu"
            />
          )}

          <aside className={`appSidebar ${menuOpen ? "open" : ""}`}>
            <div className="sidebarHeader">
              <h2>Navigation</h2>
              <button onClick={() => setMenuOpen(false)}>Close</button>
            </div>

            <nav className="appSidebarNav">
              <Link to="/" onClick={() => setMenuOpen(false)}>
                Library
              </Link>

              <Link to="/search" onClick={() => setMenuOpen(false)}>
                Search
              </Link>

              <Link to="/updates" onClick={() => setMenuOpen(false)}>
                Updates
              </Link>

              <Link to="/settings" onClick={() => setMenuOpen(false)}>
                Settings
              </Link>
            </nav>
          </aside>
          <QueueStatus />
        </>
      )}

      <main className={isReader ? "readerMain" : "main"}>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/updates" element={<UpdatesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/manga/:mangaId" element={<MangaPage />} />
          <Route path="/manga/:mangaId/read/:chapterId" element={<ReaderPage />} />
        </Routes>
      </main>
    </div>
  );
}