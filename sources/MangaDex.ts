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
                const title = attributes.title["en"] || attributes.title["ar"] || attributes.title["ja"] || "Unknown Title";
                const url = `${API}/manga/${item.id}`;

                const coverRel = item.relationships.find((rel: any) => rel.type === "cover_art");
                let imageUrl = "";
                if (coverRel?.attributes?.fileName) {
                    imageUrl = `${CDN}/covers/${item.id}/${coverRel.attributes.fileName}.256.jpg`;
                }

                const lastChapter = attributes.lastChapter || "no chapters";
                const lastUpdated = attributes.updatedAt || new Date().toISOString();

                const mangaData = {
                    altTitles: attributes.altTitles || [],
                    status: attributes.status || "Unknown",
                    description: attributes.description["en"] || "",
                    "original language": attributes.originalLanguage || "en",
                    Demographic: attributes.publicationDemographic || "Unknown",
                    year: attributes.year || "Unknown",
                    tags: attributes.tags.map((tag: any) => tag.attributes.name["en"]) || [],
                    author: item.relationships.find((rel: any) => rel.type === "author")?.attributes?.name || "Unknown Author",
                    artist: item.relationships.find((rel: any) => rel.type === "artist")?.attributes?.name || "Unknown Artist",
                };

                // Fetch chapters with pagination
                let chapters: Chapter[] = [];
                let offset = 0;
                const limit = 100;
                let total = 0;

                do {
                    const chaptersResp = await axios.get(`${API}/chapter`, {
                        headers: MANGA_DEX_HEADERS,
                        params: {
                            manga: item.id,
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
                                manga: title,
                                pages: []
                            });
                        })
                    );

                    offset += limit;
                } while (offset < total);

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

        console.log(JSON.stringify(mangas[0], null, 2));
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
                const title = attributes.title["en"] || attributes.title["ar"] || attributes.title["ja"] || "Unknown Title";
                const url = `${API}/manga/${item.id}`;

                const coverRel = item.relationships.find((rel: any) => rel.type === "cover_art");
                let imageUrl = "";
                if (coverRel?.attributes?.fileName) {
                    imageUrl = `${CDN}/covers/${item.id}/${coverRel.attributes.fileName}.256.jpg`;
                }

                const lastChapter = attributes.lastChapter || "no chapters";
                const lastUpdated = attributes.updatedAt || new Date().toISOString();

                const mangaData = {
                    altTitles: attributes.altTitles || [],
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

export default mangaDex;