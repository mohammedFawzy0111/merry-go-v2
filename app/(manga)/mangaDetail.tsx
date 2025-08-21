import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useFontSize, useTheme } from "@/contexts/settingProvider";
import { placeHolderSource, sources } from "@/sources";
import { useDownloadStore } from "@/store/downloadStore";
import { useMangaStore } from "@/store/mangaStore";
import { formatDateString } from "@/utils/fomatDateString";
import { getCachedImage } from "@/utils/imageCache";
import { Chapter, Manga } from "@/utils/sourceModel";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  ToastAndroid,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

// eslint-disable-next-line react/display-name
const ChapterCard = React.memo(
  ({
    chapter,
    style,
    onPressUrl,
    mangaUrl,
    mangaTitle,
  }: {
    chapter: Chapter;
    style?: ViewStyle;
    onPressUrl: (url: string) => void;
    mangaUrl: string;
    mangaTitle: string;
  }) => {
    const { colors } = useTheme();
    const { sizes } = useFontSize();
    const {
      downloads,
      addToDownloadQueue,
      removeDownload,
    } = useDownloadStore();

    const chapterDownload = downloads.find(d => d.chapterUrl === chapter.url);
    const downloadStatus = chapterDownload?.status;
    const downloadProgress = chapterDownload?.progress || 0;

    const handleDownloadPress = async () => {
      if(downloadStatus === 'pending' || downloadStatus === 'downloading'){
        if(chapterDownload){
          await removeDownload(chapterDownload.id);
        }
      } else {
        await addToDownloadQueue(mangaUrl, chapter.url, chapter.title, mangaTitle);
      }
    };

    const getDownloadIcon = () => {
      switch(downloadStatus){
        case 'pending':
          return(
            <View style={[styles.downloadProgress, {backgroundColor: colors.surface,borderColor: colors.border}]}>
              <MaterialIcons name="schedule" size={16} color={colors.textSecondary} onPress={handleDownloadPress}/>
            </View>
          );
          case 'downloading':
            return (
              <View style={styles.downloadProgressContainer}>
                <View style={[styles.downloadProgress, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <MaterialIcons 
                    name="close" 
                    size={16} 
                    color={colors.error} 
                    onPress={handleDownloadPress}
                  />
                  <View style={styles.progressRing}>
                    <View 
                      style={[
                        styles.progressFill,
                        { 
                          backgroundColor: colors.accent,
                          height: `${downloadProgress}%`
                        }
                      ]} 
                    />
                  </View>
                  <ThemedText variant="secondary" style={styles.progressText}>
                    {Math.round(downloadProgress)}%
                  </ThemedText>
                </View>
              </View>
            );
          case 'done':
            return (
              <View style={[styles.downloadProgress, { backgroundColor: colors.success, borderColor: colors.border }]}>
                <MaterialIcons name="check" size={16} color="#fff" />
              </View>
            );
          case 'error':
            return (
              <View style={[styles.downloadProgress, { backgroundColor: colors.error, borderColor: colors.border }]}>
                <MaterialIcons name="error" size={16} color="#fff" />
              </View>
            );
          default:
            return (
              <TouchableOpacity 
                onPress={handleDownloadPress}
                style={[styles.downloadProgress, { backgroundColor: colors.surface, borderColor: colors.border}]}
              >
                <MaterialIcons name="file-download" size={16} color={colors.text} />
              </TouchableOpacity>
            );
      }
    }
    return (
      <ThemedView variant="surface" style={[styles.chapterCardContainer, style]}>
        <TouchableOpacity onPress={() => onPressUrl(chapter.url)} style={styles.chapterInfo}>
            <ThemedView style={styles.col}>
              <ThemedText variant="secondary">{chapter.number}</ThemedText>
            </ThemedView>
            <ThemedView style={styles.col}>
              {chapter.title && (
                <ThemedText variant="default">{chapter.title}</ThemedText>
              )}
              <ThemedText variant="subtitle">
                {formatDateString(chapter.publishedAt)}
              </ThemedText>
            </ThemedView>
        </TouchableOpacity>
        <View style={styles.downloadButton}>
          {getDownloadIcon()}
        </View>
      </ThemedView>
    );
  }
);

export default function MangaDetails() {
  const { mangaUrl, sourceName } = useLocalSearchParams();
  const { colors } = useTheme();
  const { sizes } = useFontSize();
  const { mangas, addManga, removeManga, getMangaByUrl, } = useMangaStore();
  const { addToDownloadQueue, downloads } = useDownloadStore()
  const router = useRouter();
  const source = sources.find((el) => el.name === sourceName)?.source;

  const [manga, setManga] = useState<Manga>(
    new Manga({
      id: "",
      name: "Unknown",
      url: (mangaUrl as string) || "",
      imageUrl: "",
      lastChapter: "N/A",
      lastUpdated: new Date().toISOString(),
      source: placeHolderSource,
      data: {},
      chapters: [],
    })
  );
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [cachedImageUri, setCachedImageUri] = useState<string|null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(true);
  const [isReversed, setIsReversed] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    const loadMangaData = async () => {
      setLoading(true);
      try {
        // check for the manga in the store first
        const existingManga = await getMangaByUrl(mangaUrl as string);
        if(existingManga){
          if (!cancelled) {
            setManga(existingManga);
            setLoading(false);
          }
          return;
        }

        // if not in store fetch from the source
        if (!source) return;
        const data = await source.fetchMangaDetails(mangaUrl as string);
        if (!cancelled) {
          setManga(data)
        };
      } catch (error) {
        ToastAndroid.show(
          `failded to load manga: ${error}`,
          ToastAndroid.LONG
        );
        console.error(`Error fetching ${mangaUrl} manga:`, error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMangaData();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, mangaUrl, mangas]);

  useEffect(() => {
    setIsBookmarked(mangas.some((item) => item.url === manga.url));
  }, [mangas, manga.url]);

  useEffect(()=> {
    let isMounted = true;

    const cacheImage = async () => {
      if(!manga.imageUrl) return;
      try {
        const uri = await getCachedImage(manga.imageUrl);
        if(isMounted){
          setCachedImageUri(uri);
        }
      }catch (error){
        console.error('Error caching image:', error);
        if (isMounted) {
          setCachedImageUri(manga.imageUrl);
        }
      }
    };

    cacheImage();

    return () => {
    isMounted = false;
  };
  }, [manga, manga.imageUrl]);

  useEffect(() => {
  // Load downloads when component mounts
  const loadDownloads = async () => {
    const { loadDownloads } = useDownloadStore.getState();
    await loadDownloads();
  };
  
  loadDownloads();
}, []);

  const handleGoToChapter = useCallback(
    (url: string) => {
      router.navigate({
        pathname: "/(manga)/readerScreen",
        params: { chapterUrl: url, sourceName },
      });
    },
    [router, sourceName]
  );

  const toggleReverse = useCallback(() => setIsReversed((v) => !v), []);
  const toggleBookmark = async() => {
  try {
    if(isBookmarked){
      await removeManga(manga.url);
      setIsBookmarked(false);
      ToastAndroid.show('Removed from library', ToastAndroid.SHORT);
    } else {
      await addManga(manga);
      setIsBookmarked(true);
      ToastAndroid.show('Added to library', ToastAndroid.SHORT);
    }
  } catch (error) {
    ToastAndroid.show(`Operation failed: ${error}`, ToastAndroid.LONG);
    console.error('Bookmark toggle error:', error);
  }
}

// refreshing fuction
const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (!source) return;
      const data = await source.fetchMangaDetails(mangaUrl as string);
      setManga(data);
      
      // Refresh the image cache
      if (data.imageUrl) {
        const uri = await getCachedImage(data.imageUrl);
        setCachedImageUri(uri);
      }
    } catch (error) {
      ToastAndroid.show(
        `Failed to refresh manga: ${error}`,
        ToastAndroid.LONG
      );
      console.error(`Error refreshing ${mangaUrl} manga:`, error);
    } finally {
      setRefreshing(false);
    }
}, [source, mangaUrl,]);

const handleDownloadAll = async () => {
  try {
    for (const chapter of manga.chapters) {
      const existingDownload = downloads.find(d => d.chapterUrl === chapter.url);
      if (!existingDownload) {
        await addToDownloadQueue(manga.url, chapter.url, chapter.title, manga.name);
      }
    }
    ToastAndroid.show('Added all chapters to download queue', ToastAndroid.SHORT);
  } catch (error) {
    ToastAndroid.show('Failed to add chapters to download', ToastAndroid.LONG);
    console.error('Download all error:', error);
  }
};

  const displayedChapters = useMemo(() => {
    if (!isReversed) return manga.chapters;
    return [...manga.chapters].reverse();
  }, [manga.chapters, isReversed]);

  const renderHeader = useCallback(() => {
    return (
      <ThemedView>
        <ThemedView variant="surface" style={styles.head}>
          <View style={styles.coverContainer}>
            <Image
              source={
                cachedImageUri
                ? { uri: cachedImageUri }
                : manga.imageUrl
                ? { uri: manga.imageUrl }
                : require("@/assets/images/placeholder.png")
              }
              style={styles.cover}
              resizeMode="cover"
            />
          </View>

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
                style={{ flexShrink: 1 }}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {`Author: ${manga.data.author}`}
              </ThemedText>
            )}
            {manga.data.artist && (
              <ThemedText
                variant="subtitle"
                style={{ flexShrink: 1 }}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {`Artist: ${manga.data.artist}`}
              </ThemedText>
            )}
            {manga.data.status && (
              <ThemedText variant="accent" style={{ flexShrink: 1 }}>
                {manga.data.status}
              </ThemedText>
            )}
            {manga.data.year && (
              <ThemedText variant="subtitle" style={{ flexShrink: 1 }}>
                {manga.data.year}
              </ThemedText>
            )}
          </View>
        </ThemedView>


        {/* rating and add to library button */}
        <ThemedView variant="surface" style={[styles.libContainer, { backgroundColor: colors.surface }]}>
          <TouchableOpacity 
            style={[
              styles.addToLib, 
              { 
                backgroundColor: isBookmarked ? colors.accent : 'transparent',
                borderColor: colors.border,
                borderWidth: 2,
                borderRadius: 8
              }
            ]}
            onPress={toggleBookmark}
          >
            <Ionicons 
              name={isBookmarked ? "bookmark" : "bookmark-outline"} 
              size={sizes.heading} 
              color={isBookmarked ? colors.surface : colors.textSecondary} 
            />
          </TouchableOpacity>
          
          <ThemedView variant="default" style={[styles.ratingContainer, {borderColor:  colors.border}]}>
            <ThemedText variant="title" style={{ color: colors.accent }}>
              {`${manga.data.rating ? Math.round(manga.data.rating * 10)/10 : 0}`}
            </ThemedText>
            <Ionicons name='star' color={colors.accent} size={sizes.heading}/>
            <ThemedText variant="subtitle" style={{ color: colors.textSecondary }}>
              /10
            </ThemedText>
          </ThemedView>
        </ThemedView>

      {/* Details Section */}
      <ThemedView variant="surface" style={styles.body}>
          {manga.data.Demographic && (
            <ThemedText variant="secondary">{`Genre: "${manga.data.Demographic}"`}</ThemedText>
          )}

          {manga.data.description && (
            <ThemedText
              variant="secondary"
              numberOfLines={detailsCollapsed ? 3 : undefined}
            >
              {`Description: "${manga.data.description}"`}
            </ThemedText>
          )}

          {manga.data.altTitles && manga.data.altTitles.length > 0 && (
            <View>
              <ThemedText variant="secondary">{"Alternative titles:"}</ThemedText>
              {manga.data.altTitles.map((title: string, id: number) => (
                <ThemedText
                  key={id}
                  variant="secondary"
                  numberOfLines={detailsCollapsed ? 1 : undefined}
                  ellipsizeMode="tail"
                >
                  {title}
                </ThemedText>
              ))}
            </View>
          )}
        </ThemedView>

        {/* Toggle Button */}
        <View style={styles.collapsibleHeader}>
          <TouchableOpacity
            onPress={() => setDetailsCollapsed((v) => !v)}
            style={styles.collapsibleButton}
          >
            <Ionicons
              name={detailsCollapsed ? "chevron-down" : "chevron-up"}
              size={sizes.heading}
              style={styles.chevron}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>


        {manga.data.tags && manga.data.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            <FlatList
              data={manga.data.tags}
              horizontal
              keyExtractor={(_, i) => `tag-${i}`}
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled" 
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    router.navigate({
                      pathname: "/(manga)/sourceScreen",
                      params: { initialTag: item, sourceName },
                    });
                  }}
                >


                  <ThemedView variant="surface" style={styles.tagPill}>
                    <ThemedText variant="subtitle">{item}</ThemedText>
                  </ThemedView>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.tagsContent}
            />
          </View>
        )}

        <ThemedView variant="background" style={styles.chaptersHeader}>
          <ThemedText variant="title" style={{ fontSize: sizes.text }}>
            {"Chapters"}
          </ThemedText>
          <View style={styles.chapterActions}>
            <TouchableOpacity onPress={toggleReverse} style={[styles.actionButton,{backgroundColor: colors.surface}]}>
              <Ionicons
                name="swap-vertical-sharp"
                size={sizes.heading}
                color={colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDownloadAll} style={[styles.actionButton,{backgroundColor: colors.surface}]}>
              <MaterialIcons
                name="download"
                size={sizes.heading}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>
        </ThemedView>
      </ThemedView>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manga, detailsCollapsed, toggleReverse, isBookmarked]);

  const renderItem = useCallback(
    ({ item }: { item: Chapter }) => {
      return (
        <ChapterCard
          chapter={item}
          onPressUrl={handleGoToChapter}
          mangaUrl={manga.url}
          mangaTitle={manga.name}
          style={{ borderColor: colors.border }}
        />
      );
    },
    [handleGoToChapter, colors.border, manga.url, manga.name]
  );

  const ITEM_HEIGHT = 64;

  if (loading) {
    return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;
  }

  return (
    <FlatList
      ListHeaderComponent={renderHeader}
      data={displayedChapters}
      renderItem={renderItem}
      keyExtractor={(item) => item.url}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" 
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={10}
      removeClippedSubviews
      getItemLayout={(_, index) => ({
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
      })}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
      <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors = {[colors.accent]}
      />
    }
    />
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 20,
    padding: 18,
  },
  head: {
    minHeight: 160,
    flexDirection: "row",
    gap: 20,
    padding: 12,
    marginBottom: 15,
    alignItems: "flex-start",
  },
  coverContainer: {
    width: "30%",
    aspectRatio: 2 / 3,
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
    minWidth: 0,
  },
  libContainer: {
  flex: 1,
  padding: 12,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderRadius: 8,
  marginHorizontal: 16,
  marginBottom: 16,
},
addToLib: {
  width: 48,
  height: 48,
  justifyContent: 'center',
  alignItems: 'center',
},
ratingContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 8,
  borderWidth: 2,
},
  tagsContainer: {
    minHeight: 40,
    width: "100%",
    marginBottom: 12,
  },
  tagsContent: {
    paddingHorizontal: 8,
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 8,
  },
  collapsibleHeader: {
    padding: 12,
    borderRadius: 0,
    opacity: 0.5,
  },
  collapsibleButton: {
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  chevron: {
    marginLeft: 8,
  },
  body: {
    padding: 12,
    gap: 12,
    paddingTop: 0,
  },
  chaptersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    alignItems: "center",
  },
  chapterCardContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    padding: 12,
    marginBottom: 8,
    minHeight: 48,
  },
  
  chapterInfo: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  
  downloadButton: {
    marginLeft: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  
  downloadProgressContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  downloadProgress: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  
  progressRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    position: 'absolute',
    overflow: 'hidden',
    transform: [{ rotate: '-90deg' }],
  },
  
  progressFill: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    borderRadius: 16,
  },
  
  progressText: {
    fontSize: 8,
    position: 'absolute',
    fontWeight: 'bold',
  },
  col: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  chapterActions: {
    flexDirection: 'row',
    gap: 12,
  },
  
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
});
