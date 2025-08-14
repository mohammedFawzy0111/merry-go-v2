interface MangaDetails {
    altTitles?: string[];
    status?: string;
    description?: string;
    "original language"?: string;
    Demographic?: string;
    year?: string | number;
    tags?: string[];
    author?: string;
    artist?: string;
}

class Manga {
    name: string;
    url: string;
    imageUrl: string;
    lastChapter: string;
    lastUpdated: string;
    source: Source;
    data: MangaDetails;
    chapters: Chapter[];

    constructor(params: {
        name: string;
        url: string;
        imageUrl: string;
        lastChapter: string;
        lastUpdated: string;
        source: Source;
        data?: MangaDetails;
        chapters?: Chapter[];
    }) {
        this.name = params.name;
        this.url = params.url;
        this.imageUrl = params.imageUrl;
        this.lastChapter = params.lastChapter;
        this.lastUpdated = params.lastUpdated;
        this.source = params.source;
        this.data = params.data ?? {
            altTitles: [],
            status: "Unknown",
            description: "",
            "original language": "en",
            Demographic: "Unknown",
            year: "Unknown",
            tags: [],
            author: "Unknown Author",
            artist: "Unknown Artist"
        };
        this.chapters = params.chapters ?? [];
    }
}



class Chapter {
    manga: string;
    title: string;
    number: number;
    url: string;
    publishedAt:string;
    pages: string[];

    constructor(params:{
        manga: string;
        title?: string;
        number: number;
        url: string;
        publishedAt?: string;
        pages: string[]
    }){
        this.manga = params.manga;
        this.title = params.title || '';
        this.number = params.number;
        this.url = params.url;
        this.publishedAt = params.publishedAt || new Date().toISOString();
        this.pages = params.pages || [];
    }
}

class Source {
    name: string;
    baseUrl: string;
    icon: string;
    fetchRecentManga: () => Promise<Manga[]>;
    fetchPopularManga: () => Promise<Manga[]>;
    fetchMangaDetails: (url: string) => Promise<Manga>;
    fetchChapterDetails: (url: string) => Promise<Chapter>;
    fetchSearchResults: (query: string) => Promise<Manga[]>;

    constructor(params: {
        name: string;
        baseUrl: string;
        icon: string;
        fetchRecentManga?: () => Promise<Manga[] >;
        fetchPopularManga?: () => Promise<Manga[] >;
        fetchMangaDetails?: (url: string) => Promise<Manga>;
        fetchChapterDetails?: (url: string) => Promise<Chapter>;
        fetchSearchResults?: (query: string) => Promise<Manga[]>;
    }){
        this.name = params.name;
        this.baseUrl = params.baseUrl;
        this.icon = params.icon;
        this.fetchRecentManga = params.fetchRecentManga || (() => Promise.resolve([]));
        this.fetchPopularManga = params.fetchPopularManga || (() => Promise.resolve([]));
        this.fetchMangaDetails = params.fetchMangaDetails || (() => Promise.resolve(new Manga({ name: '', url: '', imageUrl: '', lastChapter: '', lastUpdated: '', source: this })));
        this.fetchChapterDetails = params.fetchChapterDetails || (() => Promise.resolve(new Chapter({manga:'', number: 0, url:'', pages:[]})));
        this.fetchSearchResults = params.fetchSearchResults || (() => Promise.resolve([]));
    }
}

export { Chapter, Manga, Source };

