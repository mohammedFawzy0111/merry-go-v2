/**
 * readerScreen.tsx
 *
 * Full-featured manga / manhwa reader inspired by Tachiyomi.
 *
 * Features:
 *  - Three reading modes: vertical scroll (webtoon), LTR pager, RTL pager
 *  - Per-page zoom via pinch & double-tap (vertical mode wraps each page)
 *  - Auto-hide overlay controls (tap to toggle)
 *  - Animated page-number indicator
 *  - Resume from last-read page
 *  - Next / previous chapter navigation
 *  - Offline-first: reads from downloaded files when available
 *  - Saves reading progress to history on every page change
 *  - Night-mode aware (handled by the global overlay in _layout.tsx)
 */

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { ZoomableView } from "@/components/ZoomableView";
import { useFontSize, useReadingMode, useTheme } from "@/contexts/settingProvider";
import { sourceManager } from "@/sources";
import { useDownloadStore } from "@/store/downloadStore";
import { useHistoryStore } from "@/store/historyStore";
import { Chapter } from "@/utils/sourceModel";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WINDOW = Dimensions.get("window");
/** Controls auto-hide delay in milliseconds. */
const CONTROLS_HIDE_DELAY = 4000;
/** Blurhash placeholder shown while images load. */
const PLACEHOLDER_BLURHASH = "L6PZfSjE.AyE_3t7t7R**0o#DgR4";

// ---------------------------------------------------------------------------
// Single page component
// ---------------------------------------------------------------------------

type PageProps = {
  uri: string;
  /** width of the screen — passed in so the component never calls Dimensions itself */
  screenWidth: number;
  isVertical: boolean;
  /** called when this page's ZoomableView reports a zoom-state change */
  onZoomChange?: (zoomed: boolean) => void;
  /** called on a single tap (toggle controls) */
  onTap?: () => void;
};

