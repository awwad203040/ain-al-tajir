import { useEffect } from "react";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { View, ActivityIndicator } from "react-native";

export default function EntryScreen() {
  const router = useRouter();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => {
      router.replace("/login");
    }, 50);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F7F6", justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#0F766E" />
    </View>
  );
}
