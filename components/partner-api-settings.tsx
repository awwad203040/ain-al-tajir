import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { createEmptyPartnerApiSettings, getPartnerApiReadiness, PARTNER_API_REQUIREMENTS, type PartnerApiSettings, type PartnerConnectorId } from "@/lib/partner-api-settings";
import { haptic } from "@/lib/haptics";
import { loadPartnerApiSettings, removePartnerApiSettings, savePartnerApiSettings } from "@/lib/store-connector-storage";
import { useApp } from "@/lib/app-context";
import { trpc } from "@/lib/trpc";

export function PartnerApiSettingsPanel({ connectorId, displayName, onClose }: { connectorId: PartnerConnectorId; displayName: string; onClose: () => void }) {
  const { isRTL, language } = useApp();
  const [settings, setSettings] = useState<PartnerApiSettings>(() => createEmptyPartnerApiSettings(connectorId));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ status: string; statusCode?: number } | null>(null);
  const testConnection = trpc.partnerApi.testConnection.useMutation();

  useEffect(() => {
    let active = true;
    setLoaded(false);
    void loadPartnerApiSettings(connectorId).then((stored) => { if (active) { setSettings(stored ?? createEmptyPartnerApiSettings(connectorId)); setLoaded(true); } });
    return () => { active = false; };
  }, [connectorId]);

  const readiness = useMemo(() => getPartnerApiReadiness(settings), [settings]);
  const set = <K extends keyof PartnerApiSettings>(field: K, value: PartnerApiSettings[K]) => setSettings((current) => ({ ...current, [field]: value }));
  const copy = {
    needs_agreement: { label: isRTL ? "اتفاقية الشريك مطلوبة" : "Partner agreement required", color: "#D97706" },
    draft: { label: isRTL ? "مسودة إعداد غير مكتملة" : "Incomplete setup draft", color: "#3F5DA8" },
    ready_for_secure_activation: { label: isRTL ? "جاهز لإضافة البيانات السرية على الخادم" : "Ready for secure server credentials", color: "#16855B" },
  }[readiness];

  const save = async () => {
    setSaving(true);
    try {
      await savePartnerApiSettings({ ...settings, updatedAt: new Date().toISOString() });
      haptic.success();
      Alert.alert(isRTL ? "تم حفظ الإعداد" : "Settings saved", isRTL ? "حُفظت بيانات الربط غير السرية محليًا. لا يُجرى اتصال حتى تفعيل بيانات الاعتماد الرسمية على الخادم." : "Non-secret connection details were saved locally. No connection is made until official credentials are activated on the server.");
    } catch {
      Alert.alert(isRTL ? "تعذر الحفظ" : "Could not save", isRTL ? "حاول مجددًا بعد التحقق من مساحة الجهاز." : "Try again after checking device storage.");
    } finally { setSaving(false); }
  };

  const clear = () => Alert.alert(isRTL ? "مسح إعدادات الربط؟" : "Clear connection settings?", isRTL ? "سيُزال معرّف الشريك والرابط المحفوظان من هذا الجهاز فقط." : "The saved partner ID and endpoint will be removed from this device only.", [
    { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
    { text: isRTL ? "مسح" : "Clear", style: "destructive", onPress: () => void removePartnerApiSettings(connectorId).then(() => { setSettings(createEmptyPartnerApiSettings(connectorId)); haptic.light(); }) },
  ]);

  const test = async () => {
    if (readiness !== "ready_for_secure_activation") {
      Alert.alert(isRTL ? "أكمل الإعداد أولًا" : "Complete setup first", isRTL ? "أكّد اتفاقية الشريك، ثم أدخل معرّف الحساب ورابط HTTPS الرسمي قبل اختبار الاتصال." : "Confirm the partner agreement, then enter the official account ID and HTTPS endpoint before testing.");
      return;
    }
    try {
      const result = await testConnection.mutateAsync({ connectorId });
      setTestResult(result);
      const copy = {
        not_configured: isRTL ? "لم تُضف بيانات اعتماد الاختبار المعتمدة على الخادم بعد." : "Approved test credentials have not been configured on the server yet.",
        connected: isRTL ? "تم الوصول إلى نقطة اختبار الشريك المعتمدة بنجاح." : "The approved partner test endpoint responded successfully.",
        authentication_failed: isRTL ? "رفض الشريك المصادقة. راجع الصلاحيات أو تدوير بيانات الاعتماد مع الشريك." : "The partner rejected authentication. Review permissions or rotate credentials with the partner.",
        unreachable: isRTL ? "تعذر الوصول إلى نقطة الاختبار المعتمدة. راجع الرابط، البيئة، والنطاقات المسموحة." : "The approved test endpoint could not be reached. Review the URL, environment, and allowlists.",
      }[result.status];
      Alert.alert(result.status === "connected" ? (isRTL ? "نجح اختبار الاتصال" : "Connection test passed") : (isRTL ? "نتيجة اختبار الاتصال" : "Connection test result"), copy);
    } catch {
      setTestResult({ status: "unreachable" });
      Alert.alert(isRTL ? "تعذر تنفيذ الاختبار" : "Could not run the test", isRTL ? "تحقق من اتصال حسابك وصلاحيته ثم حاول مجددًا." : "Check your account connection and eligibility, then try again.");
    }
  };

  const resultCopy = testResult ? {
    connected: { text: isRTL ? `تم الاتصال بنجاح${testResult.statusCode ? ` · HTTP ${testResult.statusCode}` : ""}` : `Connected successfully${testResult.statusCode ? ` · HTTP ${testResult.statusCode}` : ""}`, color: "#16855B" },
    not_configured: { text: isRTL ? "لم تُهيأ بيانات اختبار الشريك على الخادم." : "Partner test credentials are not configured on the server.", color: "#D97706" },
    authentication_failed: { text: isRTL ? "رفضت نقطة الاختبار المصادقة." : "The test endpoint rejected authentication.", color: "#C73737" },
    unreachable: { text: isRTL ? "تعذر الوصول إلى نقطة الاختبار." : "The test endpoint could not be reached.", color: "#C73737" },
  }[testResult.status] : null;

  return <View style={styles.card}>
    <View className={`flex-row items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}><View className="flex-1"><Text className={`text-base font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? `إعداد API — ${displayName}` : `${displayName} API setup`}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{PARTNER_API_REQUIREMENTS[connectorId][language]}</Text></View><Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><MaterialIcons name="close" size={19} color="#55706A" /></Pressable></View>
    <View style={[styles.status, { borderColor: `${copy.color}55`, backgroundColor: `${copy.color}12` }]}><MaterialIcons name={readiness === "ready_for_secure_activation" ? "verified" : "info-outline"} size={18} color={copy.color} /><Text className={`flex-1 text-xs font-bold ${isRTL ? "text-right" : "text-left"}`} style={{ color: copy.color }}>{copy.label}</Text></View>
    <Field label={isRTL ? "معرّف حساب الشريك" : "Partner account ID"} value={settings.partnerAccountId} onChangeText={(value) => set("partnerAccountId", value)} placeholder={isRTL ? "المعرّف الصادر من الشريك" : "Identifier issued by the partner"} isRTL={isRTL} />
    <Field label={isRTL ? "رابط API الأساسي" : "API base URL"} value={settings.baseUrl} onChangeText={(value) => set("baseUrl", value)} placeholder="https://…" isRTL={isRTL} autoCapitalize="none" />
    <Text className={`mb-2 text-xs font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "بيئة الربط" : "Connection environment"}</Text>
    <View className={`mb-4 flex-row gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>{(["production", "sandbox"] as const).map((environment) => <Pressable key={environment} onPress={() => set("environment", environment)} style={[styles.choice, settings.environment === environment && styles.choiceActive]}><Text className={`text-xs font-bold ${settings.environment === environment ? "text-white" : "text-muted"}`}>{environment === "production" ? (isRTL ? "إنتاج" : "Production") : (isRTL ? "اختبار" : "Sandbox")}</Text></Pressable>)}</View>
    <View className={`mb-4 flex-row items-center gap-3 rounded-2xl bg-background p-3 ${isRTL ? "flex-row-reverse" : ""}`}><Switch value={settings.partnerAgreementConfirmed} onValueChange={(value) => set("partnerAgreementConfirmed", value)} trackColor={{ false: "#C9D7D3", true: "#75B8AE" }} thumbColor={settings.partnerAgreementConfirmed ? "#0F766E" : "#FFFFFF"} /><Text className={`flex-1 text-xs leading-5 text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "لدي اتفاقية شريك رسمية أو موافقة مكتوبة من المتجر." : "I have an official partner agreement or written store approval."}</Text></View>
    <View className="mb-4 rounded-2xl border border-[#D8DFF4] bg-[#F0F3FC] p-3"><View className={`flex-row items-start gap-2 ${isRTL ? "flex-row-reverse" : ""}`}><MaterialIcons name="lock-outline" size={18} color="#3F5DA8" /><Text className={`flex-1 text-xs leading-5 text-[#314A86] ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "لا تدخل مفتاح API أو Client Secret هنا. زر الاختبار يرسل معرّف الموصل فقط؛ ويقرأ الخادم الرابط المعتمد وبيانات الاعتماد السرية من إعداداته." : "Do not enter an API key or client secret here. The test button sends only the connector ID; the server reads the approved endpoint and secret credentials from its settings."}</Text></View></View>
    {resultCopy ? <View style={[styles.result, { borderColor: `${resultCopy.color}55`, backgroundColor: `${resultCopy.color}12` }]}><MaterialIcons name={testResult?.status === "connected" ? "check-circle" : "info-outline"} size={18} color={resultCopy.color} /><Text className={`flex-1 text-xs font-semibold ${isRTL ? "text-right" : "text-left"}`} style={{ color: resultCopy.color }}>{resultCopy.text}</Text></View> : null}
    <Pressable disabled={!loaded || saving} onPress={() => void save()} style={[styles.save, (!loaded || saving) && styles.disabled]}><MaterialIcons name="save" size={18} color="#FFFFFF" /><Text className="text-xs font-bold text-white">{saving ? (isRTL ? "جارٍ الحفظ…" : "Saving…") : (isRTL ? "حفظ المسودة" : "Save draft")}</Text></Pressable>
    <View className={`mt-2 flex-row gap-2 ${isRTL ? "flex-row-reverse" : ""}`}><Pressable disabled={!loaded || testConnection.isPending} onPress={() => void test()} style={[styles.test, (!loaded || testConnection.isPending) && styles.disabled]}><MaterialIcons name="wifi-tethering" size={18} color="#0F766E" /><Text className="text-xs font-bold text-primary">{testConnection.isPending ? (isRTL ? "جارٍ الاختبار…" : "Testing…") : (isRTL ? "اختبار الاتصال" : "Test connection")}</Text></Pressable><Pressable onPress={clear} style={styles.clear}><MaterialIcons name="delete-outline" size={18} color="#C73737" /><Text className="text-xs font-bold text-error">{isRTL ? "مسح" : "Clear"}</Text></Pressable></View>
  </View>;
}

function Field({ label, value, onChangeText, placeholder, isRTL, autoCapitalize = "sentences" }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; isRTL: boolean; autoCapitalize?: "none" | "sentences" }) {
  return <View className="mb-4"><Text className={`mb-2 text-xs font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8AA09C" autoCapitalize={autoCapitalize} autoCorrect={false} style={[styles.input, isRTL ? styles.right : styles.left]} /></View>;
}

const styles = StyleSheet.create({ card: { backgroundColor: "#FFFFFF", borderColor: "#9FCAC2", borderRadius: 20, borderWidth: 1, marginTop: 12, padding: 15 }, close: { alignItems: "center", backgroundColor: "#F4F7F6", borderRadius: 12, height: 34, justifyContent: "center", width: 34 }, status: { alignItems: "center", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 8, marginBottom: 16, marginTop: 14, padding: 10 }, result: { alignItems: "center", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 8, marginBottom: 12, padding: 10 }, input: { backgroundColor: "#F8FAF9", borderColor: "#DDE7E4", borderRadius: 13, borderWidth: 1, color: "#14201F", fontSize: 14, minHeight: 47, paddingHorizontal: 12 }, right: { textAlign: "right" }, left: { textAlign: "left" }, choice: { alignItems: "center", backgroundColor: "#F4F7F6", borderRadius: 12, flex: 1, justifyContent: "center", minHeight: 40 }, choiceActive: { backgroundColor: "#0F766E" }, save: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 13, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 42 }, test: { alignItems: "center", borderColor: "#9FCAC2", borderRadius: 13, borderWidth: 1, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 42 }, clear: { alignItems: "center", borderColor: "#F2CACA", borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 5, justifyContent: "center", minHeight: 42, paddingHorizontal: 14 }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.7 } });
