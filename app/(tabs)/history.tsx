import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedModal } from "@/components/ThemedModal";
import { useTheme, useFontSize } from "@/contexts/settingProvider";
import { useHistoryStore } from "@/store/historyStore";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  View,
} from "react-native";
import { formatDateString } from "@/utils/fomatDateString";
import { History} from "@/db/db";

export default function HistoryScreen() {
  const { colors } = useTheme();
  const { sizes } = useFontSize();
  const router = useRouter();
  const { history, loadHistory, removeHistroy } = useHistoryStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [selectedManga, setSelectedManga] = useState<{url: string; title: string} | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const handleRemoveHistory = (mangaUrl: string, mangaTitle: string) => {
    setSelectedManga({ url: mangaUrl, title: mangaTitle });
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedManga) {
      removeHistroy(selectedManga.url);
      setShowDeleteModal(false);
      setSelectedManga(null);
    }
  };

  const handleClearAll = () => {
    if (history.length === 0) return;
    setShowClearAllModal(true);
  };

  const confirmClearAll = async () => {
    for (const item of history) {
      await removeHistroy(item.mangaUrl);
    }
    setShowClearAllModal(false);
  };

  const renderHistoryItem = ({ item }: { item:History }) => (
    <ThemedView variant="surface" style={styles.historyItem}>
      <TouchableOpacity
        style={styles.historyContent}
        onPress={() => {
          router.navigate({
            pathname: "/(manga)/readerScreen",
            params: { 
              chapterUrl: item.chapterUrl,
              sourceName: item.source || "default"
            },
          });
        }}
      >
        <View style={styles.historyInfo}>
          <ThemedText variant="subtitle" style={[styles.mangaTitle, { fontSize: sizes.heading }]}>
            {item.mangaTitle}
          </ThemedText>
          <ThemedText variant="secondary" style={{ fontSize: sizes.text }}>
            Chapter {item.chapterNumber}
          </ThemedText>
          <ThemedText variant="secondary" style={[styles.dateText, { fontSize: sizes.sub }]}>
            {formatDateString(item.lastRead)}
          </ThemedText>
          <ThemedText variant="secondary" style={{ fontSize: sizes.sub }}>
            Page {item.page}
          </ThemedText>
        </View>

        <TouchableOpacity
          onPress={() => handleRemoveHistory(item.mangaUrl, item.mangaTitle)}
          style={[styles.deleteButton, { backgroundColor: colors.surface }]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    </ThemedView>
  );

  return (
    <ThemedView variant="background" style={styles.container}>
      {/* Header */}
      <ThemedView variant="surface" style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText variant="title" style={{ fontSize: sizes.heading }}>
          Reading History
        </ThemedText>
        {history.length > 0 && (
          <TouchableOpacity
            onPress={handleClearAll}
            style={[styles.clearButton, { backgroundColor: colors.surface }]}
          >
            <ThemedText variant="secondary" style={{ fontSize: sizes.text }}>
              Clear All
            </ThemedText>
          </TouchableOpacity>
        )}
      </ThemedView>

      {/* History List */}
      <FlatList
        data={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item) => `${item.mangaUrl}-${item.chapterUrl}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          <ThemedView style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={64} color={colors.textSecondary} />
            <ThemedText variant="title" style={[styles.emptyText, { fontSize: sizes.heading }]}>
              No Reading History
            </ThemedText>
            <ThemedText variant="secondary" style={[styles.emptySubtext, { fontSize: sizes.text }]}>
              Your reading history will appear here
            </ThemedText>
          </ThemedView>
        }
      />

      {/* Delete Confirmation Modal */}
      <ThemedModal
        visible={showDeleteModal}
        type="confirm"
        title="Remove History"
        message={selectedManga ? `Remove reading history for ${selectedManga.title}?` : ''}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedManga(null);
        }}
      />

      {/* Clear All Confirmation Modal */}
      <ThemedModal
        visible={showClearAllModal}
        type="confirm"
        title="Clear All History"
        message="Are you sure you want to clear all reading history?"
        confirmText="Clear All"
        cancelText="Cancel"
        onConfirm={confirmClearAll}
        onCancel={() => setShowClearAllModal(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  listContent: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  historyItem: {
    borderRadius: 12,
    padding: 16,
  },
  historyContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyInfo: {
    flex: 1,
    gap: 4,
  },
  mangaTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  dateText: {
    opacity: 0.7,
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    minHeight: 300,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: "center",
    opacity: 0.7,
  },
});
