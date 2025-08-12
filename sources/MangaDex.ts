import { Chapter, Manga, Source } from "@/utils/sourceModel";
import axios from "axios";

const API = "https://api.mangadex.org";
const CDN = "https://uploads.mangadex.org";
const MANGA_DEX_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json",
};

const mangaDex = new Source({
    name: 'MangaDex',
    baseUrl: API,
    icon: 'https://mangadex.org/favicon.ico',
});

// populate chapters
const getChapters = async (mangaId: string, mangaTitle:string): Promise<Chapter[]> => {
    // Fetch chapters with pagination
    let chapters: Chapter[] = [];
    let offset = 0;
    const limit = 100;
    let total = 0;

    do {
        const chaptersResp = await axios.get(`${API}/chapter`, {
            headers: MANGA_DEX_HEADERS,
            params: {
                manga: mangaId,
                translatedLanguage: ["en", "ar"],
                order: { chapter: "asc" },
                limit,
                offset
            }
        });

        const chapterData = chaptersResp.data.data;
        total = chaptersResp.data.total;

        chapters = chapters.concat(
            chapterData.map((ch: any) => {
                const chapterNum = Number(ch.attributes.chapter) || 0;
                const chapterUrl = `${API}/chapter/${ch.id}`;
                return new Chapter({
                    number: chapterNum,
                    url: chapterUrl,
                    title: ch.attributes.title || `Chapter ${chapterNum}`,
                    manga: mangaTitle,
                    pages: [] // not needed here
                });
            })
        );

        offset += limit;
    } while(offset < total);

    return chapters;
}

// function to get best title
const getBestTitle = (attributes: any): string => {
    // Try main titles first (en, ar, ja)
    if (attributes.title["en"]) return attributes.title["en"];
    if (attributes.title["ar"]) return attributes.title["ar"];
    if (attributes.title["ja"]) return attributes.title["ja"];
    
    // If no main title, look for English in altTitles
    if (attributes.altTitles) {
        // Find first English alt title
        const englishAltTitle = attributes.altTitles.find((titleObj: any) => titleObj["en"]);
        if (englishAltTitle?.["en"]) return englishAltTitle["en"];
        
        // If no English, return first available alt title
        const firstAltTitle = attributes.altTitles.find((titleObj: any) => {
            const values = Object.values(titleObj);
            return values.length > 0 && values[0];
        });
        if (firstAltTitle) return Object.values(firstAltTitle)[0] as string;
    }
    
    // Fallback to "Unknown"
    return "Unknown";
};

// Fetch recent manga from MangaDex
mangaDex.fetchRecentManga = async (): Promise<Manga[]> => {
    try {
        const { data } = await axios.get(`${API}/manga`, {
            headers: MANGA_DEX_HEADERS,
            params: {
                limit: 40,
                "order[updatedAt]": "desc",
                includes: ["cover_art", "author", "artist"],
            },
        });
        
        const mangas: Manga[] = await Promise.all(
            data.data.map(async (item: any) => {
                const attributes = item.attributes;
                const title = getBestTitle(attributes);
                const url = `${API}/manga/${item.id}`;

                const coverRel = item.relationships.find((rel: any) => rel.type === "cover_art");
                let imageUrl = "";
                if (coverRel?.attributes?.fileName) {
                    imageUrl = `${CDN}/covers/${item.id}/${coverRel.attributes.fileName}.256.jpg`;
                }

                const lastChapter = attributes.lastChapter || "no chapters";
                const lastUpdated = attributes.updatedAt || new Date().toISOString();

                const mangaData = {
                    altTitles: attributes.altTitles
                ? attributes.altTitles
                    .map((titleObj: Record<string, string>) => {
                        // Get the first (and usually only) value from the object
                        const firstValue = Object.values(titleObj)[0];
                        return firstValue || "";
                    })
                    .filter(Boolean) // remove empty strings
                : [],
                    status: attributes.status || "Unknown",
                    description: attributes.description["en"] || "",
                    "original language": attributes.originalLanguage || "en",
                    Demographic: attributes.publicationDemographic || "Unknown",
                    year: attributes.year || "Unknown",
                    tags: attributes.tags.map((tag: any) => tag.attributes.name["en"]) || [],
                    author: item.relationships.find((rel: any) => rel.type === "author")?.attributes?.name || "Unknown Author",
                    artist: item.relationships.find((rel: any) => rel.type === "artist")?.attributes?.name || "Unknown Artist",
                };

                const chapters: Chapter[] = [] // not needed for recent manga, but can be fetched later
                return new Manga({
                    name: title,
                    url,
                    imageUrl,
                    lastChapter,
                    lastUpadated: lastUpdated,
                    source: mangaDex,
                    data: mangaData,
                    chapters
                });
            })
        );

        return mangas;
    } catch (error) {
        console.error("Error fetching recent manga:", error);
        return [];
    }
}

