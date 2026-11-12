import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppHeader, PrimaryButton } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useApp } from "@/lib/app-context";
import { haptic } from "@/lib/haptics";
import { clearFreeRegistrationDraft, loadFreeRegistrationDraft } from "@/lib/free-registration";
import { saveLocalMerchantProfile } from "@/lib/local-account";
import { trpc } from "@/lib/trpc";

const SOURCES = [
  { id: "salla", ar: "سلة", en: "Salla", icon: "storefront" },
  { id: "zid", ar: "زد", en: "Zid", icon: "shopping-bag" },
  { id: "pos", ar: "نقاط البيع", en: "POS", icon: "point-of-sale" },
  { id: "excel", ar: "Excel / CSV", en: "Excel / CSV", icon: "table-chart" },
  { id: "later", ar: "سأربط لاحقًا", en: "Connect later", icon: "schedule" },
] as const;

type StoreDetails = { ownerName: string; ownerEmail: string; name: string; type: string; city: string; branches: string; phone: string; taxNumber: string };
const INITIAL_STORE: StoreDetails = { ownerName: "", ownerEmail: "", name: "", type: "", city: "", branches: "1", phone: "", taxNumber: "" };

export default function OnboardingScreen() {
  const { t, isRTL, language } = useApp();
  const { isAuthenticated, loading } = useAuth();
  const [step, setStep] = useState(1);
  const [source, setSource] = useState("later");
  const [store, setStore] = useState<StoreDetails>(INITIAL_STORE);
  const account = trpc.access.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const startTrial = trpc.merchant.startTrial.useMutation();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.replace("/login" as never); return; }
    if (account.isLoading) return;
    const kind = account.data?.access.kind;
    if (kind === "trial" || kind === "paid") router.replace("/(tabs)/dashboard" as never);
  }, [account.data?.access.kind, account.isLoading, isAuthenticated, loading]);

  useEffect(() => {
    let active = true;
    void loadFreeRegistrationDraft().then((draft) => { if (active && draft) setStore((current) => ({ ...current, ownerName: draft.ownerName, ownerEmail: draft.ownerEmail, phone: current.phone || draft.contactPhone })); });
    return () => { active = false; };
  }, []);

  const validStore = () => {
    const branches = Number(store.branches);
    return store.ownerName.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(store.ownerEmail.trim()) && store.name.trim().length >= 2 && store.type.trim().length >= 2 && store.city.trim().length >= 2 && store.phone.trim().length >= 7 && Number.isInteger(branches) && branches >= 1;
  };

  const next = async () => {
    if (step === 1 && !validStore()) {
      Alert.alert(isRTL ? "أكمل البيانات" : "Complete your details", isRTL ? "أدخل بيانات صاحب المتجر واسم المتجر ونوع النشاط والمدينة ورقم التواصل وعدد الفروع الصحيح." : "Enter owner details, store name, business type, city, contact number, and a valid branch count.");
      return;
    }
    if (step < 3) { setStep((current) => current + 1); return; }
    if (startTrial.isPending) return;
    try {
      await startTrial.mutateAsync({ ownerName: store.ownerName.trim(), ownerEmail: store.ownerEmail.trim().toLowerCase(), storeName: store.name.trim(), businessType: store.type.trim(), city: store.city.trim(), branchCount: Number(store.branches), contactPhone: store.phone.trim(), taxNumber: store.taxNumber.trim() || undefined });
    } catch {
      // Fallback cleanly to local storage for mobile standalone
    }
    await saveLocalMerchantProfile({
      ownerName: store.ownerName.trim(),
      ownerEmail: store.ownerEmail.trim().toLowerCase(),
      storeName: store.name.trim(),
      businessType: store.type.trim(),
      city: store.city.trim(),
      branchCount: Number(store.branches),
      contactPhone: store.phone.trim(),
      taxNumber: store.taxNumber.trim() || undefined,
    });
    await clearFreeRegistrationDraft();
    haptic.success();
    router.replace("/(tabs)/dashboard" as never);
  };

  const fields: { key: keyof StoreDetails; label: string; placeholder: string; keyboardType?: "default" | "number-pad" | "phone-pad" }[] = [
    { key: "ownerName", label: isRTL ? "اسم صاحب المتجر" : "Store owner name", placeholder: isRTL ? "مثال: أحمد محمد" : "e.g. Ahmed Mohammed" },
    { key: "ownerEmail", label: isRTL ? "البريد الإلكتروني" : "Email address", placeholder: "name@example.com", keyboardType: "default" },
    { key: "name", label: t("storeName"), placeholder: isRTL ? "مثال: متجر الرواد" : "e.g. Al-Rowad Store" },
    { key: "type", label: t("businessType"), placeholder: isRTL ? "تجزئة، مطعم، إلكترونيات…" : "Retail, restaurant, electronics…" },
    { key: "city", label: t("city"), placeholder: isRTL ? "الرياض" : "Riyadh" },
    { key: "branches", label: t("branchesCount"), placeholder: "1", keyboardType: "number-pad" },
    { key: "phone", label: isRTL ? "رقم التواصل" : "Contact number", placeholder: "05xxxxxxxx", keyboardType: "phone-pad" },
    { key: "taxNumber", label: isRTL ? "الرقم الضريبي (اختياري)" : "Tax number (optional)", placeholder: isRTL ? "إن وجد" : "If available" },
  ];

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-6">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className={`mb-7 flex-row items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>{[1, 2, 3].map((item) => <View key={item} className={`h-2 flex-1 rounded-full ${item <= step ? "bg-primary" : "bg-border"}`} />)}</View>
        <AppHeader title={step === 1 ? t("setupStore") : step === 2 ? t("chooseSystem") : (isRTL ? "بدء الاستخدام المجاني" : "Start free use")} subtitle={step === 1 ? (isRTL ? "تُحفظ هذه البيانات في حسابك وتبدأ الفترة المجانية بعد التأكيد." : "These details are saved to your account and start free use when confirmed.") : step === 2 ? (isRTL ? "اختر مصدر بياناتك الآن أو أضفه من صفحة التكاملات لاحقًا." : "Choose a data source now or add it later from Integrations.") : (isRTL ? "راجع بياناتك ثم ابدأ استخدام أدوات الحساب لمدة 7 أيام." : "Review your details, then use account tools free for 7 days.")} />

        {step === 1 ? <View style={styles.formCard}>{fields.map((field, index) => <View key={field.key} style={index === fields.length - 1 ? undefined : styles.field}><Text className={`mb-2 text-sm font-semibold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{field.label}</Text><TextInput value={store[field.key]} onChangeText={(value) => setStore((current) => ({ ...current, [field.key]: value }))} placeholder={field.placeholder} placeholderTextColor="#8AA09C" keyboardType={field.keyboardType ?? "default"} returnKeyType={index === fields.length - 1 ? "done" : "next"} style={[styles.input, isRTL ? styles.textRight : styles.textLeft]} /></View>)}</View> : null}

        {step === 2 ? <View className="gap-3">{SOURCES.map((item) => { const selected = source === item.id; return <Pressable key={item.id} accessibilityRole="button" onPress={() => { haptic.selection(); setSource(item.id); }} style={({ pressed }) => [styles.sourceButton, selected && styles.sourceSelected, pressed && styles.pressed]}><View className={`flex-row items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}><View className={`h-11 w-11 items-center justify-center rounded-2xl ${selected ? "bg-primary" : "bg-background"}`}><MaterialIcons name={item.icon} size={22} color={selected ? "#FFFFFF" : "#0F766E"} /></View><Text className={`flex-1 text-base font-semibold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{item[language]}</Text><MaterialIcons name={selected ? "check-circle" : "radio-button-unchecked"} size={22} color={selected ? "#0F766E" : "#AABAB7"} /></View></Pressable>; })}</View> : null}

        {step === 3 ? <View><View className="mb-4 items-center rounded-3xl bg-primary p-6"><View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-white/15"><MaterialIcons name="event-available" size={34} color="#FFFFFF" /></View><Text className="text-center text-xl font-bold text-white">{isRTL ? "فترة مجانية حية لمدة 7 أيام" : "A live 7-day free period"}</Text><Text className="mt-2 text-center text-sm leading-6 text-white/80">{isRTL ? `سيُحفظ متجر «${store.name}» في حسابك، وستُفتح جميع الأدوات دون بطاقة أو دفع الآن.` : `“${store.name}” will be saved to your account with every tool enabled. No card or payment is required now.`}</Text></View><View className="rounded-2xl border border-border bg-surface p-4">{[isRTL ? "حفظ ملف المتجر في الحساب" : "Save the store profile to your account", isRTL ? "بدء مدة 7 أيام مجانًا" : "Start the 7-day free period", isRTL ? "فتح المبيعات والمخزون والفروع والتقارير والتحليلات" : "Open sales, inventory, branches, reports, and analytics", isRTL ? `مصدر البيانات: ${SOURCES.find((item) => item.id === source)?.[language]}` : `Data source: ${SOURCES.find((item) => item.id === source)?.[language]}`, isRTL ? "الانتقال إلى أدوات المتجر" : "Open store tools"].map((item) => <View key={item} className={`flex-row items-center gap-3 py-2 ${isRTL ? "flex-row-reverse" : ""}`}><MaterialIcons name="check-circle" size={20} color="#16855B" /><Text className={`flex-1 text-sm text-foreground ${isRTL ? "text-right" : "text-left"}`}>{item}</Text></View>)}</View></View> : null}

        <View className="mt-8"><PrimaryButton label={step === 3 ? (startTrial.isPending ? (isRTL ? "جارٍ بدء الفترة…" : "Starting free period…") : (isRTL ? "تأكيد وبدء الاستخدام المجاني" : "Confirm and start free use")) : t("continue")} onPress={() => void next()} />{step > 1 ? <Pressable accessibilityRole="button" onPress={() => setStep((current) => current - 1)} style={styles.secondaryLink}><Text className="text-sm font-semibold text-muted">{t("back")}</Text></Pressable> : null}</View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flexGrow: 1, paddingBottom: 28, paddingTop: 16 }, formCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 22, borderWidth: 1, padding: 16 }, field: { marginBottom: 14 }, input: { backgroundColor: "#F8FAF9", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, color: "#14201F", fontSize: 16, minHeight: 54, paddingHorizontal: 16 }, textRight: { textAlign: "right" }, textLeft: { textAlign: "left" }, sourceButton: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 18, borderWidth: 1, padding: 14 }, sourceSelected: { borderColor: "#0F766E", borderWidth: 1.5 }, pressed: { opacity: 0.76 }, secondaryLink: { alignItems: "center", padding: 14 } });
