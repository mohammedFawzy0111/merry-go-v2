import {Chapter, Manga} from "@/utils/sourceModel";
import { open } from "react-native-quick-sqlite";

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
      category TEXT DEFAULT 'uncategorized',
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
}

// Add manga
export function addManga(manga: Manga, category: string = 'uncategorized') {
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
      category,
      JSON.stringify(manga.data ?? {})
    ]
  );
}

// Get all mangas
export function getMangas(): Promise<any[]> {
  return new Promise((resove,reject) => {
    try {
      const result = db.execute('SELECT * FROM mangas');
      resove(result.rows?._array ?? []);
    } catch(e) {
      reject(e)
    }
  });
}

// Add chapter
export function addChapter(chapter: Chapter) {
  db.execute('INSERT OR REPLACE INTO chapters (manga, title, number, url, publishedAt, pages) VALUES (?, ?, ?, ?, ?, ?)', [
  chapter.manga,
  chapter.title,
  chapter.number,
  chapter.url,
  chapter.publishedAt,
  JSON.stringify(chapter.pages ?? []),
  ]);
}

// Get chapters for manga
export function getChapters(manga: string): Promise<any> {
  return new Promise((resolve,reject) => {
    try{
      const result = db.execute('SELECT * FROM chapters WHERE manga = ? ORDER BY number DESC', [manga]);
      resolve(result.rows?._array ?? []);
    } catch(e){
      reject(e)
    }
  });
}

// delete a manga and cascade delete chapters

export function deleteManga(mangaUrl: string) {
  db.execute('DELETE FROM manga WHERE url = ?', [mangaUrl])
}
