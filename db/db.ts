import { open } from "react-native-quick-sqlite";

const db = open({ name: "manga.db" });

// Run setup once (create tables if not exists)
export function initDb() {
  db.execute(`
    CREATE TABLE IF NOT EXISTS mangas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      coverUrl TEXT,
      source TEXT,
      author TEXT,
      artist TEXT,
      status TEXT,
      description TEXT
    );
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      mangaId TEXT NOT NULL,
      title TEXT NOT NULL,
      number REAL,
      read INTEGER DEFAULT 0,
      FOREIGN KEY(mangaId) REFERENCES mangas(id)
    );
  `);
}

// Add manga
export function addManga(manga: {
  id: string;
  title: string;
  coverUrl?: string;
  source?: string;
  author?: string;
  artist?: string;
  status?: string;
  description?: string;
}) {
  db.execute(
    `INSERT OR REPLACE INTO mangas 
      (id, title, coverUrl, source, author, artist, status, description) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      manga.id,
      manga.title,
      manga.coverUrl || null,
      manga.source || null,
      manga.author || null,
      manga.artist || null,
      manga.status || null,
      manga.description || null,
    ]
  );
}

// Get all mangas
export function getMangas(): any[] {
  const result = db.execute("SELECT * FROM mangas ORDER BY title ASC");
  return result.rows?._array || [];
}

// Add chapters (bulk insert)
export function addChapters(mangaId: string, chapters: { id: string; title: string; number: number }[]) {
  db.transaction((tx) => {
    for (const ch of chapters) {
      tx.execute(
        `INSERT OR REPLACE INTO chapters (id, mangaId, title, number, read) VALUES (?, ?, ?, ?, ?)`,
        [ch.id, mangaId, ch.title, ch.number, 0]
      );
    }
  });
}

// Get chapters for manga
export function getChapters(mangaId: string): any[] {
  const result = db.execute("SELECT * FROM chapters WHERE mangaId = ? ORDER BY number ASC", [mangaId]);
  return result.rows?._array || [];
}

// Mark chapter read/unread
export function setChapterRead(chapterId: string, read: boolean) {
  db.execute("UPDATE chapters SET read = ? WHERE id = ?", [read ? 1 : 0, chapterId]);
}
