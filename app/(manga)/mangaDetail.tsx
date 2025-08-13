import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/contexts/ThemeProvider";
import { placeHolderSource, sources } from "@/sources";
import { Chapter, Manga } from "@/utils/sourceModel";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import Collapsible from 'react-native-collapsible';


const ChapterCard = ({chapter,style,onpress} : {chapter:Chapter, style?:ViewStyle,onpress:()=>void}) => {
    return(
        <TouchableOpacity
            onPress={onpress}
        >
            <ThemedView variant="surface" style={[styles.chapterCard, style]}>
                <ThemedText variant="secondary">{chapter.number}</ThemedText>
                {chapter.title && (<ThemedText variant="subtitle">{chapter.title}</ThemedText>)}
            </ThemedView>
        </TouchableOpacity>
    )
}

export default function MangaDetails () {
    const { mangaUrl, sourceName } = useLocalSearchParams();
    const { colors } = useTheme();
    const router = useRouter()
    const source = sources.find(el => el.name === sourceName)?.source;
    const [manga, setManga] = useState<Manga>(new Manga({
        name: "Unknown",
        url: mangaUrl as string,
        imageUrl: "",
        lastChapter: "N/A",
        lastUpadated: new Date().toISOString(),
        source: placeHolderSource,
        data: {},
        chapters: []
    }));
    const [loading, setLoading] = useState(false);
    const [detailsCollapsed,setDetailsCollapsed] = useState(true);
    const [isReversed, setIsReversed] = useState<boolean>(false);

    useEffect(() => {
        let cancelled = false;

        const loadMangaData = async () => {
            setLoading(true);
            try {
            if (!source) return;
            const data = await source.fetchMangaDetails(mangaUrl as string);
            if (!cancelled) setManga(data);
            } catch (error) {
            console.error(`Error fetching ${mangaUrl} manga:`, error);
            } finally {
            if (!cancelled) setLoading(false);
            }
        };

        loadMangaData();
        return () => { cancelled = true };
    }, [source, mangaUrl]);

    const goToChapter = (url:string) => {
        router.navigate({
            pathname:"/(manga)/readerScreen",
            params: {chapterUrl: url, sourceName}
        });
    }

    const toggleReverse = () => {
        setIsReversed(!isReversed)
    }

    return (
        <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer} 
        >
            {
            loading ? (
            <ActivityIndicator size="large" style={{ marginTop: 50 }} />
        ) : (
            <ThemedView>
                <ThemedView variant="surface" style = {styles.head}>
                    {/* cover image */}
                    <View style={styles.coverContainer}>
                        <Image
                            source={
                            manga.imageUrl
                                ? { uri: manga.imageUrl }
                                : require("@/assets/images/placeholder.png")
                            }
                            style={styles.cover}
                            resizeMode="cover"
                        />
                    </View>
                    {/* title author and artist and year */}
                    {/* IMPORTANT: add minWidth: 0 so the text can shrink and wrap correctly inside a flex row */}
                    <View style={styles.textContainer}>
                        <ThemedText 
                            variant="title"
                            numberOfLines={2}
                            ellipsizeMode="tail"
                        >
                            {manga.name}
                        </ThemedText>
                        {manga.data.author && (
                            <ThemedText 
                                variant="subtitle" 
                                style={{flexShrink: 1}}
                                numberOfLines={2}
                                ellipsizeMode="tail"
                            >
                                {`Author: ${manga.data.author}`}
                            </ThemedText>
                        )}
                        {manga.data.artist && (
                            <ThemedText 
                                variant="subtitle" 
                                style={{flexShrink: 1}}
                                numberOfLines={2}
                                ellipsizeMode="tail"
                            >
                                {`Artist: ${manga.data.artist}`}
                            </ThemedText>
                        )}
                        {manga.data.status && (
                            <ThemedText
                                variant="accent"
                                style={{flexShrink:1}}
                            >
                                {manga.data.status}
                            </ThemedText>
                        )}
                        {manga.data.year && (
                            <ThemedText
                                variant="subtitle"
                                style={{flexShrink:1}}
                            >
                                {manga.data.year}
                            </ThemedText>
                        )}
                    </View>
                </ThemedView>
                {/* tags */}
                {manga.data.tags && manga.data.tags.length > 0 && (
                    <View style={styles.tagsContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tagsContent}
                    >
                        {manga.data.tags.map((tag: string, index: number) => (
                        <ThemedView 
                            variant="surface" 
                            style={styles.tagPill} 
                            key={index}
                        >
                            <ThemedText variant="subtitle">{tag}</ThemedText>
                        </ThemedView>
                        ))}
                    </ScrollView>
                    </View>
                )}
                {/* other manga data */}
                <Collapsible collapsed={detailsCollapsed} collapsedHeight={120} >
                    <ThemedView variant="surface" style={styles.body}>
                        {manga.data.Demographic && (<ThemedText variant="secondary">{`Genre: "${manga.data.Demographic}"`}</ThemedText>)}
                        {manga.data.description && (<ThemedText variant="secondary">{`Description: "${manga.data.description}"`}</ThemedText>)}
                        {manga.data.altTitles && manga.data.altTitles.length > 0 && (
                            <View>
                                <ThemedText variant="secondary">{"Alternative titles:"}</ThemedText>
                                {manga.data.altTitles.map(
                                    (title:string, id:number) => (
                                        <ThemedText key={id} variant="secondary">{title}</ThemedText>
                                    )
                                )}
                            </View>
                        )}
                    </ThemedView>
                </Collapsible>
                <View style={styles.collapsibleHeader}>
                    <TouchableOpacity
                        onPress={() => setDetailsCollapsed(!detailsCollapsed)}
                        style={styles.collapsibleButton}
                    >
                        <Ionicons 
                            name={detailsCollapsed ? 'chevron-down' : 'chevron-up'} 
                            size={16}
                            style={styles.chevron}
                            color={colors.text}
                        />
                    </TouchableOpacity>
                </View>

                <ThemedView variant="background" style={styles.chaptersContainer}>
                    <ThemedView variant="background" style = {styles.chaptersHeader}>
                        <ThemedText variant="title" style={{fontSize: 16}}>{"Chapters"}</ThemedText>
                        <TouchableOpacity onPress={() => {toggleReverse()}}>
                            <Ionicons name="swap-vertical-sharp" size={16} style={styles.chevron} color={colors.text}/>
                        </TouchableOpacity>
                    </ThemedView>
                    <FlatList
                        data = {manga.chapters}
                        extraData={isReversed}
                        renderItem={({item,index}) => {
                            
                            const actualIndex = isReversed? manga.chapters.length-1-index : index;
                            const actualItem = manga.chapters[actualIndex];
                            return(
                            <ChapterCard chapter={actualItem} onpress={()=> goToChapter(actualItem.url)} style={{ borderColor: colors.border }}/>
                            )
                        }}
                        keyExtractor={(item) => item.url}
                        showsVerticalScrollIndicator={false}
                        scrollEnabled={false}
                    />
                </ThemedView>
            </ThemedView>
            )}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        padding: 18
    },
    contentContainer: {
    paddingBottom: 20 // Added bottom padding
  },
    head : {
        minHeight: 160,
        flexDirection: "row",
        gap: 20,
        padding: 12,
        marginBottom: 15,
        alignItems: "flex-start"
    },
    coverContainer: {
    width: "30%",
    aspectRatio: 2/3, // Standard manga cover aspect ratio
    borderRadius: 4,
    overflow: "hidden",
  },
    cover: {
        width: "100%",
        height: "100%",
    },
    textContainer: {
    flex: 1,
    flexDirection: "column",
    gap: 10,
    minWidth: 0
  },
    tagsContainer: {
    minHeight: 40, // Ensure container has height
    width: '100%', // Take full width
    marginBottom: 12,
  },
  tagsContent: {
    paddingHorizontal: 8, // Add some horizontal padding
    gap: 8, // Space between tags
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  collapsibleHeader: {
        padding: 12,
        borderRadius: 0,
        opacity: 0.5,
        flex:1,
    },
    collapsibleButton: {
        backgroundColor: "transperent",
        justifyContent: 'center',
        alignItems: 'center',
    },
    chevron: {
        marginLeft: 8,
    },
  body : {
    padding: 12,
    gap: 12,
    paddingTop: 0,
  },
  chaptersContainer: {
    
  },
  chapterCard: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 2,
    padding: 12,
    marginBottom: 8,
  },
  chaptersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12
  }
});
