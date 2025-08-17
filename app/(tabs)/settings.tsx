 import { Dropdown, DropdownOption } from '@/components/Dropdown';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSettings } from '@/contexts/settingProvider';
import { StyleSheet, Switch, View } from 'react-native';

type ThemeType = 'light' | 'dark' | 'system';
type FontSizeType = "xs" | "s" | "m" | "l" | "xl";
type ReadingModeType = "vertical" | "ltr" | "rtl";

export default function Settings() {
  const { 
    themePreference, setThemePreference, 
    fontSize, setFontSize, 
    nightReadingMode, setNightReadingMode,
    readingMode, setReadingMode, sizes
  } = useSettings();

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

  const readingModeOptions: DropdownOption<ReadingModeType>[] = [
    { value: "vertical", label: "Vertical Scroll" },
    { value: "ltr", label: "Left to Right" },
    { value: "rtl", label: "Right to Left" }
  ];

  const groupTitleStyle = {
    fontSize: sizes.heading
  }
  const labelStyle = {
    fontSize: sizes.text
  }

  return (
    <ThemedView variant="background" style={styles.container}>
      {/* Appearance Group */}
      <ThemedView variant="surface" style={styles.group}>
        <ThemedText variant="title" style={[styles.groupTitle, groupTitleStyle]}>
          Appearance
        </ThemedText>
        
        <View style={styles.settingItem}>
          <ThemedText style={[styles.settingLabel, labelStyle]}>Theme</ThemedText>
          <Dropdown<ThemeType>
            options={themeOptions}
            selectedValue={themePreference}
            onSelect={setThemePreference}
            placeholder="Select theme"
          />
        </View>
        
        <View style={styles.settingItem}>
          <ThemedText style={styles.settingLabel}>Font Size</ThemedText>
          <Dropdown<FontSizeType>
            options={fontSizeOptions}
            selectedValue={fontSize}
            onSelect={setFontSize}
            placeholder="Select size"
          />
        </View>
      </ThemedView>

      {/* Reading Group */}
      <ThemedView variant="surface" style={styles.group}>
        <ThemedText variant="title" style={styles.groupTitle}>
          Reading Settings
        </ThemedText>
        
        <View style={styles.settingItem}>
          <ThemedText style={styles.settingLabel}>Night Mode</ThemedText>
          <Switch
            value={nightReadingMode}
            onValueChange={setNightReadingMode}
          />
        </View>
        
        <View style={styles.settingItem}>
          <ThemedText style={styles.settingLabel}>Reading Direction</ThemedText>
          <Dropdown<ReadingModeType>
            options={readingModeOptions}
            selectedValue={readingMode}
            onSelect={setReadingMode}
            placeholder="Select mode"
          />
        </View>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 20,
  },
  group: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  groupTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 16,
  },
});
