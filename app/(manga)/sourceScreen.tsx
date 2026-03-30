/* eslint-disable react-hooks/rules-of-hooks */
import { Dropdown, DropdownOption } from "@/components/Dropdown";
import { ThemedCard } from "@/components/ThemedCard";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useFontSize, useTheme } from "@/contexts/settingProvider";
import { sourceManager } from "@/sources";
import { Manga, Source } from "@/utils/sourceModel";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  TextInput,
  ToastAndroid,
} from "react-native";

type SortOption = "popular" | "latest";

const SortDropdown = ({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (value: SortOption) => void;
}) => {
  const sortOptions: DropdownOption<SortOption>[] = [
    { value: "popular", label: "Popular", icon: "flame" },
    { value: "latest", label: "Latest", icon: "time" },
  ];
  return (
    <ThemedView style={styles.dropdownContainer}>
      <Dropdown
        options={sortOptions}
        selectedValue={value}
        onSelect={onChange}
        textSize={12}
        showHeaderIconOnly={true}
      />
    </ThemedView>
  );
};

export default function SourceScreen() {
  const { sourceName, initialTag } = useLocalSearchParams();
  const { colors } = useTheme();
  const { sizes } = useFontSize();

  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>(
    initialTag ? `[${initialTag}]` : ""
  );
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const router = useRouter();

  // Stable ref for the active fetch — lets us cancel stale requests without
  // recreating the loadManga callback on every state change.
  const fetchIdRef = useRef(0);

  const screenWidth = Dimensions.get("window").width;
  const ITEM_MIN_WIDTH = 160;
  const ITEM_MARGIN = 8;
  const numColumns = useMemo(
    () => Math.floor(screenWidth / (ITEM_MIN_WIDTH + ITEM_MARGIN * 2)),
    [screenWidth]
  );

  const source = sourceManager.getSourceByName(sourceName as string);
  if (!source) {
    return (
      <ThemedView variant="background" style={styles.container}>
        <ThemedText variant="title">Source not found</ThemedText>
      </ThemedView>
    );
  }
  const sourceModel: Source = source.source;

  // Core fetch function. `currentOffset` and `appendMode` are passed explicitly
  // so the callback doesn't need to close over mutable state.
  const fetchMangas = useCallback(
    async (
      query: string,
      sort: SortOption,
      currentOffset: number,
      appendMode: boolean
    ) => {
      const myFetchId = ++fetchIdRef.current;

      if (appendMode) setIsLoadingMore(true);
      else setLoading(true);

      try {
        let data: Manga[];
        if (query.trim().length > 0) {
          data = await sourceModel.fetchSearchResults(query, currentOffset);
        } else {
          data =
            sort === "latest"
              ? await sourceModel.fetchRecentManga(currentOffset)
              : await sourceModel.fetchPopularManga(currentOffset);
        }

        // Discard result if a newer fetch has started
        if (myFetchId !== fetchIdRef.current) return;

        // Deduplicate
        if (appendMode) {
          setMangas((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            return [...prev, ...data.filter((m) => !seen.has(m.id))];
          });
        } else {
          const seen = new Set<string>();
          setMangas(
            data.filter((m) => {
              if (seen.has(m.id)) return false;
              seen.add(m.id);
              return true;
            })
          );
        }

        setHasMore(data.length > 0);
        setOffset(currentOffset + data.length);
      } catch (err) {
        if (myFetchId !== fetchIdRef.current) return;
        console.error("Failed to load manga:", err);
        ToastAndroid.show(`Failed to load manga: ${err}`, ToastAndroid.LONG);
        if (!appendMode) {
          setMangas([]);
          setHasMore(false);
        }
      } finally {
        if (myFetchId === fetchIdRef.current) {
          if (appendMode) setIsLoadingMore(false);
          else setLoading(false);
        }
      }
    },
    // sourceModel is stable as long as sourceName doesn't change
    [sourceModel]
  );

  // Reset and reload whenever search query or sort order changes (debounced).
  useEffect(() => {
    const timer = setTimeout(() => {
      setMangas([]);
      setOffset(0);
      setHasMore(true);
      fetchMangas(searchQuery, sortBy, 0, false);
    }, 600); // 600 ms debounce — snappier than 1 s

    return () => clearTimeout(timer);
  }, [searchQuery, sortBy, fetchMangas]);

  // Reset when screen comes into focus (e.g. back-navigation from detail)
  useFocusEffect(
    useCallback(() => {
      const tag = initialTag ? `[${initialTag}]` : "";
      setSearchQuery(tag);
      setSortBy("popular");
      setMangas([]);
      setOffset(0);
      setHasMore(true);
    }, [initialTag])
  );

  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasMore && !loading) {
      fetchMangas(searchQuery, sortBy, offset, true);
    }
  }, [isLoadingMore, hasMore, loading, searchQuery, sortBy, offset, fetchMangas]);

  const renderFooter = () =>
    isLoadingMore ? (
      <ThemedView style={{ padding: 20 }}>
        <ActivityIndicator size="small" />
      </ThemedView>
    ) : null;

  return (
    <ThemedView variant="background" style={styles.container}>
      <ThemedView variant="surface" style={styles.header}>
        <TextInput
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.bg,
              fontSize: sizes.text,
              color: colors.text,
            },
          ]}
          placeholder="Search…"
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <SortDropdown value={sortBy} onChange={setSortBy} />
      </ThemedView>

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={mangas}
          renderItem={({ item }) => (
            <ThemedCard
              imageSource={
                item.imageUrl
                  ? { uri: item.imageUrl }
                  : require("@/assets/images/placeholder.png")
              }
              title={item.name}
              cardStyle={styles.card}
              titleVariant="default"
              onPress={() =>
                router.navigate({
                  pathname: "/(manga)/mangaDetail",
                  params: { mangaUrl: item.url, sourceName },
                })
              }
            />
          )}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.2}
          ListFooterComponent={renderFooter}
          // Performance
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={8}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: {
    marginBottom: 20,
    padding: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  listContent: { paddingBottom: 16 },
  columnWrapper: {
    justifyContent: "space-evenly",
    marginBottom: 16,
    gap: 16,
  },
  card: { minWidth: 160, aspectRatio: 0.7 },
  dropdownContainer: { flexShrink: 1, maxWidth: "20%" },
  searchBar: { flex: 1, borderRadius: 8, padding: 12 },
});
