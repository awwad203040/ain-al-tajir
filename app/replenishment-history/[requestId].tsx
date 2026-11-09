import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useApp } from "@/lib/app-context";
import { exportInventoryReplenishmentRequestPdf } from "@/lib/inventory-replenishment-export";
import { formatReplenishmentAuditDate, replenishmentQuantityDifference, replenishmentStatusLabel, type InventoryReplenishmentAuditRecord } from "@/lib/inventory-replenishment-history";
import { trpc } from "@/lib/trpc";

export default function ReplenishmentHistoryDetailScreen() {
  return <SubscriptionGuard><ReplenishmentHistoryDetailContent /></SubscriptionGuard>;
}

function ReplenishmentHistoryDetailContent() {
  const { isRTL, language } = useApp();
  const ar = language === "ar";
  const params = useLocalSearchParams<{ requestId?: string }>();
  const requestId = Number(params.requestId);
  const query = trpc.inventory.replenishments.audit.useQuery({ requestId }, { enabled: Number.isInteger(requestId) && requestId > 0, retry: false });
  const records = useMemo(() => (query.data ?? []) as InventoryReplenishmentAuditRecord[], [query.data]);
  const [exporting, setExporting] = useState(false);
  const first = records[0];
  const textAlign = isRTL ? styles.right : styles.left;
  const direction = isRTL ? styles.rowReverse : styles.row;
  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4"><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#14201F" /></Pressable>
    {query.isLoading ? <View style={styles.loading}><ActivityIndicator color="#0F766E" size="large" /><Text style={styles.loadingText}>{ar ? "جارٍ تحميل تفاصيل الطلب…" : "Loading request details…"}</Text></View> : !first ? <View style={styles.empty}><MaterialIcons name="history" size={34} color="#63847D" /><Text style={[styles.emptyTitle, textAlign]}>{ar ? "لا توجد تفاصيل لهذا الطلب" : "No details found for this request"}</Text><Text style={[styles.emptyText, textAlign]}>{ar ? "قد يكون الطلب غير موجود أو لا ينتمي إلى هذا المتجر." : "The request may not exist or may not belong to this store."}</Text></View> : <>
      <View style={styles.hero}><View style={[styles.heroTop, direction]}><View style={styles.heroIcon}><MaterialIcons name="assignment" size={25} color="#C6F2E9" /></View><View style={styles.flex}><Text style={[styles.kicker, textAlign]}>{ar ? `طلب إعادة تزويد #${first.requestId}` : `Replenishment request #${first.requestId}`}</Text><Text style={[styles.title, textAlign]}>{first.productName}</Text><Text style={[styles.subtitle, textAlign]}>{first.productSku ? `${first.productSku} · ` : ""}{first.branchName}</Text></View></View></View>
      <View style={[styles.summary, direction]}><Summary label={ar ? "الإجراءات" : "Actions"} value={records.length} /><Summary label={ar ? "المطلوب" : "Requested"} value={first.requestedQuantity} /><Summary label={ar ? "المستلم" : "Received"} value={first.receivedQuantity} /></View>
      <Pressable disabled={exporting} accessibilityRole="button" onPress={async () => { setExporting(true); try { await exportInventoryReplenishmentRequestPdf(records, language); } catch (error) { Alert.alert(ar ? "تعذر التصدير" : "Could not export", error instanceof Error ? error.message : (ar ? "حاول مرة أخرى." : "Try again.")); } finally { setExporting(false); } }} style={({ pressed }) => [styles.exportButton, exporting && styles.disabled, pressed && styles.pressed]}><MaterialIcons name="picture-as-pdf" size={18} color="#FFFFFF" /><Text style={styles.exportButtonText}>{exporting ? (ar ? "جارٍ تجهيز PDF…" : "Preparing PDF…") : (ar ? "تصدير تفاصيل الطلب PDF" : "Export request PDF")}</Text></Pressable>
      <View style={[styles.quantityCompare, direction]}><View style={styles.flex}><Text style={[styles.quantityLabel, textAlign]}>{ar ? "مقارنة الكمية" : "Quantity comparison"}</Text><Text style={[styles.quantityHint, textAlign]}>{ar ? "المطلوب مقابل ما سجله الفرع عند الإغلاق" : "Requested versus the quantity recorded at close"}</Text></View><Text style={[styles.quantityDifference, { color: replenishmentQuantityDifference(first.requestedQuantity, first.receivedQuantity) < 0 ? "#A85E00" : "#176458" }]}>{replenishmentQuantityDifference(first.requestedQuantity, first.receivedQuantity) > 0 ? "+" : ""}{replenishmentQuantityDifference(first.requestedQuantity, first.receivedQuantity)}</Text></View>
      <View style={[styles.notice, direction]}><MaterialIcons name="verified-user" size={18} color="#176458" /><Text style={[styles.noticeText, textAlign]}>{ar ? "هذا الخط الزمني للقراءة فقط، ويعرض القرارات المسجلة بعد نجاح كل انتقال." : "This read-only timeline shows decisions recorded after each successful transition."}</Text></View>
      <Text style={[styles.sectionTitle, textAlign]}>{ar ? "الخط الزمني" : "Timeline"}</Text>
      <View style={styles.timeline}>{records.slice().reverse().map((record, index) => <TimelineItem key={record.id} record={record} language={language} isRTL={isRTL} isLast={index === records.length - 1} />)}</View>
    </>}
  </ScrollView></ScreenContainer>;
}

