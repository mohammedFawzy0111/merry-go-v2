import { Dropdown, DropdownOption } from '@/components/Dropdown';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeProvider';
import { StyleSheet } from 'react-native';

type ThemeType = 'light' | 'dark' | 'system';

export default function Settings() {
  const { themePreference, setTheme } = useTheme();

  const themeOptions: DropdownOption<ThemeType>[] = [
    { value: 'light', label: 'Light Theme', icon: 'sunny' },
    { value: 'dark', label: 'Dark Theme', icon: 'moon' },
    { value: 'system', label: 'System Default', icon: 'phone-portrait' },
  ];

  return (
    <ThemedView variant="background" style={styles.container}>
      <ThemedView variant="surface" style={styles.section}>
        <ThemedText variant="title" style={styles.sectionTitle}>
          Appearance
        </ThemedText>
        <Dropdown<ThemeType>
          options={themeOptions}
          selectedValue={themePreference}
          onSelect={setTheme}
          placeholder="Select theme"
        />
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    marginBottom: 8,
  },
});
