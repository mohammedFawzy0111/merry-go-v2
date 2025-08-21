import { placeHolderSource, sources } from "@/sources";
import { Chapter, Manga } from "@/utils/sourceModel";
import { open } from "react-native-quick-sqlite";

export interface Download {
  id: string;
  mangaUrl: string;
  chapterUrl: string;
  mangaTitle: string;
  chapterTitle: string;
  status: 'pending' | 'downloading' | 'done' | 'error';
  progress: number;
  localPath: string;
  queueIndex: number;
}

const db = open({ name: "manga.db" });

// Run setup once (create tables if not exists)
export function initDb() {
  db.execute(`
    CREATE TABLE IF NOT EXISTS mangas (
      id TEXT PRIMARY KEY,
      name TEXT,
      url TEXT,
      imageUrl TEXT,
      lastChapter TEXT,
      lastUpdated TEXT,
      source TEXT,
      category TEXT DEFAULT 'default',
      data TEXT
    );
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      manga TEXT NOT NULL,
      title TEXT NOT NULL,
      number REAL,
      url TEXT UINQUE NOT NULL,
      publishedAt TEXT,
      pages TEXT,
      read TEXT DEFAULT '0',
      FOREIGN KEY(manga) REFERENCES mangas(url) ON DELETE CASCADE
    );
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS downloads (
    id TEXT PRIMARY KEY NOT NULL,
    mangaUrl TEXT,
    chapterUrl TEXT,
    mangaTitle TEXT,
    chapterTitle TEXT,
    status TEXT,
    progress REAL,
    localPath TEXT,
    queueIndex INTEGER
    );
  `);
}

// Add manga
export function addManga(manga: Manga) {
  db.execute(
    `INSERT OR REPLACE INTO mangas 
      (id, name, url, imageUrl, lastChapter, lastUpdated, source, category, data) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      manga.id,
      manga.name,
      manga.url || null,
      manga.imageUrl || null,
      manga.lastChapter || null,
      manga.lastUpdated || null,
      manga.source.name || null,
      manga.category || "default",
      JSON.stringify(manga.data ?? {})
    ]
  );
}

// Get all mangas
export function getMangas(): Manga[] {
  const result = db.execute("SELECT * FROM mangas");
  return result.rows?._array.map((row:any) =>
    new Manga({
      id: row.id,
      name: row.name,
      url: row.url,
      imageUrl: row.imageUrl,
      lastChapter: row.lastChapter,
      lastUpdated: row.lastUpdated,
      source: sources.find(s => s.name === row.source)?.source || placeHolderSource,
      data: JSON.parse(row.data),
      category: row.category,
  })
  ) ?? [];
}

// Add chapters
export function addChapters(chapters: Chapter[]) {
    if(!chapters || !chapters.length) return;
    
      try {
        db.transaction((tx) => {
          for (const chapter of chapters){
            tx.execute(
              'INSERT OR REPLACE INTO chapters (manga, title, number, url, publishedAt, pages) VALUES (?,?,?,?,?,?)',
              [
                chapter.manga,
                chapter.title,
                chapter.number,
                chapter.url,
                chapter.publishedAt,
                JSON.stringify(chapter.pages),
              ]
            );
          }
        });
      } catch (error) {
        console.error('Failed to add chapters:', error);
    }
}

// Get chapters for manga
export function getChapters(manga: string): Chapter[] {
  const result = db.execute("SELECT * FROM chapters WHERE manga = ?", [manga]);
  return result.rows?._array.map((row:any) => 
    new Chapter({
    manga: row.manga,
    title: row.title,
    number: row.number,
    url: row.url,
    publishedAt: row.publishedAt,
    pages: JSON.parse(row.pages)
    })
  ) ?? [];
}

// delete a manga and cascade delete chapters
export function deleteManga(mangaUrl: string) {
  db.execute('DELETE FROM mangas WHERE url = ?', [mangaUrl])
}

// add download
export async function insertDownload(item: Download){
  db.execute(`
    INSERT INTO downloads (id, mangaUrl, chapterUrl, mangaTitle, chapterTitle, status, progress, localPath, queueIndex)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,[
      item.id,
      item.mangaUrl,
      item.chapterUrl,
      item.mangaTitle,
      item.chapterTitle,
      item.status,
      item.progress,
      item.localPath,
      item.queueIndex,
    ]);
}

// update Download Status
export async function updateDownloadStatus(id: string, status: string, progress: number) {
  db.execute(`
    UPDATE downloads SET status = ?, progress = ? WHERE id = ?
    `,[status, progress, id]);
}

// get pending downloads
export async function getPendingDownloads(): Promise<Download[]> {
  const result = db.execute(`
    SELECT * FROM downloads  WHERE status IN('pending', 'downloading') ORDER BY queueIndex ASC
    `);
  return result.rows?._array || [];
}

export async function getCompletedDownloads(): Promise<Download[]> {
  const result = db.execute(`
    SELECT * FROM downloads WHERE status = 'done' ORDER BY queueIndex DESC
  `);
  return result.rows?._array || [];
}

export async function getErrorDownloads(): Promise<Download[]> {
  const result = db.execute(`
    SELECT * FROM downloads WHERE status = 'error' ORDER BY queueIndex DESC
  `);
  return result.rows?._array || [];
}

export async function getAllDownloads(): Promise<Download[]> {
  const result = db.execute(`
    SELECT * FROM downloads ORDER BY 
    CASE 
      WHEN status = 'downloading' THEN 1
      WHEN status = 'pending' THEN 2
      WHEN status = 'done' THEN 3
      WHEN status = 'error' THEN 4
    END,
    queueIndex ASC
  `);
  return result.rows?._array || [];
}

// get download by chapter
export async function getDownloadsByChapter(chapterUrl: string): Promise<Download[]> {
  const result = db.execute(`
    SELECT * FROM downloads WHERE chpaterUrl = ? ORDER BY queueIndex ASC
    `,[chapterUrl]);

    return result.rows?._array || [];
}

// delete download
export async function deletDownload(id: string) {
  db.execute(`DELETE FROM downloads WHERE id = ?`, [id]);
}