function Summary({ label, value, wide = false }: { label: string; value: number | string; wide?: boolean }) { return <View style={[styles.summaryCard, wide && styles.summaryWide]}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue} numberOfLines={1}>{value}</Text></View>; }
function TimelineItem({ record, language, isRTL, isLast }: { record: InventoryReplenishmentAuditRecord; language: "ar" | "en"; isRTL: boolean; isLast: boolean }) { const toColor = record.toStatus === "closed" ? "#16855B" : record.toStatus === "approved" ? "#7252A0" : record.toStatus === "dismissed" ? "#9A5B00" : "#0F766E"; const textAlign = isRTL ? styles.right : styles.left; return <View style={[styles.timelineItem, isRTL ? styles.rowReverse : styles.row]}><View style={styles.lineColumn}><View style={[styles.dot, { backgroundColor: toColor }]}><MaterialIcons name={record.toStatus === "closed" ? "check" : "swap-horiz"} size={14} color="#FFFFFF" /></View>{!isLast && <View style={styles.line} />}</View><View style={styles.eventCard}><View style={[styles.eventHeader, isRTL ? styles.rowReverse : styles.row]}><Text style={[styles.eventTitle, { color: toColor }, textAlign]}>{replenishmentStatusLabel(record.toStatus, language)}</Text><Text style={[styles.eventDate, textAlign]}>{formatReplenishmentAuditDate(record.createdAt, language)}</Text></View><Text style={[styles.transitionText, textAlign]}>{replenishmentStatusLabel(record.fromStatus, language)} {language === "ar" ? "←" : "→"} {replenishmentStatusLabel(record.toStatus, language)}</Text><Text style={[styles.actorText, textAlign]}>{language === "ar" ? `اعتمدها: ${record.actorName}` : `Action by: ${record.actorName}`}</Text></View></View>; }

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingTop: 12 },
  row: { flexDirection: "row" },
  rowReverse: { flexDirection: "row-reverse" },
  flex: { flex: 1 },
  right: { textAlign: "right" },
  left: { textAlign: "left" },
  back: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", marginBottom: 18, width: 44 },
  hero: { backgroundColor: "#0B3B3A", borderRadius: 26, padding: 20 },
  heroTop: { alignItems: "flex-start", gap: 13 },
  heroIcon: { alignItems: "center", backgroundColor: "#FFFFFF18", borderRadius: 16, height: 52, justifyContent: "center", width: 52 },
  kicker: { color: "#B8EDE3", fontSize: 11, fontWeight: "800" },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", lineHeight: 30, marginTop: 4 },
  subtitle: { color: "#D7F4EE", fontSize: 12, marginTop: 5 },
  summary: { gap: 8, marginTop: 14 },
  summaryCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 15, borderWidth: 1, flex: 1, minHeight: 75, padding: 12 },
  summaryWide: { flex: 1.5 },
  summaryLabel: { color: "#63847D", fontSize: 10, fontWeight: "700" },
  summaryValue: { color: "#0F766E", fontSize: 17, fontWeight: "800", marginTop: 7 },
  quantityCompare: { alignItems: "center", backgroundColor: "#FFF8ED", borderColor: "#F4C98A", borderRadius: 15, borderWidth: 1, gap: 10, marginTop: 10, padding: 12 },
  quantityLabel: { color: "#7A4D00", fontSize: 12, fontWeight: "800" },
  quantityHint: { color: "#996D24", fontSize: 10, marginTop: 3 },
  quantityDifference: { fontSize: 20, fontWeight: "900" },
  exportButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 10, minHeight: 45, paddingHorizontal: 12 },
  exportButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  notice: { alignItems: "flex-start", backgroundColor: "#E7F6F1", borderColor: "#B7DED4", borderRadius: 14, borderWidth: 1, gap: 8, marginTop: 12, padding: 11 },
  noticeText: { color: "#176458", flex: 1, fontSize: 10, fontWeight: "700", lineHeight: 16 },
  sectionTitle: { color: "#14201F", fontSize: 17, fontWeight: "800", marginBottom: 12, marginTop: 22 },
  timeline: { paddingBottom: 5 },
  timelineItem: { alignItems: "stretch", minHeight: 92 },
  lineColumn: { alignItems: "center", marginEnd: 11, width: 28 },
  dot: { alignItems: "center", borderRadius: 15, height: 28, justifyContent: "center", width: 28 },
  line: { backgroundColor: "#B7DED4", flex: 1, width: 2 },
  eventCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 16, borderWidth: 1, flex: 1, marginBottom: 10, padding: 13 },
  eventHeader: { alignItems: "center", justifyContent: "space-between" },
  eventTitle: { fontSize: 13, fontWeight: "800" },
  eventDate: { color: "#63847D", fontSize: 9 },
  transitionText: { color: "#20403A", fontSize: 11, fontWeight: "800", marginTop: 10 },
  actorText: { color: "#63847D", fontSize: 10, marginTop: 7 },
  loading: { alignItems: "center", paddingVertical: 100 },
  loadingText: { color: "#63847D", fontSize: 13, fontWeight: "700", marginTop: 14 },
  empty: { alignItems: "center", backgroundColor: "#F7FBFA", borderColor: "#DDE7E4", borderRadius: 21, borderStyle: "dashed", borderWidth: 1, marginTop: 16, padding: 28 },
  emptyTitle: { color: "#14201F", fontSize: 15, fontWeight: "800", marginTop: 10 },
  emptyText: { color: "#63847D", fontSize: 11, lineHeight: 18, marginTop: 5, textAlign: "center" },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});
