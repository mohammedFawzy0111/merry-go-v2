import { ThemedModal } from "@/components/ThemedModal";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useFontSize, useTheme } from "@/contexts/settingProvider";
import { Download } from "@/db/db";
import { useDownloadStore } from "@/store/downloadStore";
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";

const { width } = Dimensions.get('window');

type DownloadSection = 'all' | 'active' | 'completed' | 'errors';

export default function Downloads() {
  const { 
    downloads, 
    activeDownloads, 
    pendingDownloads, 
    completedDownloads, 
    errorDownloads, 
    loading, 
    loadDownloads, 
    removeDownload, 
    retryDownload,
    clearCompletedDownloads
  } = useDownloadStore();
  const { colors } = useTheme();
  const { sizes } = useFontSize();
  const [activeSection, setActiveSection] = useState<DownloadSection>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDownload, setSelectedDownload] = useState<Download | null>(null);

  useEffect(() => {
    loadDownloads();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDownloads();
    setRefreshing(false);
  };

  const getDisplayDownloads = () => {
    switch (activeSection) {
      case 'active':
        return [...activeDownloads, ...pendingDownloads];
      case 'completed':
        return completedDownloads;
      case 'errors':
        return errorDownloads;
      default:
        return downloads;
    }
  };

  const handleDeleteDownload = async (download: Download) => {
    setSelectedDownload(download);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (selectedDownload) {
      // Delete files first
      try {
        const downloadDir = `${FileSystem.documentDirectory}downloads/${selectedDownload.id}/`;
        await FileSystem.deleteAsync(downloadDir, { idempotent: true });
      } catch (error) {
        console.log('Error deleting files:', error);
      }
      
      await removeDownload(selectedDownload.id);
      setShowDeleteModal(false);
      setSelectedDownload(null);
    }
  };

  const handleOpenDownload = async (download: Download) => {
    if (download.status === 'done' && download.localPath) {
      try {
        // Check if file exists
        const info = await FileSystem.getInfoAsync(download.localPath);
        if (info.exists) {
          // Here you would navigate to a reader component
          Alert.alert('Download Ready', `Open ${download.mangaTitle} - ${download.chapterTitle}`);
        } else {
          Alert.alert('Error', 'Downloaded file not found');
        }
      } catch (error) {
        Alert.alert('Error', 'Could not access downloaded file');
      }
    }
  };

  const renderDownloadItem = ({ item }: { item: Download }) => (
    <ThemedView variant="surface" style={styles.downloadItem}>
      <View style={styles.downloadInfo}>
        <ThemedText variant="subtitle" style={{fontWeight: '600',fontSize: sizes.heading}}>
          {item.mangaTitle}
        </ThemedText>
        <ThemedText variant="secondary" style={{fontSize: sizes.text,opacity: 0.8}}>
          {item.chapterTitle}
        </ThemedText>
        
        {item.status === 'downloading' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { width: `${item.progress}%`, backgroundColor: colors.accent }
                ]} 
              />
            </View>
            <ThemedText variant="secondary" style={{fontSize: sizes.sub,minWidth: 40}}>
              {Math.round(item.progress)}%
            </ThemedText>
          </View>
        )}
        
        <ThemedText variant="secondary" style={{fontSize: sizes.sub,marginTop: 4}}>
          Status: {item.status}
        </ThemedText>
      </View>

      <View style={styles.actionButtons}>
        {item.status === 'error' && (
          <TouchableOpacity 
            onPress={() => retryDownload(item.id)}
            style={[styles.actionButton, { backgroundColor: colors.accent }]}
          >
            <MaterialIcons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        
        {item.status === 'done' && (
          <TouchableOpacity 
            onPress={() => handleOpenDownload(item)}
            style={[styles.actionButton, { backgroundColor: colors.success }]}
          >
            <MaterialIcons name="open-in-new" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          onPress={() => handleDeleteDownload(item)}
          style={[styles.actionButton, { backgroundColor: colors.error }]}
        >
          <MaterialIcons name="delete" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </ThemedView>
  );

  const sectionData = [
    { key: 'all' as DownloadSection, title: 'All', count: downloads.length },
    { key: 'active' as DownloadSection, title: 'Active', count: activeDownloads.length + pendingDownloads.length },
    { key: 'completed' as DownloadSection, title: 'Completed', count: completedDownloads.length },
    { key: 'errors' as DownloadSection, title: 'Errors', count: errorDownloads.length },
  ];

  return (
    <ThemedView variant="background" style={styles.container}>
      {/* Section Header */}
      <ThemedView style={[styles.sectionHeader,{borderBottomColor: colors.border}]}>
        <FlatList
          horizontal
          data={sectionData}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setActiveSection(item.key)}
              style={[
                styles.sectionButton,
                activeSection === item.key && {backgroundColor: colors.surface}
              ]}
            >
              <ThemedText 
                variant={activeSection === item.key ? 'accent' : 'secondary'}
                style={{fontWeight: '500',fontSize:sizes.text }}
              >
                {item.title} ({item.count})
              </ThemedText>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.sectionList}
          showsHorizontalScrollIndicator={false}
        />
      </ThemedView>

      {/* Download List */}
      <FlatList
        data={getDisplayDownloads()}
        renderItem={renderDownloadItem}
        keyExtractor={(item) => item.id}
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
            <MaterialIcons name="file-download" size={64} color={colors.textSecondary} />
            <ThemedText variant="title" style={styles.emptyText}>
              No downloads found
            </ThemedText>
            <ThemedText variant="secondary" style={styles.emptySubtext}>
              {activeSection === 'all' 
                ? 'Your download list is empty'
                : `No ${activeSection} downloads`
              }
            </ThemedText>
          </ThemedView>
        }
      />

      {/* Action Buttons */}
      {(completedDownloads.length > 0 || errorDownloads.length > 0) && (
        <ThemedView style={styles.footer}>
          <TouchableOpacity
            onPress={clearCompletedDownloads}
            style={[styles.footerButton, { backgroundColor: colors.surface }]}
          >
            <MaterialIcons name="clear-all" size={20} color={colors.text} />
            <ThemedText variant="default" style={styles.footerButtonText}>
              Clear Completed
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}

      {/* Delete Confirmation Modal */}
      <ThemedModal
        visible={showDeleteModal}
        type="confirm"
        title="Delete Download"
        message={selectedDownload ? `Delete ${selectedDownload.mangaTitle} - ${selectedDownload.chapterTitle}?` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedDownload(null);
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  sectionList: {
    gap: 12,
  },
  sectionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  listContent: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  downloadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  downloadInfo: {
    flex: 1,
    gap: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: 'center',
    opacity: 0.7,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  footerButtonText: {
    fontWeight: '500',
  },
});