import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/settingProvider';
import { SourceInfo, sourceManager } from '@/sources';
import { RepositoryPlugin, pluginManager } from '@/utils/pluginSystem';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, StyleSheet, ToastAndroid, TouchableOpacity, View } from 'react-native';

type SourceTab = 'installed' | 'available';
type AvailablePlugin = RepositoryPlugin & { isInstalled?: boolean };

export default function Sources() {
  const { colors } = useTheme();
  const router = useRouter();
  const [installedPlugins, setInstalledPlugins] = useState<SourceInfo[]>([]);
  const [availablePlugins, setAvailablePlugins] = useState<RepositoryPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<SourceTab>('installed');
  const [installingId, setInstallingId] = useState<string | null>(null);

  const loadSources = async () => {
    try {
      // Load installed plugins
      const installed = sourceManager.getAllSources();
      setInstalledPlugins(installed);

      // Load available plugins from repository
      const available = await pluginManager.getAvailablePlugins();
      const installedPluginsIds = installed.map(p => p.pluginId);
      const processedAvailable = available.map(plugin => ({
        ...plugin,
        isInstalled: installedPluginsIds.includes(plugin.id)
      }));
      processedAvailable.sort((a,b) => {
        if (a.isInstalled && !b.isInstalled) return -1;
        if (!a.isInstalled && b.isInstalled) return 1;
        return 0;
      });
      setAvailablePlugins(processedAvailable);
    } catch (error) {
      console.error('Failed to load sources:', error);
      Alert.alert('Error', 'Failed to load plugins from repository');
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

  const installPlugin = async (plugin: RepositoryPlugin) => {
    try {
      setInstallingId(plugin.id);
      await sourceManager.installPluginSource(plugin.entryPoint, {
        name: plugin.name,
        version: plugin.version,
        icon: plugin.icon,
      });
      await loadSources(); // Reload to update the list
      ToastAndroid.show('Plugin installed', ToastAndroid.SHORT);
    } catch (error) {
      console.error('Failed to install plugin:', error);
      Alert.alert('Error', `Failed to install ${plugin.name}: ${error}`);
    } finally {
      setInstallingId(null);
    }
  };

  const uninstallPlugin = async (pluginId: string, pluginName: string) => {
    try {
      const success = await sourceManager.uninstallPluginSource(pluginId);
      if (success) {
        await loadSources(); // Reload to update the list
        ToastAndroid.show('Plugin uninstalled', ToastAndroid.SHORT);
      } else {
        Alert.alert('Error', `Failed to uninstall ${pluginName}`);
      }
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      Alert.alert('Error', `Failed to uninstall ${pluginName}: ${error}`);
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
      return installedPlugins;
    } else {
      return availablePlugins;
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
          onPress={() => uninstallPlugin(item.pluginId, item.name)}
          style={[styles.actionButton, { backgroundColor: colors.error}]}
          disabled={installingId !== null}
        >
          <ThemedText variant="accent" style={[styles.actionButtonText, {color:colors.text}]}>
            Uninstall
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </TouchableOpacity>
  );

  const renderAvailableItem = ({ item }: { item: AvailablePlugin }) => (
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
            v{item.version}
          </ThemedText>
          {item.description && (
            <ThemedText variant="secondary" style={styles.sourceDescription}>
              {item.description}
            </ThemedText>
          )}
        </View>
      </View>
      <TouchableOpacity 
        onPress={() => !item.isInstalled && installPlugin(item)}
        style={[styles.actionButton, { 
          backgroundColor: item.isInstalled ? colors.border : colors.success,
          opacity: item.isInstalled ? 0.5 : 1
        }]}
        disabled={installingId !== null || item.isInstalled}
      >
        {installingId === item.id ? (
          <ActivityIndicator size="small" color={colors.text} />
        ) : (
          <ThemedText variant="accent" style={[styles.actionButtonText,{color:colors.text}]}>
            {item.isInstalled ? 'Installed' : 'Install'}
          </ThemedText>
        )}
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
    { key: 'installed' as SourceTab, title: 'Installed', count: installedPlugins.length },
    { key: 'available' as SourceTab, title: 'Available', count: availablePlugins.length },
  ];

  if (loading) {
    return (
      <ThemedView variant="background" style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText variant="secondary" style={{ marginTop: 16 }}>
          Loading plugins...
        </ThemedText>
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
    marginTop: 4,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
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