import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader, DemoBanner, SectionTitle } from "@/components/app-ui";
import { AnimatedDistributionChart, InteractiveTrendChart } from "@/components/interactive-charts";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import type { ChartRange } from "@/lib/chart-data";
import { branchPerformance } from "@/lib/demo-data";

export default function SalesScreen() {
  const { t, isRTL, language } = useApp();
  const [period, setPeriod] = useState<ChartRange>("week");
  const periods: ChartRange[] = ["today", "week", "month"];

  return (
    <ScreenContainer className="px-4">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppHeader title={t("sales")} subtitle={isRTL ? "افهم النمو، القنوات، والفروع التي صنعت النتيجة." : "Understand growth, channels, and the branches behind the result."} />
        <DemoBanner compact />

        <View className={`mb-5 flex-row gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          {periods.map((item) => (
            <Pressable key={item} onPress={() => setPeriod(item)} style={[styles.filterChip, period === item && styles.filterChipActive]}>
              <Text className={`text-sm font-semibold ${period === item ? "text-white" : "text-muted"}`}>{t(item)}</Text>
            </Pressable>
          ))}
        </View>

        <View className="mb-5">
          <InteractiveTrendChart range={period} compact />
        </View>

        <View className="mb-7 flex-row flex-wrap justify-between gap-y-3">
          {[
            { label: t("orders"), value: "1,284", icon: "receipt-long", delta: "+6.2%" },
            { label: t("averageBasket"), value: `255 ${t("sar")}`, icon: "shopping-basket", delta: "+3.8%" },
            { label: isRTL ? "المرتجعات" : "Returns", value: `8,240 ${t("sar")}`, icon: "assignment-return", delta: "-1.4%" },
            { label: isRTL ? "هامش الربح" : "Profit margin", value: "23.4%", icon: "pie-chart", delta: "+1.1%" },
          ].map((item) => (
            <View key={item.label} style={styles.statCard}>
              <View className={`mb-3 flex-row items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                <MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={20} color="#0F766E" />
                <Text className="text-xs font-bold text-success">{item.delta}</Text>
              </View>
              <Text className={`text-xs text-muted ${isRTL ? "text-right" : "text-left"}`}>{item.label}</Text>
              <Text className={`mt-1 text-lg font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View className="mb-7">
          <AnimatedDistributionChart />
        </View>

        <SectionTitle title={isRTL ? "المبيعات حسب الفرع" : "Sales by branch"} />
        <View className="rounded-3xl border border-border bg-surface px-4">
          {branchPerformance.map((branch, index) => (
            <View key={branch.id} className={`flex-row items-center gap-3 py-4 ${index < branchPerformance.length - 1 ? "border-b border-border" : ""} ${isRTL ? "flex-row-reverse" : ""}`}>
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-primary/10"><MaterialIcons name="storefront" size={19} color="#0F766E" /></View>
              <View className="flex-1"><Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{branch.name[language]}</Text><Text className={`mt-1 text-xs text-muted ${isRTL ? "text-right" : "text-left"}`}>{branch.sales} {t("sar")}</Text></View>
              <Text className={`text-xs font-bold ${branch.delta.startsWith("-") ? "text-error" : "text-success"}`}>{branch.delta}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24, paddingTop: 12 },
  filterChip: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 42 },
  filterChipActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" },
  statCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 19, borderWidth: 1, padding: 14, width: "48.5%" },
});
