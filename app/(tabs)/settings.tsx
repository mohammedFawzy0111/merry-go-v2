import { Dropdown, DropdownOption } from '@/components/Dropdown';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSettings } from '@/contexts/settingProvider';
import { StyleSheet } from 'react-native';

type ThemeType = 'light' | 'dark' | 'system';
type FontSizeType = "xs" | "s" | "m" | "l" | "xl";

export default function Settings() {
  const { themePreference, setThemePreference, fontSize, setFontSize } = useSettings();

  const themeOptions: DropdownOption<ThemeType>[] = [
    { value: 'light', label: 'Light Theme', icon: 'sunny' },
    { value: 'dark', label: 'Dark Theme', icon: 'moon' },
    { value: 'system', label: 'System Default', icon: 'phone-portrait' },
  ];

  const fontSizeOptions: DropdownOption<FontSizeType>[] = [
    { value: "xs", label: "Extra Small" },
    { value: "s", label: "Small" },
    { value: "m", label: "Medium" },
    { value: "l", label: "Large" },
    { value: "xl", label: "Extra Large" },
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
          onSelect={setThemePreference}
          placeholder="Select theme"
        />
      </ThemedView>

      <ThemedView variant="surface" style={styles.section}>
        <ThemedText variant="title" style={styles.sectionTitle}>
          Font Size
        </ThemedText>
        <Dropdown<FontSizeType>
          options={fontSizeOptions}
          selectedValue={fontSize}
          onSelect={setFontSize}
          placeholder="Select Size"
        />
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    gap: 16,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  sectionTitle: {
    width: "auto"
  }
});
