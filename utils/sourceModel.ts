/**
 * sourceModel.ts
 *
 * Core domain models for the manga reader.
 * These classes are shared between the app and the plugin sandbox,
 * so keep them free of React-Native-specific imports.
 */

// ---------------------------------------------------------------------------
// MangaStatus
// ---------------------------------------------------------------------------

/** Publication / scanlation status of a series. */
export type MangaStatus =
  | "ongoing"
  | "completed"
  | "hiatus"
  | "cancelled"
  | "unknown";

// ---------------------------------------------------------------------------
// ContentRating
// ---------------------------------------------------------------------------

export type ContentRating = "safe" | "suggestive" | "explicit" | "unknown";

// ---------------------------------------------------------------------------
// MangaDetails  (extended metadata, all fields optional)
// ---------------------------------------------------------------------------

export interface MangaDetails {
  /** Alternate titles in the same or other languages. */
  altTitles?: string[];
  /** Publication / scanlation status. */
  status?: MangaStatus;
  /** Synopsis / description. */
  description?: string;
  /** ISO 639-1 language code of the original publication (e.g. "ja", "ko", "zh"). */
  originalLanguage?: string;
  /** Target demographic (Shounen, Shoujo, Seinen, Josei, …). */
  demographic?: string;
  /** Year the series started publication. */
  year?: number;
  /** Genre / theme tags. */
  tags?: string[];
  /** Primary author(s). */
  author?: string;
  /** Illustrator / artist(s). */
  artist?: string;
  /** Average rating on a 0-10 scale. */
  rating?: number;
  /** Content rating / maturity level. */
  contentRating?: ContentRating;
  /** Total number of chapters (may be unknown for ongoing series). */
  totalChapters?: number;
  /** Total number of volumes. */
  totalVolumes?: number;
  /** URL to the series on the source website. */
  externalUrl?: string;
  /** ISO 8601 date the series was last updated on the source. */
  lastUpdatedAt?: string;
  /** Whether the series has been licensed in a specific region. */
  isLicensed?: boolean;
}

// ---------------------------------------------------------------------------
// Manga
// ---------------------------------------------------------------------------

export class Manga {
  /** Unique identifier within the source (e.g. MangaDex UUID). */
  id: string;
  /** Display title. */
  name: string;
  /** Canonical URL on the source. */
  url: string;
  /** Cover image URL. */
  imageUrl: string;
  /** Title/number of the most recent chapter, e.g. "Chapter 123". */
  lastChapter: string;
  /** ISO 8601 date of the last chapter update. */
  lastUpdated: string;
  /** Source this manga belongs to. */
  source: Source;
  /** Extended metadata. */
  data: MangaDetails;
  /** Loaded chapter list (populated lazily). */
  chapters: Chapter[];
  /** Library category ID this manga is filed under. */
  category: string;
  /** Whether the manga is currently in the user's library. */
  inLibrary: boolean;
  /** ISO 8601 date the manga was added to the library. */
  dateAdded?: string;
  /** User-defined personal rating (0-10). */
  userRating?: number;
  /** User-written notes. */
  userNotes?: string;
  /** Number of chapters the user has read. */

  constructor(params: {
    id: string;
    name: string;
    url: string;
    imageUrl: string;
    lastChapter?: string;
    lastUpdated?: string;
    source: Source;
    data?: Partial<MangaDetails>;
    chapters?: Chapter[];
    category?: string;
    inLibrary?: boolean;
    dateAdded?: string;
    userRating?: number;
    userNotes?: string;
    readCount?: number;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.url = params.url;
    this.imageUrl = params.imageUrl;
    this.lastChapter = params.lastChapter ?? "";
    this.lastUpdated = params.lastUpdated ?? new Date().toISOString();
    this.source = params.source;
    this.data = {
      altTitles: [],
      status: "unknown",
      description: "",
      originalLanguage: "unknown",
      demographic: "unknown",
      year: undefined,
      tags: [],
      author: "Unknown Author",
      artist: "Unknown Artist",
      rating: 0,
      contentRating: "unknown",
      ...params.data,
    };
    this.chapters = params.chapters ?? [];
    this.category = params.category ?? "default";
    this.inLibrary = params.inLibrary ?? false;
    this.dateAdded = params.dateAdded;
    this.userRating = params.userRating;
    this.userNotes = params.userNotes;
  }

}
// ---------------------------------------------------------------------------
// Chapter
// ---------------------------------------------------------------------------

export class Chapter {
  /** URL of the manga this chapter belongs to (foreign key). */
  manga: string;
  /** Display title of the chapter (may be empty). */
  title: string;
  /** Chapter number (float to support decimal chapters like 10.5). */
  number: number;
  /** Volume number, if available. */
  volume?: number;
  /** Canonical URL of the chapter on the source. */
  url: string;
  /** ISO 8601 date the chapter was published on the source. */
  publishedAt: string;
  /** Scanlation group name, if available. */
  scanlationGroup?: string;
  /** ISO 639-1 language code of the translation (e.g. "en"). */
  language: string;
  /** Ordered list of page image URLs (empty until fetchChapterDetails is called). */
  pages: string[];
  /** Whether the user has marked this chapter as read. */
  isRead: boolean;
  /** The last page the user read (0-indexed, for resume support). */
  lastReadPage: number;
  /** ISO 8601 date the user last opened this chapter. */
  lastReadAt?: string;
  /** Whether the chapter has been downloaded locally. */
  isDownloaded: boolean;

