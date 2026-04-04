import { Dropdown, DropdownOption } from "@/components/Dropdown";
import { ThemedModal } from "@/components/ThemedModal";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useFontSize, useTheme } from "@/contexts/settingProvider";
import { placeHolderSource, sourceManager } from "@/sources";
import { useCategoryStore } from "@/store/categoryStore";
import { useDownloadStore } from "@/store/downloadStore";
import { useMangaStore } from "@/store/mangaStore";
import { formatDateString } from "@/utils/formatDateString";
import { Chapter, Manga } from "@/utils/sourceModel";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  FlatList,
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
    downloadsByChapter,
  }: {
    chapter: Chapter;
    style?: ViewStyle;
    onPressUrl: (url: string) => void;
    mangaUrl: string;
    mangaTitle: string;
    downloadsByChapter: Map<string, any>;
  }) => {
    const { colors } = useTheme();
    const { sizes } = useFontSize();
    const { addToDownloadQueue, removeDownload } = useDownloadStore();

    const chapterDownload = downloadsByChapter.get(chapter.url);
    const downloadStatus = chapterDownload?.status;
    const downloadProgress = chapterDownload?.progress || 0;

    const handleDownloadPress = async () => {
      if (downloadStatus === "pending" || downloadStatus === "downloading") {
        if (chapterDownload) {
          await removeDownload(chapterDownload.id);
        }
      } else {
        await addToDownloadQueue(
          mangaUrl,
          chapter.url,
          chapter.title,
          mangaTitle,
        );
      }
    };

    const getDownloadIcon = () => {
      switch (downloadStatus) {
        case "pending":
          return (
            <View
              style={[
                styles.downloadProgress,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <MaterialIcons
                name="schedule"
                size={16}
                color={colors.textSecondary}
                onPress={handleDownloadPress}
              />
            </View>
          );
        case "downloading":
          return (
            <View style={styles.downloadProgressContainer}>
              <View
                style={[
                  styles.downloadProgress,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name="close"
                  size={16}
                  color={colors.error}
                  onPress={handleDownloadPress}
                />
                <View
                  style={[styles.progressRing, { borderColor: colors.accent }]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        transform: [
                          { rotate: `${-90 + downloadProgress * 3.6}deg` },
                        ],
                        backgroundColor: colors.accent,
                      },
                    ]}
                  />
                </View>
                <ThemedText variant="secondary" style={styles.progressText}>
                  {Math.round(downloadProgress)}%
                </ThemedText>
              </View>
            </View>
          );
        case "done":
          return (
            <View
              style={[
                styles.downloadProgress,
                { backgroundColor: colors.success, borderColor: colors.border },
              ]}
            >
              <MaterialIcons name="check" size={16} color="#fff" />
            </View>
          );
        case "error":
          return (
            <View
              style={[
                styles.downloadProgress,
                { backgroundColor: colors.error, borderColor: colors.border },
              ]}
            >
              <MaterialIcons name="error" size={16} color="#fff" />
            </View>
          );
        default:
          return (
            <TouchableOpacity
              onPress={handleDownloadPress}
              style={[
                styles.downloadProgress,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <MaterialIcons
                name="file-download"
                size={16}
                color={colors.text}
              />
            </TouchableOpacity>
          );
      }
    };

    // ── Read state styles ──────────────────────────────────────────────────
    // Left border: accent colour = unread, muted border = read
    // Text: full opacity = unread, dimmed = read
    const readBorderColor = chapter.isRead ? colors.border : colors.accent;
    const textOpacity = chapter.isRead ? 0.45 : 1;

    return (
      <ThemedView
        variant="surface"
        style={[
          styles.chapterCardContainer,
          style,
          // Left accent bar encodes read state
          { borderLeftColor: readBorderColor, borderLeftWidth: 3 },
        ]}
      >
        <TouchableOpacity
          onPress={() => onPressUrl(chapter.url)}
          style={styles.chapterInfo}
        >
          <ThemedView style={styles.col}>
            <ThemedText
              variant="secondary"
              style={{ opacity: textOpacity, fontSize: sizes.text }}
            >
              {chapter.number}
            </ThemedText>
          </ThemedView>

          <ThemedView
            style={[styles.col, { alignItems: "flex-start", flex: 1 }]}
          >
            {chapter.title ? (
              <ThemedText
                variant="default"
                style={{ opacity: textOpacity, fontSize: sizes.text }}
              >
                {chapter.title}
              </ThemedText>
            ) : null}
            <ThemedText variant="subtitle" style={{ fontSize: sizes.sub }}>
              {formatDateString(chapter.publishedAt)}
            </ThemedText>
            {chapter.isRead && (
              <ThemedText
                variant="secondary"
                style={{ fontSize: sizes.sub, opacity: 0.5, marginTop: 1 }}
              >
                Read
              </ThemedText>
            )}
          </ThemedView>
        </TouchableOpacity>

        <View style={styles.downloadButton}>{getDownloadIcon()}</View>
      </ThemedView>
    );
  },
);

export default function MangaDetails() {
  const { mangaUrl, sourceName } = useLocalSearchParams();
  const { colors } = useTheme();
  const { sizes } = useFontSize();
  const { mangas, addManga, removeManga, getMangaByUrl } = useMangaStore();
  const { addToDownloadQueue, downloads, downloadsByChapter } =
    useDownloadStore();
  const { categories, loadCategories } = useCategoryStore();
  const router = useRouter();
  const source = sourceManager.getSourceByName(sourceName as string)?.source;
  const hasFetchedRef = useRef(false);

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
    }),
  );
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(true);
  const [isReversed, setIsReversed] = useState<boolean>(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("default");

  // Local read-state tracker so UI updates instantly without a full reload.
  // Key = chapter URL, Value = true when read.
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      // Re-seed readMap from DB so chapters marked read in the reader are reflected
      getMangaByUrl(mangaUrl as string).then((m) => {
        if (!m) return;
        const updated: Record<string, boolean> = {};
        m.chapters.forEach((ch) => {
          updated[ch.url] = ch.isRead;
        });
        setReadMap(updated);
      });
    }, [mangaUrl]),
  );

  const categoryOptions: DropdownOption<string>[] = useMemo(
    () => [
      { value: "default", label: "All" },
      ...categories.map((cat) => ({
        value: cat.id,
        label: cat.name,
      })),
    ],
    [categories],
  );

  useEffect(() => {
    const loadCats = async () => {
      await loadCategories();
    };
    loadCats();
  }, []);

  useEffect(() => {
    let cancelled = false;
    hasFetchedRef.current = false;

    const loadMangaData = async () => {
      setLoading(true);
      try {
        const existingManga = await getMangaByUrl(mangaUrl as string);
        if (existingManga) {
          if (!cancelled) {
            setManga(existingManga);
            // Seed the readMap from whatever is already stored
            const initial: Record<string, boolean> = {};
            existingManga.chapters.forEach((ch) => {
              initial[ch.url] = ch.isRead;
            });
            setReadMap(initial);
            hasFetchedRef.current = true;
          }
          return;
        }
        if (!source) return;
        const data = await source.fetchMangaDetails(mangaUrl as string);
        if (!cancelled) {
          setManga(data);
          hasFetchedRef.current = true;
        }
      } catch (error) {
        ToastAndroid.show(`Failed to load manga: ${error}`, ToastAndroid.LONG);
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

  useEffect(() => {
    setIsBookmarked(mangas.some((item) => item.url === manga.url));
  }, [mangas, manga.url]);

  // ── Navigate to chapter, mark as read, update local readMap ───────────────
  const handleGoToChapter = useCallback(
    (url: string) => {
      // Optimistic UI update so the card dims instantly on back-navigation
      setReadMap((prev) => ({ ...prev, [url]: true }));

      router.navigate({
        pathname: "/(manga)/readerScreen",
        params: { chapterUrl: url, sourceName, mangaUrl: manga.url },
      });
    },
    [router, sourceName, manga.url],
  );

  const toggleReverse = useCallback(() => setIsReversed((v) => !v), []);

  const toggleBookmark = async () => {
    try {
      if (isBookmarked) {
        await removeManga(manga.url);
        setIsBookmarked(false);
        ToastAndroid.show("Removed from library", ToastAndroid.SHORT);
      } else {
        setShowCategoryModal(true);
      }
    } catch (error) {
      ToastAndroid.show(`Operation failed: ${error}`, ToastAndroid.LONG);
      console.error("Bookmark toggle error:", error);
    }
  };

  const handleAddWithCategory = async (categoryId: string) => {
    try {
      const mangaWithCat = { ...manga, category: categoryId };
      await addManga(mangaWithCat);
      setIsBookmarked(true);
      setShowCategoryModal(false);
      ToastAndroid.show(
        `Added to ${getCategoryName(categoryId)}`,
        ToastAndroid.SHORT,
      );
    } catch (error) {
      ToastAndroid.show(`Operation failed: ${error}`, ToastAndroid.LONG);
      console.error("Bookmark toggle error:", error);
    }
  };

  const getCategoryName = (id: string) => {
    const category = categories.find((cat) => cat.id === id);
    return category ? category.name : "All";
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (!source) return;
      const data = await source.fetchMangaDetails(mangaUrl as string);
      setManga(data);
      // Re-seed readMap on refresh
      const refreshed: Record<string, boolean> = {};
      data.chapters.forEach((ch) => {
        refreshed[ch.url] = ch.isRead;
      });
      setReadMap(refreshed);
    } catch (error) {
      ToastAndroid.show(`Failed to refresh manga: ${error}`, ToastAndroid.LONG);
    } finally {
      setRefreshing(false);
    }
  }, [source, mangaUrl]);

  const handleDownloadAll = async () => {
    try {
      for (const chapter of manga.chapters) {
        const existingDownload = downloads.find(
          (d) => d.chapterUrl === chapter.url,
        );
        if (!existingDownload) {
          await addToDownloadQueue(
            manga.url,
            chapter.url,
            chapter.title,
            manga.name,
          );
        }
      }
      ToastAndroid.show(
        "Added all chapters to download queue",
        ToastAndroid.SHORT,
      );
    } catch (error) {
      ToastAndroid.show(
        "Failed to add chapters to download",
        ToastAndroid.LONG,
      );
      console.error("Download all error:", error);
    }
  };

  const displayedChapters = useMemo(() => {
    const seen = new Set<string>();
    const unique = manga.chapters.filter((ch) => {
      if (seen.has(ch.url)) return false;
      seen.add(ch.url);
      return true;
    });
    // Merge optimistic readMap into chapters so ChapterCard sees current state
    const withReadState = unique.map(
      (ch) =>
        new Chapter({
          ...ch,
          isRead: readMap[ch.url] ?? ch.isRead,
        }),
    );
    return isReversed ? [...withReadState].reverse() : withReadState;
  }, [manga.chapters, isReversed, readMap]);

  const renderHeader = useCallback(() => {
    return (
      <ThemedView>
        <ThemedView variant="surface" style={styles.head}>
          <View style={styles.coverContainer}>
            <ExpoImage
              source={
                manga.imageUrl
                  ? { uri: manga.imageUrl }
                  : require("@/assets/images/placeholder.png")
              }
              style={styles.cover}
              contentFit="cover"
              cachePolicy="disk"
            />
          </View>

          <View style={styles.textContainer}>
            <ThemedText variant="title" numberOfLines={2} ellipsizeMode="tail">
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

        {/* Rating and add to library button */}
        <ThemedView
          variant="surface"
          style={[styles.libContainer, { backgroundColor: colors.surface }]}
        >
          <TouchableOpacity
            style={[
              styles.addToLib,
              {
                backgroundColor: isBookmarked ? colors.accent : "transparent",
                borderColor: colors.border,
                borderWidth: 2,
                borderRadius: 8,
              },
            ]}
            onPress={toggleBookmark}
          >
            <Ionicons
              name={isBookmarked ? "bookmark" : "bookmark-outline"}
              size={sizes.heading}
              color={isBookmarked ? colors.surface : colors.textSecondary}
            />
          </TouchableOpacity>

          <ThemedView
            variant="default"
            style={[styles.ratingContainer, { borderColor: colors.border }]}
          >
            <ThemedText variant="title" style={{ color: colors.accent }}>
              {`${manga.data.rating ? Math.round(manga.data.rating * 10) / 10 : 0}`}
            </ThemedText>
            <Ionicons name="star" color={colors.accent} size={sizes.heading} />
            <ThemedText
              variant="subtitle"
              style={{ color: colors.textSecondary }}
            >
              /10
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Details Section */}
        <ThemedView variant="surface" style={styles.body}>
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
              <ThemedText variant="secondary">
                {"Alternative titles:"}
              </ThemedText>
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
              keyExtractor={(item) => `tag-${item}`}
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
            <TouchableOpacity
              onPress={toggleReverse}
              style={[styles.actionButton, { backgroundColor: colors.surface }]}
            >
              <Ionicons
                name="swap-vertical-sharp"
                size={sizes.heading}
                color={colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDownloadAll}
              style={[styles.actionButton, { backgroundColor: colors.surface }]}
            >
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
          downloadsByChapter={downloadsByChapter}
        />
      );
    },
    [
      handleGoToChapter,
      colors.border,
      manga.url,
      manga.name,
      downloadsByChapter,
    ],
  );

  const ITEM_HEIGHT = 64;

  if (loading) {
    return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;
  }

  return (
    <>
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
            colors={[colors.accent]}
          />
        }
      />

      <ThemedModal
        visible={showCategoryModal}
        type="custom"
        title="Select Category"
        onCancel={() => setShowCategoryModal(false)}
        customContent={
          <ThemedView style={styles.categoryModalContent}>
            <Dropdown
              options={categoryOptions}
              selectedValue={selectedCategory}
              onSelect={setSelectedCategory}
              placeholder="Select category"
              width="100%"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.surface },
                ]}
                onPress={() => setShowCategoryModal(false)}
              >
                <ThemedText>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.accent }]}
                onPress={() => handleAddWithCategory(selectedCategory)}
              >
                <ThemedText style={{ color: colors.text }}>
                  Add to Library
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        }
      />
    </>
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
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  addToLib: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
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
    borderWidth: 1,
    borderLeftWidth: 3, // overridden per-card by read state
    padding: 12,
    marginBottom: 8,
    minHeight: 48,
    borderRadius: 8,
  },
  chapterInfo: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  downloadButton: {
    marginLeft: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  downloadProgressContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  downloadProgress: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  progressRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    position: "absolute",
    justifyContent: "center",
    alignContent: "center",
    overflow: "hidden",
    transform: [{ rotate: "-90deg" }],
  },
  progressFill: {
    width: "100%",
    height: "100%",
    position: "absolute",
    borderRadius: 16,
  },
  progressText: {
    fontSize: 8,
    position: "absolute",
    fontWeight: "bold",
  },
  col: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  chapterActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
  categoryModalContent: {
    maxHeight: 300,
    padding: 16,
    gap: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
});
