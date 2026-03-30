/**
 * app/_layout.tsx
 *
 * Root layout — runs before any screen renders.
 *
 * Startup sequence (synchronous-first, then async):
 *  1. initDb()             — SQLite tables, must be sync and first
 *  2. NotificationService  — channel creation; must happen before any
 *                            download can fire a notification
 *  3. SettingsProvider     — wraps the whole tree
 *  4. BlueLightOverlay     — rendered above everything, pointer-events none
 */

import { SettingsProvider, useNightReading } from "@/contexts/settingProvider";
import { initDb } from "@/db/db";
import { NotificationService } from "@/services/notificationService";
import { Stack } from "expo-router";
import notifee from "@notifee/react-native";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler'

// Run these synchronously/eagerly at module load — before React renders anything.
// initDb() is synchronous under the hood (quick-sqlite). Doing it here (rather
// than in a useEffect) guarantees tables exist even if a screen tries to query
// them during its first render cycle.
initDb();

function BlueLightOverlay() {
  const { nightReadingMode } = useNightReading();
  if (!nightReadingMode) return null;
  return <View style={styles.overlay} pointerEvents="none" />;
}

function AppInit() {
  // Track whether we've already initialised so StrictMode double-invocation
  // doesn't register the foreground event listener twice.
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    (async () => {
      try {
        // Create the notification channel and attach the foreground event
        // listener as early as possible — before any download can start.
        await NotificationService.initialize();
        // Request permission (Android 13+). Non-blocking: the app works fine
        // whether or not the user grants it.
        await notifee.requestPermission();
      } catch (err) {
        // Never crash the app over notification setup failure.
        console.warn("Notification init failed:", err);
      }
    })();
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{flex:1}}>
    <SettingsProvider>
      <AppInit />
      <BlueLightOverlay />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(manga)" options={{ headerShown: false }} />
      </Stack>
    </SettingsProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250, 152, 61, 0.08)",
    zIndex: 999999,
  },
});