  constructor(params: {
    manga: string;
    title?: string;
    number: number;
    volume?: number;
    url: string;
    publishedAt?: string;
    scanlationGroup?: string;
    language?: string;
    pages?: string[];
    isRead?: boolean;
    lastReadPage?: number;
    lastReadAt?: string;
    isDownloaded?: boolean;
  }) {
    this.manga = params.manga;
    this.title = params.title ?? "";
    this.number = params.number;
    this.volume = params.volume;
    this.url = params.url;
    this.publishedAt = params.publishedAt ?? new Date().toISOString();
    this.scanlationGroup = params.scanlationGroup;
    this.language = params.language ?? "en";
    this.pages = params.pages ?? [];
    this.isRead = params.isRead ?? false;
    this.lastReadPage = params.lastReadPage ?? 0;
    this.lastReadAt = params.lastReadAt;
    this.isDownloaded = params.isDownloaded ?? false;
  }

  /** Display label, e.g. "Chapter 12.5 – Title" */
  get displayLabel(): string {
    const num = `Chapter ${this.number}`;
    return this.title ? `${num} – ${this.title}` : num;
  }
}

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

/**
 * A Source represents a single content provider (a website or API).
 * Plugin authors implement this interface by passing the required methods
 * to the constructor, or by sub-classing Source directly.
 *
 * @example
 * // Minimal plugin
 * registerSource(new Source({
 *   name: "My Source",
 *   baseUrl: "https://example.com",
 *   icon: "https://example.com/favicon.ico",
 *   fetchPopularManga: async (offset) => { ... },
 *   fetchChapterDetails: async (url) => { ... },
 * }));
 */
export class Source {
  /** Display name of the source. */
  name: string;
  /** Base URL used for relative-URL resolution and download matching. */
  baseUrl: string;
  /** URL to the source's favicon / logo image. */
  icon: string;
  /** ISO 639-1 language code(s) the source primarily provides (e.g. "en", "ja"). */
  language: string;
  /** Human-readable version string of the source plugin. */
  version: string;
  /** Whether the source requires an account / login to browse. */
  requiresLogin: boolean;
  /** Whether the source supports tag / genre filtering via fetchByTag(). */
  supportsTagFilter: boolean;
  /** Whether the source supports searching by author name via fetchByAuthor(). */
  supportsAuthorSearch: boolean;

  // ---- required data methods (no-ops by default so app never crashes) ----

  /** Fetch a page of the most recently updated manga. `offset` is 0-based. */
  fetchRecentManga: (offset: number) => Promise<Manga[]>;
  /** Fetch a page of the most popular manga. `offset` is 0-based. */
  fetchPopularManga: (offset: number) => Promise<Manga[]>;
  /** Fetch full details + chapter list for a manga by its URL. */
  fetchMangaDetails: (url: string) => Promise<Manga>;
  /** Fetch the ordered page image URLs for a chapter by its URL. */
  fetchChapterDetails: (url: string) => Promise<Chapter>;
  /** Search the source. `query` may be a plain string or `[tag]`-style. */
  fetchSearchResults: (query: string, offset: number) => Promise<Manga[]>;

  // ---- optional data methods ----

  /** Fetch manga filtered by a tag / genre label. */
  fetchByTag?: (tag: string, offset: number) => Promise<Manga[]>;
  /** Fetch manga by a specific author name. */
  fetchByAuthor?: (author: string, offset: number) => Promise<Manga[]>;

  constructor(params: {
    name: string;
    baseUrl: string;
    icon: string;
    language?: string;
    version?: string;
    requiresLogin?: boolean;
    supportsTagFilter?: boolean;
    supportsAuthorSearch?: boolean;
    fetchRecentManga?: (offset: number) => Promise<Manga[]>;
    fetchPopularManga?: (offset: number) => Promise<Manga[]>;
    fetchMangaDetails?: (url: string) => Promise<Manga>;
    fetchChapterDetails?: (url: string) => Promise<Chapter>;
    fetchSearchResults?: (query: string, offset: number) => Promise<Manga[]>;
    fetchByTag?: (tag: string, offset: number) => Promise<Manga[]>;
    fetchByAuthor?: (author: string, offset: number) => Promise<Manga[]>;
  }) {
    this.name = params.name;
    this.baseUrl = params.baseUrl;
    this.icon = params.icon;
    this.language = params.language ?? "en";
    this.version = params.version ?? "1.0.0";
    this.requiresLogin = params.requiresLogin ?? false;
    this.supportsTagFilter = params.supportsTagFilter ?? false;
    this.supportsAuthorSearch = params.supportsAuthorSearch ?? false;

    this.fetchRecentManga =
      params.fetchRecentManga ?? (() => Promise.resolve([]));
    this.fetchPopularManga =
      params.fetchPopularManga ?? (() => Promise.resolve([]));
    this.fetchMangaDetails =
      params.fetchMangaDetails ??
      (() =>
        Promise.resolve(
          new Manga({ id: "", name: "", url: "", imageUrl: "", source: this })
        ));
    this.fetchChapterDetails =
      params.fetchChapterDetails ??
      (() => Promise.resolve(new Chapter({ manga: "", number: 0, url: "" })));
    this.fetchSearchResults =
      params.fetchSearchResults ?? (() => Promise.resolve([]));

    if (params.fetchByTag) this.fetchByTag = params.fetchByTag;
    if (params.fetchByAuthor) this.fetchByAuthor = params.fetchByAuthor;
  }
}
