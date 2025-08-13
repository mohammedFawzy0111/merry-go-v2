import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/contexts/ThemeProvider";
import { sources } from "@/sources";
import { Chapter } from "@/utils/sourceModel";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ListRenderItemInfo,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const WINDOW = Dimensions.get("window");
const MIN_SCALE = 1;
const MAX_SCALE = 3;
const DOUBLE_TAP_SCALE = 2;

type PageProps = {
  uri: string;
  onZoomChange: (zoomed: boolean) => void; // called from UI thread via runOnJS
  onToggleControls: () => void;
};

function clamp(v: number, a: number, b: number) {
  "worklet";
  return Math.max(a, Math.min(b, v));
}

/**
 * Per-page component: handles pinch, pan, double-tap, and single-tap.
 * Keeps its own animated shared values so pages don't interfere.
 */
function Page({ uri, onZoomChange, onToggleControls }: PageProps) {
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  
  // Store image dimensions
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  
  // Get image dimensions when URI changes
  useEffect(() => {
    Image.getSize(uri, (width, height) => {
      setImageSize({ width, height });
    }, () => {});
  }, [uri]);

  // Calculate aspect ratio for the image
  const aspectRatio = imageSize.height > 0 ? imageSize.width / imageSize.height : 1;
  const calculatedHeight = WINDOW.width / aspectRatio;

  // Pinch gesture
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
      // inform JS that zoom started
      runOnJS(onZoomChange)(true);
    })
    .onUpdate((e) => {
      const s = clamp(startScale.value * e.scale, MIN_SCALE, MAX_SCALE);
      scale.value = s;
    })
    .onEnd(() => {
      if (scale.value <= MIN_SCALE + 0.01) {
        // reset translations when back to min
        scale.value = withTiming(1, { duration: 180 });
        translateX.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(0, { duration: 180 });
        runOnJS(onZoomChange)(false);
      } else if (scale.value > MAX_SCALE) {
        scale.value = withTiming(MAX_SCALE, { duration: 180 });
      }
    });

  // Pan gesture (only effective when zoomed)
  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (scale.value > 1.01) {
        translateX.value = startX.value + e.translationX;
        translateY.value = startY.value + e.translationY;
      }
    })
    .onEnd(() => {
      // Calculate boundaries based on actual image dimensions
      const maxTranslateX = (WINDOW.width * (scale.value - 1)) / 2 + 80;
      const maxTranslateY = (calculatedHeight * (scale.value - 1)) / 2 + 80;
      translateX.value = clamp(translateX.value, -maxTranslateX, maxTranslateX);
      translateY.value = clamp(translateY.value, -maxTranslateY, maxTranslateY);
    });

  // Double-tap to zoom in/out
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.01) {
        // zoom out
        scale.value = withTiming(1, { duration: 200 });
        translateX.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(0, { duration: 200 });
        runOnJS(onZoomChange)(false);
      } else {
        // zoom in
        scale.value = withTiming(DOUBLE_TAP_SCALE, { duration: 200 });
        runOnJS(onZoomChange)(true);
      }
    });

  // Single tap toggles UI controls
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onToggleControls)();
    });

  // Ensure double-tap steals recognition before single-tap (so double doesn't also trigger single)
  const tapGesture = Gesture.Exclusive(doubleTap, singleTap);

  // Only enable pinch/pan when zoomed
  const composed = scale.value > 1.01
    ? Gesture.Simultaneous(pinch, pan, tapGesture)
    : Gesture.Simultaneous(pinch, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.pageContainer, animatedStyle]}>
        <Animated.Image
          source={{ uri }}
          style={[
            styles.pageImage,
            { height: calculatedHeight, width: WINDOW.width }
          ]}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

