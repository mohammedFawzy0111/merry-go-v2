/**
 * app/_layout.tsx
 *
 * Root layout.
 * - Initialises the SQLite database BEFORE any screen renders.
 * - Wraps the entire app in SettingsProvider.
 * - Renders the warm night-mode overlay above all content.
 */

import { SettingsProvider, useNightReading } from "@/contexts/settingProvider";
import { initDb } from "@/db/db";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

function BlueLightOverlay() {
  const { nightReadingMode } = useNightReading();
  if (!nightReadingMode) return null;
  return <View style={styles.overlay} pointerEvents="none" />;
}

function AppInit() {
  useEffect(() => {
    // initDb is synchronous under the hood; calling it here ensures tables
    // exist before any tab screen mounts and tries to query them.
    initDb();
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AppInit />
      <BlueLightOverlay />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(manga)" options={{ headerShown: false }} />
      </Stack>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250, 152, 61, 0.08)",
    zIndex: 999999,
  },
});
