import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useFontSize, useTheme } from "@/contexts/settingProvider";
import { placeHolderSource, sources } from "@/sources";
import { useMangaStore } from "@/store/mangaStore";
import { formatDateString } from "@/utils/fomatDateString";
import { Chapter, Manga } from "@/utils/sourceModel";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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
  }: {
    chapter: Chapter;
    style?: ViewStyle;
    onPressUrl: (url: string) => void;
  }) => {
    return (
      <TouchableOpacity onPress={() => onPressUrl(chapter.url)}>
        <ThemedView variant="surface" style={[styles.chapterCard, style]}>
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
        </ThemedView>
      </TouchableOpacity>
    );
  }
);

export default function MangaDetails() {
  const { mangaUrl, sourceName } = useLocalSearchParams();
  const { colors } = useTheme();
  const { sizes } = useFontSize();
  const { mangas, addManga, addChapters, removeManga } = useMangaStore()
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
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false)

  const [loading, setLoading] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(true);
  const [isReversed, setIsReversed] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    const loadMangaData = async () => {
      setLoading(true);
      try {
        if (!source) return;
        const data = await source.fetchMangaDetails(mangaUrl as string);
        if (!cancelled) {
          setManga(data)
          setIsBookmarked(mangas.some((item) => item.url === manga.url));
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
  }, [source, mangaUrl]);

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
      await addChapters(manga.chapters);
      setIsBookmarked(true);
      ToastAndroid.show('Added to library', ToastAndroid.SHORT);
    }
  } catch (error) {
    ToastAndroid.show(`Operation failed: ${error}`, ToastAndroid.LONG);
    console.error('Bookmark toggle error:', error);
  }
}

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
                manga.imageUrl
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
        <ThemedView variant="surface" style={styles.libContainer}>
          <ThemedView variant="default">
            <TouchableOpacity 
              style={styles.addToLib}
              onPress = {toggleBookmark}
            >
              {isBookmarked? (<Ionicons name="bookmark" size={sizes.heading} color={colors.accent} />) :(<Ionicons name="add-sharp" color={colors.textSecondary} size={sizes.heading}/>)}
            </TouchableOpacity>
          </ThemedView>
          <ThemedView variant="default" style={{
            borderColor: colors.border,
            borderWidth: 2,
            flex: 1
          }}>
            <ThemedText variant="title">{`${manga.data.rating ? Math.round(manga.data.rating * 10)/10 : 0}/10`} <Ionicons name='star' color={colors.accent}/></ThemedText>
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
          <TouchableOpacity onPress={toggleReverse}>
            <Ionicons
              name="swap-vertical-sharp"
              size={sizes.heading}
              style={styles.chevron}
              color={colors.text}
            />
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manga, detailsCollapsed, sizes.heading, sizes.text, toggleReverse, colors.text]);

  const renderItem = useCallback(
    ({ item }: { item: Chapter }) => {
      return (
        <ChapterCard
          chapter={item}
          onPressUrl={handleGoToChapter}
          style={{ borderColor: colors.border }}
        />
      );
    },
    [handleGoToChapter, colors.border]
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
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    gap: 12,
  },
  addToLib: {
    flex: 1,
    padding: 8,
    justifyContent: "center",
    alignItems: "center"
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
  chapterCard: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 2,
    padding: 12,
    marginBottom: 8,
    minHeight: 48,
  },
  col: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
});
