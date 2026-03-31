/**
 * readerScreen.tsx
 *
 * Full-featured manga / manhwa reader.
 * Hardened against silent crashes with try/catch around every async path
 * and verbose debug logging (search "🔍" in Metro to trace issues).
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
  Image as RNImage,
  ListRenderItemInfo,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WINDOW = Dimensions.get("window");
const CONTROLS_HIDE_DELAY = 4000;
const PLACEHOLDER_BLURHASH = "L6PZfSjE.AyE_3t7t7R**0o#DgR4";
const DEBUG = __DEV__; // flip to false to silence logs in production

function log(...args: any[]) {
  if (DEBUG) console.log("🔍 [Reader]", ...args);
}
function warn(...args: any[]) {
  if (DEBUG) console.warn("⚠️ [Reader]", ...args);
}
function err(...args: any[]) {
  console.error("❌ [Reader]", ...args);
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type PageProps = {
  uri: string;
  screenWidth: number;
  isVertical: boolean;
  onZoomChange?: (zoomed: boolean) => void;
  onTap?: () => void;
};

const Page = React.memo(function Page({
  uri,
  screenWidth,
  isVertical,
  onZoomChange,
  onTap,
}: PageProps) {
  const [aspectRatio, setAspectRatio] = useState(2 / 3);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;

    // Prefetch then measure — wrapped in try/catch so a bad URI never kills
    // the whole reader.
    Image.prefetch(uri)
      .then(() => {
        if (cancelled) return;
        RNImage.getSize(
          uri,
          (w: number, h: number) => {
            if (!cancelled && w > 0 && h > 0) {
              setAspectRatio(w / h);
            }
          },
          (e: any) => {
            warn("getSize failed for", uri, e);
          }
        );
      })
      .catch((e) => {
        warn("prefetch failed for", uri, e);
      });

    return () => { cancelled = true; };
  }, [uri]);

  const imageStyle = isVertical
    ? { width: screenWidth, aspectRatio }
    : { width: screenWidth, height: WINDOW.height };

  if (isVertical) {
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

  return (
    <View
      style={{
        width: screenWidth,
        height: WINDOW.height,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "black",
      }}
    >
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
// Main screen
// ---------------------------------------------------------------------------

export default function ReaderScreen() {
  const {
    chapterUrl,
    sourceName,
    chapterList: rawChapterList,
  } = useLocalSearchParams<{
    chapterUrl: string;
    sourceName: string;
    chapterList?: string;
  }>();

  log("mount — chapterUrl:", chapterUrl, "source:", sourceName);

  const { colors } = useTheme();
  const { sizes } = useFontSize();
  const { readingMode } = useReadingMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const source = sourceManager.getSourceByName(sourceName)?.source;
  const { loadDownloads, getDownloadByChapter } = useDownloadStore();
  const { addToHistory: storeAddHistory, updateHistory: storeUpdateHistory } =
    useHistoryStore();

  // ---- state ----
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- derived ----
  const isVertical = readingMode === "vertical";
  const isRTL = readingMode === "rtl";
  const screenWidth = WINDOW.width;

  // Parse chapter list
  const chapterList: Chapter[] = useMemo(() => {
    if (!rawChapterList) return [];
    try {
      const parsed = JSON.parse(rawChapterList as string);
      return parsed.map(
        (c: any) => new Chapter({ ...c, pages: c.pages ?? [] })
      );
    } catch (e) {
      warn("Failed to parse chapterList:", e);
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
  // Fetch chapter (offline-first)
  // ---------------------------------------------------------------------------

  const fetchChapter = useCallback(async () => {
    log("fetchChapter start — url:", chapterUrl);
    setLoading(true);
    setError(null);

    try {
      // 1. Check local download
      log("checking for local download…");
      let download: Awaited<ReturnType<typeof getDownloadByChapter>> = null;
      try {
        download = await getDownloadByChapter(chapterUrl);
      } catch (e) {
        warn("getDownloadByChapter threw:", e);
      }

      if (download?.status === "done" && download.localPath) {
        log("local download found at", download.localPath);
        try {
          const files = await FileSystem.readDirectoryAsync(download.localPath);
          log("files in download dir:", files.length);
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

          if (pageFiles.length > 0) {
            const localPages = pageFiles.map(
              (f) => `${download!.localPath}${f}`
            );
            log("serving", localPages.length, "local pages");
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
          warn("download dir exists but no page files found, falling back to network");
        } catch (fsErr) {
          warn("FileSystem error reading download dir:", fsErr);
          // Fall through to network
        }
      }

      // 2. Fetch from source
      if (!source) {
        err("Source not found for name:", sourceName);
        setError("Source not found. Is the plugin still installed?");
        return;
      }

      log("fetching chapter details from source…");
      let fetched: Chapter;
      try {
        fetched = await source.fetchChapterDetails(chapterUrl);
      } catch (fetchErr) {
        err("source.fetchChapterDetails threw:", fetchErr);
        setError(`Failed to fetch chapter: ${fetchErr}`);
        return;
      }

      log("fetched chapter, pages:", fetched.pages?.length ?? 0);

      if (!fetched.pages || fetched.pages.length === 0) {
        setError("This chapter has no pages.");
        return;
      }

      setChapter(fetched);
    } catch (topErr) {
      err("Unhandled error in fetchChapter:", topErr);
      setError(`Unexpected error: ${topErr}`);
    } finally {
      log("fetchChapter done");
      setLoading(false);
    }
  }, [chapterUrl, source, sourceName, getDownloadByChapter]);

  // Load downloads index once on mount
  useEffect(() => {
    log("loading downloads index…");
    loadDownloads().catch((e) => warn("loadDownloads failed:", e));
  }, []);

  // Re-fetch whenever chapterUrl changes
  useEffect(() => {
    log("chapterUrl changed, resetting page and fetching…");
    setCurrentPage(0);
    fetchChapter();
  }, [chapterUrl]);

  // ---------------------------------------------------------------------------
  // Scroll-to-resume page
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!chapter) return;
    const resumePage = chapter.lastReadPage ?? 0;
    log("resume page:", resumePage, "/ total:", chapter.pages.length);

    if (resumePage > 0 && resumePage < chapter.pages.length) {
      setCurrentPage(resumePage);
      if (!isVertical) {
        // Horizontal: predictable fixed-width offset, safe to call
        setTimeout(() => {
          try {
            flatListRef.current?.scrollToOffset({
              offset: WINDOW.width * resumePage,
              animated: false,
            });
          } catch (e) {
            warn("scrollToOffset failed:", e);
          }
        }, 150);
      }
      // Vertical: variable heights — do NOT call scrollToIndex; just update
      // the indicator and let the user scroll manually.
    }
  }, [chapter, isVertical]);

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
      if (!v) scheduleHide();
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
  // Save progress (debounced)
  // ---------------------------------------------------------------------------

  const saveProgress = useCallback(
    (page: number) => {
      if (!chapter) return;
      if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
      progressSaveTimer.current = setTimeout(async () => {
        const now = new Date().toISOString();
        const item = {
          mangaUrl: chapter.manga,
          mangaTitle: chapter.title || "Unknown",
          chapterUrl: chapter.url,
          chapterNumber: chapter.number,
          source: sourceName,
          lastRead: now,
          page,
        };
        try {
          await storeAddHistory(item);
          log("history saved — page:", page);
        } catch (insertErr) {
          warn("addToHistory failed, trying update:", insertErr);
          try {
            await storeUpdateHistory(
              chapter.manga,
              chapter.url,
              chapter.number,
              now,
              page
            );
          } catch (updateErr) {
            warn("updateHistory also failed:", updateErr);
          }
        }
      }, 800);
    },
    [chapter, sourceName, storeAddHistory, storeUpdateHistory]
  );

  // Clean up save timer on unmount
  useEffect(() => {
    return () => {
      if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Page change
  // ---------------------------------------------------------------------------

  const handlePageChange = useCallback(
    (event: any) => {
      if (isZoomed) return;
      try {
        const offset = isVertical
          ? event.nativeEvent.contentOffset.y
          : event.nativeEvent.contentOffset.x;
        const size = isVertical ? WINDOW.height : WINDOW.width;
        const index = Math.max(0, Math.round(offset / size));
        if (index !== currentPage) {
          setCurrentPage(index);
          saveProgress(index);
        }
      } catch (e) {
        warn("handlePageChange error:", e);
      }
    },
    [isZoomed, isVertical, currentPage, saveProgress]
  );

  // ---------------------------------------------------------------------------
  // Chapter navigation
  // ---------------------------------------------------------------------------

  const goToChapter = useCallback(
    (ch: Chapter) => {
      log("navigating to chapter:", ch.number);
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
      length: WINDOW.width,
      offset: WINDOW.width * index,
      index,
    }),
    []
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
          style={[styles.errorBtn, { backgroundColor: colors.surface }]}
        >
          <ThemedText variant="accent">Go Back</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={fetchChapter}
          style={[
            styles.errorBtn,
            { backgroundColor: colors.accent, marginTop: 8 },
          ]}
        >
          <Text style={{ color: "#fff" }}>Retry</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const totalPages = chapter.pages.length;

  // ---------------------------------------------------------------------------
  // Main render
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
      // Only provide getItemLayout for horizontal pager — vertical heights are
      // dynamic (image aspect ratios) and passing getItemLayout there causes
      // native crashes when scrollToIndex is attempted.
      getItemLayout={isVertical ? undefined : getItemLayout}
      onScrollToIndexFailed={(info) => {
        warn("onScrollToIndexFailed:", info);
      }}
    />
  );

  return (
    <>
      <StatusBar hidden={!controlsVisible} animated />

      <View style={styles.container}>
        {isVertical ? (
          pagerContent
        ) : (
          <ZoomableView
            onZoomChange={handleZoomChange}
            onSingleTap={toggleControls}
          >
            {pagerContent}
          </ZoomableView>
        )}

        {/* Top bar */}
        {controlsVisible && (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(180)}
            style={[
              styles.topBar,
              {
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

        {/* Bottom bar */}
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
              <Ionicons name="chevron-back" size={18} color={colors.text} />
              <ThemedText
                variant="secondary"
                style={{ fontSize: sizes.sub, marginLeft: 2 }}
                numberOfLines={1}
              >
                {prevChapter ? `Ch.${prevChapter.number}` : "Start"}
              </ThemedText>
            </TouchableOpacity>

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
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
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
  errorBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
});
