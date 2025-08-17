import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useRouter } from "expo-router";

export default function Home() {
  const router = useRouter()

  return (
      <ThemedView variant="background" style={{flex:1}}>
        <ThemedText variant="title">{"Home"}</ThemedText>
      </ThemedView>
  );
}