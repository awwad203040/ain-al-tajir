import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppHeader, DemoBanner, SectionTitle, StatusPill } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { filterInventory } from "@/lib/business-logic";
import { inventoryItems, type InventoryItem } from "@/lib/demo-data";
import { haptic } from "@/lib/haptics";
import { trpc } from "@/lib/trpc";

type Filter = "all" | InventoryItem["status"];

export default function InventoryScreen() {
  const { t, isRTL, language } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t("all") },
    { id: "low", label: t("lowStock") },
    { id: "excess", label: t("excessStock") },
    { id: "healthy", label: t("healthy") },
  ];
  const data = useMemo(() => filterInventory(inventoryItems, query, filter, language), [filter, language, query]);
  const balances = trpc.inventory.balances.useQuery(undefined, { retry: false });
  const pendingReceipts = trpc.inventory.pendingReceipts.useQuery(undefined, { retry: false });
  const approveReceipt = trpc.inventory.approveReceipt.useMutation({
    onSuccess: async (result) => {
      await Promise.all([balances.refetch(), pendingReceipts.refetch()]);
      haptic.success();
      Alert.alert(
        isRTL ? "تم تحديث المخزون" : "Inventory updated",
        isRTL ? `تمت إضافة ${result.posting.quantityPosted} وحدة معتمدة إلى سجل المخزون.` : `${result.posting.quantityPosted} approved unit(s) were added to the inventory ledger.`,
      );
    },
  });
  const approvedUnits = balances.data?.reduce((total, item) => total + item.quantity, 0) ?? 0;

  const statusTone = (status: InventoryItem["status"]) => status === "low" ? "error" : status === "excess" ? "warning" : "success";

  const reviewReceipt = (receipt: NonNullable<typeof pendingReceipts.data>[number]) => {
    const received = receipt.lines.reduce((total, item) => total + item.receiptLine.receivedQuantity, 0);
    const rejected = receipt.lines.reduce((total, item) => total + item.receiptLine.rejectedQuantity, 0);
    const lines = receipt.lines.map((item) => `${item.purchaseOrderLine?.productName ?? (isRTL ? "منتج غير متاح" : "Unavailable product")}: +${item.receiptLine.receivedQuantity}${item.receiptLine.rejectedQuantity ? ` · ${isRTL ? "مرفوض" : "Rejected"} ${item.receiptLine.rejectedQuantity}` : ""}`).join("\n");
    Alert.alert(
      isRTL ? "اعتماد تحديث المخزون" : "Approve inventory update",
      isRTL
        ? `راجع الكميات قبل الاعتماد:\n${lines}\n\nسيتم إضافة ${received} وحدة فقط إلى المخزون. الكمية المرفوضة (${rejected}) لن تُضاف. لا يمكن تكرار الترحيل.`
        : `Review quantities before approval:\n${lines}\n\nOnly ${received} received unit(s) will be added to inventory. ${rejected} rejected unit(s) will not be added. This posting cannot be repeated.`,
      [
        { text: isRTL ? "رجوع" : "Back", style: "cancel" },
        { text: isRTL ? "اعتماد وإضافة" : "Approve & add", style: "default", onPress: () => void approveReceipt.mutateAsync({ receiptEventId: receipt.id }).catch((error) => Alert.alert(isRTL ? "تعذر تحديث المخزون" : "Could not update inventory", error instanceof Error && error.message ? error.message : (isRTL ? "حاول مرة أخرى بعد مراجعة السجل." : "Try again after reviewing the receipt."))) },
      ],
    );
  };

  return (
    <ScreenContainer className="px-4">
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <AppHeader title={t("inventory")} subtitle={isRTL ? "توقع النفاد، اكتشف الزيادة، واطلب في الوقت المناسب." : "Predict stockouts, detect excess, and reorder on time."} />
            <DemoBanner compact />
            <View style={styles.actualInventoryCard}>
              <View className={`flex-row items-center justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                <View className="flex-1"><Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "رصيد المخزون المعتمد" : "Approved inventory balance"}</Text><Text className={`mt-1 text-[11px] leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "يعرض الاستلامات المعتمدة وتحويلات الفروع التي اعتُمد استلامها فقط." : "Shows approved supplier receipts and branch transfers whose target receipt was approved."}</Text></View>
                <View style={styles.approvedCount}><Text style={styles.approvedCountValue}>{balances.isLoading ? "…" : approvedUnits}</Text><Text style={styles.approvedCountLabel}>{isRTL ? "وحدة" : "units"}</Text></View>
              </View>
              {balances.isLoading ? <View style={styles.inlineLoading}><ActivityIndicator size="small" color="#0F766E" /><Text style={styles.inlineLoadingText}>{isRTL ? "جارٍ تحميل الرصيد المعتمد…" : "Loading approved balances…"}</Text></View> : balances.data?.length ? <View style={styles.balanceList}>{balances.data.slice(0, 5).map((item) => <View key={item.id} style={styles.balanceRow}><View className="flex-1"><Text className={`text-xs font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{item.productName}</Text><Text className={`mt-0.5 text-[10px] text-muted ${isRTL ? "text-right" : "text-left"}`}>{item.productSku || "—"}</Text></View><Text style={styles.balanceQuantity}>+{item.quantity}</Text></View>)}</View> : <Text className={`mt-3 text-[11px] leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "لا يوجد رصيد مؤكد من استلامات الموردين حتى الآن." : "No supplier-receipt quantity has been approved yet."}</Text>}
              <Pressable accessibilityRole="button" onPress={() => router.push("/branch-transfers" as never)} style={({ pressed }) => [styles.transferLink, pressed && styles.pressed]}><MaterialIcons name="swap-horiz" size={17} color="#176458" /><Text style={styles.transferLinkText}>{isRTL ? "تحويل المخزون بين الفروع" : "Transfer inventory between branches"}</Text></Pressable>
            </View>
            <View style={styles.receiptReviewHeader}><View className={`flex-row items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}><View className="flex-1"><Text className={`text-[15px] font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "مراجعة استلامات الموردين" : "Review supplier receipts"}</Text><Text className={`mt-1 text-[11px] leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "تظهر الكميات هنا قبل إضافتها إلى المخزون." : "Quantities remain here until you add them to inventory."}</Text></View>{pendingReceipts.data?.length ? <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{pendingReceipts.data.length}</Text></View> : null}</View></View>
            {pendingReceipts.isLoading ? <View style={styles.inlineLoading}><ActivityIndicator size="small" color="#0F766E" /><Text style={styles.inlineLoadingText}>{isRTL ? "جارٍ تحميل الاستلامات…" : "Loading receipts…"}</Text></View> : pendingReceipts.data?.length ? <View style={styles.receiptList}>{pendingReceipts.data.map((receipt) => { const received = receipt.lines.reduce((total, item) => total + item.receiptLine.receivedQuantity, 0); const rejected = receipt.lines.reduce((total, item) => total + item.receiptLine.rejectedQuantity, 0); return <View key={receipt.id} style={styles.receiptCard}><View className={`flex-row items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}><View className="flex-1"><Text className={`text-xs font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? `استلام أمر شراء #${receipt.purchaseOrderId}` : `Purchase order receipt #${receipt.purchaseOrderId}`}</Text><Text className={`mt-1 text-[10px] text-muted ${isRTL ? "text-right" : "text-left"}`}>{new Date(receipt.createdAt).toLocaleDateString(isRTL ? "ar-SA" : "en-US")}{receipt.note ? ` · ${receipt.note}` : ""}</Text></View><View style={styles.reviewPill}><Text style={styles.reviewPillText}>{isRTL ? "بانتظار المراجعة" : "Needs review"}</Text></View></View><View style={styles.receiptQuantities}><Text style={styles.receivedQuantity}>{isRTL ? `المستلم: ${received}` : `Received: ${received}`}</Text>{rejected ? <Text style={styles.rejectedQuantity}>{isRTL ? `المرفوض: ${rejected}` : `Rejected: ${rejected}`}</Text> : null}</View><View style={styles.receiptProducts}>{receipt.lines.map((item) => <Text key={item.receiptLine.lineId} className={`text-[10px] leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>• {item.purchaseOrderLine?.productName ?? (isRTL ? "منتج غير متاح" : "Unavailable product")} — +{item.receiptLine.receivedQuantity}</Text>)}</View><Pressable disabled={approveReceipt.isPending} accessibilityRole="button" onPress={() => reviewReceipt(receipt)} style={({ pressed }) => [styles.approveButton, approveReceipt.isPending && styles.disabled, pressed && styles.pressed]}>{approveReceipt.isPending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialIcons name="fact-check" size={17} color="#FFFFFF" />}<Text style={styles.approveButtonText}>{isRTL ? "مراجعة واعتماد إضافة المخزون" : "Review & approve inventory addition"}</Text></Pressable></View>; })}</View> : <View style={styles.noReceipts}><MaterialIcons name="fact-check" size={18} color="#176458" /><Text className={`flex-1 text-[11px] leading-5 text-[#176458] ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "لا توجد استلامات معلّقة للمراجعة. ستظهر هنا بعد تسجيل الاستلام من أمر شراء معتمد." : "No receipts need review. New receipts will appear here after recording an approved purchase order delivery."}</Text></View>}
            <View style={styles.searchWrap}>
              <MaterialIcons name="search" size={22} color="#667A77" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("searchProduct")}
                placeholderTextColor="#8AA09C"
                returnKeyType="done"
                style={[styles.searchInput, isRTL ? styles.textRight : styles.textLeft]}
              />
              {query ? <Pressable accessibilityRole="button" onPress={() => setQuery("")}><MaterialIcons name="cancel" size={19} color="#8AA09C" /></Pressable> : null}
            </View>
            <FlatList
              horizontal
              data={filters}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.filterRow, isRTL && styles.reverseRow]}
              renderItem={({ item }) => (
                <Pressable onPress={() => setFilter(item.id)} style={[styles.filterChip, filter === item.id && styles.filterChipActive]}>
                  <Text className={`text-sm font-semibold ${filter === item.id ? "text-white" : "text-muted"}`}>{item.label}</Text>
                </Pressable>
              )}
            />

            <View className="mb-7 flex-row justify-between gap-2">
              {[
                { value: "12", label: t("lowStock"), color: "#C73737", bg: "#FBE7E7" },
                { value: "8", label: t("excessStock"), color: "#D97706", bg: "#FFF1D9" },
                { value: "1,228", label: t("healthy"), color: "#16855B", bg: "#E4F3EB" },
              ].map((item) => (
                <View key={item.label} style={[styles.healthCard, { backgroundColor: item.bg }]}>
                  <Text style={{ color: item.color, fontSize: 20, fontWeight: "800" }}>{item.value}</Text>
                  <Text style={{ color: item.color, fontSize: 10, fontWeight: "700", marginTop: 2 }}>{item.label}</Text>
                </View>
              ))}
            </View>
            <SectionTitle title={t("productsAtRisk")} subtitle={isRTL ? `${data.length} منتجات حسب عوامل التصفية` : `${data.length} products match your filters`} />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.productCard, pressed && styles.pressed]}>
            <View className={`flex-row items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-background"><MaterialIcons name="inventory-2" size={23} color="#0F766E" /></View>
              <View className="flex-1">
                <View className={`flex-row items-start justify-between gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <View className="flex-1">
                    <Text className={`text-[15px] font-bold leading-6 text-foreground ${isRTL ? "text-right" : "text-left"}`}>{item.name[language]}</Text>
                    <Text className={`mt-0.5 text-[11px] text-muted ${isRTL ? "text-right" : "text-left"}`}>{item.sku}</Text>
                  </View>
                  <StatusPill label={t(item.status === "low" ? "lowStock" : item.status === "excess" ? "excessStock" : "healthy")} tone={statusTone(item.status)} />
                </View>
                <View className={`mt-4 flex-row justify-between rounded-2xl bg-background px-3 py-2.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <View><Text className={`text-[10px] text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "المتوفر" : "On hand"}</Text><Text className={`mt-1 text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{item.quantity}</Text></View>
                  <View><Text className={`text-[10px] text-muted ${isRTL ? "text-right" : "text-left"}`}>{t("dailySales")}</Text><Text className={`mt-1 text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{item.dailySales}</Text></View>
                  <View><Text className={`text-[10px] text-muted ${isRTL ? "text-right" : "text-left"}`}>{t("daysCoverage")}</Text><Text className={`mt-1 text-sm font-bold ${item.coverageDays <= 5 ? "text-error" : "text-foreground"} ${isRTL ? "text-right" : "text-left"}`}>{item.coverageDays}</Text></View>
                </View>
                {item.status === "low" ? (
                  <View className={`mt-3 flex-row items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <MaterialIcons name="auto-graph" size={17} color="#3F5DA8" />
                    <Text className={`flex-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>
                      {isRTL ? `توقع: الطلب يرتفع ${item.trend}%، يوصى بطلب ${Math.max(60, item.dailySales * 10)} قطعة.` : `Forecast: demand is up ${item.trend}%; consider ordering ${Math.max(60, item.dailySales * 10)} units.`}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<View className="items-center rounded-3xl border border-dashed border-border p-8"><MaterialIcons name="search-off" size={34} color="#8AA09C" /><Text className="mt-3 text-sm font-semibold text-muted">{isRTL ? "لا توجد منتجات مطابقة" : "No matching products"}</Text></View>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24, paddingTop: 12 },
  searchWrap: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 17, borderWidth: 1, flexDirection: "row", marginBottom: 13, paddingHorizontal: 15 },
  searchInput: { color: "#14201F", flex: 1, fontSize: 15, minHeight: 52, paddingHorizontal: 10 },
  textRight: { textAlign: "right" },
  textLeft: { textAlign: "left" },
  filterRow: { gap: 8, paddingBottom: 18 },
  reverseRow: { flexDirection: "row-reverse" },
  filterChip: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: 16 },
  filterChipActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" },
  healthCard: { alignItems: "center", borderRadius: 17, flex: 1, justifyContent: "center", minHeight: 76 },
  actualInventoryCard: { backgroundColor: "#FFFFFF", borderColor: "#B7DED4", borderRadius: 20, borderWidth: 1, marginBottom: 14, padding: 14 },
  approvedCount: { alignItems: "center", backgroundColor: "#E7F6F1", borderRadius: 14, minWidth: 56, paddingHorizontal: 10, paddingVertical: 8 },
  approvedCountValue: { color: "#176458", fontSize: 18, fontWeight: "800" },
  approvedCountLabel: { color: "#176458", fontSize: 9, fontWeight: "700", marginTop: 1 },
  inlineLoading: { alignItems: "center", flexDirection: "row", gap: 7, marginTop: 12 },
  inlineLoadingText: { color: "#63847D", fontSize: 11, fontWeight: "600" },
  balanceList: { borderTopColor: "#E8EFED", borderTopWidth: 1, marginTop: 11, paddingTop: 4 },
  balanceRow: { alignItems: "center", borderBottomColor: "#EEF2F1", borderBottomWidth: 1, flexDirection: "row", minHeight: 42 },
  balanceQuantity: { color: "#16855B", fontSize: 14, fontWeight: "800" },
  transferLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 5, marginTop: 12, minHeight: 30, paddingHorizontal: 2 },
  transferLinkText: { color: "#176458", fontSize: 11, fontWeight: "800" },
  receiptReviewHeader: { marginBottom: 9, marginTop: 2 },
  pendingBadge: { alignItems: "center", backgroundColor: "#FFF1D9", borderRadius: 12, justifyContent: "center", minHeight: 25, minWidth: 25, paddingHorizontal: 7 },
  pendingBadgeText: { color: "#9A5B00", fontSize: 11, fontWeight: "800" },
  receiptList: { gap: 9, marginBottom: 17 },
  receiptCard: { backgroundColor: "#FFFFFF", borderColor: "#F0D6A8", borderRadius: 18, borderWidth: 1, padding: 13 },
  reviewPill: { backgroundColor: "#FFF1D9", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  reviewPillText: { color: "#9A5B00", fontSize: 9, fontWeight: "800" },
  receiptQuantities: { flexDirection: "row", gap: 12, marginTop: 10 },
  receivedQuantity: { color: "#16855B", fontSize: 11, fontWeight: "800" },
  rejectedQuantity: { color: "#C73737", fontSize: 11, fontWeight: "800" },
  receiptProducts: { backgroundColor: "#F8FAF9", borderRadius: 10, marginTop: 8, paddingHorizontal: 9, paddingVertical: 7 },
  approveButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 11, flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 11, minHeight: 40, paddingHorizontal: 10 },
  approveButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  noReceipts: { alignItems: "flex-start", backgroundColor: "#E7F6F1", borderColor: "#B7DED4", borderRadius: 15, borderWidth: 1, flexDirection: "row", gap: 8, marginBottom: 16, padding: 12 },
  disabled: { opacity: 0.55 },
  productCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 21, borderWidth: 1, padding: 15 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  separator: { height: 12 },
});
