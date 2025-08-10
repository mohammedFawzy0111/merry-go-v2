import { ThemeProvider } from "@/contexts/ThemeProvider";
import { Stack } from "expo-router";
import { Host } from "react-native-portalize";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Host>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </Host>
    </ThemeProvider>
  );
}
