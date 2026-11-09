import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useApp } from "@/lib/app-context";
import { haptic } from "@/lib/haptics";
import { registerForBranchTransferPushNotifications } from "@/lib/branch-notifications";
import { trpc } from "@/lib/trpc";

type QuantityDraft = Record<string, string>;
type TransferRecord = {
  id: number;
  status: "in_transit" | "received" | "canceled";
  note: string | null;
  cancellationReason?: string | null;
  canceledAt?: Date | string | null;
  sourceBranch?: { name: string };
  targetBranch?: { name: string };
  lines: { id: number; productName: string; quantity: number }[];
};

const statusCopy: Record<string, { ar: string; en: string; tone: "warning" | "success" | "neutral" }> = {
  in_transit: { ar: "قيد النقل", en: "In transit", tone: "warning" },
  received: { ar: "تم استلامه", en: "Received", tone: "success" },
  canceled: { ar: "ملغي", en: "Canceled", tone: "neutral" },
};

export default function BranchTransfersScreen() {
  return <SubscriptionGuard allowBranchManager><BranchTransfersContent /></SubscriptionGuard>;
}

function BranchTransfersContent() {
  const { isRTL, language } = useApp();
  const ar = language === "ar";
  const account = trpc.access.status.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const isBranchManager = account.data?.access.kind === "branch_manager";
  const accessReady = !account.isLoading;
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [branchCity, setBranchCity] = useState("");
  const [sourceBranchId, setSourceBranchId] = useState<number>();
  const [targetBranchId, setTargetBranchId] = useState<number>();
  const [managerBranchId, setManagerBranchId] = useState<number>();
  const [managerEmail, setManagerEmail] = useState("");
  const [quantityDraft, setQuantityDraft] = useState<QuantityDraft>({});
  const [note, setNote] = useState("");
  const [cancellationTransferId, setCancellationTransferId] = useState<number>();
  const [cancellationReason, setCancellationReason] = useState("");
  const [managerReceivedQuantities, setManagerReceivedQuantities] = useState<Record<number, string>>({});

  const branches = trpc.branches.list.useQuery(undefined, { enabled: accessReady && !isBranchManager, retry: false });
  const managerAssignments = trpc.branches.managers.list.useQuery(undefined, { enabled: accessReady && !isBranchManager, retry: false });
  const ownerTransfers = trpc.branchTransfers.list.useQuery(undefined, { enabled: accessReady && !isBranchManager, retry: false });
  const incomingTransfers = trpc.branchTransfers.incoming.useQuery(undefined, { enabled: accessReady && isBranchManager, retry: false });
  const notificationInbox = trpc.branchNotifications.inbox.useQuery(undefined, { enabled: accessReady && isBranchManager, retry: false });
  const replenishmentNotificationInbox = trpc.branchNotifications.replenishmentInbox.useQuery(undefined, { enabled: accessReady && isBranchManager, retry: false });
  const managerReplenishments = trpc.branchNotifications.replenishments.useQuery(undefined, { enabled: accessReady && isBranchManager, retry: false });
  const notificationDevices = trpc.branchNotifications.deviceStatus.useQuery(undefined, { enabled: accessReady && isBranchManager, retry: false });
  const sourceBalances = trpc.inventory.balances.useQuery(sourceBranchId ? { branchId: sourceBranchId } : undefined, { enabled: accessReady && !isBranchManager && Boolean(sourceBranchId), retry: false });
  const createBranch = trpc.branches.create.useMutation({
    onSuccess: async () => {
      await branches.refetch();
      haptic.success();
      setBranchName("");
      setBranchCity("");
      setShowBranchForm(false);
    },
  });
  const assignManager = trpc.branches.managers.assign.useMutation({
    onSuccess: async () => {
      await managerAssignments.refetch();
      haptic.success();
      setManagerEmail("");
      Alert.alert(ar ? "تم تعيين مدير الفرع" : "Branch manager assigned", ar ? "أصبح هذا الحساب وحده قادرًا على اعتماد استلام التحويلات الواردة إلى الفرع المحدد." : "Only this account can now approve incoming transfer receipts for the selected branch.");
    },
  });
  const removeManager = trpc.branches.managers.remove.useMutation({
    onSuccess: async () => { await managerAssignments.refetch(); haptic.success(); },
  });
  const sendTransfer = trpc.branchTransfers.send.useMutation({
    onSuccess: async () => {
      await Promise.all([ownerTransfers.refetch(), sourceBalances.refetch()]);
      haptic.success();
      setQuantityDraft({});
      setNote("");
      Alert.alert(ar ? "تم إرسال التحويل" : "Transfer sent", ar ? "خُصمت الكميات من فرع المصدر وسُجلت كقيد النقل. لا يمكن للمالك اعتماد الاستلام؛ يجب أن يعتمده مدير الفرع المستهدف المعين." : "Stock was deducted from the source and recorded as in transit. The owner cannot approve receipt; the assigned target-branch manager must do so.");
    },
  });
  const cancelTransfer = trpc.branchTransfers.cancel.useMutation({
    onSuccess: async (result) => {
      await Promise.all([ownerTransfers.refetch(), sourceBalances.refetch()]);
      haptic.success();
      setCancellationTransferId(undefined);
      setCancellationReason("");
      const managerAlert = result.notification ? (ar ? " وتم إنشاء تنبيه لمدير الفرع المستهدف." : " A target-branch manager alert was created.") : "";
      Alert.alert(ar ? "تم إلغاء التحويل" : "Transfer canceled", ar ? `أُعيدت ${result.cancellation.quantityReturned} وحدة إلى رصيد فرع المصدر ولم تُضف إلى الفرع المستهدف.${managerAlert}` : `${result.cancellation.quantityReturned} unit(s) were returned to the source branch and were not added to the target branch.${managerAlert}`);
    },
  });
  const receiveTransfer = trpc.branchTransfers.receive.useMutation({
    onSuccess: async (result) => {
      await incomingTransfers.refetch();
      haptic.success();
      Alert.alert(ar ? "تم اعتماد الاستلام" : "Receipt approved", ar ? `أُضيفت ${result.receipt.quantityReceived} وحدة إلى رصيد فرعك المستهدف.` : `${result.receipt.quantityReceived} unit(s) were added to your target branch balance.`);
    },
  });
  const registerNotificationDevice = trpc.branchNotifications.registerDevice.useMutation({
    onSuccess: async () => {
      await notificationDevices.refetch();
      haptic.success();
    },
  });
  const markNotificationRead = trpc.branchNotifications.markRead.useMutation({
    onSuccess: async () => { await notificationInbox.refetch(); },
  });
  const markReplenishmentNotificationRead = trpc.branchNotifications.markReplenishmentRead.useMutation({
    onSuccess: async () => { await replenishmentNotificationInbox.refetch(); },
  });
  const changeManagerReplenishmentStatus = trpc.branchNotifications.changeReplenishmentStatus.useMutation({
    onSuccess: async (result) => {
      await Promise.all([managerReplenishments.refetch(), replenishmentNotificationInbox.refetch()]);
      haptic.success();
      Alert.alert(ar ? "تم تحديث طلب إعادة التزويد" : "Replenishment request updated", result.notification ? (ar ? "تم إرسال إشعار فوري إلى مالك النظام." : "An instant alert was sent to the system owner.") : (ar ? "تم تحديث حالة الطلب." : "The request status was updated."));
    },
  });

  useEffect(() => {
    if (isBranchManager || !branches.data?.length) return;
    const primary = branches.data.find((branch) => branch.isPrimary) ?? branches.data[0];
    if (!sourceBranchId) setSourceBranchId(primary.id);
    if (!targetBranchId) {
      const alternative = branches.data.find((branch) => branch.id !== primary.id);
      if (alternative) setTargetBranchId(alternative.id);
    }
    if (!managerBranchId) setManagerBranchId(primary.id);
  }, [branches.data, isBranchManager, managerBranchId, sourceBranchId, targetBranchId]);

  const sourceBranch = branches.data?.find((branch) => branch.id === sourceBranchId);
  const targetBranch = branches.data?.find((branch) => branch.id === targetBranchId);
  const targetHasManager = Boolean(targetBranchId && managerAssignments.data?.some((assignment) => assignment.branchId === targetBranchId));
  const requestedLines = useMemo(() => (sourceBalances.data ?? []).flatMap((balance) => {
    const quantity = wholeNumber(quantityDraft[balance.productKey] ?? "");
    return quantity ? [{ productKey: balance.productKey, quantity }] : [];
  }), [quantityDraft, sourceBalances.data]);
  const transferData = (isBranchManager ? incomingTransfers.data : ownerTransfers.data) as TransferRecord[] | undefined;
  const inTransit = useMemo(() => (transferData ?? []).filter((transfer) => transfer.status === "in_transit"), [transferData]);
  const completed = useMemo(() => (transferData ?? []).filter((transfer) => transfer.status !== "in_transit").slice(0, 10), [transferData]);
  const replenishmentAction = (status: string) => status === "suggested" ? "approved" as const : status === "ordered" ? "closed" as const : undefined;
  const replenishmentActionLabel = (status: string) => status === "suggested" ? (ar ? "اعتماد طلب التزويد" : "Approve replenishment") : (ar ? "إغلاق بعد التوريد" : "Close after delivery");
  const managerReceivedQuantity = (request: { id: number; receivedQuantity?: number | null }) => managerReceivedQuantities[request.id] ?? String(request.receivedQuantity ?? 0);

  const chooseSource = (branchId: number) => {
    setSourceBranchId(branchId);
    setQuantityDraft({});
    if (branchId === targetBranchId) setTargetBranchId(undefined);
  };

  const saveBranch = async () => {
    if (branchName.trim().length < 2) return Alert.alert(ar ? "أدخل اسم الفرع" : "Enter branch name", ar ? "اكتب اسمًا من حرفين على الأقل." : "Enter a name with at least two characters.");
    try { await createBranch.mutateAsync({ name: branchName.trim(), city: branchCity.trim() || undefined }); }
    catch (error) { Alert.alert(ar ? "تعذر إنشاء الفرع" : "Could not create branch", messageOf(error, ar, "تحقق من أن الاسم غير مكرر ثم حاول مرة أخرى.", "Check that the name is unique, then try again.")); }
  };

  const saveManager = async () => {
    if (!managerBranchId || !managerEmail.trim()) return Alert.alert(ar ? "أكمل بيانات المدير" : "Complete manager details", ar ? "اختر الفرع وأدخل البريد الإلكتروني للحساب المسجل للمدير." : "Choose a branch and enter the email of the manager's registered account.");
    try { await assignManager.mutateAsync({ branchId: managerBranchId, managerEmail: managerEmail.trim().toLowerCase() }); }
    catch (error) { Alert.alert(ar ? "تعذر تعيين المدير" : "Could not assign manager", messageOf(error, ar, "يجب أن يسجّل المدير الدخول مرة واحدة أولًا، وألا يكون مالك المتجر نفسه.", "The manager must sign in once first and cannot be the merchant owner.")); }
  };

  const confirmRemoveManager = (branchId: number, branchName: string) => {
    Alert.alert(ar ? "إزالة مدير الفرع" : "Remove branch manager", ar ? `سيُمنع المدير الحالي من اعتماد أي تحويل وارد إلى «${branchName}» فورًا.` : `The current manager will immediately lose permission to approve incoming transfers for “${branchName}”.`, [{ text: ar ? "رجوع" : "Back", style: "cancel" }, { text: ar ? "إزالة الصلاحية" : "Remove permission", style: "destructive", onPress: () => void removeManager.mutateAsync({ branchId }).catch((error) => Alert.alert(ar ? "تعذر إزالة الصلاحية" : "Could not remove permission", messageOf(error, ar, "حاول مرة أخرى.", "Please try again."))) }]);
  };

  const confirmSend = () => {
    if (!sourceBranch || !targetBranch) return Alert.alert(ar ? "اختر فرعين" : "Choose both branches", ar ? "اختر فرع المصدر وفرعًا آخر مستهدفًا قبل الإرسال." : "Choose a source and a different target branch before sending.");
    if (!targetHasManager) return Alert.alert(ar ? "عيّن مدير الفرع المستهدف" : "Assign the target branch manager", ar ? "لا يمكن إرسال التحويل قبل تعيين حساب مدير مسجل للفرع المستهدف، لأن المالك لا يستطيع اعتماد الاستلام." : "A registered manager account must be assigned to the target branch before sending, because the owner cannot approve receipt.");
    if (!requestedLines.length) return Alert.alert(ar ? "أدخل كميات التحويل" : "Enter transfer quantities", ar ? "أدخل كمية موجبة لمنتج واحد على الأقل من رصيد المصدر المؤكد." : "Enter a positive quantity for at least one confirmed source-stock item.");
    const invalid = (sourceBalances.data ?? []).some((balance) => { const raw = quantityDraft[balance.productKey]?.trim(); const quantity = wholeNumber(raw ?? ""); return Boolean(raw) && (!quantity || quantity > balance.quantity); });
    if (invalid) return Alert.alert(ar ? "راجع الكميات" : "Check quantities", ar ? "لا يمكن إرسال صفر أو كمية أكبر من الرصيد المؤكد في فرع المصدر." : "A transfer quantity must be positive and no greater than the confirmed source balance.");
    const summary = requestedLines.map((line) => `${sourceBalances.data?.find((balance) => balance.productKey === line.productKey)?.productName ?? line.productKey}: ${line.quantity}`).join("\n");
    Alert.alert(ar ? "تأكيد إرسال التحويل" : "Confirm transfer send", ar ? `سيُخصم الآن من «${sourceBranch.name}» ويصبح قيد النقل إلى «${targetBranch.name}». لن يضاف للهدف حتى يعتمد مدير الفرع المعين الاستلام.\n\n${summary}` : `Stock will be deducted now from “${sourceBranch.name}” and remain in transit to “${targetBranch.name}”. It will not be added until the assigned branch manager approves receipt.\n\n${summary}`, [{ text: ar ? "رجوع" : "Back", style: "cancel" }, { text: ar ? "إرسال التحويل" : "Send transfer", onPress: () => void sendTransfer.mutateAsync({ sourceBranchId: sourceBranch.id, targetBranchId: targetBranch.id, note: note.trim() || undefined, lines: requestedLines }).catch((error) => Alert.alert(ar ? "تعذر إرسال التحويل" : "Could not send transfer", messageOf(error, ar, "حاول مرة أخرى بعد مراجعة الرصيد والفروع.", "Try again after reviewing balances and branches."))) }]);
  };

  const confirmReceipt = (transfer: TransferRecord) => {
    const target = transfer.targetBranch?.name ?? (ar ? "فرعك المستهدف" : "your target branch");
    const quantity = transfer.lines.reduce((total, line) => total + line.quantity, 0);
    Alert.alert(ar ? "اعتماد استلام فرعك" : "Approve receipt for your branch", ar ? `أنت المدير المعين لـ«${target}». ستُضاف ${quantity} وحدة إلى رصيد فرعك الآن ولا يمكن اعتماد التحويل مرة ثانية.` : `You are the assigned manager for “${target}”. ${quantity} unit(s) will be added to your branch now and this transfer cannot be received again.`, [{ text: ar ? "رجوع" : "Back", style: "cancel" }, { text: ar ? "اعتماد الاستلام" : "Approve receipt", onPress: () => void receiveTransfer.mutateAsync({ transferId: transfer.id }).catch((error) => Alert.alert(ar ? "لا تملك صلاحية الاعتماد" : "Receipt permission denied", messageOf(error, ar, "يمكن لمدير الفرع المستهدف المعين فقط اعتماد هذا التحويل.", "Only the assigned target-branch manager can approve this transfer."))) }]);
  };

  const confirmCancellation = (transfer: TransferRecord) => {
    const reason = cancellationReason.trim().replace(/\s+/g, " ");
    if (reason.length < 3) return Alert.alert(ar ? "أدخل سبب الإلغاء" : "Enter a cancellation reason", ar ? "اكتب سببًا واضحًا من 3 أحرف على الأقل ليُحفظ في سجل التدقيق ويظهر لمدير الفرع." : "Enter a clear reason of at least 3 characters. It will be saved in the audit trail and shown to the branch manager.");
    const quantity = transfer.lines.reduce((total, line) => total + line.quantity, 0);
    Alert.alert(ar ? "إلغاء تحويل قيد النقل" : "Cancel in-transit transfer", ar ? `سيُلغى التحويل #${transfer.id} وتُعاد ${quantity} وحدة إلى رصيد فرع المصدر، وسيصل السبب إلى مدير الفرع المستهدف. لا يمكن التراجع عن الإلغاء.\n\nالسبب: ${reason}` : `Transfer #${transfer.id} will be canceled, ${quantity} unit(s) will return to the source branch, and the target manager will be notified of the reason. This cannot be undone.\n\nReason: ${reason}`, [{ text: ar ? "رجوع" : "Back", style: "cancel" }, { text: ar ? "إلغاء التحويل" : "Cancel transfer", style: "destructive", onPress: () => void cancelTransfer.mutateAsync({ transferId: transfer.id, cancellationReason: reason }).catch((error) => Alert.alert(ar ? "تعذر إلغاء التحويل" : "Could not cancel transfer", messageOf(error, ar, "قد يكون مدير الفرع قد اعتمد الاستلام بالفعل. حدّث القائمة ثم حاول مرة أخرى.", "The branch manager may have already approved receipt. Refresh the list and try again."))) }]);
  };

  const enableManagerNotifications = async () => {
    const result = await registerForBranchTransferPushNotifications();
    if (result.status !== "registered") {
      Alert.alert(ar ? "تعذر تفعيل إشعار الهاتف" : "Phone notification unavailable", ar ? "تبقى التنبيهات محفوظة داخل التطبيق. لاختيار إشعارات الهاتف، استخدم نسخة Android أو iOS على جهاز فعلي واسمح بالإشعارات.\n\n" + result.reason : `Alerts remain available inside the app. To receive phone notifications, use an Android or iOS build on a physical device and allow notifications.\n\n${result.reason}`);
      return;
    }
    try {
      await registerNotificationDevice.mutateAsync({ expoToken: result.expoToken, platform: result.platform });
      Alert.alert(ar ? "تم تفعيل إشعارات التحويل" : "Transfer notifications enabled", ar ? "سيصل إشعار فوري إلى هذا الجهاز عند إرسال تحويل جديد إلى فرعك." : "This device will receive an instant alert when a new transfer is sent to your branch.");
    } catch (error) {
      Alert.alert(ar ? "تعذر حفظ الجهاز" : "Could not save device", messageOf(error, ar, "حاول مرة أخرى.", "Please try again."));
    }
  };

  const direction = isRTL ? styles.rowReverse : styles.row;
  const textAlign = isRTL ? styles.right : styles.left;
  const transfersLoading = isBranchManager ? incomingTransfers.isLoading : ownerTransfers.isLoading;
  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4"><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#14201F" /></Pressable>
    <View style={styles.hero}><View style={[styles.row, direction]}><View style={styles.heroIcon}><MaterialIcons name={isBranchManager ? "verified-user" : "swap-horiz"} size={27} color="#C6F2E9" /></View><View style={styles.flex}><Text style={[styles.heroTitle, textAlign]}>{isBranchManager ? (ar ? "استلام فرعك" : "Your branch receipts") : (ar ? "تحويل المخزون بين الفروع" : "Branch inventory transfers")}</Text><Text style={[styles.heroText, textAlign]}>{isBranchManager ? (ar ? "ترى التحويلات الواردة إلى فرعك المعيّن فقط. اعتمدها بعد المراجعة لإضافة الكمية إلى رصيد الفرع." : "You see only transfers sent to your assigned branch. Review and approve them to add stock to that branch.") : (ar ? "أرسل من رصيد مؤكد، ثم يضيف مدير الفرع المستهدف الكمية بعد اعتماد الاستلام." : "Send from confirmed stock; the target-branch manager adds it only after approving receipt.")}</Text></View></View></View>
    <View style={[styles.notice, direction]}><MaterialIcons name="lock" size={19} color="#176458" /><Text style={[styles.noticeText, textAlign]}>{isBranchManager ? (ar ? "لا يمكنك رؤية أو تعديل أرصدة الفروع الأخرى، ولا اعتماد أي تحويل لا يستهدف فرعك المعيّن." : "You cannot view or change other branch balances, or approve transfers not targeting your assigned branch.") : (ar ? "لا يستطيع مالك المتجر اعتماد الاستلام. عيّن حساب مدير مسجلًا لكل فرع مستهدف قبل إرسال التحويل." : "The merchant owner cannot approve receipt. Assign a registered manager account to each target branch before sending a transfer.")}</Text></View>

    {isBranchManager ? <>
      <SectionTitle label={ar ? "إشعارات تحويلات فرعك" : "Your branch transfer alerts"} detail={ar ? "تُحفظ التنبيهات هنا فور إنشاء التحويل، ويمكن تفعيل إشعار الهاتف على جهاز فعلي." : "Alerts are stored here as soon as a transfer is created; enable phone alerts on a physical device."} isRTL={isRTL} />
      <View style={styles.notificationCard}>
        <View style={[styles.row, direction]}><View style={styles.notificationIcon}><MaterialIcons name="notifications-active" size={20} color="#0F766E" /></View><View style={styles.flex}><Text style={[styles.cardTitle, textAlign]}>{notificationDevices.data?.activeDevices ? (ar ? `إشعار الهاتف مفعّل على ${notificationDevices.data.activeDevices} جهاز` : `Phone alerts enabled on ${notificationDevices.data.activeDevices} device(s)`) : (ar ? "إشعار الهاتف غير مفعّل" : "Phone alerts are not enabled")}</Text><Text style={[styles.cardMeta, textAlign]}>{ar ? "لن يُرسل محتوى التحويل إلا إلى الجهاز المسجل لحساب مدير الفرع." : "Transfer content is sent only to a device registered to the branch manager account."}</Text></View></View>
        <ActionButton loading={registerNotificationDevice.isPending} label={notificationDevices.data?.activeDevices ? (ar ? "تفعيل جهاز إضافي" : "Enable another device") : (ar ? "تفعيل إشعار الهاتف" : "Enable phone alerts")} loadingLabel={ar ? "جارٍ التفعيل…" : "Enabling…"} icon="notifications" onPress={() => void enableManagerNotifications()} />
        {notificationInbox.data?.slice(0, 5).map((notification) => <Pressable key={notification.id} accessibilityRole="button" onPress={() => { if (!notification.readAt) void markNotificationRead.mutateAsync({ notificationId: notification.id }); }} style={({ pressed }) => [styles.inboxRow, !notification.readAt && styles.inboxUnread, pressed && styles.pressed]}><View style={[styles.row, direction]}><MaterialIcons name={notification.readAt ? "notifications-none" : "notifications"} size={18} color="#0F766E" /><View style={styles.flex}><Text style={[styles.inboxTitle, textAlign]}>{notification.title}</Text><Text style={[styles.inboxBody, textAlign]}>{notification.body}</Text></View></View></Pressable>)}
        {!notificationInbox.isLoading && !notificationInbox.data?.length ? <Text style={[styles.emptyInline, textAlign]}>{ar ? "لا توجد تحويلات جديدة إلى فرعك حتى الآن." : "No new transfers have been sent to your branch yet."}</Text> : null}
        {replenishmentNotificationInbox.data?.slice(0, 5).map((notification) => <Pressable key={`replenishment-${notification.id}`} accessibilityRole="button" onPress={() => { if (!notification.readAt) void markReplenishmentNotificationRead.mutateAsync({ notificationId: notification.id }); }} style={({ pressed }) => [styles.inboxRow, !notification.readAt && styles.inboxUnread, pressed && styles.pressed]}><View style={[styles.row, direction]}><MaterialIcons name={notification.readAt ? "notifications-none" : "inventory"} size={18} color="#A85E00" /><View style={styles.flex}><Text style={[styles.inboxTitle, textAlign]}>{notification.title}</Text><Text style={[styles.inboxBody, textAlign]}>{notification.body}</Text></View></View></Pressable>)}
        {managerReplenishments.data?.filter((request) => request.status === "suggested" || request.status === "ordered").slice(0, 10).map((request) => { const action = replenishmentAction(request.status); return <View key={`manager-replenishment-${request.id}`} style={styles.replenishmentCard}><View style={[styles.row, direction]}><MaterialIcons name="inventory" size={18} color="#A85E00" /><View style={styles.flex}><Text style={[styles.inboxTitle, textAlign]}>{request.productName}</Text><Text style={[styles.inboxBody, textAlign]}>{request.branchName} · {ar ? `المتاح ${request.currentQuantity} · المطلوب ${request.suggestedQuantity} · المستلم ${request.receivedQuantity}` : `Current ${request.currentQuantity} · Requested ${request.suggestedQuantity} · Received ${request.receivedQuantity}`}</Text></View><View style={[styles.pill, request.status === "suggested" ? styles.pillWarning : styles.pillSuccess]}><Text style={styles.pillText}>{request.status === "suggested" ? (ar ? "مقترح" : "Suggested") : (ar ? "مطلوب" : "Ordered")}</Text></View></View>{request.status === "ordered" ? <View style={[styles.receivedRow, direction]}><Text style={[styles.receivedLabel, textAlign]}>{ar ? "الكمية المستلمة" : "Received quantity"}</Text><TextInput value={managerReceivedQuantity(request)} onChangeText={(value) => setManagerReceivedQuantities((current) => ({ ...current, [request.id]: value }))} keyboardType="number-pad" returnKeyType="done" style={styles.receivedInput} /></View> : null}{action ? <Pressable disabled={changeManagerReplenishmentStatus.isPending} accessibilityRole="button" onPress={() => void changeManagerReplenishmentStatus.mutateAsync({ requestId: request.id, status: action, receivedQuantity: action === "closed" ? Number(managerReceivedQuantity(request)) : undefined }).catch((error) => Alert.alert(ar ? "تعذر تحديث الطلب" : "Could not update request", messageOf(error, ar, "قد تكون حالة الطلب تغيرت بالفعل.", "The request may already have changed.")))} style={({ pressed }) => [styles.replenishmentAction, changeManagerReplenishmentStatus.isPending && styles.disabled, pressed && styles.pressed]}><MaterialIcons name={action === "approved" ? "fact-check" : "done-all"} size={16} color="#176458" /><Text style={styles.replenishmentActionText}>{replenishmentActionLabel(request.status)}</Text></Pressable> : null}</View>; })}
      </View>
    </> : null}

    {!isBranchManager ? <>
      <SectionTitle label={ar ? "الفروع" : "Branches"} detail={ar ? "أنشئ فرعًا واحدًا على الأقل بجانب الفرع الرئيسي للبدء." : "Add at least one branch alongside the primary branch to begin."} isRTL={isRTL} />
      {branches.isLoading ? <Loading label={ar ? "جارٍ تحميل الفروع…" : "Loading branches…"} /> : <>
        <View style={styles.branchList}>{branches.data?.map((branch) => <View key={branch.id} style={styles.branchCard}><View style={[styles.row, direction]}><View style={styles.branchIcon}><MaterialIcons name={branch.isPrimary ? "store" : "storefront"} size={20} color="#0F766E" /></View><View style={styles.flex}><Text style={[styles.cardTitle, textAlign]}>{branch.name}</Text><Text style={[styles.cardMeta, textAlign]}>{branch.city || (ar ? "المدينة غير محددة" : "City not specified")}</Text></View>{branch.isPrimary ? <View style={styles.primaryPill}><Text style={styles.primaryPillText}>{ar ? "رئيسي" : "Primary"}</Text></View> : null}</View></View>)}</View>
        <Pressable accessibilityRole="button" onPress={() => setShowBranchForm((value) => !value)} style={({ pressed }) => [styles.addBranch, pressed && styles.pressed]}><MaterialIcons name={showBranchForm ? "expand-less" : "add-business"} size={18} color="#0F766E" /><Text style={styles.addBranchText}>{showBranchForm ? (ar ? "إخفاء نموذج الفرع" : "Hide branch form") : (ar ? "إضافة فرع" : "Add branch")}</Text></Pressable>
        {showBranchForm ? <View style={styles.formCard}><Field label={ar ? "اسم الفرع" : "Branch name"} value={branchName} onChangeText={setBranchName} placeholder={ar ? "مثال: فرع جدة" : "e.g. Jeddah Branch"} isRTL={isRTL} /><Field label={ar ? "المدينة (اختياري)" : "City (optional)"} value={branchCity} onChangeText={setBranchCity} placeholder={ar ? "جدة" : "Jeddah"} isRTL={isRTL} /><ActionButton loading={createBranch.isPending} label={ar ? "حفظ الفرع" : "Save branch"} loadingLabel={ar ? "جارٍ الحفظ…" : "Saving…"} icon="save" onPress={() => void saveBranch()} /></View> : null}
      </>}

      <SectionTitle label={ar ? "مديرو الفروع" : "Branch managers"} detail={ar ? "أدخل بريد حساب المدير المسجل. المدير وحده يعتمد التحويلات الواردة إلى فرعه." : "Enter a registered manager account email. Only that manager can approve incoming transfers for the branch."} isRTL={isRTL} />
      <View style={styles.formCard}><ChoiceField label={ar ? "الفرع" : "Branch"} branches={branches.data ?? []} selectedId={managerBranchId} onSelect={setManagerBranchId} isRTL={isRTL} /><Field label={ar ? "بريد حساب المدير" : "Manager account email"} value={managerEmail} onChangeText={setManagerEmail} placeholder="manager@example.com" isRTL={isRTL} autoCapitalize="none" keyboardType="email-address" /><ActionButton loading={assignManager.isPending} label={ar ? "تعيين مدير الفرع" : "Assign branch manager"} loadingLabel={ar ? "جارٍ التعيين…" : "Assigning…"} icon="person-add" onPress={() => void saveManager()} /></View>
      {managerAssignments.isLoading ? <Loading label={ar ? "جارٍ تحميل المديرين…" : "Loading managers…"} /> : managerAssignments.data?.length ? <View style={styles.managerList}>{managerAssignments.data.map((assignment) => <View key={assignment.id} style={styles.managerCard}><View style={[styles.row, direction]}><View style={styles.branchIcon}><MaterialIcons name="manage-accounts" size={20} color="#0F766E" /></View><View style={styles.flex}><Text style={[styles.cardTitle, textAlign]}>{assignment.branch?.name ?? (ar ? "فرع غير متاح" : "Unavailable branch")}</Text><Text style={[styles.cardMeta, textAlign]}>{assignment.manager?.email ?? (ar ? "حساب المدير غير متاح" : "Manager account unavailable")}</Text></View></View><Pressable accessibilityRole="button" onPress={() => confirmRemoveManager(assignment.branchId, assignment.branch?.name ?? (ar ? "الفرع" : "branch"))} style={({ pressed }) => [styles.removeManager, pressed && styles.pressed]}><MaterialIcons name="person-remove" size={16} color="#B3261E" /><Text style={styles.removeManagerText}>{ar ? "إزالة الصلاحية" : "Remove permission"}</Text></Pressable></View>)}</View> : <Text style={[styles.emptyInline, textAlign]}>{ar ? "لم يُعيّن مدير لأي فرع بعد." : "No branch manager has been assigned yet."}</Text>}

      <SectionTitle label={ar ? "إرسال تحويل جديد" : "Send a new transfer"} detail={ar ? "اختر المصدر والهدف، ثم الكميات من الرصيد المعتمد للمصدر." : "Choose source and target, then select quantities from the source's approved balance."} isRTL={isRTL} />
      <View style={styles.formCard}>
        <ChoiceField label={ar ? "فرع المصدر" : "Source branch"} branches={branches.data ?? []} selectedId={sourceBranchId} onSelect={chooseSource} isRTL={isRTL} />
        <ChoiceField label={ar ? "الفرع المستهدف" : "Target branch"} branches={(branches.data ?? []).filter((branch) => branch.id !== sourceBranchId)} selectedId={targetBranchId} onSelect={setTargetBranchId} isRTL={isRTL} />
        {targetBranchId && !targetHasManager ? <Text style={[styles.inlineWarning, textAlign]}>{ar ? "عيّن مديرًا لهذا الفرع من قسم «مديرو الفروع» قبل الإرسال." : "Assign this branch a manager in the Branch managers section before sending."}</Text> : null}
        {!branches.isLoading && (branches.data?.length ?? 0) < 2 ? <Text style={[styles.inlineWarning, textAlign]}>{ar ? "أضف فرعًا آخر قبل إرسال أول تحويل." : "Add another branch before sending your first transfer."}</Text> : null}
        <Text style={[styles.fieldLabel, textAlign]}>{ar ? "رصيد المصدر المؤكد" : "Confirmed source balance"}</Text>
        {sourceBalances.isLoading ? <Loading label={ar ? "جارٍ تحميل رصيد المصدر…" : "Loading source balance…"} /> : sourceBalances.data?.length ? <View style={styles.stockList}>{sourceBalances.data.map((balance) => <View key={balance.id} style={styles.stockRow}><View style={styles.flex}><Text style={[styles.stockName, textAlign]}>{balance.productName}</Text><Text style={[styles.cardMeta, textAlign]}>{balance.productSku || "—"} · {ar ? `المتاح ${balance.quantity}` : `${balance.quantity} available`}</Text></View><TextInput value={quantityDraft[balance.productKey] ?? ""} onChangeText={(value) => setQuantityDraft((draft) => ({ ...draft, [balance.productKey]: value }))} keyboardType="number-pad" placeholder="0" placeholderTextColor="#8AA09C" style={[styles.quantityInput, isRTL ? styles.right : styles.left]} /></View>)}</View> : sourceBranchId ? <Text style={[styles.emptyInline, textAlign]}>{ar ? "لا يوجد رصيد معتمد في هذا الفرع لإرساله." : "This branch has no approved inventory available to send."}</Text> : <Text style={[styles.emptyInline, textAlign]}>{ar ? "اختر فرع المصدر لعرض رصيده." : "Choose a source branch to view its balance."}</Text>}
        <Field label={ar ? "ملاحظة التحويل (اختياري)" : "Transfer note (optional)"} value={note} onChangeText={setNote} placeholder={ar ? "مثال: إعادة توزيع أسبوعية" : "e.g. Weekly rebalancing"} isRTL={isRTL} />
        <ActionButton loading={sendTransfer.isPending} disabled={!sourceBranchId || !targetBranchId || !targetHasManager} label={ar ? "مراجعة وإرسال التحويل" : "Review & send transfer"} loadingLabel={ar ? "جارٍ الإرسال…" : "Sending…"} icon="local-shipping" onPress={confirmSend} />
      </View>
    </> : null}

    <SectionTitle label={isBranchManager ? (ar ? "تحويلات واردة إلى فرعك" : "Transfers incoming to your branch") : (ar ? "تحويلات قيد النقل" : "In-transit transfers")} detail={isBranchManager ? (ar ? "اعتمد التحويل فقط بعد مراجعة الكميات المستلمة في فرعك." : "Approve only after reviewing the quantities received at your branch.") : (ar ? "ينتظر كل تحويل اعتماد مدير الفرع المستهدف المعين." : "Each transfer awaits approval from its assigned target-branch manager.")} isRTL={isRTL} />
    {transfersLoading ? <Loading label={ar ? "جارٍ تحميل التحويلات…" : "Loading transfers…"} /> : inTransit.length ? <View style={styles.transferList}>{inTransit.map((transfer) => <View key={transfer.id}><TransferCard transfer={transfer} ar={ar} isRTL={isRTL} pending={isBranchManager ? receiveTransfer.isPending : cancelTransfer.isPending} onReceive={isBranchManager ? () => confirmReceipt(transfer) : undefined} onCancel={!isBranchManager ? () => { setCancellationTransferId(transfer.id); setCancellationReason(""); } : undefined} />{!isBranchManager && cancellationTransferId === transfer.id ? <View style={styles.cancelForm}><Field label={ar ? "سبب الإلغاء (إلزامي)" : "Cancellation reason (required)"} value={cancellationReason} onChangeText={setCancellationReason} placeholder={ar ? "مثال: تم إنشاء التحويل بكميات غير صحيحة" : "e.g. Transfer created with incorrect quantities"} isRTL={isRTL} /><Text style={[styles.cancelHint, textAlign]}>{ar ? "سيُحفظ السبب في سجل التحويل ويُرسل إلى مدير الفرع المستهدف." : "The reason will be stored in the transfer audit trail and sent to the target branch manager."}</Text><View style={[styles.cancelActions, direction]}><Pressable accessibilityRole="button" onPress={() => { setCancellationTransferId(undefined); setCancellationReason(""); }} style={({ pressed }) => [styles.cancelBack, pressed && styles.pressed]}><Text style={styles.cancelBackText}>{ar ? "رجوع" : "Back"}</Text></Pressable><Pressable disabled={cancelTransfer.isPending} accessibilityRole="button" onPress={() => confirmCancellation(transfer)} style={({ pressed }) => [styles.cancelConfirm, cancelTransfer.isPending && styles.disabled, pressed && styles.pressed]}>{cancelTransfer.isPending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialIcons name="undo" size={16} color="#FFFFFF" />}<Text style={styles.cancelConfirmText}>{ar ? "مراجعة الإلغاء" : "Review cancellation"}</Text></Pressable></View></View> : null}</View>)}</View> : <Empty icon="sync-alt" title={ar ? "لا توجد تحويلات قيد النقل" : "No in-transit transfers"} detail={isBranchManager ? (ar ? "ستظهر هنا التحويلات الواردة إلى فرعك المعيّن فقط." : "Only transfers sent to your assigned branch appear here.") : (ar ? "ستظهر هنا التحويلات بعد خصمها من فرع المصدر وحتى اعتماد المدير المستهدف." : "Transfers appear here after source deduction until the target manager approves them.")} isRTL={isRTL} />}

    <SectionTitle label={isBranchManager ? (ar ? "سجل استلامات فرعك" : "Your branch receipt history") : (ar ? "آخر التحويلات" : "Recent transfers")} detail={isBranchManager ? (ar ? "لا يظهر لك إلا سجل التحويلات التي استهدفت فرعك." : "Only transfers targeting your branch are visible.") : (ar ? "سجل التحويلات المكتملة أو الملغاة للحساب الحالي." : "Completed or canceled transfers for the current account.")} isRTL={isRTL} />
    {completed.length ? <View style={styles.transferList}>{completed.map((transfer) => <TransferCard key={transfer.id} transfer={transfer} ar={ar} isRTL={isRTL} pending={false} />)}</View> : <Text style={[styles.emptyInline, textAlign]}>{ar ? "لا توجد تحويلات مكتملة بعد." : "No completed transfers yet."}</Text>}
  </ScrollView></ScreenContainer>;
}

