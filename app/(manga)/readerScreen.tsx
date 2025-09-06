import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useFontSize, useReadingMode, useTheme } from "@/contexts/settingProvider";
import { sourceManager } from "@/sources";
import { useDownloadStore } from "@/store/downloadStore";
import { Chapter } from "@/utils/sourceModel";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ListRenderItemInfo,
  StyleSheet,
  ToastAndroid,
  TouchableOpacity,
  View
} from "react-native";
import {
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ZoomableView } from "@/components/ZoomableView";

const WINDOW = Dimensions.get("window");

type PageProps = {
  uri: string;
  readingMode: string;
};

function Page({ uri, readingMode }: PageProps) {
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

  return (
    <View style={styles.pageContainer}>
      <Image
        source={{ uri }}
        style={[
          styles.pageImage,
          readingMode === "vertical"
            ? { width: WINDOW.width, height: undefined, aspectRatio }
            : { height: calculatedHeight, width: WINDOW.width }
        ]}
        resizeMode={readingMode === "vertical" ? "cover" : "contain"}
      />
    </View>
  );
}

export default function ChapterReader() {
  const { chapterUrl, sourceName } = useLocalSearchParams();
  const { colors } = useTheme();
  const { sizes } = useFontSize();
  const { readingMode } = useReadingMode()
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loadDownloads, getDownloadByChapter } = useDownloadStore();

  const source = sourceManager.getSourceByName(sourceName as string)?.source;

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const toggleControls = useCallback(() => {
    setControlsVisible((v) => !v);
  }, []);

  const handleZoomChange = useCallback((zoomed: boolean) => {
    setIsZoomed(zoomed);
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<string>) => {
      return (
        <Page
          uri={item}
          readingMode={readingMode}
        />
      );
    },
    [readingMode]
  );

  // Custom scroll component that wraps the FlatList in ZoomableView
  const renderScrollComponent = useCallback(
    (props: any) => (
      <ZoomableView
        onZoomChange={handleZoomChange}
        onSingleTap={toggleControls}
        {...props}
      />
    ),
    [handleZoomChange, toggleControls]
  );

  const fetchChapterData = async() => {
    setLoading(true);
    try {
      const download = await getDownloadByChapter(chapterUrl as string);
      if(download && download.status === 'done' && download.localPath){
        const files = await FileSystem.readDirectoryAsync(download.localPath);
        const pageFiles = files
        .filter(file => file.startsWith('page_') && (file.endsWith('.jpg') || file.endsWith('.png')))
        .sort((a,b) => {
          const aNum = parseInt(a.split('_')[1].split('.')[0], 10);
          const bNum = parseInt(b.split('_')[1].split('.')[0], 10);
          return aNum - bNum;
        });
        const localPages = pageFiles.map(file => `${download.localPath}${file}`);

        const localChapter = new Chapter({
          manga: download.mangaUrl,
          title: download.chapterTitle,
          number:0,
          url: download.chapterUrl,
          publishedAt: '',
          pages: localPages
        });
        setChapter(localChapter);
      } else {
        if(!source) return;
        const chapter: Chapter = await source.fetchChapterDetails(chapterUrl as string);
        if(!(chapter.pages.length > 0)) {
          ToastAndroid.show('chapter is empty', ToastAndroid.SHORT);
          router.back();
        }
        setChapter(chapter);
      }
    } catch (error) {
      console.error("Error fetching chapter: ", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDownloads();
  }, []);

  useEffect(() => {
    fetchChapterData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterUrl]);

  // Auto-hide controls
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (controlsVisible && !isZoomed) {
      timeout = setTimeout(() => setControlsVisible(false), 5000);
    }
    return () => clearTimeout(timeout);
  }, [controlsVisible, isZoomed]);

  const handlePageChange = (event: any) => {
    if (isZoomed) return; // Don't change page when zoomed
    
    const offset = readingMode === "vertical" 
      ? event.nativeEvent.contentOffset.y 
      : event.nativeEvent.contentOffset.x;
    const windowSize = readingMode === "vertical" 
      ? Dimensions.get("window").height 
      : Dimensions.get("window").width;
    const index = Math.floor(offset / windowSize);
    setCurrentPage(index);
  };

  if (loading || !chapter) {
    return (
      <ThemedView variant="background" style={styles.container}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <>
      <StatusBar hidden={!controlsVisible} animated style="auto" />
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.readerContainer}>
          <FlatList
            ref={flatListRef}
            data={chapter.pages}
            renderItem={renderItem}
            keyExtractor={(_, index) => index.toString()}
            onMomentumScrollEnd={handlePageChange}
            pagingEnabled={readingMode !== 'vertical' && !isZoomed}
            snapToAlignment={readingMode !== 'vertical' ? "center" : undefined}
            snapToInterval={readingMode !== 'vertical' ? WINDOW.width : undefined}
            decelerationRate={readingMode === "vertical" ? "normal" : "fast"}
            disableIntervalMomentum={readingMode === "vertical"}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            scrollEnabled={!isZoomed}
            removeClippedSubviews
            windowSize={3}
            horizontal={readingMode !== "vertical"}
            inverted={readingMode === "rtl"}
            renderScrollComponent={renderScrollComponent}
          />

          {controlsVisible && (
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
                <Ionicons name="arrow-back" size={sizes.heading} color={colors.text} />
              </TouchableOpacity>
              <ThemedText variant="title" style={styles.chapterTitle}>
                {chapter.number} - {chapter.title}
              </ThemedText>
            </View>
          )}

          {controlsVisible && (
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
                <Ionicons name="arrow-forward" size={sizes.heading} color={colors.accent} />
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