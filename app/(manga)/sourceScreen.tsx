import { Dropdown, DropdownOption } from "@/components/Dropdown";
import { ThemedCard } from "@/components/ThemedCard";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { sources } from "@/sources";
import { Manga, Source } from "@/utils/sourceModel";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, ToastAndroid, useWindowDimensions } from "react-native";

type SortOption = "popular" | "latest";

const SortDropdown = ({
  position = "right",
  value,
  onChange,
}: {
  position?: "left" | "right";
  value: SortOption;
  onChange: (value: SortOption) => void;
}) => {
  const sortOptions: DropdownOption<SortOption>[] = [
    { value: "popular", label: "Popular", icon: "flame" },
    { value: "latest", label: "Latest", icon: "time" },
  ];

  return (
    <ThemedView
      style={[
        position === "right" ? styles.rightPosition : styles.leftPosition,
        styles.dropdownContainer,
      ]}
    >
      <Dropdown
        options={sortOptions}
        selectedValue={value}
        onSelect={onChange}
        width={140}
        textSize={12}
      />
    </ThemedView>
  );
};

export default function SourceScreen() {
  const { sourceName } = useLocalSearchParams();
  const isTablet = useWindowDimensions().width >= 768;

  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const source = sources.find((s) => s.name === sourceName);
  if (!source) {
    return (
      <ThemedView variant="background" style={styles.container}>
        <ThemedText variant="title">Source not found</ThemedText>
      </ThemedView>
    );
  }

  const sourceModel: Source = source.source;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    let cancelled = false;

    const loadManga = async () => {
      setLoading(true);
      try {
        const data =
          sortBy === "latest"
            ? await sourceModel.fetchRecentManga()
            : await sourceModel.fetchPopularManga() ?? []; // optional chaining in case it’s missing

        if (!cancelled) {
          setMangas(data);
        }
      } catch (err) {
        ToastAndroid.show(`failed to load source: ${err}`,ToastAndroid.LONG)
        console.error(`Error fetching ${sortBy} manga:`, err);
        if (!cancelled) setMangas([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadManga();

    return () => {
      cancelled = true; // prevents setting state after unmount
    };
  }, [sortBy, sourceModel]);

  return (
    <ThemedView variant="background" style={styles.container}>
      <ThemedView variant="surface" style={styles.header}>
        <SortDropdown
          position={isTablet ? "right" : "left"}
          value={sortBy}
          onChange={setSortBy}
        />
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
              cardStyle={[styles.card, isTablet && styles.cardTablet]}
              titleVariant="subtitle"
              onPress={() => {
                router.navigate({
                  pathname: "/(manga)/mangaDetail",
                  params: { mangaUrl: item.url, sourceName}
                })
              }}
            />
          )}
          keyExtractor={(item) => item.url}
          numColumns={isTablet ? 3 : 2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
  },
  listContent: {
    paddingBottom: 16,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 16,
  },
  card: {
    width: "48%",
    aspectRatio: 0.8,
  },
  cardTablet: {
    width: "31%",
  },
  dropdownContainer: {
    maxWidth: 150,
  },
  rightPosition: {
    right: 8,
  },
  leftPosition: {
    left: 8,
  },
});
