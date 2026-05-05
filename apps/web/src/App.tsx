import { Link, Route, Routes, useLocation } from "react-router-dom";
import { LibraryPage } from "./pages/LibraryPage";
import { MangaPage } from "./pages/MangaPage";
import { ReaderPage } from "./pages/ReaderPage";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UpdatesPage } from "./pages/UpdatesPage";

export default function App() {
  const location = useLocation();
  const isReader = location.pathname.includes("/read/");

  return (
    <div className="app">
      {!isReader && (
        <header className="topbar">
          <Link to="/" className="brand">
            XManga Manager
          </Link>

          <nav className="nav">
            <Link to="/">Library</Link>
            <Link to="/updates">Updates</Link>
            <Link to="/search">Search</Link>
            <Link to="/settings">Settings</Link>
          </nav>
        </header>
      )}

      <main className={isReader ? "readerMain" : "main"}>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/updates" element={<UpdatesPage />} />
          <Route path="/manga/:mangaId" element={<MangaPage />} />
          <Route path="/manga/:mangaId/read/:chapterId" element={<ReaderPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}