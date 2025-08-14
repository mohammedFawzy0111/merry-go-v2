import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSettings } from '@/contexts/settingProvider';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { DimensionValue, FlatList, LayoutChangeEvent, LayoutRectangle, StyleSheet, TouchableOpacity, View } from 'react-native';
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
}

export function Dropdown<T extends string>({
  options,
  selectedValue,
  onSelect,
  placeholder = 'Select an option',
  width = 'auto',
  textSize = 16,
}: DropdownProps<T>) {
  const { colors, sizes } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [buttonLayout, setButtonLayout] = useState<LayoutRectangle | null>(null);
  const [measuredLabelWidth, setMeasuredLabelWidth] = useState<number>(0);
  const [labelFits, setLabelFits] = useState(true);

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
  const headerPaddingHorizontal = 16; // matches header padding
  const iconGap = 12; // matches gap used in headerContent style

  // measure visible space and decide whether label fits
  useEffect(() => {
    if (!buttonLayout) {
      setLabelFits(true);
      return;
    }

    // compute available space inside header for the label after icon and chevron and paddings
    // If no selected icon, we will still reserve icon space for the default icon
    const reservedForIcon = headerIconSize + iconGap;
    const reservedForChevron = chevronSize + 8; // extra spacing for chevron area
    const available = buttonLayout.width - (headerPaddingHorizontal * 2) - reservedForIcon - reservedForChevron;

    // measuredLabelWidth is the intrinsic width of the label text
    // if measuredLabelWidth is 0 (not yet measured), optimistically allow label (it will update once measured)
    if (measuredLabelWidth === 0) {
      setLabelFits(true);
      return;
    }

    setLabelFits(measuredLabelWidth <= available);
  }, [buttonLayout, measuredLabelWidth, headerIconSize, chevronSize]);

  // For header text style we pass numberOfLines & ellipsizeMode as props (not inside style object)
  const headerTextStyle = {
    fontSize: textSize,
    flexShrink: 1,
    // note: numberOfLines and ellipsizeMode are passed as props below
  };

  const optionTextStyle = {
    fontSize: textSize,
    flex: 1,
  };

  // Default fallback icon when selected option has no icon
  const fallbackIcon: IoniconsName = 'apps';

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
            {/* show selected icon or fallback */}
            <Ionicons
              name={selectedOption?.icon ?? fallbackIcon}
              size={headerIconSize}
              color={colors.accent}
            />

            {/* Visible label (only when it fits). We still render an invisible offscreen label for measurement below. */}
            {labelFits ? (
              <ThemedText
                style={[headerTextStyle, { marginLeft: 0 }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {selectedOption?.label || (typeof placeholder === 'string' ? placeholder : '')}
              </ThemedText>
            ) : null}
          </View>

          <Animated.View style={animatedChevron}>
            <Ionicons name="chevron-down" size={chevronSize} color={colors.textSecondary} />
          </Animated.View>
        </TouchableOpacity>
      </ThemedView>

      {/* Offscreen/invisible measurement text to compute the intrinsic width of the label.
          It's absolutely positioned offscreen so it won't affect layout but still fires onLayout. */}
      <View style={styles.measureContainer} pointerEvents="none">
        <ThemedText
          style={[headerTextStyle, { position: 'absolute' }]}
          onLayout={(e: LayoutChangeEvent) => {
            setMeasuredLabelWidth(e.nativeEvent.layout.width);
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {selectedOption?.label || (typeof placeholder === 'string' ? placeholder : '')}
        </ThemedText>
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
