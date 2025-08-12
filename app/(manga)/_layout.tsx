import { useTheme } from "@/contexts/ThemeProvider";
import { Stack, useLocalSearchParams } from "expo-router";

export default function MangaLayout() {
  const { colors } = useTheme();
  const { sourceName } = useLocalSearchParams();
  const source = sourceName as string || "Unknown Source"; // Fallback if no sourceName is provided

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen 
        name="sourceScreen" 
        options={{
          title: source ,
        }}
      />
      <Stack.Screen 
        name="mangaDetail" 
        options={{
          title: "Manga Details",
        }}
      />
      <Stack.Screen
        name="readerScreen"
        options={{
          headerShown: false
        }} 
        />
    </Stack>
  );
}