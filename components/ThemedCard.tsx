// components/ThemedCard.tsx
import { Image } from 'expo-image';
import React from 'react';
import { ImageStyle, View as RNView, StyleSheet, TouchableOpacity } from 'react-native';
import type { ImageSource } from 'expo-image';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface ThemedCardProps {
    imageSource: ImageSource | string | number;
    title: string;
    imageStyle?: ImageStyle;
    cardStyle?: RNView['props']['style'];
    titleVariant?: 'default' | 'secondary' | 'accent' | 'title' | 'subtitle';
    onPress?: () => void; // Optional onPress handler
    onLongPress?: () => void;
}

export const ThemedCard: React.FC<ThemedCardProps> = ({
    imageSource,
    title,
    imageStyle,
    cardStyle,
    titleVariant = 'title',
    onPress = () => {}, // Default to a no-op function
    onLongPress = () => {},
}) => {

    return (
        <TouchableOpacity 
        onPress={onPress}
        onLongPress={onLongPress} 
        activeOpacity={0.7}
        style={[styles.card, cardStyle]}>
            <ThemedView variant="surface" style={{flex: 1}}>
                <Image 
                    source={imageSource as any} 
                    style={[styles.image, imageStyle]} 
                    contentFit="cover"
                />
                <ThemedView 
                    style={styles.titleContainer}
                    variant="background"
                >
                    <ThemedText 
                        variant={titleVariant} 
                        style={styles.titleText}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                    >
                        {title}
                    </ThemedText>
                </ThemedView>
            </ThemedView>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%' // Adjust as needed
    },
    titleContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent black
    },
    titleText: {
        color: 'white', // Override text color for better contrast
    },
});