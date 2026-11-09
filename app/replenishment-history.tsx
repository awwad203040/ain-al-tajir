import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useApp } from "@/lib/app-context";
import { exportInventoryReplenishmentAuditPdf } from "@/lib/inventory-replenishment-export";
import { filterReplenishmentAudit, formatReplenishmentAuditDate, replenishmentStatusLabel, type InventoryReplenishmentAuditRecord, type ReplenishmentAuditFilterStatus } from "@/lib/inventory-replenishment-history";
import { trpc } from "@/lib/trpc";

export default function ReplenishmentHistoryScreen() {
  return <SubscriptionGuard><ReplenishmentHistoryContent /></SubscriptionGuard>;
}

function ReplenishmentHistoryContent() {
  const { isRTL, language } = useApp();
  const ar = language === "ar";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ReplenishmentAuditFilterStatus>("all");
  const [days, setDays] = useState<number | undefined>(undefined);
  const [branchId, setBranchId] = useState<number | undefined>(undefined);
  const [actorUserId, setActorUserId] = useState<number | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  const query = trpc.inventory.replenishments.audit.useQuery(undefined, { retry: false });
  const records = useMemo(() => (query.data ?? []) as InventoryReplenishmentAuditRecord[], [query.data]);
  const branchOptions = useMemo(() => [...new Map(records.map((item) => [item.branchId, item.branchName])).entries()], [records]);
  const actorOptions = useMemo(() => [...new Map(records.map((item) => [item.actorUserId, item.actorName])).entries()], [records]);
  const filtered = useMemo(() => filterReplenishmentAudit(records, search, status, days, branchId, actorUserId), [records, search, status, days, branchId, actorUserId]);
  const direction = isRTL ? styles.rowReverse : styles.row;
  const textAlign = isRTL ? styles.right : styles.left;

  const exportHistory = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportInventoryReplenishmentAuditPdf(filtered, language);
      Alert.alert(ar ? "تم تجهيز السجل" : "History ready", result.method === "print" ? (ar ? "فُتحت نافذة الطباعة لسجل إعادة التزويد." : "A print window was opened for the replenishment history.") : (ar ? "تم إنشاء ملف PDF ويمكنك حفظه أو مشاركته." : "A PDF was created and can be saved or shared."));
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
        <View style={styles.hero}><View style={[styles.heroTop, direction]}><View style={styles.heroIcon}><MaterialIcons name="history" size={25} color="#C6F2E9" /></View><View style={styles.flex}><Text style={[styles.heroTitle, textAlign]}>{ar ? "تاريخ إعادة التزويد" : "Replenishment history"}</Text><Text style={[styles.heroSubtitle, textAlign]}>{ar ? "راجع كل قرار وحالة ومنفذ ووقت دون تعديل السجل أو أرصدة المخزون." : "Review every status decision, actor, and timestamp without changing the audit log or inventory."}</Text></View></View></View>
        <View style={[styles.summaryRow, direction]}><Metric label={ar ? "الإجراءات" : "Actions"} value={filtered.length} accent="#0F766E" /><Metric label={ar ? "طلبات مميزة" : "Requests"} value={new Set(filtered.map((item) => item.requestId)).size} accent="#7252A0" /><Metric label={ar ? "الفروع" : "Branches"} value={new Set(filtered.map((item) => item.branchId)).size} accent="#9A5B00" /></View>
        <View style={[styles.searchBox, direction]}><MaterialIcons name="search" size={20} color="#63847D" /><TextInput value={search} onChangeText={setSearch} placeholder={ar ? "ابحث بالمنتج أو الفرع أو المنفذ أو رقم الطلب" : "Search product, branch, actor, or request"} placeholderTextColor="#8AA09C" autoCapitalize="none" autoCorrect={false} style={[styles.searchInput, textAlign]} /></View>
        <Text style={[styles.filterLabel, textAlign]}>{ar ? "الحالة" : "Status"}</Text>
        <View style={[styles.chipRow, direction]}>{(["all", "suggested", "approved", "ordered", "closed", "dismissed"] as ReplenishmentAuditFilterStatus[]).map((item) => <Pressable key={item} onPress={() => setStatus(item)} style={[styles.filterChip, status === item && styles.filterChipActive]}><Text style={[styles.filterChipText, status === item && styles.filterChipTextActive]}>{item === "all" ? (ar ? "الكل" : "All") : replenishmentStatusLabel(item, language)}</Text></Pressable>)}</View>
        <Text style={[styles.filterLabel, textAlign]}>{ar ? "الفترة" : "Period"}</Text>
        <View style={[styles.chipRow, direction]}>{([{ value: undefined, ar: "كل الفترات", en: "All time" }, { value: 7, ar: "7 أيام", en: "7 days" }, { value: 30, ar: "30 يومًا", en: "30 days" }, { value: 90, ar: "90 يومًا", en: "90 days" }] as const).map((item) => <Pressable key={item.value ?? "all"} onPress={() => setDays(item.value)} style={[styles.filterChip, days === item.value && styles.filterChipActive]}><Text style={[styles.filterChipText, days === item.value && styles.filterChipTextActive]}>{item[language]}</Text></Pressable>)}</View>
        <Text style={[styles.filterLabel, textAlign]}>{ar ? "الفرع" : "Branch"}</Text>
        <View style={[styles.chipRow, direction]}><Pressable onPress={() => setBranchId(undefined)} style={[styles.filterChip, branchId === undefined && styles.filterChipActive]}><Text style={[styles.filterChipText, branchId === undefined && styles.filterChipTextActive]}>{ar ? "كل الفروع" : "All branches"}</Text></Pressable>{branchOptions.map(([id, name]) => <Pressable key={id} onPress={() => setBranchId(id)} style={[styles.filterChip, branchId === id && styles.filterChipActive]}><Text style={[styles.filterChipText, branchId === id && styles.filterChipTextActive]}>{name}</Text></Pressable>)}</View>
        <Text style={[styles.filterLabel, textAlign]}>{ar ? "مدير الفرع / المنفذ" : "Branch manager / actor"}</Text>
        <View style={[styles.chipRow, direction]}><Pressable onPress={() => setActorUserId(undefined)} style={[styles.filterChip, actorUserId === undefined && styles.filterChipActive]}><Text style={[styles.filterChipText, actorUserId === undefined && styles.filterChipTextActive]}>{ar ? "كل المنفذين" : "All actors"}</Text></Pressable>{actorOptions.map(([id, name]) => <Pressable key={id} onPress={() => setActorUserId(id)} style={[styles.filterChip, actorUserId === id && styles.filterChipActive]}><Text style={[styles.filterChipText, actorUserId === id && styles.filterChipTextActive]}>{name}</Text></Pressable>)}</View>
        <View style={[styles.actionRow, direction]}><Pressable disabled={exporting} accessibilityRole="button" onPress={() => void exportHistory()} style={({ pressed }) => [styles.exportButton, exporting && styles.disabled, pressed && styles.pressed]}><MaterialIcons name="picture-as-pdf" size={18} color="#FFFFFF" /><Text style={styles.exportText}>{exporting ? (ar ? "جارٍ التجهيز…" : "Preparing…") : (ar ? "تصدير PDF" : "Export PDF")}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push("/inventory-operations" as never)} style={({ pressed }) => [styles.operationsButton, pressed && styles.pressed]}><MaterialIcons name="inventory" size={18} color="#0F766E" /><Text style={styles.operationsText}>{ar ? "العودة للعمليات" : "Back to operations"}</Text></Pressable></View>
        <View style={[styles.disclosure, direction]}><MaterialIcons name="verified-user" size={18} color="#176458" /><Text style={[styles.disclosureText, textAlign]}>{ar ? "السجل للقراءة فقط. كل تغيير حالة يُكتب داخل معاملة بعد نجاح الانتقال، ولا يعيد التصدير إرسال إشعارات أو تعديل المخزون." : "This log is read-only. Each status change is written in the same transaction after a successful transition; exporting sends no alerts and changes no inventory."}</Text></View>
        <Text style={[styles.listTitle, textAlign]}>{search.trim() ? (ar ? "نتائج البحث" : "Search results") : (ar ? "كل الإجراءات" : "All actions")}</Text>
      </>}
      renderItem={({ item }) => <AuditRow item={item} language={language} isRTL={isRTL} onPress={() => router.push(`/replenishment-history/${item.requestId}` as never)} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={query.isLoading ? <View style={styles.empty}><MaterialIcons name="hourglass-empty" size={29} color="#63847D" /><Text style={[styles.emptyTitle, textAlign]}>{ar ? "جارٍ تحميل السجل…" : "Loading history…"}</Text></View> : <View style={styles.empty}><MaterialIcons name={search.trim() ? "search-off" : "history"} size={31} color="#63847D" /><Text style={[styles.emptyTitle, textAlign]}>{search.trim() ? (ar ? "لا توجد نتائج مطابقة" : "No matching actions") : (ar ? "لا توجد إجراءات محفوظة بعد" : "No recorded actions yet")}</Text><Text style={[styles.emptyText, textAlign]}>{ar ? "ستظهر هنا قرارات اعتماد أو طلب أو إغلاق إعادة التزويد." : "Approval, ordering, and closure decisions will appear here."}</Text></View>}
    />
  </ScreenContainer>;
}

