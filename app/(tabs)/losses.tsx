import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader, DemoBanner, SectionTitle, StatusPill } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { recommendedActions } from "@/lib/demo-data";

export default function LossCenterScreen() {
  const { t, isRTL, language } = useApp();

  return (
    <ScreenContainer className="px-4">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppHeader title={t("lossCenter")} subtitle={isRTL ? "اكتشاف المشكلة، قياس أثرها، ثم اقتراح الإجراء." : "Detect the issue, measure its impact, and recommend an action."} />
        <DemoBanner compact />

        <View className="mb-6 rounded-3xl bg-error p-5">
          <View className={`flex-row items-start justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
            <View>
              <Text className={`text-sm font-semibold text-white/75 ${isRTL ? "text-right" : "text-left"}`}>{t("impactTotal")}</Text>
              <Text className="mt-1 text-3xl font-bold text-white">5,620 <Text className="text-sm text-white/70">{t("sar")}</Text></Text>
              <Text className={`mt-2 text-xs text-white/70 ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "تقدير شهري إذا استمرت الأنماط الحالية" : "Monthly estimate if current patterns continue"}</Text>
            </View>
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><MaterialIcons name="policy" size={26} color="#FFFFFF" /></View>
          </View>
        </View>

        <View className="mb-7 flex-row justify-between gap-2">
          {[
            { label: t("high"), value: "2", color: "#C73737", background: "#FBE7E7" },
            { label: t("medium"), value: "4", color: "#D97706", background: "#FFF1D9" },
            { label: t("low"), value: "3", color: "#3F5DA8", background: "#E9EDFA" },
          ].map((item) => (
            <View key={item.label} style={[styles.severityCard, { backgroundColor: item.background }]}>
              <Text style={{ color: item.color, fontSize: 22, fontWeight: "800" }}>{item.value}</Text>
              <Text style={{ color: item.color, fontSize: 11, fontWeight: "700", marginTop: 2 }}>{item.label}</Text>
            </View>
          ))}
        </View>

        <SectionTitle title={t("detectedLosses")} subtitle={t("orderedByImpact")} />
        <View className="gap-3">
          {recommendedActions.map((item, index) => (
            <Pressable key={item.id} onPress={() => router.push(`/insight/${item.id}` as never)} style={({ pressed }) => [styles.issueCard, pressed && styles.pressed]}>
              <View className={`mb-3 flex-row items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-error/10"><MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={22} color="#C73737" /></View>
                <View className="flex-1">
                  <Text className={`text-[15px] font-bold leading-6 text-foreground ${isRTL ? "text-right" : "text-left"}`}>{item.title[language]}</Text>
                  <Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{item.detail[language]}</Text>
                </View>
                <StatusPill label={t(item.priority)} tone={item.priority === "high" ? "error" : "warning"} />
              </View>
              <View className={`rounded-2xl bg-background p-3 ${isRTL ? "items-end" : "items-start"}`}>
                <Text className="text-[11px] font-semibold text-muted">{t("financialImpact")}</Text>
                <View className={`mt-1 flex-row items-center justify-between self-stretch ${isRTL ? "flex-row-reverse" : ""}`}>
                  <Text className="text-base font-bold text-error">{item.impact} {t("sar")}</Text>
                  <Text className="text-xs font-semibold text-muted">{t("confidence")} {item.confidence}%</Text>
                </View>
              </View>
              <View className={`mt-3 flex-row items-center justify-end gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Text className="text-xs font-bold text-primary">{t("viewDetails")}</Text>
                <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={18} color="#0F766E" />
              </View>
            </Pressable>
          ))}
          <View className="rounded-2xl border border-dashed border-border p-4">
            <View className={`flex-row items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <MaterialIcons name="info-outline" size={21} color="#667A77" />
              <Text className={`flex-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>
                {isRTL ? "هذه مؤشرات تحتاج تحققًا وليست أدلة قاطعة. راجع البيانات قبل اتخاذ قرار." : "These signals require verification and are not conclusive evidence. Review the data before acting."}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24, paddingTop: 12 },
  severityCard: { alignItems: "center", borderRadius: 18, flex: 1, justifyContent: "center", minHeight: 82 },
  issueCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 21, borderWidth: 1, padding: 15 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
