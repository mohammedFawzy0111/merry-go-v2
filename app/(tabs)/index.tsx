import { ThemedView } from "@/components/ThemedView";
import { useRouter } from "expo-router";
import { useMangaStore } from '@/store/mangaStore'
import {ThemedCard} from "@/components/ThemedCard";
import {Dimensions, FlatList, StyleSheet} from "react-native";
import {useMemo} from "react";
import {ThemedText} from "@/components/ThemedText";



export default function Home() {
  const router = useRouter()
  const { mangas } = useMangaStore();

  const screenWidth = Dimensions.get('window').width;
  const ITEM_MIN_WIDTH = 160;
  const ITEM_MARGIN = 8;

  const numColumns = useMemo(()=>{
    return Math.floor(screenWidth / (ITEM_MIN_WIDTH + ITEM_MARGIN * 2));
  }, [screenWidth])


  const empty = () => {
    return (
      <ThemedText variant="title">
      Nothing in the library yet add some...
      </ThemedText>
    );
  }

  return (
    <ThemedView variant="background" style={styles.container}>
    {mangas.length === 0? empty() :
      <FlatList
        data = {mangas}
        renderItem={({item}) => (
          <ThemedCard 
            imageSource={
             item.imageUrl ? {uri: item.imageUrl}:
              require('@/assets/images/placeholder.png')
            }

            title={item.name}
            imageStyle={styles.card}
          />
        )}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
      />}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
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
});
