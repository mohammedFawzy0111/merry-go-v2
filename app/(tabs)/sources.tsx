// app/(tabs)/sources.tsx
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/settingProvider';
import { sources } from '@/sources';
import { useRouter } from 'expo-router';
import { FlatList, Image, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function Sources() {
  const { colors } = useTheme();
  const router = useRouter();

  const loadSourceScreen = (source: typeof sources[0]) => {
    router.navigate({
      pathname: '/(manga)/sourceScreen',
      params: { sourceName: source.name },
    });
}

  const renderItem = ({ item }: { item: typeof sources[0] }) => (
    <TouchableOpacity 
    onPress={() => loadSourceScreen(item)}>
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
    </TouchableOpacity>
  );

  return (
    <ThemedView variant="background" style={styles.container}>
      <FlatList
        data={sources}
        renderItem={renderItem}
        keyExtractor={(item) => item.name}
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