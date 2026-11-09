import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/hooks/use-auth";
import { useApp } from "@/lib/app-context";
import { haptic } from "@/lib/haptics";
import { trpc } from "@/lib/trpc";

export function AppHeader({ title, subtitle, trailing }: { title: string; subtitle?: string; trailing?: ReactNode }) {
  const { isRTL } = useApp();
  return (
    <View className="mb-5 flex-row items-start justify-between">
      <View className="flex-1">
        <Text className={`text-2xl font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{title}</Text>
        {subtitle ? (
          <Text className={`mt-1 text-sm leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

export function TrialBanner({ compact = false }: { compact?: boolean }) {
  const { isRTL } = useApp();
  const { isAuthenticated } = useAuth();
  const account = trpc.access.status.useQuery(undefined, { enabled: isAuthenticated, retry: false, staleTime: 30_000 });
  const trial = account.data?.access;
  if (trial?.kind !== "trial") return null;
  const urgency = trial.trialDaysRemaining <= 1 ? "urgent" : trial.trialDaysRemaining <= 3 ? "warning" : "normal";
  const bannerCopy = urgency === "urgent"
    ? (isRTL ? "تنبيه عاجل: اختر الباقة اليوم لاستمرار الوصول." : "Urgent: choose a plan today to keep access.")
    : urgency === "warning"
      ? (isRTL ? "اقترب انتهاء التجربة. اختر الباقة قبل انتهاء المدة." : "Your trial is ending soon. Choose a plan before it ends.")
      : (isRTL ? "تعمل جميع أدوات حسابك خلال الفترة المجانية." : "All account tools are active during your free period.");
  const urgencyStyle = urgency === "urgent" ? styles.demoBannerUrgent : urgency === "warning" ? styles.demoBannerWarning : undefined;
  return (
    <View style={[styles.demoBanner, compact ? styles.demoBannerCompact : styles.demoBannerRegular, urgencyStyle]}>
      <View className={`flex-row items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
        <View style={[styles.demoIcon, urgency === "urgent" && styles.demoIconUrgent, urgency === "warning" && styles.demoIconWarning]}>
          <MaterialIcons name={urgency === "urgent" ? "notification-important" : "event-available"} color="#FFFFFF" size={19} />
        </View>
        <View className="flex-1">
          <Text className={`text-sm font-bold ${isRTL ? "text-right" : "text-left"}`} style={{ color: urgency === "urgent" ? "#C73737" : urgency === "warning" ? "#B45309" : "#0F766E" }}>{isRTL ? `باقي ${trial.trialDaysRemaining} ${trial.trialDaysRemaining === 1 ? "يوم" : "أيام"} من الاستخدام المجاني` : `${trial.trialDaysRemaining} free day${trial.trialDaysRemaining === 1 ? "" : "s"} remaining`}</Text>
          {!compact ? (
            <Text className={`mt-0.5 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{bannerCopy}</Text>
          ) : null}
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push("/module/subscription" as never)} style={({ pressed }) => [styles.demoUpgrade, pressed && styles.pressed]}>
          <Text className="text-xs font-bold text-white">{isRTL ? "اختيار الباقة" : "Choose plan"}</Text>
          <MaterialIcons name={isRTL ? "arrow-back" : "arrow-forward"} color="#FFFFFF" size={16} />
      </Pressable>
    </View>
  );
}

/** @deprecated استُبدل باسم TrialBanner؛ يُبقى هذا الاسم توافقًا مع الشاشات القائمة. */
export const DemoBanner = TrialBanner;

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: string }) {
  const { isRTL } = useApp();
  return (
    <View className={`mb-3 flex-row items-end justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
      <View className="flex-1">
        <Text className={`text-lg font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{title}</Text>
        {subtitle ? <Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{subtitle}</Text> : null}
      </View>
      {action ? <Text className="text-sm font-semibold text-primary">{action}</Text> : null}
    </View>
  );
}

export function StatusPill({ label, tone = "primary" }: { label: string; tone?: "primary" | "success" | "warning" | "error" | "neutral" }) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    error: "bg-error/10 text-error",
    neutral: "bg-surface text-muted",
  }[tone];
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${toneClasses.split(" ")[0]}`}>
      <Text className={`text-[11px] font-bold ${toneClasses.split(" ")[1]}`}>{label}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, icon = "arrow-forward", secondary = false }: { label: string; onPress: () => void; icon?: keyof typeof MaterialIcons.glyphMap; secondary?: boolean }) {
  const { isRTL } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.light();
        onPress();
      }}
      style={({ pressed }) => [styles.buttonPressable, pressed && styles.pressed]}
    >
      <View className={`min-h-12 flex-row items-center justify-center gap-2 rounded-2xl px-5 ${secondary ? "border border-border bg-surface" : "bg-primary"} ${isRTL ? "flex-row-reverse" : ""}`}>
        <Text className={`text-base font-bold ${secondary ? "text-foreground" : "text-white"}`}>{label}</Text>
        <MaterialIcons name={icon} size={19} color={secondary ? "#14201F" : "#FFFFFF"} style={isRTL && icon === "arrow-forward" ? styles.flip : undefined} />
      </View>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label }: { icon: keyof typeof MaterialIcons.glyphMap; onPress: () => void; label: string }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <MaterialIcons name={icon} size={22} color="#14201F" />
    </Pressable>
  );
}

export function EmptyState({ icon, title, description, action, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; description: string; action?: string; onPress?: () => void }) {
  const { isRTL } = useApp();
  return (
    <View className="items-center rounded-3xl border border-border bg-surface p-6">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <MaterialIcons name={icon} size={28} color="#0F766E" />
      </View>
      <Text className="text-center text-lg font-bold text-foreground">{title}</Text>
      <Text className={`mt-2 text-center text-sm leading-6 text-muted ${isRTL ? "text-right" : "text-left"}`}>{description}</Text>
      {action && onPress ? <View className="mt-5 w-full"><PrimaryButton label={action} onPress={onPress} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  buttonPressable: { width: "100%" },
  demoBanner: { backgroundColor: "#EAF4F2", borderColor: "#B8DAD6", borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  demoBannerWarning: { backgroundColor: "#FFF6E5", borderColor: "#F2D39E" },
  demoBannerUrgent: { backgroundColor: "#FDECEC", borderColor: "#EAB3B3" },
  demoIcon: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  demoIconWarning: { backgroundColor: "#D97706" },
  demoIconUrgent: { backgroundColor: "#C73737" },
  demoBannerCompact: { paddingHorizontal: 12, paddingVertical: 10 },
  demoBannerRegular: { padding: 16 },
  demoUpgrade: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#0F766E", borderRadius: 12, flexDirection: "row", gap: 6, marginTop: 12, minHeight: 38, paddingHorizontal: 12 },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE7E4",
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  flip: { transform: [{ scaleX: -1 }] },
});
