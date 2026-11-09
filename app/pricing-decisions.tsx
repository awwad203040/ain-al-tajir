import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useApp } from "@/lib/app-context";
import { exportPricingDecisionHistoryPdf } from "@/lib/pricing-decision-export";
import { decisionGrossMargin, decisionTotalCostMinor, filterPricingDecisionHistory, formatDecisionDate, formatPercent, formatSar, pricingDecisionActionLabel, pricingDecisionGoalLabel, resolvedDecisionPriceMinor, summarizePricingDecisions, type PricingDecisionHistoryRecord } from "@/lib/pricing-decision-history";
import { trpc } from "@/lib/trpc";

export default function PricingDecisionsScreen() {
  return <SubscriptionGuard><PricingDecisionsContent /></SubscriptionGuard>;
}

function PricingDecisionsContent() {
  const { isRTL, language } = useApp();
  const ar = language === "ar";
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const decisionsQuery = trpc.priceResearch.decisions.useQuery(undefined, { retry: false });
  const records = useMemo(() => (decisionsQuery.data ?? []) as PricingDecisionHistoryRecord[], [decisionsQuery.data]);
  const filtered = useMemo(() => filterPricingDecisionHistory(records, search), [records, search]);
  const summary = useMemo(() => summarizePricingDecisions(filtered), [filtered]);
  const direction = isRTL ? styles.rowReverse : styles.row;
  const textAlign = isRTL ? styles.right : styles.left;

  const exportHistory = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportPricingDecisionHistoryPdf(filtered, language);
      Alert.alert(ar ? "تم تجهيز السجل" : "History ready", result.method === "print" ? (ar ? "فُتحت نافذة الطباعة لسجل قرارات التسعير." : "A print window was opened for the pricing decision history.") : (ar ? "تم إنشاء ملف PDF ويمكنك حفظه أو مشاركته." : "A PDF was created and can be saved or shared."));
    } catch {
      Alert.alert(ar ? "تعذر التصدير" : "Could not export", ar ? "تحقق من السماح بالنوافذ المنبثقة أو حاول مجددًا." : "Allow pop-ups if needed, then try again.");
    } finally {
      setExporting(false);
    }
  };

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4">
    <FlatList
      data={filtered}
      keyExtractor={(item) => String(item.id)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#14201F" /></Pressable>
        <View style={styles.hero}><View style={[styles.heroTop, direction]}><View style={styles.heroIcon}><MaterialIcons name="fact-check" size={25} color="#C6F2E9" /></View><View style={styles.flex}><Text style={[styles.heroTitle, textAlign]}>{ar ? "سجل قرارات التسعير" : "Pricing decision history"}</Text><Text style={[styles.heroSubtitle, textAlign]}>{ar ? "راجع قراراتك وأسعارها وقت التسجيل. هذا السجل لا يعدّل سعر أي منتج تلقائيًا." : "Review your recorded decisions and prices at the time. This log never changes a product price automatically."}</Text></View></View></View>
        <View style={[styles.summaryRow, direction]}><Metric label={ar ? "القرارات" : "Decisions"} value={summary.total} accent="#0F766E" /><Metric label={ar ? "اعتمد" : "Accepted"} value={summary.accepted} accent="#16855B" /><Metric label={ar ? "اختار" : "Selected"} value={summary.customized} accent="#7252A0" /><Metric label={ar ? "لم يعتمد" : "Not used"} value={summary.dismissed} accent="#8A5B00" /></View>
        <View style={[styles.searchBox, direction]}><MaterialIcons name="search" size={20} color="#63847D" /><TextInput value={search} onChangeText={setSearch} placeholder={ar ? "ابحث باسم المنتج أو SKU أو الباركود" : "Search product name, SKU, or barcode"} placeholderTextColor="#8AA09C" autoCapitalize="none" autoCorrect={false} style={[styles.searchInput, textAlign]} /></View>
        <View style={[styles.actionRow, direction]}><Pressable disabled={exporting} accessibilityRole="button" onPress={() => void exportHistory()} style={({ pressed }) => [styles.exportButton, exporting && styles.disabled, pressed && styles.pressed]}><MaterialIcons name="picture-as-pdf" size={18} color="#FFFFFF" /><Text style={styles.exportText}>{exporting ? (ar ? "جارٍ التجهيز…" : "Preparing…") : (ar ? "تصدير PDF" : "Export PDF")}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push("/price-scout" as never)} style={({ pressed }) => [styles.compareButton, pressed && styles.pressed]}><MaterialIcons name="add" size={18} color="#0F766E" /><Text style={styles.compareText}>{ar ? "مقارنة جديدة" : "New comparison"}</Text></Pressable></View>
        <View style={[styles.disclosure, direction]}><MaterialIcons name="verified-user" size={18} color="#176458" /><Text style={[styles.disclosureText, textAlign]}>{ar ? "التصدير يحتوي على قرارات حسابك فقط، ويعرض عدد مصادر السوق الحديثة عند وقت القرار من دون جلب بيانات جديدة." : "The export contains only decisions in your account and shows the current-market source count at the decision time without collecting new data."}</Text></View>
        <Text style={[styles.listTitle, textAlign]}>{search.trim() ? (ar ? "نتائج البحث" : "Search results") : (ar ? "جميع القرارات" : "All decisions")}</Text>
      </>}
      renderItem={({ item }) => <DecisionRow item={item} language={language} isRTL={isRTL} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={decisionsQuery.isLoading ? <View style={styles.empty}><MaterialIcons name="hourglass-empty" size={29} color="#63847D" /><Text style={[styles.emptyTitle, textAlign]}>{ar ? "جارٍ تحميل السجل…" : "Loading history…"}</Text></View> : <View style={styles.empty}><MaterialIcons name={search.trim() ? "search-off" : "history"} size={31} color="#63847D" /><Text style={[styles.emptyTitle, textAlign]}>{search.trim() ? (ar ? "لا توجد نتائج مطابقة" : "No matching decisions") : (ar ? "لا توجد قرارات محفوظة بعد" : "No recorded decisions yet")}</Text><Text style={[styles.emptyText, textAlign]}>{search.trim() ? (ar ? "جرّب اسمًا أو SKU أو باركودًا آخر." : "Try another name, SKU, or barcode.") : (ar ? "أنشئ توصية في المقارنة الذكية ثم اختر اعتمادها أو تعديلها أو عدم استخدامها." : "Create a Smart Comparison recommendation, then accept, modify, or decline it.")}</Text>{!search.trim() ? <Pressable accessibilityRole="button" onPress={() => router.push("/price-scout" as never)} style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}><Text style={styles.emptyButtonText}>{ar ? "فتح المقارنة الذكية" : "Open Smart Comparison"}</Text></Pressable> : null}</View>}
    />
  </ScreenContainer>;
}

