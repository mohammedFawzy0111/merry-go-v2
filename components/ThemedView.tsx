// components/ThemedView.tsx
import { useTheme } from '@/contexts/settingProvider';
import React from 'react';
import { View as RNView, ViewProps as RNViewProps, StyleSheet } from 'react-native';

type ViewVariant = 'default' | 'surface' | 'background';

interface ThemedViewProps extends RNViewProps {
    variant?: ViewVariant;
    bordered?: boolean;
}

export const ThemedView: React.FC<ThemedViewProps> = ({
    variant = 'default',
    bordered = false,
    style,
    ...props
    }) => {
    const { colors } = useTheme();

    const getBackgroundColor = () => {
        switch (variant) {
        case 'surface':
            return colors.surface;
        case 'background':
            return colors.bg;
        default:
            return 'transparent';
        }
    };

    return (
        <RNView
        style={[
            styles.view,
            {
            backgroundColor: getBackgroundColor(),
            borderColor: bordered ? colors.border : 'transparent',
            borderWidth: bordered ? 1 : 0,
            borderRadius: variant === "background" ? 0 : 8, // Adjust radius as needed
            },
            style,
        ]}
        {...props}
        />
    );
    };

    const styles = StyleSheet.create({
    view: {
        overflow: 'visible', // For child borders
    },
});