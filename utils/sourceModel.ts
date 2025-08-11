class Manga {
    name: string;
    url: string;
    imageUrl: string;
    lastChapter: string;
    lastUpadated: string;
    source: Source;
    data: Record<string, any>;
    chapters: Chapter[];

    constructor(params: {
        name: string;
        url: string;
        imageUrl: string;
        lastChapter: string;
        lastUpadated: string;
        source: Source;
        data?: Record<string, any>;
        chapters?: Chapter[];
    }) {
        this.name = params.name;
        this.url = params.url;
        this.imageUrl = params.imageUrl;
        this.lastChapter = params.lastChapter;
        this.lastUpadated = params.lastUpadated;
        this.source = params.source;
        this.data = params.data ?? {};
        this.chapters = params.chapters ?? [];
    }
}


class Chapter {
    manga: string;
    title: string;
    number: number;
    url: string;
    pages: string[];

    constructor(params:{
        manga: string;
        title?: string;
        number: number;
        url: string;
        pages: string[]
    }){
        this.manga = params.manga;
        this.title = params.title || '';
        this.number = params.number;
        this.url = params.url;
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
    fetchChapterDetails: (url: string) => Promise<Chapter[]>;
    fetchSearchResults: (query: string) => Promise<Manga[]>;

    constructor(params: {
        name: string;
        baseUrl: string;
        icon: string;
        fetchRecentManga?: () => Promise<Manga[] >;
        fetchPopularManga?: () => Promise<Manga[] >;
        fetchMangaDetails?: (url: string) => Promise<Manga>;
        fetchChapterDetails?: (url: string) => Promise<Chapter[] >;
        fetchSearchResults?: (query: string) => Promise<Manga[]>;
    }){
        this.name = params.name;
        this.baseUrl = params.baseUrl;
        this.icon = params.icon;
        this.fetchRecentManga = params.fetchRecentManga || (() => Promise.resolve([]));
        this.fetchPopularManga = params.fetchPopularManga || (() => Promise.resolve([]));
        this.fetchMangaDetails = params.fetchMangaDetails || (() => Promise.resolve(new Manga({ name: '', url: '', imageUrl: '', lastChapter: '', lastUpadated: '', source: this })));
        this.fetchChapterDetails = params.fetchChapterDetails || (() => Promise.resolve([]));
        this.fetchSearchResults = params.fetchSearchResults || (() => Promise.resolve([]));
    }
}

export { Chapter, Manga, Source };