function Metric({ label, value, accent }: { label: string; value: number; accent: string }) { return <View style={styles.metric}><Text style={[styles.metricValue, { color: accent }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

function DecisionRow({ item, language, isRTL }: { item: PricingDecisionHistoryRecord; language: "ar" | "en"; isRTL: boolean }) {
  const actionColor = item.action === "accepted" ? "#16855B" : item.action === "customized" ? "#7252A0" : "#9A5B00";
  const selectedPrice = resolvedDecisionPriceMinor(item);
  const totalCost = decisionTotalCostMinor(item);
  const margin = decisionGrossMargin(item);
  const direction = isRTL ? styles.rowReverse : styles.row;
  const textAlign = isRTL ? styles.right : styles.left;
  const identifiers = [item.productSku ? `SKU: ${item.productSku}` : "", item.productBarcode ? `${language === "ar" ? "باركود" : "Barcode"}: ${item.productBarcode}` : ""].filter(Boolean).join(" · ");
  return <View style={styles.rowCard}><View style={[styles.cardTop, direction]}><View style={[styles.actionIcon, { backgroundColor: `${actionColor}17` }]}><MaterialIcons name={item.action === "accepted" ? "check-circle" : item.action === "customized" ? "edit" : "remove-circle-outline"} size={20} color={actionColor} /></View><View style={styles.flex}><Text style={[styles.productName, textAlign]} numberOfLines={2}>{item.productQuery}</Text>{identifiers ? <Text style={[styles.identifiers, textAlign]} numberOfLines={1}>{identifiers}</Text> : null}</View><View style={[styles.actionPill, { backgroundColor: `${actionColor}14` }]}><Text style={[styles.actionPillText, { color: actionColor }]}>{pricingDecisionActionLabel(item.action, language)}</Text></View></View>
    <View style={[styles.detailsGrid, direction]}><Detail label={language === "ar" ? "هدف التسعير" : "Pricing goal"} value={pricingDecisionGoalLabel(item.goal, language)} isRTL={isRTL} /><Detail label={language === "ar" ? "سعر المتجر" : "Store price"} value={formatSar(item.ownPriceMinor, language)} isRTL={isRTL} /><Detail label={language === "ar" ? "تكلفة المنتج" : "Product cost"} value={item.costPriceMinor ? formatSar(item.costPriceMinor, language) : (language === "ar" ? "غير مدخلة" : "Not entered")} isRTL={isRTL} /><Detail label={language === "ar" ? "إضافات/وحدة" : "Add-ons / unit"} value={item.additionalCostMinor ? formatSar(item.additionalCostMinor, language) : (language === "ar" ? "غير مدخلة" : "Not entered")} isRTL={isRTL} /><Detail label={language === "ar" ? "التكلفة الكلية" : "All-in cost"} value={totalCost ? formatSar(totalCost, language) : (language === "ar" ? "غير متاحة" : "Unavailable")} isRTL={isRTL} /><Detail label={language === "ar" ? "المستهدف" : "Target"} value={formatSar(item.targetPriceMinor, language)} isRTL={isRTL} /><Detail label={language === "ar" ? "المسجل" : "Recorded"} value={selectedPrice ? formatSar(selectedPrice, language) : (language === "ar" ? "لم يعتمد" : "Not used")} isRTL={isRTL} /><Detail label={language === "ar" ? "الهامش الإجمالي" : "Gross margin"} value={margin ? formatPercent(margin.grossMarginPercent, language) : (language === "ar" ? "غير متاح" : "Unavailable")} isRTL={isRTL} /></View>
    <View style={[styles.cardFooter, direction]}><View style={direction}><MaterialIcons name="verified" size={14} color="#0F766E" /><Text style={styles.footerText}>{item.sourceCount} {language === "ar" ? "مصدر حديث" : "current sources"}</Text></View><Text style={[styles.footerText, textAlign]}>{formatDecisionDate(item.createdAt, language)}</Text></View>
  </View>;
}

function Detail({ label, value, isRTL }: { label: string; value: string; isRTL: boolean }) { return <View style={styles.detail}><Text style={[styles.detailLabel, isRTL ? styles.right : styles.left]}>{label}</Text><Text style={[styles.detailValue, isRTL ? styles.right : styles.left]} numberOfLines={1}>{value}</Text></View>; }

const styles = StyleSheet.create({
  content: { paddingBottom: 30, paddingTop: 12 }, row: { flexDirection: "row" }, rowReverse: { flexDirection: "row-reverse" }, flex: { flex: 1 }, right: { textAlign: "right" }, left: { textAlign: "left" }, back: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", marginBottom: 18, width: 44 }, hero: { backgroundColor: "#0B3B3A", borderRadius: 26, padding: 20 }, heroTop: { alignItems: "flex-start", gap: 13 }, heroIcon: { alignItems: "center", backgroundColor: "#FFFFFF18", borderRadius: 16, height: 52, justifyContent: "center", width: 52 }, heroTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "800", lineHeight: 32 }, heroSubtitle: { color: "#D7F4EE", fontSize: 12, lineHeight: 19, marginTop: 7 }, summaryRow: { gap: 7, marginTop: 14 }, metric: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, flex: 1, minHeight: 68, paddingHorizontal: 5, paddingVertical: 8 }, metricValue: { fontSize: 18, fontWeight: "800" }, metricLabel: { color: "#58706A", fontSize: 9, fontWeight: "700", marginTop: 3, textAlign: "center" }, searchBox: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 15, borderWidth: 1, gap: 8, marginTop: 15, paddingHorizontal: 13 }, searchInput: { color: "#14201F", flex: 1, fontSize: 14, minHeight: 48 }, actionRow: { gap: 9, marginTop: 10 }, exportButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 13, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 46 }, exportText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" }, compareButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#9FCAC2", borderRadius: 13, borderWidth: 1, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 46 }, compareText: { color: "#0F766E", fontSize: 12, fontWeight: "800" }, disclosure: { alignItems: "flex-start", backgroundColor: "#E7F6F1", borderColor: "#B7DED4", borderRadius: 14, borderWidth: 1, gap: 8, marginTop: 12, padding: 11 }, disclosureText: { color: "#176458", flex: 1, fontSize: 10, fontWeight: "700", lineHeight: 16 }, listTitle: { color: "#14201F", fontSize: 16, fontWeight: "800", marginBottom: 10, marginTop: 20 }, rowCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 18, borderWidth: 1, padding: 14 }, cardTop: { alignItems: "flex-start", gap: 10 }, actionIcon: { alignItems: "center", borderRadius: 13, height: 40, justifyContent: "center", width: 40 }, productName: { color: "#14201F", fontSize: 14, fontWeight: "800", lineHeight: 20 }, identifiers: { color: "#6C827D", fontSize: 10, marginTop: 2 }, actionPill: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4 }, actionPillText: { fontSize: 9, fontWeight: "800" }, detailsGrid: { flexWrap: "wrap", gap: 8, marginTop: 13 }, detail: { backgroundColor: "#F7FAF9", borderRadius: 10, flexBasis: "47%", flexGrow: 1, padding: 9 }, detailLabel: { color: "#6C827D", fontSize: 9, fontWeight: "700" }, detailValue: { color: "#20403A", fontSize: 11, fontWeight: "800", marginTop: 3 }, cardFooter: { alignItems: "center", justifyContent: "space-between", marginTop: 12 }, footerText: { color: "#63847D", fontSize: 10, fontWeight: "700" }, separator: { height: 9 }, empty: { alignItems: "center", backgroundColor: "#F7FBFA", borderColor: "#DDE7E4", borderRadius: 21, borderStyle: "dashed", borderWidth: 1, marginTop: 2, padding: 26 }, emptyTitle: { color: "#14201F", fontSize: 14, fontWeight: "800", marginTop: 10 }, emptyText: { color: "#63847D", fontSize: 11, lineHeight: 18, marginTop: 5, textAlign: "center" }, emptyButton: { backgroundColor: "#0F766E", borderRadius: 12, marginTop: 16, paddingHorizontal: 15, paddingVertical: 11 }, emptyButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" }, pressed: { opacity: 0.72 }, disabled: { opacity: 0.55 },
});
