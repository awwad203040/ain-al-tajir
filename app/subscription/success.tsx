import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Text, View } from "react-native";

import { PrimaryButton } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";

export default function SubscriptionSuccessScreen() {
  const { isRTL } = useApp();
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="items-center justify-center px-6">
      <View className="w-full items-center rounded-3xl border border-border bg-surface p-6">
        <View className="mb-5 h-16 w-16 items-center justify-center rounded-3xl bg-success/10"><MaterialIcons name="check-circle" size={34} color="#16855B" /></View>
        <Text className="text-center text-2xl font-bold text-foreground">{isRTL ? "تم استلام نتيجة الدفع" : "Payment result received"}</Text>
        <Text className="mt-3 text-center text-sm leading-6 text-muted">{isRTL ? "سيتم تفعيل الاشتراك بعد تأكيد الخادم لحدث الدفع الموقّع. لا تعتمد حالة العودة وحدها لتفعيل المزايا." : "Access is activated only after the server confirms the signed payment event, not from the return page alone."}</Text>
        <View className="mt-6 w-full"><PrimaryButton label={isRTL ? "العودة إلى الاشتراك" : "Back to subscription"} onPress={() => router.replace("/module/subscription" as never)} icon="workspace-premium" /></View>
      </View>
    </ScreenContainer>
  );
}
