/**
 * db.ts
 *
 * SQLite database layer using react-native-quick-sqlite.
 * Call initDb() once at app startup (in app/_layout.tsx) before any other
 * database function is used.
 *
 * Naming conventions:
 *  - All exported query functions are async so callers can await them uniformly,
 *    even though quick-sqlite executes synchronously under the hood.
 *  - Table names are singular snake_case.
 *  - Column names mirror the TypeScript field names exactly.
 */

import { placeHolderSource, sourceManager } from "@/sources";
import { Chapter, Manga } from "@/utils/sourceModel";
import { open } from "react-native-quick-sqlite";

// ---------------------------------------------------------------------------
// Shared types (re-exported so stores don't need to import db internals)
// ---------------------------------------------------------------------------

export interface Download {
  id: string;
  mangaUrl: string;
  chapterUrl: string;
  mangaTitle: string;
  chapterTitle: string;
  status: "pending" | "downloading" | "done" | "error";
  progress: number;
  localPath: string;
  queueIndex: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface History {
  mangaUrl: string;
  mangaTitle: string;
  chapterUrl: string;
  chapterNumber: number;
  source: string;
  lastRead: string;
  page: number;
}

// ---------------------------------------------------------------------------
// Database connection (module-level singleton)
// ---------------------------------------------------------------------------

const db = open({ name: "manga.db" });

// ---------------------------------------------------------------------------
// initDb — create tables if they don't exist
// Call this ONCE from app/_layout.tsx before any navigation renders.
// ---------------------------------------------------------------------------

export function initDb(): void {
  // Manga library
  db.execute(`
    CREATE TABLE IF NOT EXISTS manga (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      url         TEXT UNIQUE NOT NULL,
      imageUrl    TEXT,
      lastChapter TEXT,
      lastUpdated TEXT,
      source      TEXT,
      category    TEXT DEFAULT 'default',
      data        TEXT,
      readCount   INTEGER DEFAULT 0,
      dateAdded   TEXT,
      userRating  REAL,
      userNotes   TEXT
    );
  `);

  // Chapters (url is the natural primary key)
  db.execute(`
    CREATE TABLE IF NOT EXISTS chapter (
      url              TEXT PRIMARY KEY,
      manga            TEXT NOT NULL,
      title            TEXT,
      number           REAL NOT NULL,
      volume           REAL,
      publishedAt      TEXT,
      scanlationGroup  TEXT,
      language         TEXT DEFAULT 'en',
      pages            TEXT,
      isRead           INTEGER DEFAULT 0,
      lastReadPage     INTEGER DEFAULT 0,
      lastReadAt       TEXT,
      isDownloaded     INTEGER DEFAULT 0,
      FOREIGN KEY(manga) REFERENCES manga(url) ON DELETE CASCADE
    );
  `);

  // Download queue
  db.execute(`
    CREATE TABLE IF NOT EXISTS download (
      id           TEXT PRIMARY KEY,
      mangaUrl     TEXT,
      chapterUrl   TEXT,
      mangaTitle   TEXT,
      chapterTitle TEXT,
      status       TEXT,
      progress     REAL,
      localPath    TEXT,
      queueIndex   INTEGER
    );
  `);

  // User-defined library categories
  db.execute(`
    CREATE TABLE IF NOT EXISTS category (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);
  db.execute(
    `INSERT OR IGNORE INTO category (id, name) VALUES ('default', 'All');`
  );

  // Reading history
  db.execute(`
    CREATE TABLE IF NOT EXISTS history (
      id            TEXT PRIMARY KEY,
      mangaUrl      TEXT NOT NULL,
      mangaTitle    TEXT,
      chapterUrl    TEXT,
      chapterNumber REAL,
      source        TEXT,
      lastRead      TEXT,
      page          INTEGER DEFAULT 0
    );
  `);
}

// ---------------------------------------------------------------------------
// Manga
// ---------------------------------------------------------------------------

/** Upsert a manga into the library. */
export function addManga(manga: Manga): void {
  db.execute(
    `INSERT OR REPLACE INTO manga
      (id, name, url, imageUrl, lastChapter, lastUpdated, source, category, data, readCount, dateAdded, userRating, userNotes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      manga.id,
      manga.name,
      manga.url ?? null,
      manga.imageUrl ?? null,
      manga.lastChapter ?? null,
      manga.lastUpdated ?? null,
      manga.source.name ?? null,
      manga.category ?? "default",
      JSON.stringify(manga.data ?? {}),
      manga.readCount ?? 0,
      manga.dateAdded ?? new Date().toISOString(),
      manga.userRating ?? null,
      manga.userNotes ?? null,
    ]
  );
}

/** Return all manga in the library as Manga instances. */
export function getMangas(): Manga[] {
  const result = db.execute("SELECT * FROM manga");
  return (
    result.rows?._array.map(
      (row: any) =>
        new Manga({
          id: row.id,
          name: row.name,
          url: row.url,
          imageUrl: row.imageUrl,
          lastChapter: row.lastChapter,
          lastUpdated: row.lastUpdated,
          source:
            sourceManager.getSourceByName(row.source)?.source ??
            placeHolderSource,
          data: JSON.parse(row.data ?? "{}"),
          category: row.category,
          inLibrary: true,
          readCount: row.readCount ?? 0,
          dateAdded: row.dateAdded,
          userRating: row.userRating ?? undefined,
          userNotes: row.userNotes ?? undefined,
        })
    ) ?? []
  );
}

/** Remove a manga (and its chapters via CASCADE). */
export function deleteManga(mangaUrl: string): void {
  db.execute("DELETE FROM manga WHERE url = ?", [mangaUrl]);
}

/** Update the readCount for a manga. */
export function updateMangaReadCount(mangaUrl: string, readCount: number): void {
  db.execute("UPDATE manga SET readCount = ? WHERE url = ?", [
    readCount,
    mangaUrl,
  ]);
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

/** Upsert a list of chapters in a single transaction. */
export function addChapters(chapters: Chapter[]): void {
  if (!chapters?.length) return;
  try {
    db.transaction((tx) => {
      for (const ch of chapters) {
        tx.execute(
          `INSERT OR REPLACE INTO chapter
            (url, manga, title, number, volume, publishedAt, scanlationGroup, language, pages, isRead, lastReadPage, lastReadAt, isDownloaded)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ch.url,
            ch.manga,
            ch.title ?? "",
            ch.number,
            ch.volume ?? null,
            ch.publishedAt,
            ch.scanlationGroup ?? null,
            ch.language ?? "en",
            JSON.stringify(ch.pages ?? []),
            ch.isRead ? 1 : 0,
            ch.lastReadPage ?? 0,
            ch.lastReadAt ?? null,
            ch.isDownloaded ? 1 : 0,
          ]
        );
      }
    });
  } catch (error) {
    console.error("Failed to add chapters:", error);
  }
}

/** Return all chapters for a manga URL, ordered by chapter number ascending. */
export function getChapters(mangaUrl: string): Chapter[] {
  const result = db.execute(
    "SELECT * FROM chapter WHERE manga = ? ORDER BY number ASC",
    [mangaUrl]
  );
  return (
    result.rows?._array.map(
      (row: any) =>
        new Chapter({
          url: row.url,
          manga: row.manga,
          title: row.title,
          number: row.number,
          volume: row.volume ?? undefined,
          publishedAt: row.publishedAt,
          scanlationGroup: row.scanlationGroup ?? undefined,
          language: row.language ?? "en",
          pages: JSON.parse(row.pages ?? "[]"),
          isRead: row.isRead === 1,
          lastReadPage: row.lastReadPage ?? 0,
          lastReadAt: row.lastReadAt ?? undefined,
          isDownloaded: row.isDownloaded === 1,
        })
    ) ?? []
  );
}

/** Mark a single chapter as read and record the last page. */
export function markChapterRead(
  chapterUrl: string,
  lastReadPage: number = 0
): void {
  db.execute(
    `UPDATE chapter SET isRead = 1, lastReadPage = ?, lastReadAt = ? WHERE url = ?`,
    [lastReadPage, new Date().toISOString(), chapterUrl]
  );
}

/** Mark a single chapter as unread. */
export function markChapterUnread(chapterUrl: string): void {
  db.execute(
    `UPDATE chapter SET isRead = 0, lastReadPage = 0, lastReadAt = NULL WHERE url = ?`,
    [chapterUrl]
  );
}

/** Update the last-read page for a chapter (called while reading). */
export function updateChapterProgress(
  chapterUrl: string,
  page: number
): void {
  db.execute(
    `UPDATE chapter SET lastReadPage = ?, lastReadAt = ? WHERE url = ?`,
    [page, new Date().toISOString(), chapterUrl]
  );
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

export async function insertDownload(item: Download): Promise<void> {
  db.execute(
    `INSERT INTO download (id, mangaUrl, chapterUrl, mangaTitle, chapterTitle, status, progress, localPath, queueIndex)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.mangaUrl,
      item.chapterUrl,
      item.mangaTitle,
      item.chapterTitle,
      item.status,
      item.progress,
      item.localPath,
      item.queueIndex,
    ]
  );
}

export async function updateDownloadStatus(
  id: string,
  status: string,
  progress: number
): Promise<void> {
  db.execute(`UPDATE download SET status = ?, progress = ? WHERE id = ?`, [
    status,
    progress,
    id,
  ]);
}

export async function getAllDownloads(): Promise<Download[]> {
  const result = db.execute(`
    SELECT * FROM download ORDER BY
      CASE
        WHEN status = 'downloading' THEN 1
        WHEN status = 'pending'     THEN 2
        WHEN status = 'done'        THEN 3
        WHEN status = 'error'       THEN 4
      END,
      queueIndex ASC
  `);
  return result.rows?._array ?? [];
}

export async function getDownloadsByChapter(
  chapterUrl: string
): Promise<Download[]> {
  const result = db.execute(
    `SELECT * FROM download WHERE chapterUrl = ? ORDER BY queueIndex ASC`,
    [chapterUrl]
  );
  return result.rows?._array ?? [];
}

export async function deleteDownload(id: string): Promise<void> {
  db.execute(`DELETE FROM download WHERE id = ?`, [id]);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  const result = db.execute(`SELECT * FROM category`);
  return result.rows?._array ?? [];
}

export async function insertCategory(item: Category): Promise<void> {
  db.execute(`INSERT INTO category (id, name) VALUES (?, ?)`, [
    item.id,
    item.name,
  ]);
}

export async function deleteCategory(id: string): Promise<void> {
  db.execute(`DELETE FROM category WHERE id = ?`, [id]);
}

/** Move all manga in oldCategoryId to newCategoryId (used before deleting a category). */
export async function reassignMangaCategory(
  oldCategoryId: string,
  newCategoryId: string
): Promise<void> {
  db.transaction((tx) => {
    tx.execute(`UPDATE manga SET category = ? WHERE category = ?`, [
      newCategoryId,
      oldCategoryId,
    ]);
  });
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/** Insert a new history record. Uses mangaUrl as the logical key. */
export async function addToHistory(item: History): Promise<void> {
  const id = `history_${item.mangaUrl}`;
  db.execute(
    `INSERT OR REPLACE INTO history (id, mangaUrl, mangaTitle, chapterUrl, chapterNumber, source, lastRead, page)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      item.mangaUrl,
      item.mangaTitle,
      item.chapterUrl,
      item.chapterNumber,
      item.source,
      item.lastRead,
      item.page,
    ]
  );
}

/** Update an existing history record when the user continues reading. */
export async function updateHistory(
  mangaUrl: string,
  chapterUrl: string,
  chapterNumber: number,
  page: number,
  lastRead: string
): Promise<void> {
  db.execute(
    `UPDATE history
     SET chapterUrl = ?, chapterNumber = ?, lastRead = ?, page = ?
     WHERE mangaUrl = ?`,
    [chapterUrl, chapterNumber, lastRead, page, mangaUrl]
  );
}

/** Return all history entries ordered by most recently read first. */
export async function getHistory(): Promise<History[]> {
  try {
    const result = db.execute(
      `SELECT * FROM history ORDER BY lastRead DESC`
    );
    return (result.rows?._array ?? []).map((row: any) => ({
      mangaUrl: row.mangaUrl,
      mangaTitle: row.mangaTitle,
      chapterUrl: row.chapterUrl,
      chapterNumber: row.chapterNumber,
      source: row.source,
      lastRead: row.lastRead,
      page: row.page,
    }));
  } catch {
    console.error("Failed to get history");
    return [];
  }
}

/** Delete all history for a given manga. */
export async function deleteHistory(mangaUrl: string): Promise<void> {
  db.execute(`DELETE FROM history WHERE mangaUrl = ?`, [mangaUrl]);
}
