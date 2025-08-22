import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSettings } from '@/contexts/settingProvider';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  DimensionValue,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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

  const rotation = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-10);

  useEffect(() => {
    rotation.value = withTiming(isOpen ? 1 : 0, { duration: 200 });
    opacity.value = withTiming(isOpen ? 1 : 0, { duration: 200 });
    translateY.value = withTiming(isOpen ? 0 : -10, { duration: 200 });
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === selectedValue);

  const toggleDropdown = () => {
    setIsOpen(prev => !prev);
  };

  const handleSelect = (value: T) => {
    onSelect(value);
    setIsOpen(false);
  };

  const animatedChevron = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(rotation.value, [0, 1], [0, 180])}deg` },
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
        {
          backgroundColor:
            selectedValue === item.value ? colors.border + '20' : 'transparent',
        },
      ]}
      onPress={() => handleSelect(item.value)}
    >
      {item.icon && (
        <Ionicons name={item.icon} size={sizes.text} color={colors.text} />
      )}
      <ThemedText style={[styles.optionText, { fontSize: textSize }]}>
        {item.label}
      </ThemedText>
      {selectedValue === item.value && (
        <Ionicons name="checkmark" size={sizes.text} color={colors.accent} />
      )}
    </TouchableOpacity>
  );

  // sizes used in header
  const chevronSize = sizes.heading;
  const headerIconSize = sizes.heading;

  const headerTextStyle = {
    fontSize: textSize,
    flexShrink: 1,
  };

  const shouldShowHeaderIcon =
    showHeaderIconOnly ||
    selectedOption?.icon ||
    typeof placeholder !== 'string';

  const headerIconName =
    selectedOption?.icon || (typeof placeholder !== 'string' ? placeholder : 'apps');

  const headerLabel =
    selectedOption?.label || (typeof placeholder === 'string' ? placeholder : '');

  return (
    <View style={{ position: 'relative', width }}>
      <ThemedView variant="surface" style={[styles.container, { width }]}>
        <TouchableOpacity
          style={styles.header}
          onPress={toggleDropdown}
          activeOpacity={0.7}
        >
          <View style={styles.headerContent}>
            {shouldShowHeaderIcon && (
              <Ionicons
                name={headerIconName}
                size={headerIconSize}
                color={colors.accent}
              />
            )}

            {!showHeaderIconOnly && (
              <ThemedText
                style={[
                  headerTextStyle,
                  { marginLeft: shouldShowHeaderIcon ? 8 : 0 },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {headerLabel}
              </ThemedText>
            )}
          </View>

          <Animated.View style={animatedChevron}>
            <Ionicons
              name="chevron-down"
              size={chevronSize}
              color={colors.textSecondary}
            />
          </Animated.View>
        </TouchableOpacity>
      </ThemedView>

      {isOpen && (
        <>
          {/* overlay to close dropdown when clicking outside */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          />
          <Animated.View
            style={[
              styles.menu,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              animatedMenu,
            ]}
          >
            <FlatList
              data={options}
              renderItem={renderOption}
              keyExtractor={item => String(item.value)}
              scrollEnabled={false}
            />
          </Animated.View>
        </>
      )}
    </View>
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
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 5,
    minWidth: 150,
    zIndex: 1000,
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