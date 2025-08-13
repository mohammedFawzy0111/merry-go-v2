// components/ThemedText.tsx
import { useFontSize, useTheme } from '@/contexts/settingProvider';
import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';

type TextVariant = 'default' | 'secondary' | 'accent' | 'title' | 'subtitle';

interface ThemedTextProps extends RNTextProps {
    variant?: TextVariant;
    bold?: boolean;
}

export const ThemedText: React.FC<ThemedTextProps> = ({
    variant = 'default',
    bold = false,
    style,
    ...props
    }) => {
    const { colors } = useTheme();
    const { sizes } = useFontSize()

    const getTextColor = () => {
        switch (variant) {
        case 'secondary':
            return colors.textSecondary;
        case 'accent':
            return colors.accent;
        case 'title':
            return colors.text;
        case 'subtitle':
            return colors.textSecondary;
        default:
            return colors.text;
        }
    };

    const getFontSize = () => {
        switch (variant) {
        case 'title':
            return sizes.heading;
        case 'subtitle':
            return sizes.sub;
        default:
            return sizes.text;
        }
    };

    return (
        <RNText
        style={[
            styles.text,
            {
            color: getTextColor(),
            fontSize: getFontSize(),
            fontWeight: bold ? 'bold' : 'normal',
            },
            style,
        ]}
        {...props}
        />
    );
    };

    const styles = StyleSheet.create({
    text: {
        fontFamily: 'System', // Or your custom font
        lineHeight: 20, // Better readability
    },
});