import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Text, View } from "react-native";

import { PrimaryButton } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";

export default function SubscriptionCancelScreen() {
  const { isRTL } = useApp();
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="items-center justify-center px-6">
      <View className="w-full items-center rounded-3xl border border-border bg-surface p-6">
        <View className="mb-5 h-16 w-16 items-center justify-center rounded-3xl bg-warning/10"><MaterialIcons name="cancel" size={34} color="#D97706" /></View>
        <Text className="text-center text-2xl font-bold text-foreground">{isRTL ? "لم يتم تنفيذ أي خصم" : "No charge was made"}</Text>
        <Text className="mt-3 text-center text-sm leading-6 text-muted">{isRTL ? "أُلغيت عملية الدفع ويمكنك العودة لاحقًا بعد تفعيل مزود الدفع." : "Checkout was canceled. You can return after a payment provider is enabled."}</Text>
        <View className="mt-6 w-full"><PrimaryButton label={isRTL ? "العودة إلى الباقة" : "Back to plan"} onPress={() => router.replace("/module/subscription" as never)} icon="arrow-forward" /></View>
      </View>
    </ScreenContainer>
  );
}