function TransferCard({ transfer, ar, isRTL, pending, onReceive, onCancel }: { transfer: TransferRecord; ar: boolean; isRTL: boolean; pending: boolean; onReceive?: () => void; onCancel?: () => void }) {
  const status = statusCopy[transfer.status] ?? statusCopy.in_transit;
  const direction = isRTL ? styles.rowReverse : styles.row;
  const textAlign = isRTL ? styles.right : styles.left;
  return <View style={styles.transferCard}><View style={[styles.transferTop, direction]}><View style={styles.flex}><Text style={[styles.cardTitle, textAlign]}>{ar ? `تحويل #${transfer.id}` : `Transfer #${transfer.id}`}</Text><Text style={[styles.cardMeta, textAlign]}>{transfer.sourceBranch?.name ?? (ar ? "مصدر غير متاح" : "Unavailable source")} {isRTL ? "←" : "→"} {transfer.targetBranch?.name ?? (ar ? "هدف غير متاح" : "Unavailable target")}</Text></View><Pill label={status[ar ? "ar" : "en"]} tone={status.tone} /></View><View style={styles.divider} />{transfer.lines.map((line) => <View key={line.id} style={[styles.lineRow, direction]}><Text style={[styles.lineName, textAlign]}>{line.productName}</Text><Text style={styles.lineQuantity}>{line.quantity > 0 ? `× ${line.quantity}` : "—"}</Text></View>)}{transfer.note ? <Text style={[styles.note, textAlign]}>{transfer.note}</Text> : null}{transfer.status === "canceled" && transfer.cancellationReason ? <View style={styles.cancellationAudit}><Text style={[styles.cancellationAuditLabel, textAlign]}>{ar ? "سبب الإلغاء" : "Cancellation reason"}</Text><Text style={[styles.cancellationAuditText, textAlign]}>{transfer.cancellationReason}</Text></View> : null}{transfer.status === "in_transit" && onReceive ? <ActionButton loading={pending} label={ar ? "اعتماد استلام فرعك" : "Approve receipt for your branch"} loadingLabel={ar ? "جارٍ الاعتماد…" : "Approving…"} icon="fact-check" onPress={onReceive} /> : null}{transfer.status === "in_transit" && onCancel ? <Pressable disabled={pending} accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.cancelTransfer, pending && styles.disabled, pressed && styles.pressed]}><MaterialIcons name="undo" size={16} color="#B3261E" /><Text style={styles.cancelTransferText}>{ar ? "إلغاء التحويل وإعادة الكمية للمصدر" : "Cancel transfer and return source stock"}</Text></Pressable> : null}</View>;
}

