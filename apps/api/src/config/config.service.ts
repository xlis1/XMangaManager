import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { settings } from "../db/schema.js";

export type AppConfig = {
  theme: "dark" | "light";
  libraryPath: string;
  downloadPages: boolean;
  defaultSource: string;
  preferredLanguages: string[];
  readerDirection: "ltr" | "rtl" | "vertical";
  pageFit: "width" | "height" | "original";

  updateIntervalMinutes: number;
  autoCheckOnStartup: boolean;
  requestDelayMs: number;
  chapterDownloadDelayMs: number;
};

export const defaultConfig: AppConfig = {
  theme: "dark",
  libraryPath: "./data/media",
  downloadPages: false,
  defaultSource: "mangadex",
  preferredLanguages: ["en"],
  readerDirection: "rtl",
  pageFit: "width",

  updateIntervalMinutes: 360,
  autoCheckOnStartup: false,
  requestDelayMs: 1500,
  chapterDownloadDelayMs: 750,
};

export async function getConfig(): Promise<AppConfig> {
  const rows = db.select().from(settings).all();

  const values = Object.fromEntries(
    rows.map((row) => [row.key, JSON.parse(row.value)]),
  );

  return {
    ...defaultConfig,
    ...values,
  };
}

export async function updateConfig(partial: Partial<AppConfig>) {
  for (const [key, value] of Object.entries(partial)) {
    db.insert(settings)
      .values({
        key,
        value: JSON.stringify(value),
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: JSON.stringify(value),
        },
      })
      .run();
  }

  return getConfig();
}