function Metric({ label, value, accent }: { label: string; value: number; accent: string }) { return <View style={styles.metric}><Text style={[styles.metricValue, { color: accent }]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

function AuditRow({ item, language, isRTL, onPress }: { item: InventoryReplenishmentAuditRecord; language: "ar" | "en"; isRTL: boolean; onPress: () => void }) {
  const direction = isRTL ? styles.rowReverse : styles.row;
  const textAlign = isRTL ? styles.right : styles.left;
  const toColor = item.toStatus === "closed" ? "#16855B" : item.toStatus === "approved" ? "#7252A0" : item.toStatus === "dismissed" ? "#9A5B00" : "#0F766E";
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.rowCard, pressed && styles.pressed]}><View style={[styles.cardTop, direction]}><View style={[styles.actionIcon, { backgroundColor: `${toColor}17` }]}><MaterialIcons name={item.toStatus === "closed" ? "check-circle" : "swap-horiz"} size={20} color={toColor} /></View><View style={styles.flex}><Text style={[styles.productName, textAlign]} numberOfLines={2}>{item.productName}</Text><Text style={[styles.secondary, textAlign]}>{item.productSku ? `${item.productSku} · ` : ""}{item.branchName}</Text></View><View style={[styles.statusPill, { backgroundColor: `${toColor}14` }]}><Text style={[styles.statusText, { color: toColor }]}>{replenishmentStatusLabel(item.toStatus, language)}</Text></View></View><View style={[styles.transition, direction]}><Text style={[styles.transitionText, textAlign]}>{replenishmentStatusLabel(item.fromStatus, language)} {language === "ar" ? "←" : "→"} {replenishmentStatusLabel(item.toStatus, language)}</Text><Text style={[styles.requestText, textAlign]}>{language === "ar" ? `طلب #${item.requestId}` : `Request #${item.requestId}`}</Text></View><View style={[styles.footer, direction]}><Text style={[styles.footerText, textAlign]}>{language === "ar" ? `بواسطة ${item.actorName}` : `By ${item.actorName}`}</Text><View style={[styles.footer, direction]}><Text style={[styles.footerText, textAlign]}>{formatReplenishmentAuditDate(item.createdAt, language)}</Text><MaterialIcons name={isRTL ? "chevron-left" : "chevron-right"} size={16} color="#0F766E" /></View></View></Pressable>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30, paddingTop: 12 }, row: { flexDirection: "row" }, rowReverse: { flexDirection: "row-reverse" }, flex: { flex: 1 }, right: { textAlign: "right" }, left: { textAlign: "left" }, back: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", marginBottom: 18, width: 44 }, hero: { backgroundColor: "#0B3B3A", borderRadius: 26, padding: 20 }, heroTop: { alignItems: "flex-start", gap: 13 }, heroIcon: { alignItems: "center", backgroundColor: "#FFFFFF18", borderRadius: 16, height: 52, justifyContent: "center", width: 52 }, heroTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "800", lineHeight: 32 }, heroSubtitle: { color: "#D7F4EE", fontSize: 12, lineHeight: 19, marginTop: 7 }, summaryRow: { gap: 7, marginTop: 14 }, metric: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, flex: 1, minHeight: 68, paddingHorizontal: 5, paddingVertical: 8 }, metricValue: { fontSize: 18, fontWeight: "800" }, metricLabel: { color: "#58706A", fontSize: 9, fontWeight: "700", marginTop: 3, textAlign: "center" }, searchBox: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 15, borderWidth: 1, gap: 8, marginTop: 15, paddingHorizontal: 13 }, searchInput: { color: "#14201F", flex: 1, fontSize: 14, minHeight: 48 }, filterLabel: { color: "#58706A", fontSize: 11, fontWeight: "800", marginTop: 12 }, chipRow: { flexWrap: "wrap", gap: 7, marginTop: 7 }, filterChip: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 18, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 }, filterChipActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" }, filterChipText: { color: "#58706A", fontSize: 10, fontWeight: "700" }, filterChipTextActive: { color: "#FFFFFF" }, actionRow: { gap: 9, marginTop: 10 }, exportButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 13, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 46 }, exportText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" }, operationsButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#9FCAC2", borderRadius: 13, borderWidth: 1, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 46 }, operationsText: { color: "#0F766E", fontSize: 12, fontWeight: "800" }, disclosure: { alignItems: "flex-start", backgroundColor: "#E7F6F1", borderColor: "#B7DED4", borderRadius: 14, borderWidth: 1, gap: 8, marginTop: 12, padding: 11 }, disclosureText: { color: "#176458", flex: 1, fontSize: 10, fontWeight: "700", lineHeight: 16 }, listTitle: { color: "#14201F", fontSize: 16, fontWeight: "800", marginBottom: 10, marginTop: 20 }, rowCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 18, borderWidth: 1, padding: 14 }, cardTop: { alignItems: "flex-start", gap: 10 }, actionIcon: { alignItems: "center", borderRadius: 13, height: 40, justifyContent: "center", width: 40 }, productName: { color: "#14201F", fontSize: 14, fontWeight: "800", lineHeight: 20 }, secondary: { color: "#6C827D", fontSize: 10, marginTop: 3 }, statusPill: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 4 }, statusText: { fontSize: 9, fontWeight: "800" }, transition: { alignItems: "center", backgroundColor: "#F7FAF9", borderRadius: 10, justifyContent: "space-between", marginTop: 12, padding: 9 }, transitionText: { color: "#20403A", flex: 1, fontSize: 11, fontWeight: "800" }, requestText: { color: "#6C827D", fontSize: 10, marginStart: 8 }, footer: { alignItems: "center", justifyContent: "space-between", marginTop: 12 }, footerText: { color: "#63847D", fontSize: 10, fontWeight: "700" }, separator: { height: 9 }, empty: { alignItems: "center", backgroundColor: "#F7FBFA", borderColor: "#DDE7E4", borderRadius: 21, borderStyle: "dashed", borderWidth: 1, marginTop: 2, padding: 26 }, emptyTitle: { color: "#14201F", fontSize: 14, fontWeight: "800", marginTop: 10 }, emptyText: { color: "#63847D", fontSize: 11, lineHeight: 18, marginTop: 5, textAlign: "center" }, pressed: { opacity: 0.72 }, disabled: { opacity: 0.55 },
});
