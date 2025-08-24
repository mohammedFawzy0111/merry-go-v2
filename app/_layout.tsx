import { SettingsProvider, useNightReading } from "@/contexts/settingProvider";
import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";


function BlueLightOverlay () {
  const { nightReadingMode } = useNightReading();
  if (!nightReadingMode) return null;
  return(
    <View style={styles.overlay} pointerEvents='none'></View>
  )
}

export default function RootLayout() {
  return (
    <SettingsProvider>
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
    backgroundColor: "rgba(250, 152, 61, 0.08)", // warm orange tint
    zIndex: 999999, // force it to render above all
  },
})
