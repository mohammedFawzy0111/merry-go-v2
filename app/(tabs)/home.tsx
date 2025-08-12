import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";

export default function Home() {
  const router = useRouter()

  return (
      <ThemedView variant="background">
        <TouchableOpacity
          onPress={()=>{
            router.navigate({
              pathname:"/(manga)/readerScreen",
              params: {chapterUrl: "test url", sourceName: "test source"}
            })
          }}
        >
          <ThemedText variant="title">{"test"}</ThemedText>
        </TouchableOpacity>
      </ThemedView>
  );
}