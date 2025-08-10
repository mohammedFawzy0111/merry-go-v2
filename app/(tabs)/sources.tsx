// app/(tabs)/sources.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeProvider';
import { FlatList, Image, StyleSheet, View } from 'react-native';

// Temporary mock data - replace with your actual data source
const mockSources = [
  {
    name: 'Science Daily',
    icon: 'https://www.sciencedaily.com/images/sd-logo.png',
    module: { id: 'science-daily' }
  },
  {
    name: 'TechCrunch',
    icon: 'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png?w=180',
    module: { id: 'techcrunch' }
  },
  {
    name: 'BBC News',
    icon: 'https://static.files.bbci.co.uk/orbit/ee9a9ac8e5c711d664b9411f3a4a7d62/img/blq-orbit-blocks_grey.svg',
    module: { id: 'bbc-news' }
  },
  {
    name: 'National Geographic',
    icon: 'https://www.nationalgeographic.com/etc/clientlibs/ngfoundation/clientlibs/ngfoundation.base/resources/img/ng-logo-2x.png',
    module: { id: 'natgeo' }
  },
];

export default function Sources() {
  const { colors } = useTheme();

  const renderItem = ({ item }: { item: typeof mockSources[0] }) => (
    <ThemedView variant="surface" style={styles.sourceItem}>
      <View style={styles.sourceHeader}>
        {item.icon && (
          <Image 
            source={{ uri: item.icon }} 
            style={[styles.sourceIcon,{ backgroundColor: colors.tint}]} 
            resizeMode="contain"
          />
        )}
        <ThemedText style={styles.sourceName}>{item.name}</ThemedText>
      </View>
    </ThemedView>
  );

  return (
    <ThemedView variant="background" style={styles.container}>
      <FlatList
        data={mockSources}
        renderItem={renderItem}
        keyExtractor={(item) => item.module.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => (
          <ThemedView style={styles.separator} />
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  listContent: {
    paddingBottom: 16,
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
  },
  sourceIcon: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  sourceName: {
    fontSize: 16,
  },
  separator: {
    height: 1,
    marginVertical: 8,
  },
});