const Page = React.memo(function Page({
  uri,
  screenWidth,
  isVertical,
  onZoomChange,
  onTap,
}: PageProps) {
  const [aspectRatio, setAspectRatio] = useState(2 / 3); // sensible manga default

  useEffect(() => {
    // Derive true aspect ratio from the image so tall webtoon pages render fully
    Image.prefetch(uri)
      .then(() => {
        // expo-image does not expose getSize, use RN's Image
        const { Image: RNImage } = require("react-native");
        RNImage.getSize(
          uri,
          (w: number, h: number) => {
            if (w > 0 && h > 0) setAspectRatio(w / h);
          },
          () => {}
        );
      })
      .catch(() => {});
  }, [uri]);

  const imageStyle = isVertical
    ? { width: screenWidth, aspectRatio }
    : { width: screenWidth, height: WINDOW.height };

  if (isVertical) {
    // Vertical (webtoon) mode: each page is individually zoomable
    return (
      <ZoomableView onZoomChange={onZoomChange} onSingleTap={onTap}>
        <Image
          source={{ uri }}
          style={imageStyle}
          contentFit="contain"
          placeholder={PLACEHOLDER_BLURHASH}
          transition={200}
        />
      </ZoomableView>
    );
  }

  // Pager mode: the whole FlatList is wrapped in a ZoomableView (see below),
  // so individual pages are plain images.
  return (
    <View style={{ width: screenWidth, height: WINDOW.height, justifyContent: "center", alignItems: "center", backgroundColor: "black" }}>
      <Image
        source={{ uri }}
        style={imageStyle}
        contentFit="contain"
        placeholder={PLACEHOLDER_BLURHASH}
        transition={200}
      />
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main reader screen
// ---------------------------------------------------------------------------

export default function ReaderScreen() {
  const { chapterUrl, sourceName, chapterList: rawChapterList } =
    useLocalSearchParams<{
      chapterUrl: string;
      sourceName: string;
      chapterList?: string; // JSON-serialised Chapter[] passed from detail screen
    }>();

  const { colors } = useTheme();
  const { sizes } = useFontSize();
  const { readingMode } = useReadingMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const source = sourceManager.getSourceByName(sourceName)?.source;
  const { loadDownloads, getDownloadByChapter } = useDownloadStore();
  const { addToHistory: storeAddHistory, updateHistory: storeUpdateHistory } = useHistoryStore();

  // ---- chapter state ----
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- UI state ----
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout>| null>(null);

  // ---- derived values ----
  const isVertical = readingMode === "vertical";
  const isRTL = readingMode === "rtl";
  const screenWidth = WINDOW.width;

  // Parse the chapter list so we can navigate prev/next
  const chapterList: Chapter[] = useMemo(() => {
    if (!rawChapterList) return [];
    try {
      const parsed = JSON.parse(rawChapterList as string);
      // Rebuild Chapter instances so methods like displayLabel work
      return parsed.map(
        (c: any) =>
          new Chapter({
            ...c,
            pages: c.pages ?? [],
          })
      );
    } catch {
      return [];
    }
  }, [rawChapterList]);

  const currentChapterIndex = useMemo(
    () => chapterList.findIndex((c) => c.url === chapterUrl),
    [chapterList, chapterUrl]
  );

  const prevChapter =
    currentChapterIndex > 0 ? chapterList[currentChapterIndex - 1] : null;
  const nextChapter =
    currentChapterIndex < chapterList.length - 1
      ? chapterList[currentChapterIndex + 1]
      : null;

  // ---------------------------------------------------------------------------
  // Fetch chapter pages (offline-first)
  // ---------------------------------------------------------------------------

  const fetchChapter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Check for a completed local download first
      const download = await getDownloadByChapter(chapterUrl);
      if (download?.status === "done" && download.localPath) {
        const files = await FileSystem.readDirectoryAsync(download.localPath);
        const pageFiles = files
          .filter(
            (f) =>
              f.startsWith("page_") &&
              (f.endsWith(".jpg") || f.endsWith(".png"))
          )
          .sort((a, b) => {
            const n = (s: string) =>
              parseInt(s.split("_")[1].split(".")[0], 10);
            return n(a) - n(b);
          });
        const localPages = pageFiles.map((f) => `${download.localPath}${f}`);
        setChapter(
          new Chapter({
            manga: download.mangaUrl,
            title: download.chapterTitle,
            number: 0,
            url: download.chapterUrl,
            pages: localPages,
            isDownloaded: true,
          })
        );
        return;
      }

      // 2. Fetch from the source
      if (!source) {
        setError("Source not found. Is the plugin still installed?");
        return;
      }
      const fetched = await source.fetchChapterDetails(chapterUrl);
      if (!fetched.pages.length) {
        setError("This chapter has no pages.");
        return;
      }
      setChapter(fetched);
    } catch (err) {
      console.error("Error fetching chapter:", err);
      setError(`Failed to load chapter: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [chapterUrl, source, getDownloadByChapter]);

  useEffect(() => {
    loadDownloads();
  }, []);

  useEffect(() => {
    fetchChapter();
    setCurrentPage(0);
  }, [chapterUrl]);

  // ---------------------------------------------------------------------------
  // Scroll to last-read page after content loads
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!chapter) return;
    const resumePage = chapter.lastReadPage ?? 0;
    if (resumePage > 0 && resumePage < chapter.pages.length) {
      // Small delay so FlatList has laid out
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: resumePage,
          animated: false,
        });
        setCurrentPage(resumePage);
      }, 100);
    }
  }, [chapter]);

  // ---------------------------------------------------------------------------
  // Controls auto-hide
  // ---------------------------------------------------------------------------

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(
      () => setControlsVisible(false),
      CONTROLS_HIDE_DELAY
    );
  }, []);

  const toggleControls = useCallback(() => {
    setControlsVisible((v) => {
      if (!v) scheduleHide(); // show → schedule hide
      return !v;
    });
  }, [scheduleHide]);

  useEffect(() => {
    if (controlsVisible && !isZoomed) scheduleHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [controlsVisible, isZoomed, scheduleHide]);

  // ---------------------------------------------------------------------------
  // Save reading progress (debounced to avoid hammering the DB)
  // ---------------------------------------------------------------------------

  const saveProgress = useCallback(
    (page: number) => {
      if (!chapter) return;
      if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
      progressSaveTimer.current = setTimeout(async () => {
        const now = new Date().toISOString();
        const historyItem = {
          mangaUrl: chapter.manga,
          mangaTitle: chapter.title || "Unknown",
          chapterUrl: chapter.url,
          chapterNumber: chapter.number,
          source: sourceName,
          lastRead: now,
          page,
        };
        try {
          await storeAddHistory(historyItem);
        } catch {
          // If insert fails, try updating
          await storeUpdateHistory(
            chapter.manga,
            chapter.url,
            chapter.number,
            now,
            page
          );
        }
      }, 800);
    },
    [chapter, sourceName, storeAddHistory, storeUpdateHistory]
  );

  // ---------------------------------------------------------------------------
  // Page change handler
  // ---------------------------------------------------------------------------

  const handlePageChange = useCallback(
    (event: any) => {
      if (isZoomed) return;
      const offset = isVertical
        ? event.nativeEvent.contentOffset.y
        : event.nativeEvent.contentOffset.x;
      const size = isVertical ? WINDOW.height : WINDOW.width;
      const index = Math.max(0, Math.round(offset / size));
      if (index !== currentPage) {
        setCurrentPage(index);
        saveProgress(index);
      }
    },
    [isZoomed, isVertical, currentPage, saveProgress]
  );

  // ---------------------------------------------------------------------------
  // Chapter navigation
  // ---------------------------------------------------------------------------

  const goToChapter = useCallback(
    (ch: Chapter) => {
      router.replace({
        pathname: "/(manga)/readerScreen",
        params: {
          chapterUrl: ch.url,
          sourceName,
          chapterList: rawChapterList,
        },
      });
    },
    [router, sourceName, rawChapterList]
  );

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const handleZoomChange = useCallback((zoomed: boolean) => {
    setIsZoomed(zoomed);
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <Page
        uri={item}
        screenWidth={screenWidth}
        isVertical={isVertical}
        onZoomChange={isVertical ? handleZoomChange : undefined}
        onTap={isVertical ? toggleControls : undefined}
      />
    ),
    [screenWidth, isVertical, handleZoomChange, toggleControls]
  );

  const keyExtractor = useCallback(
    (_: string, index: number) => `page-${index}`,
    []
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: isVertical ? WINDOW.height : WINDOW.width,
      offset: (isVertical ? WINDOW.height : WINDOW.width) * index,
      index,
    }),
    [isVertical]
  );

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <ThemedView variant="background" style={styles.center}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color={colors.accent} />
        <ThemedText variant="secondary" style={{ marginTop: 12 }}>
          Loading chapter…
        </ThemedText>
      </ThemedView>
    );
  }

  if (error || !chapter) {
    return (
      <ThemedView variant="background" style={styles.center}>
        <StatusBar style="auto" />
        <MaterialIcons name="error-outline" size={48} color={colors.error} />
        <ThemedText
          variant="secondary"
          style={{ marginTop: 12, textAlign: "center", paddingHorizontal: 32 }}
        >
          {error ?? "Unknown error"}
        </ThemedText>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.errorBackBtn, { backgroundColor: colors.surface }]}
        >
          <ThemedText variant="accent">Go Back</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={fetchChapter}
          style={[styles.errorBackBtn, { backgroundColor: colors.accent, marginTop: 8 }]}
        >
          <Text style={{ color: "#fff" }}>Retry</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const totalPages = chapter.pages.length;

  // ---------------------------------------------------------------------------
  // Pager mode wraps the FlatList in a ZoomableView for unified pinch support
  // ---------------------------------------------------------------------------

  const pagerContent = (
    <FlatList
      ref={flatListRef}
      data={chapter.pages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      horizontal={!isVertical}
      inverted={isRTL}
      pagingEnabled={!isVertical}
      snapToAlignment="center"
      snapToInterval={!isVertical ? WINDOW.width : undefined}
      decelerationRate={isVertical ? "normal" : "fast"}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      scrollEnabled={!isZoomed}
      onMomentumScrollEnd={handlePageChange}
      removeClippedSubviews
      windowSize={isVertical ? 5 : 3}
      initialNumToRender={isVertical ? 3 : 1}
      maxToRenderPerBatch={isVertical ? 3 : 2}
      getItemLayout={isVertical ? undefined : getItemLayout}
      contentContainerStyle={isVertical ? undefined : undefined}
    />
  );

  return (
    <>
      <StatusBar hidden={!controlsVisible} animated />

      <View style={styles.container}>
        {/* ---- Pages ---- */}
        {isVertical ? (
          // Vertical: tap-to-toggle handled per-page inside Page component
          pagerContent
        ) : (
          // Pager: single ZoomableView wrapping the horizontal FlatList
          <ZoomableView
            onZoomChange={handleZoomChange}
            onSingleTap={toggleControls}
          >
            {pagerContent}
          </ZoomableView>
        )}

        {/* ---- Top controls overlay ---- */}
        {controlsVisible && (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(180)}
            style={[
              styles.topBar,
              {
                top: 0,
                paddingTop: insets.top + 8,
                backgroundColor: `${colors.surface}E6`,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.iconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.topBarCenter}>
              <ThemedText
                variant="default"
                numberOfLines={1}
                style={{ fontWeight: "600", fontSize: sizes.text }}
              >
                {chapter.displayLabel || `Chapter ${chapter.number}`}
              </ThemedText>
            </View>

            {/* Reading-mode badge */}
            <View
              style={[
                styles.modeBadge,
                { backgroundColor: colors.accent + "33" },
              ]}
            >
              <ThemedText
                variant="accent"
                style={{ fontSize: 10, fontWeight: "bold" }}
              >
                {readingMode.toUpperCase()}
              </ThemedText>
            </View>
          </Animated.View>
        )}

        {/* ---- Bottom controls overlay ---- */}
        {controlsVisible && (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(180)}
            style={[
              styles.bottomBar,
              {
                paddingBottom: insets.bottom + 8,
                backgroundColor: `${colors.surface}E6`,
              },
            ]}
          >
            {/* Previous chapter */}
            <TouchableOpacity
              onPress={() => prevChapter && goToChapter(prevChapter)}
              disabled={!prevChapter}
              style={[
                styles.chapterNavBtn,
                {
                  backgroundColor: colors.surface,
                  opacity: prevChapter ? 1 : 0.35,
                },
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={colors.text}
              />
              <ThemedText
                variant="secondary"
                style={{ fontSize: sizes.sub, marginLeft: 2 }}
                numberOfLines={1}
              >
                {prevChapter ? `Ch.${prevChapter.number}` : "Start"}
              </ThemedText>
            </TouchableOpacity>

            {/* Page indicator */}
            <View style={styles.pageIndicator}>
              <ThemedText
                variant="default"
                style={{ fontSize: sizes.text, fontWeight: "600" }}
              >
                {currentPage + 1}
              </ThemedText>
              <ThemedText variant="secondary" style={{ fontSize: sizes.sub }}>
                {" "}/ {totalPages}
              </ThemedText>
            </View>

            {/* Next chapter */}
            <TouchableOpacity
              onPress={() => nextChapter && goToChapter(nextChapter)}
              disabled={!nextChapter}
              style={[
                styles.chapterNavBtn,
                {
                  backgroundColor: colors.surface,
                  opacity: nextChapter ? 1 : 0.35,
                },
              ]}
            >
              <ThemedText
                variant="secondary"
                style={{ fontSize: sizes.sub, marginRight: 2 }}
                numberOfLines={1}
              >
                {nextChapter ? `Ch.${nextChapter.number}` : "End"}
              </ThemedText>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.text}
              />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    zIndex: 20,
  },
  iconBtn: {
    padding: 6,
  },
  topBarCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 10,
    zIndex: 20,
  },
  pageIndicator: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  chapterNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: 120,
  },
  errorBackBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
});
