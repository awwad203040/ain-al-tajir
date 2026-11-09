import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/hooks/use-auth";
import { exportAnnualStatementPdf } from "@/lib/annual-statement-export";
import { useApp } from "@/lib/app-context";
import { buildAnnualStatement } from "@/lib/billing-utils";
import { haptic } from "@/lib/haptics";
import { trpc } from "@/lib/trpc";
import { SubscriptionNotice } from "@/components/subscription-notice";
import { TrialBanner } from "@/components/app-ui";
import { canOpenCustomerPortal } from "@/shared/payment";

const PROVIDER_META = {
  stripe: { name: "Stripe", icon: "credit-card", color: "#635BFF", background: "#EEEDFF" },
  paytabs: { name: "PayTabs", icon: "account-balance", color: "#0B8A7C", background: "#E5F5F2" },
  paypal: { name: "PayPal", icon: "payments", color: "#1469C7", background: "#E8F2FC" },
} as const;

const FALLBACK_PROVIDERS = [
  { provider: "stripe" as const, enabled: false, automatic: true, reason: "Stripe test credentials are not configured" },
  { provider: "paytabs" as const, enabled: false, automatic: true, reason: "PayTabs merchant credentials are required" },
  { provider: "paypal" as const, enabled: false, automatic: true, reason: "PayPal merchant credentials are required" },
];