function ChoiceField({ label, branches, selectedId, onSelect, isRTL }: { label: string; branches: { id: number; name: string; city: string | null; isPrimary: boolean }[]; selectedId?: number; onSelect: (id: number) => void; isRTL: boolean }) { return <View style={styles.field}><Text style={[styles.fieldLabel, isRTL ? styles.right : styles.left]}>{label}</Text><View style={[styles.choices, isRTL ? styles.rowReverse : styles.row]}>{branches.map((branch) => <Pressable key={branch.id} accessibilityRole="button" onPress={() => onSelect(branch.id)} style={({ pressed }) => [styles.choice, selectedId === branch.id && styles.choiceActive, pressed && styles.pressed]}><Text style={[styles.choiceText, selectedId === branch.id && styles.choiceTextActive]}>{branch.name}</Text></Pressable>)}</View>{!branches.length ? <Text style={[styles.inlineWarning, isRTL ? styles.right : styles.left]}>{isRTL ? "لا توجد فروع متاحة." : "No branches available."}</Text> : null}</View>; }
function Field({ label, value, onChangeText, placeholder, isRTL, autoCapitalize = "sentences", keyboardType = "default" }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; isRTL: boolean; autoCapitalize?: "none" | "sentences"; keyboardType?: "default" | "email-address" }) { return <View style={styles.field}><Text style={[styles.fieldLabel, isRTL ? styles.right : styles.left]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8AA09C" autoCorrect={false} autoCapitalize={autoCapitalize} keyboardType={keyboardType} style={[styles.input, isRTL ? styles.right : styles.left]} /></View>; }
function ActionButton({ loading, disabled, label, loadingLabel, icon, onPress }: { loading: boolean; disabled?: boolean; label: string; loadingLabel: string; icon: keyof typeof MaterialIcons.glyphMap; onPress: () => void }) { return <Pressable disabled={loading || disabled} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionButton, (loading || disabled) && styles.disabled, pressed && styles.pressed]}>{loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialIcons name={icon} size={18} color="#FFFFFF" />}<Text style={styles.saveText}>{loading ? loadingLabel : label}</Text></Pressable>; }
function SectionTitle({ label, detail, isRTL }: { label: string; detail: string; isRTL: boolean }) { return <View style={styles.sectionTitleWrap}><Text style={[styles.sectionTitle, isRTL ? styles.right : styles.left]}>{label}</Text><Text style={[styles.sectionDetail, isRTL ? styles.right : styles.left]}>{detail}</Text></View>; }
function Loading({ label }: { label: string }) { return <View style={styles.loading}><ActivityIndicator color="#0F766E" /><Text style={styles.loadingText}>{label}</Text></View>; }
function Empty({ icon, title, detail, isRTL }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; detail: string; isRTL: boolean }) { return <View style={styles.empty}><MaterialIcons name={icon} size={30} color="#63847D" /><Text style={[styles.emptyTitle, isRTL ? styles.right : styles.left]}>{title}</Text><Text style={[styles.emptyDetail, isRTL ? styles.right : styles.left]}>{detail}</Text></View>; }
function Pill({ label, tone }: { label: string; tone: "warning" | "success" | "neutral" }) { return <View style={[styles.pill, tone === "success" ? styles.pillSuccess : tone === "warning" ? styles.pillWarning : styles.pillNeutral]}><Text style={styles.pillText}>{label}</Text></View>; }
function wholeNumber(value: string) { if (!/^\d+$/.test(value.trim())) return undefined; const number = Number(value); return Number.isSafeInteger(number) && number > 0 && number <= 1_000_000 ? number : undefined; }
function messageOf(error: unknown, ar: boolean, fallbackAr: string, fallbackEn: string) { return error instanceof Error && error.message ? error.message : ar ? fallbackAr : fallbackEn; }

