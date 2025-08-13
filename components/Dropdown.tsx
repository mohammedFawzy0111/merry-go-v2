import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { DimensionValue, FlatList, LayoutRectangle, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Portal } from 'react-native-portalize';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  icon?: IoniconsName;
}

interface DropdownProps<T extends string> {
  options: DropdownOption<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  placeholder?: string;
  width?: DimensionValue;
  textSize?: number;
}

export function Dropdown<T extends string>({
  options,
  selectedValue,
  onSelect,
  placeholder = 'Select an option',
  width = 'auto',
  textSize = 16,
}: DropdownProps<T>) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [buttonLayout, setButtonLayout] = useState<LayoutRectangle | null>(null);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-10);

  useEffect(() => {
  rotation.value = withTiming(isOpen ? 1 : 0, { duration: 200 });
  opacity.value = withTiming(isOpen ? 1 : 0, { duration: 200 });
  translateY.value = withTiming(isOpen ? 0 : -10, { duration: 200 });
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [isOpen]);

  const selectedOption = options.find(opt => opt.value === selectedValue);

  const toggleDropdown = () => {
    setIsOpen(prev => !prev)
  };

  const handleSelect = (value: T) => {
    onSelect(value);
    toggleDropdown();
  };

  const animatedChevron = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(rotation.value, [0, 1], [0, 180])}deg` }
    ],
  }));

  const animatedMenu = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const renderOption = ({ item }: { item: DropdownOption<T> }) => (
    <TouchableOpacity
      style={[
        styles.option,
        { backgroundColor: selectedValue === item.value ? colors.border + '20' : 'transparent' }
      ]}
      onPress={() => handleSelect(item.value)}
    >
      {item.icon && <Ionicons name={item.icon} size={18} color={colors.text} />}
      <ThemedText style={[styles.optionText, optionTextStyle]}>{item.label}</ThemedText>
      {selectedValue === item.value && (
        <Ionicons name="checkmark" size={18} color={colors.accent} />
      )}
    </TouchableOpacity>
  );

  const headerTextStyle = {
    fontSize: textSize,
    flexShrink: 1,
    numberOfLines: 1,
    ellipsizeMode: 'tail'
  };

  const optionTextStyle = {
    fontSize: textSize,
    flex: 1,
  }

  return (
    <>
      <ThemedView
        variant="surface"
        style={[styles.container, { width }]}
        onLayout={e => setButtonLayout(e.nativeEvent.layout)}
      >
        <TouchableOpacity
          style={styles.header}
          onPress={toggleDropdown}
          activeOpacity={0.7}
        >
          <View style={styles.headerContent}>
            {selectedOption?.icon && (
              <Ionicons name={selectedOption.icon} size={20} color={colors.accent} />
            )}
            <ThemedText style={[headerTextStyle]}>
              {selectedOption?.label || placeholder}
            </ThemedText>
          </View>
          <Animated.View style={animatedChevron}>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </Animated.View>
        </TouchableOpacity>
      </ThemedView>

      {isOpen && buttonLayout && (
        <Portal>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={toggleDropdown}
          />
          <Animated.View
            style={[
              styles.menu,
              {
                top: buttonLayout.y + buttonLayout.height,
                left: buttonLayout.x,
                width: buttonLayout.width,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              animatedMenu
            ]}
          >
            <FlatList
              data={options}
              renderItem={renderOption}
              keyExtractor={(item) => String(item.value)}
              scrollEnabled={false}
              
            />
          </Animated.View>
        </Portal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minWidth: 100,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  menu: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 5,
  },
  option: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    flexShrink: 1,
  },
});
