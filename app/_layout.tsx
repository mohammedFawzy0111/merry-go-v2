import { SettingsProvider, useNightReading } from "@/contexts/settingProvider";
import { initDb } from "@/db/db";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Host } from "react-native-portalize";

function BlueLightOverlay () {
  const { nightReadingMode } = useNightReading();
  if (!nightReadingMode) return null;
  return(
    <View style={styles.overlay} pointerEvents='none'></View>
  )
}

export default function RootLayout() {
  useEffect(()=>{
    initDb();
  }, []);
  return (
    <SettingsProvider>
      <Host>
        <BlueLightOverlay />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(manga)" options={{ headerShown: false }} />
        </Stack>
      </Host>
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250, 152, 61, 0.08)", // warm orange tint
    zIndex: 999999, // force it to render above all
  },
})
