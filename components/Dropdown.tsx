import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSettings } from '@/contexts/settingProvider';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  DimensionValue,
  FlatList,
  LayoutChangeEvent,
  LayoutRectangle,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
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
  placeholder?: string | IoniconsName;
  width?: DimensionValue;
  textSize?: number;
  /**
   * If true, only the header icon is shown and header text is hidden.
   * Defaults to false.
   */
  showHeaderIconOnly?: boolean;
}

export function Dropdown<T extends string>({
  options,
  selectedValue,
  onSelect,
  placeholder = 'Select an option',
  width = 'auto',
  textSize = 16,
  showHeaderIconOnly = false,
}: DropdownProps<T>) {
  const { colors, sizes } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [buttonLayout, setButtonLayout] = useState<LayoutRectangle | null>(null);

  // measured maximum width of any option (measured offscreen)
  const [measuredMaxOptionWidth, setMeasuredMaxOptionWidth] = useState<number>(0);

  // computed menu width and left position to avoid overflow
  const [menuWidth, setMenuWidth] = useState<number | null>(null);
  const [menuLeft, setMenuLeft] = useState<number | null>(null);

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
    setIsOpen(prev => !prev);
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
      {item.icon && <Ionicons name={item.icon} size={sizes.text} color={colors.text} />}
      <ThemedText style={[styles.optionText, optionTextStyle]}>{item.label}</ThemedText>
      {selectedValue === item.value && (
        <Ionicons name="checkmark" size={sizes.text} color={colors.accent} />
      )}
    </TouchableOpacity>
  );

  // sizes used in header
  const chevronSize = sizes.heading;
  const headerIconSize = sizes.heading;

  // header text style — always render as single line with ellipsize
  const headerTextStyle = {
    fontSize: textSize,
    flexShrink: 1,
  };

  const optionTextStyle = {
    fontSize: textSize,
    flex: 1,
  };

  // Determine if we should show an icon in the header
  const shouldShowHeaderIcon = showHeaderIconOnly || selectedOption?.icon || typeof placeholder !== 'string';
  
  // Determine which icon to show in the header
  const headerIconName = selectedOption?.icon || 
                         (typeof placeholder !== 'string' ? placeholder : 'apps');

  // Determine header label text (if selected or placeholder string)
  const headerLabel = selectedOption?.label || (typeof placeholder === 'string' ? placeholder : '');

  // Reset measured width when options/text size change
  useEffect(() => {
    setMeasuredMaxOptionWidth(0);
    setMenuWidth(null);
    setMenuLeft(null);
  }, [options, textSize, sizes.heading]);

  // When we have both buttonLayout and measuredMaxOptionWidth, compute final menu width & left.
  useEffect(() => {
    if (!buttonLayout) return;

    const screenWidth = Dimensions.get('window').width;
    const margin = 8; // keep small margin from screen edges

    const desiredWidth = Math.max(buttonLayout.width, measuredMaxOptionWidth || 0);
    const cappedWidth = Math.min(desiredWidth, screenWidth - margin * 2);

    // compute left to keep menu visible
    let left = buttonLayout.x;
    if (left + cappedWidth > screenWidth - margin) {
      left = Math.max(margin, screenWidth - cappedWidth - margin);
    }
    if (left < margin) left = margin;

    setMenuWidth(cappedWidth);
    setMenuLeft(left);
  }, [buttonLayout, measuredMaxOptionWidth]);

  // Offscreen measurement container: render each option with same visuals and measure its width.
  // We include checkmark & icon to match menu layout (worst-case).
  const onMeasureOption = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setMeasuredMaxOptionWidth(prev => Math.max(prev, w));
  };

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
            {/* Only show icon if in icon-only mode or if an icon is provided */}
            {shouldShowHeaderIcon && (
              <Ionicons
                name={headerIconName}
                size={headerIconSize}
                color={colors.accent}
              />
            )}

            {/* Show text unless user requested icon-only header */}
            {!showHeaderIconOnly && (
              <ThemedText
                style={[headerTextStyle, { marginLeft: shouldShowHeaderIcon ? 8 : 0 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {headerLabel}
              </ThemedText>
            )}
          </View>

          <Animated.View style={animatedChevron}>
            <Ionicons name="chevron-down" size={chevronSize} color={colors.textSecondary} />
          </Animated.View>
        </TouchableOpacity>
      </ThemedView>

      {/* Offscreen measurement container */}
      <View style={styles.measureContainer} pointerEvents="none" accessible={false}>
        {options.map(opt => (
          <View
            key={String(opt.value)}
            style={[styles.option, { backgroundColor: 'transparent' }]}
            onLayout={onMeasureOption}
          >
            {opt.icon && <Ionicons name={opt.icon} size={sizes.text} color={colors.text} />}
            <ThemedText style={[styles.optionText, optionTextStyle]} numberOfLines={1} ellipsizeMode="tail">
              {opt.label}
            </ThemedText>
            {/* include checkmark for worst-case width measurement */}
            <Ionicons name="checkmark" size={sizes.text} color={colors.accent} />
          </View>
        ))}
      </View>

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
                left: menuLeft ?? buttonLayout.x,
                width: menuWidth ?? buttonLayout.width,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                zIndex: 9999, // Ensure it renders on top of modals
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
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menu: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 5,
    minWidth: 150,
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

  // offscreen measurement container: keep it small, invisible and out of layout flow
  measureContainer: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
});