// screens/ChapterReader.tsx
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/contexts/ThemeProvider";
import { Chapter } from "@/utils/sourceModel";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
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

export default function ChapterReader() {
  const { chapterUrl } = useLocalSearchParams();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [controlsVisable, setControlsVisable] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);

  // Controls animation
  const controlsOpacity = useSharedValue(1);
  const controlsTranslateY = useSharedValue(0);

  // Zoom value (shared for demo; can be made per-page later)
  const scale = useSharedValue(1);

  useEffect(() => {
    const fetchChapterData = async () => {
      setLoading(true);
      try {
        const mockChapter: Chapter = {
          url: chapterUrl as string,
          number: 1,
          title: "Chapter 1",
          manga: "test",
          pages: Array(10).fill("https://placehold.co/400x600"),
        };
        setChapter(mockChapter);
      } catch (error) {
        console.error("Error fetching chapter:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchChapterData();
  }, [chapterUrl]);

  // Auto-hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (controlsVisable) {
      timeout = setTimeout(hideControls, 10000);
    }
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlsVisable]);

  const showControlsAnimated = useCallback(() => {
    setControlsVisable(true);
    controlsOpacity.value = withTiming(1, { duration: 200 });
    controlsTranslateY.value = withTiming(0, { duration: 200 });
  }, [controlsOpacity, controlsTranslateY]);

  const hideControls = useCallback(() => {
    // Completion callback is a worklet — use runOnJS to set React state
    controlsOpacity.value = withTiming(0, { duration: 200 });
    controlsTranslateY.value = withTiming(
      -50,
      { duration: 200 },
      (isFinished?: boolean) => {
        if (isFinished) {
          runOnJS(setControlsVisable)(false);
        }
      }
    );
  }, [controlsOpacity, controlsTranslateY, setControlsVisable]);

  const toggleControls = useCallback(() => {
    controlsVisable ? hideControls() : showControlsAnimated();
  }, [controlsVisable, hideControls, showControlsAnimated]);

  // Pinch gesture (per-image pinch)
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = e.scale;
    })
    .onEnd(() => {
      scale.value = withTiming(1, { duration: 200 });
    });

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const controlsStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
    transform: [{ translateY: controlsTranslateY.value }],
  }));

  const handlePageChange = (event: any) => {
    const index = Math.floor(
      event.nativeEvent.contentOffset.y / Dimensions.get("window").height
    );
    setCurrentPage(index);
  };

  if (loading || !chapter) {
    return (
      <ThemedView variant="background" style={styles.container}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  // Tap gesture to toggle controls (runs on UI thread; use runOnJS to call JS toggle)
  const tapGesture = Gesture.Tap().numberOfTaps(1).onEnd(() => {
    runOnJS(toggleControls)();
  });

  // When controls are visible we want to show status bar; hide it otherwise.
  // (StatusBar hidden prop uses the current controlsVisable state)
  return (
    <>
      <StatusBar hidden={!controlsVisable} animated style="auto" />
      <GestureHandlerRootView style={styles.container}>
        <GestureDetector gesture={tapGesture}>
          <View style={styles.readerContainer}>
            <FlatList
              data={chapter.pages}
              renderItem={({ item }) => (
                // Keep pinch per-item so pinch gestures work on the image
                <GestureDetector gesture={pinchGesture}>
                  <Animated.View style={styles.pageContainer}>
                    <Animated.Image
                      source={{ uri: item }}
                      style={[styles.pageImage, animatedImageStyle]}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </GestureDetector>
              )}
              keyExtractor={(_, index) => index.toString()}
              onMomentumScrollEnd={handlePageChange}
              pagingEnabled
              showsVerticalScrollIndicator={false}
            />

            {/* Top Controls */}
            {controlsVisable && (
              <Animated.View
                style={[
                  styles.topControls,
                  controlsStyle,
                  {
                    // move controls below status bar / notch when visible
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
              </Animated.View>
            )}

            {/* Bottom Controls */}
            {controlsVisable && (
              <Animated.View
                style={[
                  styles.bottomControls,
                  controlsStyle,
                  {
                    // lift controls above home indicator / gesture area
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
                  <Ionicons
                    name="arrow-forward"
                    size={24}
                    color={colors.accent}
                  />
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  readerContainer: { flex: 1, position: "relative" },
  pageContainer: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
  },
  pageImage: { width: "100%", height: "100%" },
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