export default function ChapterReader() {
  const { chapterUrl, sourceName } = useLocalSearchParams();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const source = sources.find((el) => el.name === sourceName)?.source;

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [controlsVisable, setControlsVisable] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [readingMode, setReadingMode] = useState("vertical")
  // when any page is zoomed, we disable the FlatList vertical scroll
  const [isAnyZoomed, setIsAnyZoomed] = useState(false);

  const toggleControls = useCallback(() => {
    setControlsVisable((v) => !v);
  }, []);
  // Moved renderItem hook to top level - must be declared unconditionally
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<string>) => {
      return (
        <Page
          uri={item}
          onZoomChange={(zoomed) => {
            // called from UI thread via runOnJS
            setIsAnyZoomed(zoomed);
          }}
          onToggleControls={toggleControls}
        />
      );
    },
    [toggleControls]
  );

  useEffect(() => {
    const fetchChapterData = async () => {
      setLoading(true);
      try {
        if (!source) return;
        const chapter: Chapter = await source.fetchChapterDetails(
          chapterUrl as string
        );
        if(!(chapter.pages.length > 0)){
          router.back()
        }
        setChapter(chapter);
      } catch (error) {
        console.error("Error fetching chapter:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchChapterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterUrl]);

  // Auto-hide controls
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (controlsVisable) {
      timeout = setTimeout(hideControls, 10000);
    }
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlsVisable]);

  const showControlsAnimated = useCallback(() => {
    setControlsVisable(true);
  }, []);

  const hideControls = useCallback(() => {
    setControlsVisable(false);
  }, []);

  const handlePageChange = (event: any) => {
    const index = Math.floor(
      event.nativeEvent.contentOffset.y / Dimensions.get("window").height
    );
    setCurrentPage(index);
  };

  // Moved conditional return AFTER all hook declarations
  if (loading || !chapter) {
    return (
      <ThemedView variant="background" style={styles.container}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <>
      <StatusBar hidden={!controlsVisable} animated style="auto" />
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.readerContainer}>
          <FlatList
            data={chapter.pages}
            renderItem={renderItem}
            keyExtractor={(_, index) => index.toString()}
            onMomentumScrollEnd={handlePageChange}
            pagingEnabled = {!isAnyZoomed && !(readingMode === "vertical")}
            snapToAlignment={readingMode === "vertical"? undefined: "center"}
            snapToInterval={readingMode === "vertical"? undefined: WINDOW.height}
            decelerationRate={readingMode === "vertcial"? "normal": "fast"}
            disableIntervalMomentum={readingMode === "vertical"}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isAnyZoomed} // when zoomed, disable list scrolling so pan works
            removeClippedSubviews
            windowSize={3}
          />

          {/* Top Controls */}
          {controlsVisable && (
            <View
              style={[
                styles.topControls,
                {
                  top: insets.top,
                  paddingTop: insets.top > 0 ? 8 : 0,
                  backgroundColor: `${colors.surface}CC`,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <ThemedText variant="title" style={styles.chapterTitle}>
                {chapter.number} - {chapter.title}
              </ThemedText>
            </View>
          )}

          {/* Bottom Controls */}
          {controlsVisable && (
            <View
              style={[
                styles.bottomControls,
                {
                  bottom: insets.bottom,
                  paddingBottom: insets.bottom > 0 ? 8 : 0,
                  backgroundColor: `${colors.surface}CC`,
                },
              ]}
            >
              <ThemedText variant="subtitle">
                {currentPage + 1} / {chapter.pages.length}
              </ThemedText>
              <TouchableOpacity
                onPress={() => console.log("Next chapter")}
                style={styles.nextButton}
              >
                <ThemedText variant="accent">Next</ThemedText>
                <Ionicons name="arrow-forward" size={24} color={colors.accent} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </GestureHandlerRootView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  readerContainer: { flex: 1, position: "relative", backgroundColor: "black" },
  pageContainer: {
    width: WINDOW.width,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
  },
  pageImage: { width: "100%" },
  topControls: {
    position: "absolute",
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  bottomControls: {
    position: "absolute",
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  backButton: { marginRight: 16 },
  chapterTitle: { flex: 1 },
  nextButton: { flexDirection: "row", alignItems: "center", gap: 8 },
});