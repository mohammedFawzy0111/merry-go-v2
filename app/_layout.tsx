import { SettingsProvider } from "@/contexts/settingProvider";
import { Stack } from "expo-router";
import { Host } from "react-native-portalize";

export default function RootLayout() {
  return (
    <SettingsProvider>
      <Host>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(manga)" options={{ headerShown: false }} />
        </Stack>
      </Host>
    </SettingsProvider>
  );
}
