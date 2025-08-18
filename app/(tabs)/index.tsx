import { ThemedCard } from "@/components/ThemedCard";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useMangaStore } from '@/store/mangaStore';
import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { Dimensions, FlatList, StyleSheet } from "react-native";

export default function Home() {
  const router = useRouter()
  const { mangas, loadMangas } = useMangaStore();

  const screenWidth = Dimensions.get('window').width;
  const CARD_WIDTH = 160;
  const CARD_HEIGHT = 240;
  const GAP = 16;

  const numColumns = useMemo(() => {
    return Math.floor(screenWidth / (CARD_WIDTH + GAP));
  }, [screenWidth]);

  const containerPadding = useMemo(() => {
    const remainingSpace = screenWidth - (numColumns * (CARD_WIDTH + GAP));
    return Math.max(GAP, remainingSpace / 2);
  }, [screenWidth, numColumns]);

  useEffect(() => {
    loadMangas();
  }, []);

  const EmptyState = () => (
    <ThemedView style={styles.emptyContainer}>
      <ThemedText variant="title" style={styles.emptyText}>
        Your library is empty
      </ThemedText>
      <ThemedText variant="subtitle" style={styles.emptySubtext}>
        Add some manga to get started
      </ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView variant="background" style={styles.container}>
      <FlatList
        data={mangas}
        renderItem={({ item }) => (
          <ThemedCard 
            imageSource={
              item.imageUrl 
                ? { uri: item.imageUrl }
                : require('@/assets/images/placeholder.png')
            }
            title={item.name}
            imageStyle={styles.cardImage}
            cardStyle={styles.cardContainer}
            
          />
        )}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        columnWrapperStyle={[
          styles.columnWrapper,
          { paddingHorizontal: containerPadding - GAP / 2 }
        ]}
        contentContainerStyle={[
          styles.listContent,
          { paddingHorizontal: containerPadding }
        ]}
        ListEmptyComponent={<EmptyState />}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
  },
  columnWrapper: {
    gap: 16,
  },
  cardContainer: {
    width: 160,
    height: 240,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: 'center',
    opacity: 0.7,
  },
});