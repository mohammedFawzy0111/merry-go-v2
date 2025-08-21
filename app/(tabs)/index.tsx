import { ThemedCard } from "@/components/ThemedCard";
import { ThemedModal } from "@/components/ThemedModal";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/contexts/settingProvider";
import { initDb } from "@/db/db";
import { NotificationService } from "@/services/notificationService";
import { useCategoryStore } from '@/store/categoryStore';
import { useDownloadStore } from "@/store/downloadStore";
import { useMangaStore } from '@/store/mangaStore';
import { MaterialIcons } from '@expo/vector-icons';
import notifee from '@notifee/react-native';
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Dimensions, FlatList, StyleSheet, TouchableOpacity } from "react-native";

export default function Home() {
  const router = useRouter();
  const { mangas, loadMangas, removeManga } = useMangaStore();
  const { categories, activeCategory, addCategory, setActiveCategory, deleteCategory } = useCategoryStore();
  const { loadDownloads } = useDownloadStore()
  const { colors } = useTheme();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoyDel, setCategoryDel] = useState(true);
  const [idToDelete, setIdToDelete] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

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

  // initilization useEffect
  useEffect(() => {
    (async () => {
      await initDb();
      await loadMangas();
    })();

    const initializeNotification = async () => {
      await NotificationService.initialize();
      await notifee.requestPermission();
    }

    (async () => { await loadDownloads()})()

    initializeNotification();
  }, []);

  const filteredMangas = useMemo(() => {
    return mangas.filter(manga => manga.category === activeCategory);
  }, [mangas, activeCategory]);

  const handleAddCategory = (name: string | undefined) => {
    if (name && name.trim()) {
      addCategory(name);
      setNewCategoryName('');
      setShowAddModal(false);
    }
  };

  const handleDelete = (id:string) => {
    if(categoyDel){
      deleteCategory(id);
    } else {
      removeManga(id);
    }
    setShowDeleteModal(false);
  }

  const EmptyState = () => (
    <ThemedView style={styles.emptyContainer}>
      <ThemedText variant="title" style={styles.emptyText}>
        {activeCategory === 'default' ? 'Your library is empty' : `No manga in ${activeCategory}`}
      </ThemedText>
      <ThemedText variant="subtitle" style={styles.emptySubtext}>
        {activeCategory === 'default' 
          ? 'Add some manga to get started' 
          : 'Add manga to this category'}
      </ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView variant="background" style={styles.container}>
      {/* Categories Header */}
      <ThemedView style={styles.sectionContainer}>
        <FlatList
          horizontal
          data={categories}
          renderItem={({ item }) => (
            <ThemedView 
              style={[
                styles.categoryButton,
                activeCategory === item.id && styles.activeCategoryButton
              ]}
              variant={activeCategory === item.id ? 'surface' : 'default'}
              bordered={activeCategory === item.id}
            >
              <TouchableOpacity 
                onPress={() => setActiveCategory(item.id)}
                activeOpacity={0.7}
                onLongPress={item.id !== 'default' ? () => {
                  setCategoryDel(true);
                  setIdToDelete(item.id);
                  setShowDeleteModal(true);
                } : undefined}
              >
                <ThemedText 
                  variant={activeCategory === item.id ? 'accent' : 'secondary'}
                  style={styles.categoryText}
                >
                  {item.name}
                </ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.sectionList}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps= "handled"
        />
        
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.7}
        >
          <MaterialIcons 
            name="add" 
            size={24} 
            color={colors.textSecondary} 
          />
        </TouchableOpacity>
      </ThemedView>

      {/* Add Category Modal */}
      <ThemedModal
        visible={showAddModal}
        type="prompt"
        title="Add New Category"
        placeholder="Enter category name"
        confirmText="Add"
        onConfirm={handleAddCategory}
        onCancel={() => {
          setNewCategoryName('');
          setShowAddModal(false);
        }}
      />
      {/* delete category Modal */}
      <ThemedModal 
        visible={showDeleteModal}
        type="confirm"
        title="Delete Category"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={()=> handleDelete(idToDelete)}
        onCancel={()=> {
          setShowDeleteModal(false);
        }}
      />

      {/* Manga List */}
      <FlatList
        data={filteredMangas}
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
            onPress={() => {
              router.navigate({
                pathname: "/(manga)/mangaDetail",
                params: {mangaUrl: item.url, sourceName: item.source.name}
              })
            }}
            onLongPress={()=> {
              setCategoryDel(false)
              setIdToDelete(item.url);
              setShowDeleteModal(true);
            }}
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
  sectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sectionList: {
    gap: 8,
  },
  categoryButton: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  activeCategoryButton: {
    borderWidth: 1,
  },
  categoryText: {
    fontWeight: '500',
  },
  addButton: {
    padding: 8,
    marginLeft: 8,
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