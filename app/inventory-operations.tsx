import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppHeader, DemoBanner, StatusPill } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useApp } from "@/lib/app-context";
import { haptic } from "@/lib/haptics";
import { registerForInventoryReplenishmentPushNotifications } from "@/lib/inventory-replenishment-notifications";
import { trpc } from "@/lib/trpc";

function wholeNumber(value: string) {
  const parsed = Number(value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export default function InventoryOperationsScreen() {
  return <SubscriptionGuard><InventoryOperationsContent /></SubscriptionGuard>;
}

function InventoryOperationsContent() {
  const { isRTL } = useApp();
  const ar = isRTL;
  const [branchId, setBranchId] = useState<number>();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [thresholds, setThresholds] = useState<Record<string, { minimum: string; target: string }>>({});
  const [receivedQuantities, setReceivedQuantities] = useState<Record<number, string>>({});
  const [showThresholds, setShowThresholds] = useState(false);

  const branches = trpc.branches.list.useQuery(undefined, { retry: false });
  const balances = trpc.inventory.balances.useQuery(branchId ? { branchId } : undefined, { enabled: Boolean(branchId), retry: false });
  const counts = trpc.inventory.counts.list.useQuery(branchId ? { branchId } : undefined, { enabled: Boolean(branchId), retry: false });
  const replenishments = trpc.inventory.replenishments.list.useQuery(branchId ? { branchId } : undefined, { enabled: Boolean(branchId), retry: false });
  const replenishmentAudit = trpc.inventory.replenishments.audit.useQuery(branchId ? { branchId } : undefined, { enabled: Boolean(branchId), retry: false });
  const replenishmentNotifications = trpc.inventory.replenishmentNotifications.inbox.useQuery(undefined, { retry: false });
  const notificationDevices = trpc.inventory.replenishmentNotifications.deviceStatus.useQuery(undefined, { retry: false });
  const createCount = trpc.inventory.counts.create.useMutation({
    onSuccess: async () => {
      await counts.refetch();
      haptic.success();
      Alert.alert(ar ? "تم إرسال الجرد" : "Count submitted", ar ? "سُجلت الكميات وأصبح الجرد بانتظار اعتماد مالك النظام." : "The quantities were recorded and the count is waiting for merchant-owner approval.");
    },
  });
  const approveCount = trpc.inventory.counts.approve.useMutation({
    onSuccess: async () => {
      await Promise.all([counts.refetch(), balances.refetch(), replenishments.refetch()]);
      haptic.success();
      Alert.alert(ar ? "تم اعتماد التسوية" : "Adjustment approved", ar ? "تم تحديث رصيد الفرع وحفظ الفروقات في سجل التدقيق." : "The branch balance was updated and the variance was saved in the audit ledger.");
    },
  });
  const saveRule = trpc.inventory.reorderRules.upsert.useMutation({
    onSuccess: async () => {
      await replenishments.refetch();
      haptic.success();
    },
  });
  const changeRequest = trpc.inventory.replenishments.changeStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([replenishments.refetch(), replenishmentAudit.refetch()]);
      haptic.success();
    },
  });
  const registerNotificationDevice = trpc.inventory.replenishmentNotifications.registerDevice.useMutation({
    onSuccess: async () => {
      await notificationDevices.refetch();
      haptic.success();
    },
  });
  const markNotificationRead = trpc.inventory.replenishmentNotifications.markRead.useMutation({
    onSuccess: async () => { await replenishmentNotifications.refetch(); },
  });

  useEffect(() => {
    if (!branchId && branches.data?.length) setBranchId(branches.data[0].id);
  }, [branchId, branches.data]);

  useEffect(() => {
    if (!balances.data) return;
    const nextCounted: Record<string, string> = {};
    const nextThresholds: Record<string, { minimum: string; target: string }> = {};
    for (const item of balances.data) {
      nextCounted[item.productKey] = String(item.quantity);
      nextThresholds[item.productKey] = { minimum: "0", target: String(Math.max(1, item.quantity)) };
    }
    setCounted(nextCounted);
    setThresholds(nextThresholds);
  }, [branchId, balances.data]);

  const selectedBranch = branches.data?.find((branch) => branch.id === branchId);
  const countVariance = useMemo(() => (balances.data ?? []).reduce((total, item) => {
    const value = wholeNumber(counted[item.productKey] ?? "");
    return value === undefined ? total : total + value - item.quantity;
  }, 0), [balances.data, counted]);

  const submitCount = async () => {
    if (!branchId || !balances.data?.length) return;
    const lines = balances.data.map((item) => ({
      productKey: item.productKey,
      productName: item.productName,
      productSku: item.productSku ?? undefined,
      systemQuantity: item.quantity,
      countedQuantity: wholeNumber(counted[item.productKey] ?? ""),
    }));
    if (lines.some((line) => line.countedQuantity === undefined)) {
      Alert.alert(ar ? "راجع الكميات" : "Review quantities", ar ? "أدخل أرقامًا صحيحة غير سالبة لكل منتج." : "Enter a valid non-negative number for every product.");
      return;
    }
    const validLines = lines.filter((line): line is typeof line & { countedQuantity: number } => line.countedQuantity !== undefined);
    try {
      await createCount.mutateAsync({ branchId, submit: true, lines: validLines });
    } catch (error) {
      Alert.alert(ar ? "تعذر إرسال الجرد" : "Could not submit count", error instanceof Error ? error.message : (ar ? "حاول مرة أخرى." : "Try again."));
    }
  };

  const saveThreshold = async (item: NonNullable<typeof balances.data>[number]) => {
    if (!branchId) return;
    const draft = thresholds[item.productKey] ?? { minimum: "0", target: "0" };
    const minimumQuantity = wholeNumber(draft.minimum);
    const targetQuantity = wholeNumber(draft.target);
    if (minimumQuantity === undefined || targetQuantity === undefined || targetQuantity <= minimumQuantity) {
      Alert.alert(ar ? "راجع حد إعادة التزويد" : "Review reorder threshold", ar ? "يجب أن يكون الهدف أكبر من الحد الأدنى." : "The target quantity must be greater than the minimum.");
      return;
    }
    try {
      await saveRule.mutateAsync({ branchId, productKey: item.productKey, productName: item.productName, productSku: item.productSku ?? undefined, minimumQuantity, targetQuantity, isActive: true });
      Alert.alert(ar ? "تم حفظ الحد" : "Threshold saved", ar ? "سيُنشأ اقتراح إعادة تزويد عند وصول الرصيد إلى الحد الأدنى أو أقل." : "A replenishment suggestion will be created when stock reaches or falls below the minimum.");
    } catch (error) {
      Alert.alert(ar ? "تعذر حفظ الحد" : "Could not save threshold", error instanceof Error ? error.message : (ar ? "حاول مرة أخرى." : "Try again."));
    }
  };

  const enableOwnerNotifications = async () => {
    const result = await registerForInventoryReplenishmentPushNotifications();
    if (result.status !== "registered") {
      Alert.alert(ar ? "تعذر تفعيل إشعار الهاتف" : "Phone notification unavailable", ar ? "تبقى التنبيهات محفوظة داخل التطبيق. لتفعيل إشعار الهاتف استخدم نسخة Android أو iOS على جهاز فعلي واسمح بالإشعارات.\n\n" + result.reason : `Alerts remain available inside the app. To enable phone alerts, use an Android or iOS build on a physical device and allow notifications.\n\n${result.reason}`);
      return;
    }
    try {
      await registerNotificationDevice.mutateAsync({ expoToken: result.expoToken, platform: result.platform });
      Alert.alert(ar ? "تم تفعيل إشعارات إعادة التزويد" : "Replenishment alerts enabled", ar ? "سيصل إشعار فوري إليك عند إنشاء اقتراح إعادة تزويد لأي فرع." : "You will receive an instant alert when a replenishment suggestion is created for any branch.");
    } catch (error) {
      Alert.alert(ar ? "تعذر حفظ الجهاز" : "Could not save device", error instanceof Error ? error.message : (ar ? "حاول مرة أخرى." : "Please try again."));
    }
  };

  const nextRequestAction = (status: string) => status === "suggested" ? "approved" : status === "approved" ? "ordered" : status === "ordered" ? "closed" : undefined;
  const requestLabel = (status: string) => status === "suggested" ? (ar ? "اعتماد الطلب" : "Approve request") : status === "approved" ? (ar ? "تسجيل كـ مطلوب" : "Mark ordered") : status === "ordered" ? (ar ? "إغلاق بعد التوريد" : "Close after delivery") : (ar ? "مغلق" : "Closed");
  const requestTone = (status: string) => status === "suggested" ? "warning" as const : status === "closed" || status === "dismissed" ? "neutral" as const : status === "ordered" ? "primary" as const : "success" as const;
  const auditByRequest = useMemo(() => new Map((replenishmentAudit.data ?? []).map((entry) => [entry.requestId, entry])), [replenishmentAudit.data]);
  const statusLabel = (status: string) => ({ suggested: ar ? "مقترح" : "Suggested", approved: ar ? "معتمد" : "Approved", ordered: ar ? "مطلوب" : "Ordered", closed: ar ? "مغلق" : "Closed", dismissed: ar ? "مرفوض" : "Dismissed" }[status] ?? status);
  const advanceRequest = async (request: NonNullable<typeof replenishments.data>[number], next: "approved" | "ordered" | "closed" | "dismissed") => {
    const rawReceived = receivedQuantities[request.id] ?? String(request.receivedQuantity ?? 0);
    const receivedQuantity = wholeNumber(rawReceived);
    if (next === "closed" && receivedQuantity === undefined) {
      Alert.alert(ar ? "أدخل الكمية المستلمة" : "Enter received quantity", ar ? "اكتب كمية صحيحة غير سالبة قبل إغلاق الطلب." : "Enter a valid non-negative quantity before closing the request.");
      return;
    }
    try {
      await changeRequest.mutateAsync({ requestId: request.id, status: next, receivedQuantity });
    } catch (error) {
      Alert.alert(ar ? "تعذر تحديث الطلب" : "Could not update request", error instanceof Error ? error.message : (ar ? "حاول مرة أخرى." : "Try again."));
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><MaterialIcons name={ar ? "arrow-forward" : "arrow-back"} size={22} color="#14201F" /></Pressable>
        <AppHeader title={ar ? "الجرد وإعادة التزويد" : "Stocktake & replenishment"} subtitle={ar ? "راجع كميات كل فرع، اعتمد الفروقات، وتابع طلبات إعادة التزويد دون تعديل صامت للمخزون." : "Count each branch, approve variances, and review replenishment requests without silent stock changes."} />
        <DemoBanner compact />

        <View style={styles.branchCard}>
          <View className={`flex-row items-center gap-3 ${ar ? "flex-row-reverse" : ""}`}>
            <View style={styles.iconCircle}><MaterialIcons name="store" size={21} color="#0F766E" /></View>
            <View className="flex-1"><Text className={`text-sm font-bold text-foreground ${ar ? "text-right" : "text-left"}`}>{ar ? "الفرع محل المراجعة" : "Branch under review"}</Text><Text className={`mt-1 text-xs text-muted ${ar ? "text-right" : "text-left"}`}>{selectedBranch?.name ?? (ar ? "اختر فرعًا" : "Choose a branch")}</Text></View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.branchChoices, ar && styles.reverseRow]}>
            {(branches.data ?? []).map((branch) => <Pressable key={branch.id} accessibilityRole="button" onPress={() => setBranchId(branch.id)} style={({ pressed }) => [styles.branchChoice, branch.id === branchId && styles.branchChoiceActive, pressed && styles.pressed]}><Text style={[styles.branchChoiceText, branch.id === branchId && styles.branchChoiceTextActive]}>{branch.name}</Text></Pressable>)}
          </ScrollView>
        </View>

        <View style={styles.sectionCard}>
          <View className={`flex-row items-center justify-between gap-3 ${ar ? "flex-row-reverse" : ""}`}>
            <View className="flex-1">
              <Text className={`text-base font-bold text-foreground ${ar ? "text-right" : "text-left"}`}>{ar ? "إشعارات إعادة التزويد" : "Replenishment alerts"}</Text>
              <Text className={`mt-1 text-xs leading-5 text-muted ${ar ? "text-right" : "text-left"}`}>{notificationDevices.data?.activeDevices ? (ar ? `إشعار الهاتف مفعّل على ${notificationDevices.data.activeDevices} جهاز` : `Phone alerts enabled on ${notificationDevices.data.activeDevices} device(s)`) : (ar ? "فعّل إشعار الهاتف لتصلك الاقتراحات فورًا." : "Enable phone alerts to receive suggestions instantly.")}</Text>
            </View>
            <MaterialIcons name="notifications-active" size={22} color="#0F766E" />
          </View>
          <Pressable disabled={registerNotificationDevice.isPending} accessibilityRole="button" onPress={() => void enableOwnerNotifications()} style={({ pressed }) => [styles.primaryButton, registerNotificationDevice.isPending && styles.disabled, pressed && styles.pressed]}>
            {registerNotificationDevice.isPending ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons name="notifications" size={18} color="#FFFFFF" />}
            <Text style={styles.primaryButtonText}>{registerNotificationDevice.isPending ? (ar ? "جارٍ التفعيل…" : "Enabling…") : (notificationDevices.data?.activeDevices ? (ar ? "تفعيل جهاز إضافي" : "Enable another device") : (ar ? "تفعيل إشعار الهاتف" : "Enable phone alerts"))}</Text>
          </Pressable>
          {(replenishmentNotifications.data ?? []).slice(0, 5).map((notification) => <Pressable key={notification.id} accessibilityRole="button" onPress={() => { if (!notification.readAt) void markNotificationRead.mutateAsync({ notificationId: notification.id }); }} style={({ pressed }) => [styles.inboxRow, !notification.readAt && styles.inboxUnread, pressed && styles.pressed]}><View className={`flex-row items-start gap-2 ${ar ? "flex-row-reverse" : ""}`}><MaterialIcons name={notification.readAt ? "notifications-none" : "notifications"} size={18} color="#0F766E" /><View className="flex-1"><Text className={`text-xs font-bold text-foreground ${ar ? "text-right" : "text-left"}`}>{notification.title}</Text><Text className={`mt-1 text-[11px] leading-5 text-muted ${ar ? "text-right" : "text-left"}`}>{notification.body}</Text></View></View></Pressable>)}
          {!replenishmentNotifications.isLoading && !replenishmentNotifications.data?.length ? <Text className={`mt-3 text-xs leading-5 text-muted ${ar ? "text-right" : "text-left"}`}>{ar ? "لا توجد اقتراحات جديدة حتى الآن." : "No replenishment suggestions yet."}</Text> : null}
        </View>

        <View style={styles.sectionCard}>
          <View className={`flex-row items-start justify-between gap-3 ${ar ? "flex-row-reverse" : ""}`}><View className="flex-1"><Text className={`text-base font-bold text-foreground ${ar ? "text-right" : "text-left"}`}>{ar ? "جرد دوري جديد" : "New periodic stocktake"}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${ar ? "text-right" : "text-left"}`}>{ar ? "عدّل الكميات الفعلية ثم أرسلها. لا يتغير الرصيد حتى يعتمد مالك النظام التسوية." : "Enter the physical count and submit it. Balances stay unchanged until the owner approves the adjustment."}</Text></View><View style={[styles.varianceBadge, countVariance === 0 ? styles.varianceNeutral : countVariance > 0 ? styles.variancePositive : styles.varianceNegative]}><Text style={styles.varianceText}>{countVariance > 0 ? "+" : ""}{countVariance}</Text><Text style={styles.varianceLabel}>{ar ? "فرق" : "variance"}</Text></View></View>
          {!branchId || balances.isLoading ? <View style={styles.loading}><ActivityIndicator color="#0F766E" /><Text style={styles.loadingText}>{ar ? "جارٍ تحميل رصيد الفرع…" : "Loading branch balance…"}</Text></View> : balances.data?.length ? <View style={styles.itemList}>{balances.data.map((item) => <View key={item.productKey} style={styles.itemRow}><View className="flex-1"><Text className={`text-xs font-bold text-foreground ${ar ? "text-right" : "text-left"}`}>{item.productName}</Text><Text className={`mt-1 text-[10px] text-muted ${ar ? "text-right" : "text-left"}`}>{ar ? `النظام: ${item.quantity}` : `System: ${item.quantity}`} · {item.productSku || "—"}</Text></View><TextInput value={counted[item.productKey] ?? ""} onChangeText={(value) => setCounted((current) => ({ ...current, [item.productKey]: value }))} keyboardType="number-pad" returnKeyType="done" style={styles.numberInput} /></View>)}</View> : <Text className={`mt-4 text-xs leading-5 text-muted ${ar ? "text-right" : "text-left"}`}>{ar ? "لا يوجد رصيد معتمد لهذا الفرع بعد. اعتمد استلامًا أو تحويلًا قبل بدء الجرد." : "This branch has no approved balance yet. Approve a receipt or transfer before starting a count."}</Text>}
          <Pressable disabled={createCount.isPending || !balances.data?.length} accessibilityRole="button" onPress={() => void submitCount()} style={({ pressed }) => [styles.primaryButton, (!balances.data?.length || createCount.isPending) && styles.disabled, pressed && styles.pressed]}>{createCount.isPending ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons name="send" size={18} color="#FFFFFF" />}<Text style={styles.primaryButtonText}>{ar ? "إرسال الجرد للاعتماد" : "Submit count for approval"}</Text></Pressable>
        </View>

        <View style={styles.sectionCard}>
          <View className={`flex-row items-center justify-between ${ar ? "flex-row-reverse" : ""}`}><View className="flex-1"><Text className={`text-base font-bold text-foreground ${ar ? "text-right" : "text-left"}`}>{ar ? "الجرد بانتظار الاعتماد" : "Counts awaiting approval"}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${ar ? "text-right" : "text-left"}`}>{ar ? "اعتماد التسوية يحدّث رصيد هذا الفرع ويحفظ سجل الفروقات." : "Approval updates this branch balance and preserves the variance audit trail."}</Text></View>{counts.data?.filter((item) => item.status === "submitted").length ? <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{counts.data.filter((item) => item.status === "submitted").length}</Text></View> : null}</View>
          {(counts.data ?? []).filter((item) => item.status === "submitted").map((session) => <View key={session.id} style={styles.requestCard}><View className={`flex-row items-start justify-between gap-2 ${ar ? "flex-row-reverse" : ""}`}><View className="flex-1"><Text className={`text-xs font-bold text-foreground ${ar ? "text-right" : "text-left"}`}>{ar ? `جرد #${session.id} · ${session.branch?.name ?? "الفرع"}` : `Count #${session.id} · ${session.branch?.name ?? "Branch"}`}</Text><Text className={`mt-1 text-[10px] text-muted ${ar ? "text-right" : "text-left"}`}>{session.lines.length} {ar ? "منتجًا" : "products"} · {new Date(session.createdAt).toLocaleDateString(ar ? "ar-SA" : "en-US")}</Text></View><StatusPill label={ar ? "بانتظار الاعتماد" : "Needs approval"} tone="warning" /></View><View style={styles.linePreview}>{session.lines.filter((line) => line.varianceQuantity !== 0).slice(0, 4).map((line) => <Text key={line.id} className={`text-[11px] leading-5 text-muted ${ar ? "text-right" : "text-left"}`}>• {line.productName}: {line.varianceQuantity > 0 ? "+" : ""}{line.varianceQuantity}</Text>)}</View><Pressable disabled={approveCount.isPending} accessibilityRole="button" onPress={() => void approveCount.mutateAsync({ sessionId: session.id })} style={({ pressed }) => [styles.approveButton, approveCount.isPending && styles.disabled, pressed && styles.pressed]}><MaterialIcons name="fact-check" size={17} color="#FFFFFF" /><Text style={styles.primaryButtonText}>{ar ? "اعتماد التسوية وتحديث الرصيد" : "Approve adjustment & update balance"}</Text></Pressable></View>)}
          {!counts.isLoading && !(counts.data ?? []).some((item) => item.status === "submitted") ? <Text className={`mt-4 text-xs leading-5 text-muted ${ar ? "text-right" : "text-left"}`}>{ar ? "لا توجد تسويات بانتظار الاعتماد." : "No stocktake adjustments are waiting for approval."}</Text> : null}
        </View>

        <View style={styles.sectionCard}>
          <Pressable accessibilityRole="button" onPress={() => setShowThresholds((value) => !value)} style={({ pressed }) => [styles.sectionToggle, pressed && styles.pressed]}><View className={`flex-row items-center justify-between ${ar ? "flex-row-reverse" : ""}`}><View className="flex-1"><Text className={`text-base font-bold text-foreground ${ar ? "text-right" : "text-left"}`}>{ar ? "حدود إعادة التزويد" : "Reorder thresholds"}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${ar ? "text-right" : "text-left"}`}>{ar ? "حدد الحد الأدنى والهدف لكل منتج في هذا الفرع." : "Set a minimum and target quantity for each product in this branch."}</Text></View><MaterialIcons name={showThresholds ? "expand-less" : "expand-more"} size={24} color="#0F766E" /></View></Pressable>
          {showThresholds ? <View style={styles.itemList}>{(balances.data ?? []).map((item) => { const draft = thresholds[item.productKey] ?? { minimum: "0", target: "1" }; return <View key={item.productKey} style={styles.thresholdCard}><View className="flex-1"><Text className={`text-xs font-bold text-foreground ${ar ? "text-right" : "text-left"}`}>{item.productName}</Text><Text className={`mt-1 text-[10px] text-muted ${ar ? "text-right" : "text-left"}`}>{ar ? `الرصيد الحالي: ${item.quantity}` : `Current balance: ${item.quantity}`}</Text></View><View style={styles.thresholdInputs}><TextInput value={draft.minimum} onChangeText={(value) => setThresholds((current) => ({ ...current, [item.productKey]: { ...draft, minimum: value } }))} keyboardType="number-pad" placeholder={ar ? "الحد" : "Min"} placeholderTextColor="#8AA09C" style={styles.smallInput} /><TextInput value={draft.target} onChangeText={(value) => setThresholds((current) => ({ ...current, [item.productKey]: { ...draft, target: value } }))} keyboardType="number-pad" placeholder={ar ? "الهدف" : "Target"} placeholderTextColor="#8AA09C" style={styles.smallInput} /><Pressable accessibilityRole="button" onPress={() => void saveThreshold(item)} style={({ pressed }) => [styles.saveSmall, pressed && styles.pressed]}><MaterialIcons name="save" size={16} color="#FFFFFF" /></Pressable></View></View>; })}</View> : null}
        </View>

        <View style={styles.sectionCard}><View className={`flex-row items-center justify-between ${ar ? "flex-row-reverse" : ""}`}><View className="flex-1"><Text className={`text-base font-bold text-foreground ${ar ? "text-right" : "text-left"}`}>{ar ? "طلبات إعادة التزويد" : "Replenishment requests"}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${ar ? "text-right" : "text-left"}`}>{ar ? "يُنشئ التطبيق اقتراحًا عند انخفاض الرصيد، ويبقى القرار بيدك." : "The app creates a suggestion when stock is low; the decision remains with you."}</Text></View><MaterialIcons name="autorenew" size={23} color="#0F766E" /></View>{(replenishments.data ?? []).map((request) => { const next = nextRequestAction(request.status); const lastAudit = auditByRequest.get(request.id); return <View key={request.id} style={styles.requestCard}><View className={`flex-row items-start justify-between gap-2 ${ar ? "flex-row-reverse" : ""}`}><View className="flex-1"><Text className={`text-xs font-bold text-foreground ${ar ? "text-right" : "text-left"}`}>{request.productName}</Text><Text className={`mt-1 text-[10px] text-muted ${ar ? "text-right" : "text-left"}`}>{ar ? `المتاح ${request.currentQuantity} · الحد ${request.minimumQuantity} · المطلوب ${request.suggestedQuantity} · المستلم ${request.receivedQuantity}` : `Current ${request.currentQuantity} · Minimum ${request.minimumQuantity} · Requested ${request.suggestedQuantity} · Received ${request.receivedQuantity}`}</Text></View><StatusPill label={request.status} tone={requestTone(request.status)} /></View>{request.status === "ordered" ? <View style={[styles.receivedRow, ar && styles.reverseRow]}><Text style={[styles.receivedLabel, ar ? styles.textRight : styles.textLeft]}>{ar ? "الكمية المستلمة عند الإغلاق" : "Received quantity at close"}</Text><TextInput value={receivedQuantities[request.id] ?? String(request.receivedQuantity ?? 0)} onChangeText={(value) => setReceivedQuantities((current) => ({ ...current, [request.id]: value }))} keyboardType="number-pad" returnKeyType="done" style={styles.receivedInput} /></View> : null}{lastAudit ? <Text className={`mt-2 text-[10px] leading-4 text-muted ${ar ? "text-right" : "text-left"}`}>{ar ? `آخر إجراء: ${statusLabel(lastAudit.fromStatus)} ← ${statusLabel(lastAudit.toStatus)} · ${new Date(lastAudit.createdAt).toLocaleString("ar-SA")}` : `Last action: ${statusLabel(lastAudit.fromStatus)} → ${statusLabel(lastAudit.toStatus)} · ${new Date(lastAudit.createdAt).toLocaleString("en-SA")}`}</Text> : null}{next ? <Pressable disabled={changeRequest.isPending} accessibilityRole="button" onPress={() => void advanceRequest(request, next as "approved" | "ordered" | "closed" | "dismissed")} style={({ pressed }) => [styles.secondaryButton, changeRequest.isPending && styles.disabled, pressed && styles.pressed]}><Text style={styles.secondaryButtonText}>{requestLabel(request.status)}</Text><MaterialIcons name={ar ? "arrow-back" : "arrow-forward"} size={16} color="#176458" /></Pressable> : null}</View>; })}{!replenishments.isLoading && !(replenishments.data ?? []).length ? <Text className={`mt-4 text-xs leading-5 text-muted ${ar ? "text-right" : "text-left"}`}>{ar ? "احفظ حدًا أدنى لمنتج حتى تبدأ الاقتراحات التلقائية عند انخفاض رصيده." : "Save a minimum threshold for a product to start automatic low-stock suggestions."}</Text> : null}</View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 34, paddingTop: 12 },
  backButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", marginBottom: 20, width: 44 },
  branchCard: { backgroundColor: "#EAF4F2", borderColor: "#B8DAD6", borderRadius: 22, borderWidth: 1, marginBottom: 14, padding: 16 },
  iconCircle: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, height: 42, justifyContent: "center", width: 42 },
  branchChoices: { gap: 8, paddingTop: 14 },
  reverseRow: { flexDirection: "row-reverse" },
  branchChoice: { backgroundColor: "#FFFFFF", borderColor: "#C6DDD9", borderRadius: 13, borderWidth: 1, minHeight: 40, justifyContent: "center", paddingHorizontal: 13 },
  branchChoiceActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" },
  branchChoiceText: { color: "#176458", fontSize: 12, fontWeight: "700" },
  branchChoiceTextActive: { color: "#FFFFFF" },
  sectionCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 22, borderWidth: 1, marginBottom: 14, padding: 16 },
  sectionToggle: { minHeight: 42 },
  varianceBadge: { alignItems: "center", borderRadius: 14, minWidth: 54, paddingHorizontal: 8, paddingVertical: 7 },
  varianceNeutral: { backgroundColor: "#F1F5F4" },
  variancePositive: { backgroundColor: "#E4F3EB" },
  varianceNegative: { backgroundColor: "#FBE7E7" },
  varianceText: { color: "#14201F", fontSize: 16, fontWeight: "800" },
  varianceLabel: { color: "#667A77", fontSize: 9, fontWeight: "700" },
  loading: { alignItems: "center", flexDirection: "row", gap: 9, paddingVertical: 22 },
  loadingText: { color: "#667A77", fontSize: 12 },
  itemList: { gap: 9, marginTop: 15 },
  itemRow: { alignItems: "center", backgroundColor: "#F7FAF9", borderRadius: 15, flexDirection: "row", gap: 10, paddingHorizontal: 11, paddingVertical: 10 },
  numberInput: { backgroundColor: "#FFFFFF", borderColor: "#B8DAD6", borderRadius: 10, borderWidth: 1, color: "#14201F", fontSize: 14, fontWeight: "800", minWidth: 62, paddingHorizontal: 9, paddingVertical: 8, textAlign: "center" },
  primaryButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 15, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 15, minHeight: 48, paddingHorizontal: 14 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  approveButton: { alignItems: "center", backgroundColor: "#176458", borderRadius: 13, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 12, minHeight: 44, paddingHorizontal: 12 },
  secondaryButton: { alignItems: "center", alignSelf: "flex-start", borderColor: "#B8DAD6", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 7, marginTop: 12, minHeight: 38, paddingHorizontal: 12 },
  secondaryButtonText: { color: "#176458", fontSize: 11, fontWeight: "800" },
  pendingBadge: { alignItems: "center", backgroundColor: "#FFF1D9", borderRadius: 11, justifyContent: "center", minWidth: 26, paddingHorizontal: 8, paddingVertical: 5 },
  pendingBadgeText: { color: "#A85E00", fontSize: 11, fontWeight: "800" },
  requestCard: { backgroundColor: "#F7FAF9", borderColor: "#E2ECE9", borderRadius: 16, borderWidth: 1, marginTop: 12, padding: 12 },
  inboxRow: { borderRadius: 13, marginTop: 9, padding: 9 },
  inboxUnread: { backgroundColor: "#EAF4F2" },
  linePreview: { marginTop: 8 },
  receivedRow: { alignItems: "center", backgroundColor: "#FFF8ED", borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "space-between", marginTop: 10, padding: 9 },
  receivedLabel: { color: "#7A4D00", flex: 1, fontSize: 10, fontWeight: "700" },
  receivedInput: { backgroundColor: "#FFFFFF", borderColor: "#F4C98A", borderRadius: 9, borderWidth: 1, color: "#14201F", fontSize: 13, fontWeight: "800", minWidth: 58, paddingHorizontal: 8, paddingVertical: 7, textAlign: "center" },
  textRight: { textAlign: "right" },
  textLeft: { textAlign: "left" },
  thresholdCard: { alignItems: "center", backgroundColor: "#F7FAF9", borderRadius: 15, flexDirection: "row", gap: 8, padding: 10 },
  thresholdInputs: { alignItems: "center", flexDirection: "row", gap: 5 },
  smallInput: { backgroundColor: "#FFFFFF", borderColor: "#C6DDD9", borderRadius: 9, borderWidth: 1, color: "#14201F", fontSize: 11, minWidth: 42, paddingHorizontal: 5, paddingVertical: 7, textAlign: "center" },
  saveSmall: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 9, height: 34, justifyContent: "center", width: 34 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
