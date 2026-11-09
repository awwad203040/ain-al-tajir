import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader, PrimaryButton, StatusPill } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { recommendedActions } from "@/lib/demo-data";
import { haptic } from "@/lib/haptics";

export default function InsightDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isRTL, language, addTask } = useApp();
  const [created, setCreated] = useState(false);
  const item = useMemo(() => recommendedActions.find((action) => action.id === id) ?? recommendedActions[0], [id]);

  const explanation = item.id === "riyadh-gap"
    ? {
        why: isRTL ? "ظهر الفرق لأن الكمية المسجلة انخفضت أسرع من الكمية المباعة في أربعة منتجات." : "The recorded quantity fell faster than sold quantity across four products.",
        evidence: isRTL ? "حركات المخزون، طلبات البيع، وجرد فرع الرياض خلال آخر 48 ساعة." : "Inventory movements, sales orders, and Riyadh branch counts from the last 48 hours.",
        action: isRTL ? "نفّذ جردًا سريعًا للمنتجات الأربعة وراجع حركات التعديل اليدوي." : "Run a spot count for the four products and review manual adjustments.",
      }
    : item.id === "reorder"
      ? {
          why: isRTL ? "متوسط المبيعات اليومية أعلى من الكمية المتاحة حتى موعد التوريد المتوقع." : "Average daily sales exceed available stock through the expected replenishment date.",
          evidence: isRTL ? "مبيعات 30 يومًا، المخزون الحالي، ومدة التوريد المعتادة للمورد." : "30-day sales, current stock, and the supplier's usual lead time.",
          action: isRTL ? "راجع طلب الشراء المقترح والكميات قبل إرساله إلى المورد." : "Review suggested purchase quantities before sending the order.",
        }
      : {
          why: isRTL ? "سُجّلت ثلاثة تحديثات أسعار متتالية رفعت متوسط تكلفة الشراء 9%." : "Three consecutive price updates raised average purchase cost by 9%.",
          evidence: isRTL ? "فواتير الشراء الحالية وسجل أسعار المورد خلال 90 يومًا." : "Current purchase invoices and 90-day supplier price history.",
          action: isRTL ? "اطلب عرض سعر محدثًا وقارن المورد ببديلين قبل التجديد." : "Request an updated quote and compare two alternatives before renewal.",
        };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#14201F" />
        </Pressable>
        <AppHeader title={item.title[language]} subtitle={item.detail[language]} />

        <View className="mb-5 rounded-3xl bg-error p-5">
          <View className={`flex-row items-start justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
            <View>
              <Text className={`text-xs font-semibold text-white/70 ${isRTL ? "text-right" : "text-left"}`}>{t("financialImpact")}</Text>
              <Text className="mt-1 text-3xl font-bold text-white">{item.impact} <Text className="text-sm text-white/70">{t("sar")}</Text></Text>
            </View>
            <StatusPill label={t(item.priority)} tone="warning" />
          </View>
          <View className={`mt-5 flex-row items-center justify-between border-t border-white/15 pt-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Text className="text-xs font-semibold text-white/70">{t("confidence")}</Text>
            <Text className="text-base font-bold text-white">{item.confidence}%</Text>
          </View>
        </View>

        <View className="mb-5 rounded-2xl border border-[#CCD6F2] bg-[#F0F3FC] p-4">
          <View className={`flex-row items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            <MaterialIcons name="auto-graph" size={21} color="#3F5DA8" />
            <View className="flex-1">
              <Text className={`text-sm font-bold text-[#314A86] ${isRTL ? "text-right" : "text-left"}`}>{t("estimate")}</Text>
              <Text className={`mt-1 text-xs leading-5 text-[#53648D] ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "القيمة المالية تقديرية، مبنية على استمرار النمط الحالي، وليست مبلغًا محققًا." : "The financial value is an estimate based on the current pattern, not a realized amount."}</Text>
            </View>
          </View>
        </View>

        {[
          { title: t("why"), text: explanation.why, icon: "psychology", color: "#3F5DA8", bg: "#EEF1FA" },
          { title: t("evidence"), text: explanation.evidence, icon: "query-stats", color: "#0F766E", bg: "#E4F2F0" },
          { title: t("suggestedAction"), text: explanation.action, icon: "task-alt", color: "#16855B", bg: "#E4F3EB" },
        ].map((section) => (
          <View key={section.title} className="mb-3 rounded-3xl border border-border bg-surface p-4">
            <View className={`flex-row items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <View style={[styles.sectionIcon, { backgroundColor: section.bg }]}><MaterialIcons name={section.icon as keyof typeof MaterialIcons.glyphMap} size={21} color={section.color} /></View>
              <View className="flex-1">
                <Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{section.title}</Text>
                <Text className={`mt-1.5 text-sm leading-6 text-muted ${isRTL ? "text-right" : "text-left"}`}>{section.text}</Text>
              </View>
            </View>
          </View>
        ))}

        <View className="mt-4">
          <PrimaryButton
            label={created ? t("taskCreated") : t("createTask")}
            icon={created ? "check-circle" : "add-task"}
            onPress={() => {
              if (!created) {
                addTask(item.title[language]);
                haptic.success();
                setCreated(true);
              }
            }}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28, paddingTop: 12 },
  backButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", marginBottom: 22, width: 44 },
  sectionIcon: { alignItems: "center", borderRadius: 14, height: 42, justifyContent: "center", width: 42 },
});
