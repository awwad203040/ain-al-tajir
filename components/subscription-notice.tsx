import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/hooks/use-auth";
import { useApp } from "@/lib/app-context";
import { getSubscriptionNotice } from "@/lib/billing-utils";
import { trpc } from "@/lib/trpc";

const NOTICE_STYLE = {
  renewal_info: { color: "#3F5DA8", background: "#EEF1FA", border: "#CCD6F2", icon: "event" },
  renewal_warning: { color: "#D97706", background: "#FFF6E5", border: "#F2D39E", icon: "schedule" },
  renewal_urgent: { color: "#C73737", background: "#FDECEC", border: "#EAB3B3", icon: "notification-important" },
  ending: { color: "#D97706", background: "#FFF6E5", border: "#F2D39E", icon: "event-busy" },
  expired: { color: "#C73737", background: "#FDECEC", border: "#EAB3B3", icon: "lock-clock" },
  past_due: { color: "#C73737", background: "#FDECEC", border: "#EAB3B3", icon: "credit-card-off" },
} as const;

export function SubscriptionNotice() {
  const { isRTL } = useApp();
  const { isAuthenticated } = useAuth();
  const billing = trpc.billing.status.useQuery(undefined, { enabled: isAuthenticated, retry: false, staleTime: 30_000 });
  const subscription = billing.data?.subscription;
  if (!subscription) return null;

  const notice = getSubscriptionNotice(subscription.status, subscription.currentPeriodEnd, subscription.cancelAtPeriodEnd);
  if (!notice) return null;
  const theme = NOTICE_STYLE[notice.kind];
  const days = Math.max(0, notice.daysRemaining);

  const copy = {
    renewal_info: {
      title: isRTL ? `موعد التجديد بعد ${days} يومًا` : `Renewal in ${days} days`,
      body: isRTL ? "راجع الفواتير وطريقة الدفع قبل موعد التجديد." : "Review invoices and payment method before renewal.",
    },
    renewal_warning: {
      title: isRTL ? `اقترب موعد التجديد: ${days} أيام` : `Renewal is close: ${days} days`,
      body: isRTL ? "تأكد من جاهزية وسيلة الدفع لتجنب توقف الوصول." : "Confirm your payment method to avoid access interruption.",
    },
    renewal_urgent: {
      title: isRTL ? (days === 0 ? "موعد التجديد اليوم" : `التجديد خلال ${days} أيام`) : (days === 0 ? "Renewal is today" : `Renewal in ${days} days`),
      body: isRTL ? "راجع الاشتراك الآن لتفادي تعثر التجديد." : "Review the subscription now to avoid a failed renewal.",
    },
    ending: {
      title: isRTL ? `سينتهي اشتراكك بعد ${days} يومًا` : `Subscription ends in ${days} days`,
      body: isRTL ? "أُوقف التجديد التلقائي وسيبقى الوصول متاحًا حتى نهاية الفترة." : "Auto-renewal is off; access remains available until period end.",
    },
    expired: {
      title: isRTL ? "انتهى الاشتراك" : "Subscription expired",
      body: isRTL ? "جدّد الباقة لاستعادة الوصول إلى لوحة التحكم." : "Renew the plan to restore dashboard access.",
    },
    past_due: {
      title: isRTL ? "تعذر تجديد الاشتراك" : "Subscription renewal failed",
      body: isRTL ? "راجع وسيلة الدفع والفاتورة المستحقة لاستعادة الوصول." : "Review the payment method and outstanding invoice to restore access.",
    },
  }[notice.kind];

  return (
    <Pressable onPress={() => router.push("/module/subscription" as never)} style={({ pressed }) => [styles.wrapper, { backgroundColor: theme.background, borderColor: theme.border }, pressed && styles.pressed]}>
      <View className={`flex-row items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
        <View style={[styles.icon, { backgroundColor: theme.color }]}><MaterialIcons name={theme.icon} size={21} color="#FFFFFF" /></View>
        <View className="flex-1"><Text className={`text-sm font-bold ${isRTL ? "text-right" : "text-left"}`} style={{ color: theme.color }}>{copy.title}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{copy.body}</Text></View>
        <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={22} color={theme.color} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 19, borderWidth: 1, marginBottom: 18, padding: 14 },
  icon: { alignItems: "center", borderRadius: 14, height: 42, justifyContent: "center", width: 42 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
});