export function SubscriptionPanel() {
  const { isRTL, language, t } = useApp();
  const { isAuthenticated } = useAuth();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<"trial" | "merchant">("merchant");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);
  const billingConfig = trpc.billing.config.useQuery();
  const billingStatus = trpc.billing.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const invoices = trpc.billing.invoices.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const checkout = trpc.billing.createStripeCheckout.useMutation();
  const customerPortal = trpc.billing.createCustomerPortal.useMutation();
  const cancelSubscription = trpc.billing.cancelSubscription.useMutation({
    onSuccess: async () => {
      setConfirmCancel(false);
      await billingStatus.refetch();
    },
  });
  const plan = billingConfig.data?.plan;
  const providers = billingConfig.data?.providers ?? FALLBACK_PROVIDERS;
  const subscription = billingStatus.data?.subscription;
  const isActive = subscription?.status === "active";
  const stripeEnabled = providers.some((provider) => provider.provider === "stripe" && provider.enabled);
  const canManagePayment = stripeEnabled && canOpenCustomerPortal(subscription);
  const availableYears = useMemo(() => {
    const years = new Set((invoices.data ?? []).map((invoice) => new Date(invoice.paidAt ?? invoice.createdAt).getFullYear()));
    years.add(new Date().getFullYear());
    return [...years].sort((left, right) => right - left);
  }, [invoices.data]);
  const annualStatement = useMemo(() => buildAnnualStatement(invoices.data ?? [], selectedYear), [invoices.data, selectedYear]);

  const formatDate = (date?: Date | string | null) => {
    if (!date) return isRTL ? "غير محدد" : "Not available";
    return new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium" }).format(new Date(date));
  };

  const invoiceStatus = (status: string) => {
    const labels: Record<string, { ar: string; en: string; tone: string }> = {
      paid: { ar: "مدفوعة", en: "Paid", tone: "#16855B" },
      open: { ar: "مستحقة", en: "Open", tone: "#D97706" },
      void: { ar: "ملغاة", en: "Void", tone: "#667A77" },
      uncollectible: { ar: "متعذرة", en: "Uncollectible", tone: "#C73737" },
      draft: { ar: "مسودة", en: "Draft", tone: "#667A77" },
    };
    return labels[status] ?? labels.open;
  };

  const startPayment = async (provider: "stripe" | "paytabs" | "paypal", enabled: boolean) => {
    haptic.light();
    if (!enabled) {
      Alert.alert(
        isRTL ? "وسيلة الدفع غير مفعّلة" : "Payment method unavailable",
        isRTL
          ? "يلزم إضافة حساب التاجر ومفاتيح الاختبار قبل قبول أي دفع. لم يتم تنفيذ أي خصم."
          : "Merchant credentials must be configured before accepting payments. No charge was made.",
      );
      return;
    }
    if (provider !== "stripe") return;
    try {
      const result = await checkout.mutateAsync();
      await WebBrowser.openBrowserAsync(result.checkoutUrl, { toolbarColor: "#0B3B3A", controlsColor: "#FFFFFF" });
    } catch {
      Alert.alert(
        isRTL ? "تعذر بدء الدفع" : "Unable to start payment",
        isRTL ? "تأكد من تسجيل الدخول وإعداد Stripe ثم حاول مجددًا." : "Confirm sign-in and Stripe configuration, then try again.",
      );
    }
  };

  const exportStatement = async () => {
    if (!annualStatement.invoices.length) {
      Alert.alert(isRTL ? "لا توجد فواتير" : "No invoices", isRTL ? `لا توجد فواتير مسجلة لسنة ${selectedYear}.` : `There are no recorded invoices for ${selectedYear}.`);
      return;
    }
    setExporting(true);
    try {
      await exportAnnualStatementPdf(annualStatement, language);
    } catch {
      Alert.alert(isRTL ? "تعذر تصدير الكشف" : "Export failed", isRTL ? "تعذر إنشاء ملف PDF. حاول مجددًا وتأكد من السماح بالمشاركة أو النوافذ المنبثقة." : "The PDF could not be created. Try again and allow sharing or pop-ups.");
    } finally {
      setExporting(false);
    }
  };

  const updatePaymentMethod = async () => {
    if (!canManagePayment) return;
    haptic.light();
    try {
      const result = await customerPortal.mutateAsync();
      await WebBrowser.openBrowserAsync(result.portalUrl, { toolbarColor: "#0B3B3A", controlsColor: "#FFFFFF" });
      await billingStatus.refetch();
    } catch {
      Alert.alert(isRTL ? "تعذر فتح إدارة البطاقة" : "Unable to manage payment method", isRTL ? "تأكد من إعداد Stripe Customer Portal ثم حاول مجددًا." : "Confirm Stripe Customer Portal is configured, then try again.");
    }
  };

  const features = plan?.features[language] ?? (isRTL
    ? ["لوحة المؤشرات والتحليلات", "مركز الخسائر", "توقعات المخزون", "مساعد عين التاجر", "تقارير الفروع"]
    : ["Dashboard and analytics", "Loss Center", "Inventory forecasting", "Ain Al-Tajir Assistant", "Branch reports"]);

  return (
    <View>
      <TrialBanner />
      <SubscriptionNotice />
      {isAuthenticated && subscription ? (
        <View className={`mb-5 rounded-3xl border p-5 ${isActive ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10"}`}>
          <View className={`flex-row items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            <View className="flex-1">
              <View className={`mb-2 flex-row items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <MaterialIcons name={isActive ? "verified" : "error-outline"} size={20} color={isActive ? "#16855B" : "#D97706"} />
                <Text className={`text-sm font-bold ${isActive ? "text-success" : "text-warning"}`}>{isActive ? (isRTL ? "اشتراك نشط" : "Active subscription") : (isRTL ? "الاشتراك غير نشط" : "Subscription inactive")}</Text>
              </View>
              <Text className={`text-xl font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "باقة التاجر" : "Merchant Plan"}</Text>
              <Text className={`mt-2 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{subscription.cancelAtPeriodEnd ? (isRTL ? `سينتهي الاشتراك في ${formatDate(subscription.currentPeriodEnd)}` : `Subscription ends on ${formatDate(subscription.currentPeriodEnd)}`) : (isRTL ? `موعد التجديد: ${formatDate(subscription.currentPeriodEnd)}` : `Renews on: ${formatDate(subscription.currentPeriodEnd)}`)}</Text>
            </View>
            <View className="rounded-2xl bg-surface px-3 py-2"><Text className="text-sm font-bold text-foreground">100 {t("sar")}</Text><Text className="mt-0.5 text-[10px] text-muted">/{isRTL ? "شهر" : "month"}</Text></View>
          </View>

          {canManagePayment ? (
            <Pressable disabled={customerPortal.isPending} onPress={() => void updatePaymentMethod()} style={({ pressed }) => [styles.paymentMethodButton, pressed && styles.pressed]}>
              <View className={`flex-row items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-primary/10"><MaterialIcons name="credit-card" size={21} color="#0F766E" /></View>
                <View className="flex-1"><Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{customerPortal.isPending ? (isRTL ? "جارٍ فتح البوابة…" : "Opening portal…") : (isRTL ? "تحديث وسيلة الدفع" : "Update payment method")}</Text><Text className={`mt-1 text-xs text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "تُدار البطاقة بأمان في صفحة Stripe المستضافة." : "Your card is managed securely on Stripe's hosted page."}</Text></View>
                <MaterialIcons name="open-in-new" size={20} color="#0F766E" />
              </View>
            </Pressable>
          ) : null}

          {isActive && !subscription.cancelAtPeriodEnd ? (
            <View className="mt-5 border-t border-border/60 pt-4">
              {!confirmCancel ? (
                <Pressable onPress={() => setConfirmCancel(true)} style={({ pressed }) => [styles.cancelLink, pressed && styles.pressed]}><Text className="text-sm font-bold text-error">{isRTL ? "إلغاء الاشتراك" : "Cancel subscription"}</Text></Pressable>
              ) : (
                <View className="rounded-2xl border border-error/25 bg-surface p-4">
                  <Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "تأكيد إلغاء التجديد" : "Confirm cancellation"}</Text>
                  <Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "سيبقى وصولك فعالًا حتى نهاية الفترة المدفوعة، ثم لن يتجدد الاشتراك." : "Access remains active until the paid period ends, then the subscription will not renew."}</Text>
                  <View className={`mt-4 flex-row gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <Pressable disabled={cancelSubscription.isPending} onPress={() => void cancelSubscription.mutateAsync()} style={[styles.confirmButton, styles.dangerButton]}><Text className="text-sm font-bold text-white">{cancelSubscription.isPending ? (isRTL ? "جارٍ الإلغاء…" : "Canceling…") : (isRTL ? "تأكيد الإلغاء" : "Confirm")}</Text></Pressable>
                    <Pressable onPress={() => setConfirmCancel(false)} style={[styles.confirmButton, styles.keepButton]}><Text className="text-sm font-bold text-foreground">{isRTL ? "الاحتفاظ بالاشتراك" : "Keep subscription"}</Text></Pressable>
                  </View>
                  {cancelSubscription.isError ? <Text className="mt-3 text-xs font-semibold text-error">{isRTL ? "تعذر الإلغاء. تحقق من إعداد مزود الدفع ثم حاول مجددًا." : "Cancellation failed. Check payment provider configuration and try again."}</Text> : null}
                </View>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      <Text className={`mb-3 mt-2 text-lg font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "اختر الباقة المناسبة" : "Choose the right plan"}</Text>
      <View className={`mb-5 gap-3 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
        <Pressable onPress={() => setSelectedPackage("trial")} style={[styles.packageCard, selectedPackage === "trial" && styles.packageCardActive]}>
          <MaterialIcons name="event-available" size={22} color={selectedPackage === "trial" ? "#0F766E" : "#63847D"} />
          <Text className={`mt-2 text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "تجربة مجانية" : "Free trial"}</Text>
          <Text className={`mt-1 text-[11px] leading-4 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "7 أيام كاملة دون بطاقة" : "7 full days, no card"}</Text>
          <Text className={`mt-2 text-xs font-bold text-primary ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "للحسابات الجديدة" : "For new accounts"}</Text>
        </Pressable>
        <Pressable onPress={() => setSelectedPackage("merchant")} style={[styles.packageCard, selectedPackage === "merchant" && styles.packageCardActive]}>
          <MaterialIcons name="workspace-premium" size={22} color={selectedPackage === "merchant" ? "#0F766E" : "#63847D"} />
          <Text className={`mt-2 text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "باقة التاجر" : "Merchant plan"}</Text>
          <Text className={`mt-1 text-[11px] leading-4 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "كل الأدوات مقابل 100 ر.س شهريًا" : "All tools for SAR 100/month"}</Text>
          <Text className={`mt-2 text-xs font-bold text-primary ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "الاختيار المستمر" : "Ongoing access"}</Text>
        </Pressable>
      </View>
      <View style={styles.planCard}>
        <View className={`mb-5 flex-row items-start justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
          <View className="flex-1">
            <View className="mb-2 self-start rounded-full bg-white/15 px-3 py-1.5"><Text className="text-[11px] font-bold text-white">{isRTL ? "باقة شهرية واحدة" : "One monthly plan"}</Text></View>
            <Text className={`text-2xl font-bold text-white ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "باقة التاجر" : "Merchant Plan"}</Text>
            <Text className={`mt-2 text-sm leading-6 text-white/70 ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "كل أدوات التحليل والتنبؤ في اشتراك واضح." : "All analytics and forecasting tools in one clear subscription."}</Text>
          </View>
          <View className="h-14 w-14 items-center justify-center rounded-3xl bg-white/15"><MaterialIcons name="workspace-premium" size={29} color="#FFFFFF" /></View>
        </View>
        <View className={`flex-row items-end gap-2 ${isRTL ? "flex-row-reverse justify-end" : ""}`}><Text className="text-4xl font-bold text-white">100</Text><Text className="pb-1.5 text-sm font-semibold text-white/70">{t("sar")} / {isRTL ? "شهر" : "month"}</Text></View>
        <View className="mt-4 border-t border-white/15 pt-4">
          {features.map((feature) => <View key={feature} className={`mb-2 flex-row items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}><MaterialIcons name="check-circle" size={18} color="#72D8A4" /><Text className={`flex-1 text-sm text-white/85 ${isRTL ? "text-right" : "text-left"}`}>{feature}</Text></View>)}
        </View>
      </View>

      {!isActive ? (
        <>
          <View className="mt-5 rounded-2xl border border-warning/30 bg-warning/10 p-4">
            <View className={`flex-row items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}><MaterialIcons name="info-outline" size={21} color="#D97706" /><View className="flex-1"><Text className={`text-sm font-bold text-warning ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "الدفع غير مفعّل حاليًا" : "Payments are not enabled yet"}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "لن يطلب التطبيق بيانات بطاقة ولن ينفذ خصمًا حتى تضيف الإدارة حساب تاجر ومفاتيح اختبار صالحة." : "The app will not request card details or charge anyone until valid merchant test credentials are configured."}</Text></View></View>
          </View>
          <Text className={`mb-3 mt-7 text-lg font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "اختر وسيلة الدفع" : "Choose payment method"}</Text>
          <View className="gap-3">
            {providers.map((provider) => {
              if (provider.provider === "instapay") return null;
              const providerKey = provider.provider as keyof typeof PROVIDER_META;
              const meta = PROVIDER_META[providerKey];
              return (
                <Pressable key={provider.provider} accessibilityRole="button" onPress={() => void startPayment(providerKey, provider.enabled)} style={({ pressed }) => [styles.providerCard, pressed && styles.pressed]}>
                  <View className={`flex-row items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}><View style={[styles.providerIcon, { backgroundColor: meta.background }]}><MaterialIcons name={meta.icon} size={23} color={meta.color} /></View><View className="flex-1"><View className={`flex-row items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}><Text className="text-base font-bold text-foreground">{meta.name}</Text><View className={`rounded-full px-2 py-1 ${provider.enabled ? "bg-success/10" : "bg-background"}`}><Text className={`text-[10px] font-bold ${provider.enabled ? "text-success" : "text-muted"}`}>{provider.enabled ? (isRTL ? "متاح" : "Available") : (isRTL ? "غير مفعّل" : "Not configured")}</Text></View></View><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{provider.enabled ? (isRTL ? "دفع آمن وتجديد شهري تلقائي" : "Secure payment with automatic monthly renewal") : (isRTL ? "يتطلب حساب تاجر ومفاتيح اختبار" : "Merchant account and test credentials required")}</Text></View><MaterialIcons name={provider.enabled ? (isRTL ? "chevron-left" : "chevron-right") : "lock-outline"} size={22} color={provider.enabled ? "#0F766E" : "#8AA09C"} /></View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {isAuthenticated ? (
        <View className="mt-7">
          <View className={`mb-3 flex-row items-center justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            <View className="flex-1"><Text className={`text-lg font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "الفواتير السابقة" : "Invoice history"}</Text><Text className={`mt-1 text-xs text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "اختر السنة ثم صدّر كشفًا موحدًا." : "Choose a year and export one statement."}</Text></View>
            <Pressable disabled={exporting || !annualStatement.invoices.length} onPress={() => void exportStatement()} style={[styles.exportButton, !annualStatement.invoices.length && styles.disabledButton]}>
              <MaterialIcons name="picture-as-pdf" size={19} color="#FFFFFF" />
              <Text className="text-xs font-bold text-white">{exporting ? (isRTL ? "جارٍ الإنشاء…" : "Creating…") : "PDF"}</Text>
            </Pressable>
          </View>
          <View className={`mb-4 flex-row flex-wrap gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            {availableYears.map((year) => <Pressable key={year} onPress={() => setSelectedYear(year)} style={[styles.yearChip, selectedYear === year && styles.yearChipActive]}><Text className={`text-xs font-bold ${selectedYear === year ? "text-white" : "text-muted"}`}>{year}</Text></Pressable>)}
          </View>
          {invoices.isLoading ? <View className="rounded-2xl border border-border bg-surface p-5"><Text className="text-center text-sm text-muted">{isRTL ? "جارٍ تحميل الفواتير…" : "Loading invoices…"}</Text></View> : invoices.data?.length ? (
            <View className="gap-3">
              {invoices.data.map((invoice) => {
                const status = invoiceStatus(invoice.status);
                const invoiceLink = invoice.invoicePdfUrl ?? invoice.hostedInvoiceUrl;
                return <Pressable key={invoice.id} disabled={!invoiceLink} onPress={() => invoiceLink && WebBrowser.openBrowserAsync(invoiceLink)} style={({ pressed }) => [styles.invoiceCard, pressed && styles.pressed]}><View className={`flex-row items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}><View className="h-11 w-11 items-center justify-center rounded-2xl bg-background"><MaterialIcons name="receipt-long" size={22} color="#0F766E" /></View><View className="flex-1"><Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{invoice.invoiceNumber ?? (isRTL ? `فاتورة #${invoice.id}` : `Invoice #${invoice.id}`)}</Text><Text className={`mt-1 text-xs text-muted ${isRTL ? "text-right" : "text-left"}`}>{formatDate(invoice.paidAt ?? invoice.createdAt)} · {(invoice.amountPaidMinor / 100).toFixed(2)} {invoice.currency}</Text></View><View className="items-end gap-2"><Text style={{ color: status.tone, fontSize: 11, fontWeight: "700" }}>{language === "ar" ? status.ar : status.en}</Text>{invoiceLink ? <MaterialIcons name="download" size={18} color="#0F766E" /> : null}</View></View></Pressable>;
              })}
            </View>
          ) : <View className="items-center rounded-3xl border border-dashed border-border p-6"><MaterialIcons name="receipt-long" size={30} color="#8AA09C" /><Text className="mt-3 text-center text-sm font-bold text-foreground">{isRTL ? "لا توجد فواتير بعد" : "No invoices yet"}</Text><Text className="mt-1 text-center text-xs leading-5 text-muted">{isRTL ? "ستظهر فواتير المزود هنا بعد أول دفعة مؤكدة." : "Provider invoices will appear here after the first confirmed payment."}</Text></View>}
        </View>
      ) : null}

      <View className="mt-6 rounded-2xl border border-border bg-surface p-4"><View className={`flex-row items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}><MaterialIcons name="verified-user" size={22} color="#16855B" /><Text className={`flex-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "تتم معالجة بيانات البطاقة في صفحة المزود المستضافة ولا يخزن تطبيق عين التاجر رقم البطاقة أو رمز CVV." : "Card data is processed on the provider-hosted page; Ain Al-Tajir never stores card numbers or CVV."}</Text></View></View>
      <View className={`mt-4 flex-row items-center justify-center gap-5 ${isRTL ? "flex-row-reverse" : ""}`}>
        <Pressable accessibilityRole="link" onPress={() => router.push("/legal/privacy" as never)}><Text className="text-xs font-bold text-primary">{isRTL ? "سياسة الخصوصية" : "Privacy policy"}</Text></Pressable>
        <Text className="text-xs text-muted">•</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push("/legal/terms" as never)}><Text className="text-xs font-bold text-primary">{isRTL ? "شروط الاشتراك" : "Subscription terms"}</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  packageCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 18, borderWidth: 1, flex: 1, minHeight: 150, padding: 14 },
  packageCardActive: { backgroundColor: "#EAF4F2", borderColor: "#0F766E", borderWidth: 1.5 },
  planCard: { backgroundColor: "#0B3B3A", borderRadius: 26, padding: 20 },
  providerCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 20, borderWidth: 1, padding: 15 },
  providerIcon: { alignItems: "center", borderRadius: 16, height: 48, justifyContent: "center", width: 48 },
  paymentMethodButton: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 17, borderWidth: 1, marginTop: 16, padding: 13 },
  invoiceCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 18, borderWidth: 1, padding: 14 },
  exportButton: { alignItems: "center", backgroundColor: "#C73737", borderRadius: 14, flexDirection: "row", gap: 5, justifyContent: "center", minHeight: 42, paddingHorizontal: 12 },
  disabledButton: { opacity: 0.42 },
  yearChip: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 38, minWidth: 62, paddingHorizontal: 12 },
  yearChipActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" },
  cancelLink: { alignItems: "center", borderColor: "#EAB3B3", borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 44 },
  confirmButton: { alignItems: "center", borderRadius: 13, flex: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 12 },
  dangerButton: { backgroundColor: "#C73737" },
  keepButton: { backgroundColor: "#F4F7F6", borderColor: "#DDE7E4", borderWidth: 1 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
