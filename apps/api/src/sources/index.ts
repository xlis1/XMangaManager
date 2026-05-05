import type { SourceAdapter } from "../source-adapter.js";
import { mangadexAdapter } from "./mangadex.js";

const sources: SourceAdapter[] = [mangadexAdapter];

export function getSources() {
  return sources.map((source) => ({
    id: source.id,
    displayName: source.displayName,
  }));
}

export function getSource(id: string): SourceAdapter {
  const source = sources.find((s) => s.id === id);

  if (!source) {
    throw new Error(`Unknown source: ${id}`);
  }

  return source;
}