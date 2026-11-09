import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppHeader, DemoBanner, SectionTitle } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { moduleContent, type ModuleSlug } from "@/lib/demo-data";

const GROUPS: { titleKey: "management" | "settingsAndAccess"; items: ModuleSlug[] }[] = [
  { titleKey: "management", items: ["notifications", "tasks", "purchases", "suppliers", "branches", "reports", "integrations"] },
  { titleKey: "settingsAndAccess", items: ["employees", "subscription", "settings", "admin"] },
];

export default function MoreScreen() {
  const { t, isRTL, language } = useApp();

  return (
    <ScreenContainer className="px-4">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppHeader title={t("more")} subtitle={isRTL ? "كل أدوات التشغيل والإدارة في مكان واحد." : "All operations and management tools in one place."} />
        <DemoBanner compact />

        <Pressable onPress={() => router.push("/assistant" as never)} style={({ pressed }) => [styles.assistantCard, pressed && styles.pressed]}>
          <View className={`flex-row items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <View className="h-14 w-14 items-center justify-center rounded-3xl bg-white/15"><MaterialIcons name="auto-awesome" size={29} color="#FFFFFF" /></View>
            <View className="flex-1">
              <Text className={`text-lg font-bold text-white ${isRTL ? "text-right" : "text-left"}`}>{t("assistant")}</Text>
              <Text className={`mt-1 text-xs leading-5 text-white/70 ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "اسأل: أين أخسر؟ وماذا أشتري هذا الأسبوع؟" : "Ask: Where am I losing money? What should I buy this week?"}</Text>
            </View>
            <MaterialIcons name={isRTL ? "arrow-back" : "arrow-forward"} size={23} color="#FFFFFF" />
          </View>
        </Pressable>

        <Pressable onPress={() => router.push("/price-scout" as never)} style={({ pressed }) => [styles.priceScoutCard, pressed && styles.pressed]}>
          <View className={`flex-row items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <View className="h-14 w-14 items-center justify-center rounded-3xl bg-primary/10"><MaterialIcons name="travel-explore" size={28} color="#0F766E" /></View>
            <View className="flex-1"><Text className={`text-base font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "المقارنة الذكية" : "Smart Comparison"}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "راجع خمس مصادر سوق ثم احصل على توصية تسعير بالذكاء الاصطناعي." : "Review five market sources, then get an AI pricing recommendation."}</Text></View>
            <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={23} color="#0F766E" />
          </View>
        </Pressable>

        <Pressable onPress={() => router.push("/pricing-decisions" as never)} style={({ pressed }) => [styles.decisionHistoryCard, pressed && styles.pressed]}>
          <View className={`flex-row items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#F1E9FA]"><MaterialIcons name="fact-check" size={25} color="#7252A0" /></View>
            <View className="flex-1"><Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "سجل قرارات التسعير" : "Pricing decision history"}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "راجع قراراتك وصدّرها PDF دون تغيير الأسعار تلقائيًا." : "Review and export your decisions without automatic price changes."}</Text></View>
            <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={22} color="#7252A0" />
          </View>
        </Pressable>

        <Pressable onPress={() => router.push("/channel-fees" as never)} style={({ pressed }) => [styles.channelFeesCard, pressed && styles.pressed]}>
          <View className={`flex-row items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F5F1]"><MaterialIcons name="account-balance-wallet" size={25} color="#0F766E" /></View>
            <View className="flex-1"><Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "رسوم قنوات البيع" : "Sales channel fees"}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "اضبط الشحن والعمولات والضريبة لكل وحدة قبل المقارنة." : "Set shipping, commission, and tax per unit before comparing."}</Text></View>
            <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={22} color="#0F766E" />
          </View>
        </Pressable>

        <Pressable onPress={() => router.push("/margin-target" as never)} style={({ pressed }) => [styles.marginTargetCard, pressed && styles.pressed]}>
          <View className={`flex-row items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF2DB]"><MaterialIcons name="trending-up" size={25} color="#9A5B00" /></View>
            <View className="flex-1"><Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "هدف الهامش" : "Margin target"}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "حدد هدفًا اختياريًا لتنبيهك عند انخفاض الهامش." : "Set an optional target to be alerted when margin drops."}</Text></View>
            <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={22} color="#9A5B00" />
          </View>
        </Pressable>

        <Pressable onPress={() => router.push("/inventory-operations" as never)} style={({ pressed }) => [styles.inventoryOperationsCard, pressed && styles.pressed]}>
          <View className={`flex-row items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF4F2]"><MaterialIcons name="fact-check" size={25} color="#0F766E" /></View>
            <View className="flex-1"><Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "الجرد وإعادة التزويد" : "Stocktake & replenishment"}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "اعتمد فروقات الجرد وتابع اقتراحات إعادة التزويد لكل فرع." : "Approve stocktake variances and review low-stock replenishment suggestions by branch."}</Text></View>
            <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={22} color="#0F766E" />
          </View>
        </Pressable>

        <Pressable onPress={() => router.push("/replenishment-history" as never)} style={({ pressed }) => [styles.replenishmentHistoryCard, pressed && styles.pressed]}>
          <View className={`flex-row items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#F1E9FA]"><MaterialIcons name="history" size={25} color="#7252A0" /></View>
            <View className="flex-1"><Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "تاريخ إعادة التزويد" : "Replenishment history"}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "راجع كل قرار وفرع ومنفذ وصدّر السجل إلى PDF." : "Review every decision, branch, actor, and export the log to PDF."}</Text></View>
            <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={22} color="#7252A0" />
          </View>
        </Pressable>

        <Pressable onPress={() => router.push("/replenishment-variance" as never)} style={({ pressed }) => [styles.replenishmentHistoryCard, pressed && styles.pressed]}>
          <View className={`flex-row items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF2DB]"><MaterialIcons name="assessment" size={25} color="#9A5B00" /></View>
            <View className="flex-1"><Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "تقرير فروقات التزويد" : "Replenishment variance report"}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "قارن المطلوب بالمستلم حسب الشهر والفرع وصدّر التقرير." : "Compare requested and received quantities by month and branch."}</Text></View>
            <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={22} color="#9A5B00" />
          </View>
        </Pressable>

        {GROUPS.map((group) => (
          <View key={group.titleKey} className="mt-7">
            <SectionTitle title={t(group.titleKey)} />
            <View className="overflow-hidden rounded-3xl border border-border bg-surface px-4">
              {group.items.map((slug, index) => {
                const module = moduleContent[slug];
                return (
                  <Pressable key={slug} onPress={() => router.push(`/module/${slug}` as never)} style={({ pressed }) => [styles.moduleRow, index < group.items.length - 1 && styles.rowBorder, pressed && styles.pressed]}>
                    <View className={`flex-1 flex-row items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-background"><MaterialIcons name={module.icon} size={22} color="#0F766E" /></View>
                      <View className="flex-1">
                        <Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{module.title[language]}</Text>
                        <Text className={`mt-0.5 text-[11px] leading-4 text-muted ${isRTL ? "text-right" : "text-left"}`} numberOfLines={1}>{module.subtitle[language]}</Text>
                      </View>
                      {slug === "notifications" ? <View className="min-w-6 items-center justify-center rounded-full bg-error px-2 py-1"><Text className="text-[10px] font-bold text-white">7</Text></View> : null}
                      <MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={22} color="#8AA09C" />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <View className="mt-7 rounded-2xl border border-border bg-surface p-4">
          <View className={`flex-row items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            <MaterialIcons name="verified-user" size={22} color="#16855B" />
            <View className="flex-1">
              <Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "حماية على مستوى المتجر" : "Store-level protection"}</Text>
              <Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "يُعرض كل قسم وصلاحية وفق دور المستخدم والمتجر النشط." : "Every section and permission is scoped to the active store and user role."}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24, paddingTop: 12 },
  assistantCard: { backgroundColor: "#0B3B3A", borderRadius: 24, padding: 18 },
  priceScoutCard: { backgroundColor: "#FFFFFF", borderColor: "#9FCAC2", borderRadius: 22, borderWidth: 1, marginTop: 14, padding: 17 },
  decisionHistoryCard: { backgroundColor: "#FFFFFF", borderColor: "#DCCAF0", borderRadius: 20, borderWidth: 1, marginTop: 10, padding: 15 }, channelFeesCard: { backgroundColor: "#FFFFFF", borderColor: "#B7DED4", borderRadius: 20, borderWidth: 1, marginTop: 10, padding: 15 }, marginTargetCard: { backgroundColor: "#FFFFFF", borderColor: "#F0CB8C", borderRadius: 20, borderWidth: 1, marginTop: 10, padding: 15 }, inventoryOperationsCard: { backgroundColor: "#FFFFFF", borderColor: "#9FCAC2", borderRadius: 20, borderWidth: 1, marginTop: 10, padding: 15 }, replenishmentHistoryCard: { backgroundColor: "#FFFFFF", borderColor: "#DCCAF0", borderRadius: 20, borderWidth: 1, marginTop: 10, padding: 15 },
  moduleRow: { minHeight: 72, paddingVertical: 12 },
  rowBorder: { borderBottomColor: "#DDE7E4", borderBottomWidth: 1 },
  pressed: { opacity: 0.72 },
});
