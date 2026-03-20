# Merry Go — Manga & Manhua Reader

A full-featured manga/manhwa reader for Android built with **Expo** and **React Native**.  
Inspired by Tachiyomi, with a plugin-based source system so you can add any content provider without rebuilding the app.

---

## Table of Contents

1. [Features](#features)
2. [Project Structure](#project-structure)
3. [Architecture Overview](#architecture-overview)
4. [Getting Started](#getting-started)
5. [Plugin / Source System](#plugin--source-system)
6. [Writing a Plugin](#writing-a-plugin)
7. [Database Schema](#database-schema)
8. [State Management](#state-management)
9. [Reader Modes](#reader-modes)
10. [Contributing](#contributing)

---

## Features

| Feature | Status |
|---|---|
| Plugin-based source system | ✅ |
| Install plugins from a hosted repository | ✅ |
| Library with custom categories | ✅ |
| Vertical scroll reader (webtoon / manhwa) | ✅ |
| Left-to-right & right-to-left pager reader | ✅ |
| Pinch-to-zoom & double-tap zoom | ✅ |
| Offline chapter downloads | ✅ |
| Download queue with progress notifications | ✅ |
| Reading history with resume support | ✅ |
| Dark / Light / System theme | ✅ |
| Night reading mode (warm overlay) | ✅ |
| Adjustable font sizes | ✅ |
| AniList / MAL tracker integration | 🔜 |
| Cloud backup / restore | 🔜 |

---

## Project Structure

```
merry-go-v2/
│
├── app/                        Expo Router screens
│   ├── _layout.tsx             Root layout — DB init, SettingsProvider
│   ├── (tabs)/                 Bottom-tab screens
│   │   ├── index.tsx           Library (home)
│   │   ├── history.tsx         Reading history
│   │   ├── sources.tsx         Plugin manager
│   │   ├── downloads.tsx       Download queue
│   │   └── settings.tsx        App settings
│   └── (manga)/                Full-screen manga screens
│       ├── sourceScreen.tsx    Browse / search a source
│       ├── mangaDetail.tsx     Manga details + chapter list
│       └── readerScreen.tsx    Chapter reader
│
├── components/                 Reusable UI components
│   ├── ThemedText.tsx
│   ├── ThemedView.tsx
│   ├── ThemedCard.tsx
│   ├── ThemedModal.tsx
│   ├── Dropdown.tsx
│   └── ZoomableView.tsx        Pinch + pan + double-tap zoom
│
├── constants/
│   ├── colors.ts               Light / dark colour palettes
│   └── fontsizes.ts            Font-size scale (xs → xl)
│
├── contexts/
│   └── settingProvider.tsx     React context exposing theme, font, reading mode
│
├── db/
│   └── db.ts                   SQLite schema + all query functions
│
├── services/
│   ├── DownloadManager.ts      Background download orchestration
│   └── notificationService.ts  Notifee download notifications
│
├── sources/
│   └── index.ts                SourceManager singleton
│
├── store/                      Zustand stores
│   ├── mangaStore.ts
│   ├── downloadStore.ts
│   ├── historyStore.ts
│   ├── categoryStore.ts
│   └── settingsStore.ts        Persisted via AsyncStorage
│
└── utils/
    ├── sourceModel.ts          Core domain classes: Manga, Chapter, Source
    ├── pluginSystem.ts         PluginManager — install / load / sandbox plugins
    ├── imageCache.ts           Manual image cache helper (legacy, prefer expo-image)
    └── formatDateString.ts     Date formatting utility
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  Expo Router                    │
│  (tabs)  ←→  (manga)  ←→  readerScreen         │
└──────────────┬──────────────────────────────────┘
               │ reads/writes
┌──────────────▼──────────────────────────────────┐
│               Zustand Stores                    │
│  mangaStore · downloadStore · historyStore      │
│  categoryStore · settingsStore (persisted)      │
└──────────────┬──────────────────────────────────┘
               │ wraps
┌──────────────▼──────────────────────────────────┐
│           SQLite (react-native-quick-sqlite)    │
│  manga · chapter · download · category · history│
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│               Source / Plugin Layer             │
│                                                 │
│  SourceManager                                  │
│    └── PluginManager                            │
│          ├── Download plugin JS from GitHub     │
│          ├── Execute in sandboxed new Function  │
│          └── Expose http / Manga / Chapter APIs │
└─────────────────────────────────────────────────┘
```

**Key design decisions:**

- **Plugin sandboxing** — plugins run inside `new Function(...)` with a Proxy-locked sandbox. They can only access `http`, `Manga`, `Chapter`, `Source`, `utils`, and `console`. Access to `process`, `global`, `window`, `localStorage`, etc. throws.
- **One source per plugin** — each plugin file registers exactly one `Source` instance via `registerSource()`.
- **Offline-first reader** — the reader checks for a completed local download before hitting the network.
- **O(1) download lookups** — `downloadStore` maintains a `Map<chapterUrl, Download>` so `ChapterCard` never does a linear scan.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your Android device **or** an Android emulator

### Install & run

```bash
# Clone the repo
git clone https://github.com/mohammedFawzy0111/merry-go-v2.git
cd merry-go-v2

# Install dependencies
npm install

# Start the dev server
npx expo start
```

Scan the QR code with Expo Go. Every file save hot-reloads the app instantly — no build step needed during development.

### Build a release APK

The repo includes a GitHub Actions workflow (`.github/workflows/build-apk.yml`) that produces a signed APK on every push to `main`.  
To build locally:

```bash
npx expo run:android --variant release
```

---

## Plugin / Source System

Sources are JavaScript files hosted anywhere (GitHub raw, your own server, etc.).  
The app fetches, validates, and executes them inside a sandboxed scope.

### Plugin repository format

Your repository needs a `manifest.json` at the root:

```json
{
  "plugins": [
    {
      "id": "mangadex",
      "name": "MangaDex",
      "version": "1.0.0",
      "description": "The world's largest manga site",
      "icon": "https://mangadex.org/favicon.ico",
      "entryPoint": "https://raw.githubusercontent.com/you/plugins/main/mangadex.js",
      "language": "en"
    }
  ]
}
```

The app fetches this manifest from `REPOSITORY_BASE_URL` defined in `utils/pluginSystem.ts`.

---

## Writing a Plugin

A plugin is a single `.js` file. It must call `registerSource(source)` with one `Source` instance:

```js
// my-source.js

const mySource = new Source({
  name: "My Source",
  baseUrl: "https://my-manga-site.com",
  icon: "https://my-manga-site.com/favicon.ico",
  language: "en",
  version: "1.0.0",

  fetchPopularManga: async (offset) => {
    const { data } = await http.get(
      `https://my-manga-site.com/api/popular?page=${offset}`
    );
    return data.results.map(item =>
      new Manga({
        id: item.id,
        name: item.title,
        url: item.url,
        imageUrl: item.cover,
        lastChapter: item.latestChapter,
        lastUpdated: item.updatedAt,
        source: mySource,
        data: {
          status: item.status,
          tags: item.genres,
          author: item.author,
        },
      })
    );
  },

  fetchChapterDetails: async (url) => {
    const { data } = await http.get(url);
    return new Chapter({
      manga: data.mangaUrl,
      number: data.chapterNumber,
      url,
      pages: data.images, // array of image URLs
    });
  },

  // ... fetchRecentManga, fetchMangaDetails, fetchSearchResults
});

registerSource(mySource);
```

### Available sandbox APIs

| API | Description |
|---|---|
| `http.get(url, config?)` | Axios-like GET. Returns `{ data, status, headers }`. |
| `new Manga(params)` | Create a Manga instance. |
| `new Chapter(params)` | Create a Chapter instance. |
| `new Source(params)` | Create a Source instance. |
| `utils.createManga(params)` | Alias for `new Manga(params)`. |
| `utils.createChapter(params)` | Alias for `new Chapter(params)`. |
| `registerSource(source)` | Register your source (call exactly once). |
| `console.log/warn/error` | Prefixed `[PLUGIN]` logs to the Metro console. |

---

## Database Schema

All tables are created in `db/db.ts` via `initDb()`, which is called once in `app/_layout.tsx`.

| Table | Purpose |
|---|---|
| `manga` | Library entries |
| `chapter` | Chapter metadata + read progress per chapter |
| `download` | Download queue entries |
| `category` | User-defined library categories |
| `history` | Reading history (one row per manga) |

**Chapter read state** is stored on the `chapter` row itself (`isRead`, `lastReadPage`, `lastReadAt`), so it survives library removal and re-add.

---

## State Management

All global state lives in Zustand stores (`store/`). Stores are the single source of truth — components never call `db/` functions directly.

| Store | Responsible for |
|---|---|
| `mangaStore` | Library manga list + chapter cache |
| `downloadStore` | Download queue + O(1) chapter→download map |
| `historyStore` | Reading history |
| `categoryStore` | Library categories + active filter |
| `settingsStore` | Theme, font size, reading mode (persisted to AsyncStorage) |

---

## Reader Modes

| Mode | Best for | Scroll direction |
|---|---|---|
| `vertical` | Manhwa / webtoons (long strips) | Top → bottom |
| `ltr` | Japanese manga | Left → right |
| `rtl` | Arabic / traditional manga | Right → left |

Change the default in **Settings → Reading Direction**. The setting is persisted and applied to all future chapters.

Each page supports:
- **Single tap** — toggle the controls overlay
- **Double tap** — zoom to 2× centred on the tap point
- **Pinch** — free zoom (1× – 3×)
- **Pan** — move while zoomed

---

## Contributing

1. Fork the repo and create a feature branch
2. Follow the existing code style (TypeScript, functional components, Zustand for state)
3. Document new public functions with JSDoc comments
4. Open a PR with a clear description of your changes

For new sources / plugins, open a PR against the [plugins repository](https://github.com/mohammedFawzy0111/merry-go-plugins) instead.