// Add this method to the mangaDex object, right after fetchRecentManga
mangaDex.fetchPopularManga = async (): Promise<Manga[]> => {
    try {
        const { data } = await axios.get(`${API}/manga`, {
            headers: MANGA_DEX_HEADERS,
            params: {
                limit: 40,
                "order[followedCount]": "desc", // Sort by most followed manga
                includes: ["cover_art", "author", "artist"],
            },
        });
        
        const mangas: Manga[] = await Promise.all(
            data.data.map(async (item: any) => {
                const attributes = item.attributes;
                const title = getBestTitle(attributes);
                const url = `${API}/manga/${item.id}`;

                const coverRel = item.relationships.find((rel: any) => rel.type === "cover_art");
                let imageUrl = "";
                if (coverRel?.attributes?.fileName) {
                    imageUrl = `${CDN}/covers/${item.id}/${coverRel.attributes.fileName}.256.jpg`;
                }

                const lastChapter = attributes.lastChapter || "no chapters";
                const lastUpdated = attributes.updatedAt || new Date().toISOString();

                const mangaData = {
                    altTitles: attributes.altTitles
                ? attributes.altTitles
                    .map((titleObj: Record<string, string>) => {
                        // Get the first (and usually only) value from the object
                        const firstValue = Object.values(titleObj)[0];
                        return firstValue || "";
                    })
                    .filter(Boolean) // remove empty strings
                : [],
                    status: attributes.status || "Unknown",
                    description: attributes.description["en"] || "",
                    "original language": attributes.originalLanguage || "en",
                    Demographic: attributes.publicationDemographic || "Unknown",
                    year: attributes.year || "Unknown",
                    tags: attributes.tags.map((tag: any) => tag.attributes.name["en"]) || [],
                    author: item.relationships.find((rel: any) => rel.type === "author")?.attributes?.name || "Unknown Author",
                    artist: item.relationships.find((rel: any) => rel.type === "artist")?.attributes?.name || "Unknown Artist",
                };

                // For popular manga, we might not need all chapters immediately
                // Just fetch basic info and leave chapters for when user selects the manga
                const chapters: Chapter[] = [];

                return new Manga({
                    name: title,
                    url,
                    imageUrl,
                    lastChapter,
                    lastUpadated: lastUpdated,
                    source: mangaDex,
                    data: mangaData,
                    chapters
                });
            })
        );

        return mangas;
    } catch (error) {
        console.error("Error fetching popular manga:", error);
        return [];
    }
}

mangaDex.fetchMangaDetails = async (mangaUrl: string): Promise<Manga> => {
    try{
        // fetch manga details
        const { data } = await axios.get(mangaUrl, {
            headers: MANGA_DEX_HEADERS,
            params: {
                includes: ["cover_art", "author", "artist"],
            },
        });
        
        const mangaData = data.data;
        const title = getBestTitle(mangaData.attributes);
        const coverId = mangaData.relationships.find((rel: any) => rel.type === "cover_art").id;
        const cover = await axios.get(`${API}/cover/${coverId}`);
        const coverUrl = `${CDN}/covers/${mangaData.id}/${cover.data.data.attributes.fileName}.256.jpg`;
        const lastChapter = mangaData.attributes.lastChapter || "no chapters";
        const lastUpdated = mangaData.attributes.updatedAt || new Date().toISOString();

        const details = {
            altTitles: mangaData.attributes.altTitles
                ? mangaData.attributes.altTitles
                    .map((titleObj: Record<string, string>) => {
                        // Get the first (and usually only) value from the object
                        const firstValue = Object.values(titleObj)[0];
                        return firstValue || "";
                    })
                    .filter(Boolean) // remove empty strings
                : [],
            status: mangaData.attributes.status || "Unknown",
            description: mangaData.attributes.description["en"] || "",
            "original language": mangaData.attributes.originalLanguage || "en",
            Demographic: mangaData.attributes.publicationDemographic || "Unknown",
            year: mangaData.attributes.year || "Unknown",
            tags: mangaData.attributes.tags.map((tag: any) => tag.attributes.name["en"]) || [],
            author: mangaData.relationships.find((rel: any) => rel.type === "author")?.attributes?.name || "Unknown Author",
            artist: mangaData.relationships.find((rel: any) => rel.type === "artist")?.attributes?.name || "Unknown Artist",
        }

        const chapters: Chapter[] = await getChapters(mangaData.id,title);
        return new Manga({
            name: title,
            url: mangaUrl,
            imageUrl: coverUrl,
            lastChapter,
            lastUpadated: lastUpdated,
            source: mangaDex,
            data: details,
            chapters
        })

    }catch (error) {
        console.error("Error fetching manga details:", error);
        return new Manga({
            name: "Unknown",
            url: mangaUrl,
            imageUrl: "",
            lastChapter: "N/A",
            lastUpadated: new Date().toISOString(),
            source: mangaDex,
            data: {},
            chapters: []
        });
    }
}

mangaDex.fetchChapterDetails = async(url:string): Promise<Chapter> => {
    try{
        const chapterReq = await axios.get(url,{
            headers: MANGA_DEX_HEADERS
        });
        const chapterData = chapterReq.data.data;

        const manga = chapterData.relationships.find((rel:any) => rel.type == "manga")["id"] as string || "";
        const title = chapterData.attributes.title || "";
        const chapterNum = Number(chapterData.attributes.chapter) || 0;
        const chapterId = chapterData.id;

        const atHomeResp = await axios.get(`${API}/at-home/server/${chapterId}`,{
            headers: MANGA_DEX_HEADERS
        });
        const baseUrl:string = atHomeResp.data.baseUrl;
        const hash:string = atHomeResp.data.chapter.hash;
        const fileNames: string[] = atHomeResp.data.chapter.data;

        const pages: string[] = fileNames.map((name:string) => `${baseUrl}/data/${hash}/${name}`) || [];
        return new Chapter({
            manga,
            title,
            number: chapterNum,
            url,
            pages
        })
    } catch(error){
        console.error("Error fetching chapter:", error);
        return new Chapter({
            manga:"",
            number: 0,
            url,
            pages: []
        });
    }
}

export default mangaDex;