const styles = StyleSheet.create({
  content: { paddingBottom: 32, paddingTop: 12 }, row: { alignItems: "center", flexDirection: "row", gap: 10 }, rowReverse: { flexDirection: "row-reverse" }, flex: { flex: 1 }, right: { textAlign: "right" }, left: { textAlign: "left" }, back: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", marginBottom: 18, width: 44 }, hero: { backgroundColor: "#0B3B3A", borderRadius: 25, padding: 19 }, heroIcon: { alignItems: "center", backgroundColor: "#FFFFFF18", borderRadius: 16, height: 52, justifyContent: "center", width: 52 }, heroTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", lineHeight: 31 }, heroText: { color: "#D7F4EE", fontSize: 12, lineHeight: 19, marginTop: 5 }, notice: { alignItems: "flex-start", backgroundColor: "#E7F6F1", borderColor: "#B7DED4", borderRadius: 16, borderWidth: 1, gap: 8, marginTop: 14, padding: 12 }, noticeText: { color: "#176458", flex: 1, fontSize: 11, fontWeight: "700", lineHeight: 17 }, sectionTitleWrap: { marginTop: 21 }, sectionTitle: { color: "#14201F", fontSize: 16, fontWeight: "800" }, sectionDetail: { color: "#63847D", fontSize: 11, lineHeight: 17, marginTop: 4 }, notificationCard: { backgroundColor: "#FFFFFF", borderColor: "#B7DED4", borderRadius: 19, borderWidth: 1, gap: 12, marginTop: 13, padding: 14 }, notificationIcon: { alignItems: "center", backgroundColor: "#E7F6F1", borderRadius: 13, height: 40, justifyContent: "center", width: 40 }, inboxRow: { backgroundColor: "#F8FAF9", borderColor: "#E2ECE9", borderRadius: 12, borderWidth: 1, padding: 10 }, inboxUnread: { backgroundColor: "#EAF8F4", borderColor: "#9EDACB" }, inboxTitle: { color: "#14201F", fontSize: 11, fontWeight: "800" }, inboxBody: { color: "#63847D", fontSize: 10, lineHeight: 15, marginTop: 3 }, branchList: { gap: 8, marginTop: 12 }, branchCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 17, borderWidth: 1, padding: 13 }, branchIcon: { alignItems: "center", backgroundColor: "#E7F6F1", borderRadius: 13, height: 40, justifyContent: "center", width: 40 }, cardTitle: { color: "#14201F", fontSize: 13, fontWeight: "800" }, cardMeta: { color: "#63847D", fontSize: 10, fontWeight: "600", lineHeight: 16, marginTop: 3 }, primaryPill: { backgroundColor: "#E7F6F1", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 }, primaryPillText: { color: "#176458", fontSize: 9, fontWeight: "800" }, addBranch: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 6, marginTop: 10, minHeight: 34, paddingHorizontal: 3 }, addBranchText: { color: "#0F766E", fontSize: 11, fontWeight: "800" }, formCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 20, borderWidth: 1, marginTop: 13, padding: 14 }, field: { marginBottom: 12 }, fieldLabel: { color: "#334A46", fontSize: 11, fontWeight: "800", marginBottom: 7 }, input: { backgroundColor: "#F8FAF9", borderColor: "#DDE7E4", borderRadius: 12, borderWidth: 1, color: "#14201F", fontSize: 14, minHeight: 45, paddingHorizontal: 11 }, choices: { flexWrap: "wrap", gap: 7 }, choice: { backgroundColor: "#F4F7F6", borderColor: "#DDE7E4", borderRadius: 10, borderWidth: 1, minHeight: 35, paddingHorizontal: 10, justifyContent: "center" }, choiceActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" }, choiceText: { color: "#176458", fontSize: 10, fontWeight: "800" }, choiceTextActive: { color: "#FFFFFF" }, inlineWarning: { color: "#9A5B00", fontSize: 10, fontWeight: "700", lineHeight: 16, marginBottom: 10 }, stockList: { borderColor: "#E2ECE9", borderRadius: 13, borderWidth: 1, marginBottom: 13, overflow: "hidden" }, stockRow: { alignItems: "center", backgroundColor: "#F8FAF9", borderBottomColor: "#E2ECE9", borderBottomWidth: 1, flexDirection: "row", gap: 9, minHeight: 60, paddingHorizontal: 10 }, stockName: { color: "#334A46", fontSize: 11, fontWeight: "800" }, quantityInput: { backgroundColor: "#FFFFFF", borderColor: "#B7DED4", borderRadius: 10, borderWidth: 1, color: "#14201F", fontSize: 13, minHeight: 37, paddingHorizontal: 9, width: 58 }, emptyInline: { backgroundColor: "#F7FBFA", borderColor: "#DDE7E4", borderRadius: 12, borderStyle: "dashed", borderWidth: 1, color: "#63847D", fontSize: 11, lineHeight: 17, marginBottom: 13, padding: 11 }, actionButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 12, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 45 }, saveText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" }, managerList: { gap: 9, marginTop: 12 }, managerCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 17, borderWidth: 1, padding: 13 }, removeManager: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 5, marginTop: 10, minHeight: 28, paddingHorizontal: 2 }, removeManagerText: { color: "#B3261E", fontSize: 10, fontWeight: "800" }, transferList: { gap: 10, marginTop: 13 }, transferCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 19, borderWidth: 1, padding: 14 }, transferTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" }, divider: { backgroundColor: "#E8EFED", height: 1, marginVertical: 10 }, lineRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }, lineName: { color: "#334A46", flex: 1, fontSize: 11, fontWeight: "700" }, lineQuantity: { color: "#0F766E", fontSize: 12, fontWeight: "800" }, note: { color: "#63847D", fontSize: 10, lineHeight: 16, marginTop: 9 }, cancellationAudit: { backgroundColor: "#FFF7ED", borderColor: "#F4C98A", borderRadius: 11, borderWidth: 1, marginTop: 10, padding: 9 }, cancellationAuditLabel: { color: "#9A5B00", fontSize: 9, fontWeight: "800" }, cancellationAuditText: { color: "#6F4811", fontSize: 10, lineHeight: 16, marginTop: 3 }, cancelTransfer: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 5, marginTop: 12, minHeight: 30, paddingHorizontal: 2 }, cancelTransferText: { color: "#B3261E", fontSize: 10, fontWeight: "800" }, cancelForm: { backgroundColor: "#FFF9F5", borderColor: "#E8B8A7", borderRadius: 16, borderWidth: 1, marginTop: 8, padding: 12 }, cancelHint: { color: "#7E574A", fontSize: 10, lineHeight: 16, marginBottom: 10 }, cancelActions: { flexDirection: "row", gap: 8 }, cancelBack: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D8C4BD", borderRadius: 11, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 42 }, cancelBackText: { color: "#6A5148", fontSize: 11, fontWeight: "800" }, cancelConfirm: { alignItems: "center", backgroundColor: "#B3261E", borderRadius: 11, flex: 1.4, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 42 }, cancelConfirmText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" }, pill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 }, pillSuccess: { backgroundColor: "#DDF2E9" }, pillWarning: { backgroundColor: "#FFF1D9" }, pillNeutral: { backgroundColor: "#EEF2F1" }, pillText: { color: "#526E69", fontSize: 9, fontWeight: "800" }, loading: { alignItems: "center", padding: 22 }, loadingText: { color: "#63847D", fontSize: 11, marginTop: 8 }, empty: { alignItems: "center", backgroundColor: "#F7FBFA", borderColor: "#DDE7E4", borderRadius: 18, borderStyle: "dashed", borderWidth: 1, marginTop: 13, padding: 22 }, emptyTitle: { color: "#14201F", fontSize: 13, fontWeight: "800", marginTop: 9 }, emptyDetail: { color: "#63847D", fontSize: 11, lineHeight: 17, marginTop: 5 }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
  replenishmentCard: { backgroundColor: "#FFF8ED", borderColor: "#F4C98A", borderRadius: 13, borderWidth: 1, marginTop: 9, padding: 10 },
  receivedRow: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, flexDirection: "row", gap: 7, justifyContent: "space-between", marginTop: 9, padding: 8 },
  receivedLabel: { color: "#7A4D00", flex: 1, fontSize: 10, fontWeight: "700" },
  receivedInput: { backgroundColor: "#FFFFFF", borderColor: "#F4C98A", borderRadius: 8, borderWidth: 1, color: "#14201F", fontSize: 12, fontWeight: "800", minWidth: 55, paddingHorizontal: 7, paddingVertical: 6, textAlign: "center" },
  replenishmentAction: { alignItems: "center", alignSelf: "stretch", borderColor: "#B8DAD6", borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 9, minHeight: 36 },
  replenishmentActionText: { color: "#176458", fontSize: 10, fontWeight: "800" },
});
