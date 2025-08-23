// app/(tabs)/sources.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/settingProvider';
import { sourceManager } from '@/sources';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, SectionList, StyleSheet, TouchableOpacity, View } from 'react-native';

interface SourceSection {
  title: string;
  data: any[];
}

export default function Sources() {
  const { colors } = useTheme();
  const router = useRouter();
  const [sections, setSections] = useState<SourceSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const renderSectionHeader = ({ section }: { section: SourceSection }) => (
    <ThemedView variant="surface" style={styles.sectionHeader}>
      <ThemedText variant="subtitle" style={styles.sectionTitle}>
        {section.title}
      </ThemedText>
    </ThemedView>
  );

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
          style={styles.actionButton}
        >
          <ThemedText variant="secondary">Uninstall</ThemedText>
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
        style={[styles.actionButton, styles.installButton]}
      >
        <ThemedText variant="accent">Install</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );

  const renderItem = ({ item, section }: { item: any; section: SourceSection }) => {
    if (section.title === 'Installed Plugins') {
      return renderInstalledItem({ item });
    } else {
      return renderAvailableItem({ item });
    }
  };

  if (loading) {
    return (
      <ThemedView variant="background" style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
      </ThemedView>
    );
  }

  return (
    <ThemedView variant="background" style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item.id || item.pluginId || index.toString()}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <ThemedView style={styles.separator} />}
        SectionSeparatorComponent={() => <ThemedView style={styles.sectionSeparator} />}
        refreshing={refreshing}
        onRefresh={onRefresh}
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
  listContent: {
    paddingBottom: 16,
  },
  sectionHeader: {
    padding: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
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
    padding: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  installButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  separator: {
    height: 1,
    marginHorizontal: 16,
  },
  sectionSeparator: {
    height: 16,
  },
});