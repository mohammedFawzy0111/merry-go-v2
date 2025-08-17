/* eslint-disable react-hooks/rules-of-hooks */
import { Dropdown, DropdownOption } from "@/components/Dropdown";
import { ThemedCard } from "@/components/ThemedCard";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useFontSize, useTheme } from "@/contexts/settingProvider";
import { sources } from "@/sources";
import { Manga, Source } from "@/utils/sourceModel";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useMemo, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, TextInput, ToastAndroid, Dimensions } from "react-native";

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
    <ThemedView
      style={styles.dropdownContainer}
    >
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
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>(initialTag ? `[${initialTag}]` : "")

  const [offset,setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const router = useRouter();

  const screenWidth = Dimensions.get('window').width;

  const ITEM_MIN_WIDTH = 160;
  const ITEM_MARGIN = 8;

  const numColumns = useMemo(()=>{
    return Math.floor(screenWidth / (ITEM_MIN_WIDTH + ITEM_MARGIN * 2));
  }, [screenWidth]);


  const source = sources.find((s) => s.name === sourceName);

  if (!source) {
    return (
      <ThemedView variant="background" style={styles.container}>
        <ThemedText variant="title">Source not found</ThemedText>
      </ThemedView>
    );
  }

  const sourceModel: Source = source.source;

  const loadManga = useCallback(async (loadMore: boolean = false) => {
  if ((!loadMore && loading) || (loadMore && isLoadingMore)) return;
  
  let cancelled = false;
  
  if (loadMore) {
    setIsLoadingMore(true);
  } else {
    setLoading(true);
  }
  
  try {
    const currentOffset = loadMore ? offset : 0;
    let data: Manga[] = [];

    if (searchQuery.trim().length > 0) {
      data = await sourceModel.fetchSearchResults(searchQuery, currentOffset);
    } else {
      data = sortBy === "latest"
        ? await sourceModel.fetchRecentManga(currentOffset)
        : await sourceModel.fetchPopularManga(currentOffset) ?? [];
    }

    if (!cancelled) {
      if (loadMore) {
        setMangas(prev => [...prev, ...data]);
      } else {
        setMangas(data);
      }
      setHasMore(data.length > 0);
      setOffset(loadMore ? offset + data.length : data.length);
    }
  } catch (err) {
    if (!cancelled) {
      ToastAndroid.show(`Failed to load manga: ${err}`, ToastAndroid.LONG);
      if (!loadMore) setMangas([]);
      setHasMore(false);
    }
  } finally {
    if (!cancelled) {
      if (loadMore) {
        setIsLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }

  return () => {
    cancelled = true;
  };
}, [offset, searchQuery, sortBy, sourceModel, loading, isLoadingMore]);

useEffect(() => {
  return () => {
    // Reset all state when component unmounts
    setMangas([]);
    setOffset(0);
    setSearchQuery(initialTag ? `[${initialTag}]` : "");
  };
}, []);
  
  useFocusEffect(
    useCallback(() => {
      // Reset state when screen comes into focus
      setMangas([]);
      setOffset(0);
      setSearchQuery(initialTag ? `[${initialTag}]` : "");
      setSortBy("popular");
      setHasMore(true);
      
      return () => {};
    }, [initialTag])
  );  

  useEffect(() => {
  const debounceTimer = setTimeout(() => {
    loadManga(false);
  }, 1000);

  return () => {
    clearTimeout(debounceTimer);
  };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [searchQuery, sortBy]); // Only trigger when these change

  const handleEndReached = useCallback(() => {
  if (!isLoadingMore && hasMore && !loading) {
    loadManga(true);
  }
}, [isLoadingMore, hasMore, loading, loadManga]);

  // Loading footer component
  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <ThemedView style={{ padding: 20 }}>
        <ActivityIndicator size="small" />
      </ThemedView>
    );
  };

  return (
    <ThemedView variant="background" style={styles.container}>
      <ThemedView variant="surface" style={styles.header}>
        <TextInput 
          style={[styles.searchBar,{ backgroundColor: colors.bg, fontSize: sizes.text, color: colors.text }]}
          placeholder="search"
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <SortDropdown
          value={sortBy}
          onChange={setSortBy}
        />
      </ThemedView>

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={mangas}
          key={numColumns}
          renderItem={({ item }) => (
            <ThemedCard
              imageSource={
                item.imageUrl
                  ? { uri: item.imageUrl }
                  : require("@/assets/images/placeholder.png")
              }
              title={item.name}
              cardStyle={[styles.card]}
              titleVariant="default"
              onPress={() => {
                router.navigate({
                  pathname: "/(manga)/mangaDetail",
                  params: { mangaUrl: item.url, sourceName}
                })
              }}
            />
          )}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.1}
          ListFooterComponent={renderFooter}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listContent: {
    paddingBottom: 16,
  },
  columnWrapper: {
    justifyContent: "space-evenly",
    marginBottom: 16,
    gap: 16,
  },
  card: {
    minWidth: 160,
    aspectRatio: 0.7,
  },
  
  dropdownContainer: {
    flexShrink:1,
    maxWidth: "20%",
  },
  searchBar: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
  },
});
