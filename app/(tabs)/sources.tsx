// app/(tabs)/sources.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/settingProvider';
import { sourceManager } from '@/sources';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';

interface SourceSection {
  title: string;
  data: any[];
}

type SourceTab = 'installed' | 'available';

export default function Sources() {
  const { colors } = useTheme();
  const router = useRouter();
  const [sections, setSections] = useState<SourceSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<SourceTab>('installed');

  const loadSources = async () => {
    try {
      const installedSources = sourceManager.getAllSources();
      
      // This would typically come from a plugin repository API
      const availablePlugins = [
        {
          id: 'plugin_1',
          name: 'MangaDex',
          icon: 'https://mangadex.org/favicon.ico',
          description: 'Official MangaDex plugin',
          author: 'Community',
          version: '1.0.0',
          repoUrl: 'https://raw.githubusercontent.com/your-repo/mangadex/main/plugin.js'
        },
        {
          id: 'plugin_2',
          name: 'MangaSee',
          icon: 'https://mangasee123.com/favicon.ico',
          description: 'MangaSee plugin',
          author: 'Community',
          version: '1.0.0',
          repoUrl: 'https://raw.githubusercontent.com/your-repo/mangasee/main/plugin.js'
        }
      ];

      setSections([
        {
          title: 'Installed Plugins',
          data: installedSources
        },
        {
          title: 'Available Plugins',
          data: availablePlugins
        }
      ]);
    } catch (error) {
      console.error('Failed to load sources:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadSources();
  };

  const installPlugin = async (plugin: any) => {
    try {
      setLoading(true);
      await sourceManager.installPluginSource(plugin.repoUrl, {
        name: plugin.name,
        version: plugin.version,
        icon: plugin.icon
      });
      loadSources(); // Reload to update the list
    } catch (error) {
      console.error('Failed to install plugin:', error);
    }
  };

  const uninstallPlugin = async (pluginId: string) => {
    try {
      setLoading(true);
      await sourceManager.uninstallPluginSource(pluginId);
      loadSources(); // Reload to update the list
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
    }
  };

  const loadSourceScreen = (source: any) => {
    router.navigate({
      pathname: '/(manga)/sourceScreen',
      params: { sourceName: source.name },
    });
  };

  const getDisplayData = () => {
    if (activeTab === 'installed') {
      return sections[0]?.data || [];
    } else {
      return sections[1]?.data || [];
    }
  };

  const renderInstalledItem = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => loadSourceScreen(item)}>
      <ThemedView variant="surface" style={styles.sourceItem}>
        <View style={styles.sourceHeader}>
          {item.icon && (
            <Image 
              source={{ uri: item.icon }} 
              style={[styles.sourceIcon, { backgroundColor: colors.tint }]} 
              resizeMode="contain"
            />
          )}
          <View style={styles.sourceInfo}>
            <ThemedText variant="default" style={styles.sourceName}>
              {item.name}
            </ThemedText>
            <ThemedText variant="subtitle" style={styles.sourceVersion}>
              v{item.manifest?.version || '1.0.0'}
            </ThemedText>
          </View>
        </View>
        <TouchableOpacity 
          onPress={() => uninstallPlugin(item.pluginId)}
          style={[styles.actionButton, { backgroundColor: colors.error }]}
        >
          <ThemedText variant="accent" style={styles.actionButtonText}>
            Uninstall
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </TouchableOpacity>
  );

  const renderAvailableItem = ({ item }: { item: any }) => (
    <ThemedView variant="surface" style={styles.sourceItem}>
      <View style={styles.sourceHeader}>
        {item.icon && (
          <Image 
            source={{ uri: item.icon }} 
            style={[styles.sourceIcon, { backgroundColor: colors.tint }]} 
            resizeMode="contain"
          />
        )}
        <View style={styles.sourceInfo}>
          <ThemedText variant="default" style={styles.sourceName}>
            {item.name}
          </ThemedText>
        </View>
      </View>
      <TouchableOpacity 
        onPress={() => installPlugin(item)}
        style={[styles.actionButton, { backgroundColor: colors.success }]}
      >
        <ThemedText variant="accent" style={styles.actionButtonText}>
          Install
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );

  const renderItem = ({ item }: { item: any }) => {
    if (activeTab === 'installed') {
      return renderInstalledItem({ item });
    } else {
      return renderAvailableItem({ item });
    }
  };

  const tabData = [
    { key: 'installed' as SourceTab, title: 'Installed', count: sections[0]?.data?.length || 0 },
    { key: 'available' as SourceTab, title: 'Available', count: sections[1]?.data?.length || 0 },
  ];

  if (loading) {
    return (
      <ThemedView variant="background" style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return (
    <ThemedView variant="background" style={styles.container}>
      {/* Section Header - Horizontal Tabs */}
      <ThemedView style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
        <FlatList
          horizontal
          data={tabData}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setActiveTab(item.key)}
              style={[
                styles.sectionButton,
                activeTab === item.key && { backgroundColor: colors.surface }
              ]}
            >
              <ThemedText 
                variant={activeTab === item.key ? 'accent' : 'secondary'}
                style={styles.sectionButtonText}
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

      {/* Source List */}
      <FlatList
        data={getDisplayData()}
        renderItem={renderItem}
        keyExtractor={(item) => item.id || item.pluginId}
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
            <ThemedText variant="title" style={styles.emptyText}>
              {activeTab === 'installed' 
                ? 'No plugins installed' 
                : 'No plugins available'
              }
            </ThemedText>
            <ThemedText variant="secondary" style={styles.emptySubtext}>
              {activeTab === 'installed' 
                ? 'Install plugins from the Available tab' 
                : 'Check back later for new plugins'
              }
            </ThemedText>
          </ThemedView>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  sectionButtonText: {
    fontWeight: '500',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  sourceName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  sourceVersion: {
    fontSize: 12,
    opacity: 0.7,
  },
  sourceDescription: {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 2,
  },
  sourceAuthor: {
    fontSize: 11,
    opacity: 0.6,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 200,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '500',
  },
  emptySubtext: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 14,
  },
});