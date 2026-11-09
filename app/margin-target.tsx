import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useAuth } from "@/hooks/use-auth";
import { useApp } from "@/lib/app-context";
import { haptic } from "@/lib/haptics";
import { loadMarginTargetPercent, normalizeMarginTargetPercent, saveMarginTargetPercent } from "@/lib/margin-target";
import { toPriceMinor } from "@/shared/price-research";

export default function MarginTargetScreen() {
  return <SubscriptionGuard><MarginTargetContent /></SubscriptionGuard>;
}

function MarginTargetContent() {
  const { user } = useAuth();
  const { isRTL, language } = useApp();
  const ar = language === "ar";
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(Boolean(user?.id));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user?.id) { setTarget(""); setLoading(false); return () => { active = false; }; }
    setLoading(true);
    void loadMarginTargetPercent(String(user.id)).then((value) => {
      if (!active) return;
      setTarget(value ? String(value) : "");
      setLoading(false);
    });
    return () => { active = false; };
  }, [user?.id]);

  const save = async () => {
    if (!user?.id || saving) return;
    const raw = target.trim();
    const candidate = raw ? (toPriceMinor(raw) ?? 0) / 100 : undefined;
    const normalized = candidate === undefined ? undefined : normalizeMarginTargetPercent(candidate);
    if (raw && !normalized) {
      Alert.alert(ar ? "هدف غير صالح" : "Invalid target", ar ? "أدخل نسبة أكبر من 0 وأقل من 100، مثل 20 أو 22.5." : "Enter a percentage above 0 and below 100, such as 20 or 22.5.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveMarginTargetPercent(String(user.id), normalized);
      setTarget(saved ? String(saved) : "");
      haptic.success();
      Alert.alert(ar ? "تم حفظ الهدف" : "Target saved", saved ? (ar ? "سيظهر تنبيه عندما ينخفض الهامش الإجمالي المحسوب عن هذا الهدف. لا يتم تعديل أي سعر تلقائيًا." : "An alert will appear when the calculated gross margin is below this target. No price is changed automatically.") : (ar ? "تم إيقاف تنبيهات هدف الهامش." : "Margin-target alerts are now off."));
    } catch {
      Alert.alert(ar ? "تعذر الحفظ" : "Could not save", ar ? "حاول مرة أخرى بعد التحقق من مساحة الجهاز." : "Try again after checking available device storage.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      await saveMarginTargetPercent(String(user.id), undefined);
      setTarget("");
      haptic.success();
      Alert.alert(ar ? "تم إيقاف التنبيه" : "Alerts turned off", ar ? "لن تظهر تنبيهات هدف الهامش حتى تحدد هدفًا جديدًا." : "Margin-target alerts will stay off until you set a new target.");
    } catch {
      Alert.alert(ar ? "تعذر الحفظ" : "Could not save", ar ? "حاول مرة أخرى بعد التحقق من مساحة الجهاز." : "Try again after checking available device storage.");
    } finally {
      setSaving(false);
    }
  };
  const direction = isRTL ? styles.rowReverse : styles.row;
  const textAlign = isRTL ? styles.right : styles.left;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4"><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#14201F" /></Pressable>
    <View style={styles.hero}><View style={[styles.row, direction]}><View style={styles.heroIcon}><MaterialIcons name="trending-up" size={26} color="#C6F2E9" /></View><View style={styles.flex}><Text style={[styles.heroTitle, textAlign]}>{ar ? "هدف الهامش" : "Margin target"}</Text><Text style={[styles.heroText, textAlign]}>{ar ? "حدد حدًا مرجعيًا للهامش الإجمالي كي تظهر لك تنبيهات واضحة أثناء المقارنة." : "Set a gross-margin reference so clear alerts appear during Smart Comparison."}</Text></View></View></View>
    <View style={[styles.notice, direction]}><MaterialIcons name="info-outline" size={19} color="#315B9C" /><Text style={[styles.noticeText, textAlign]}>{ar ? "هذا الهدف اختياري ويعمل كتذكير فقط. لا يغير النطاق المقترح ولا سعر المتجر، ويحتاج إلى تكلفة منتج وإضافات مدخلة ليتم حساب الهامش." : "This optional target is only a reminder. It does not change the suggested range or store price, and needs entered product and add-on costs to calculate a margin."}</Text></View>
    <View style={styles.formCard}>{loading ? <View style={styles.loading}><ActivityIndicator color="#0F766E" /><Text style={styles.loadingText}>{ar ? "جارٍ تحميل الهدف…" : "Loading target…"}</Text></View> : <><Text style={[styles.label, textAlign]}>{ar ? "هدف الهامش الإجمالي (%)" : "Gross-margin target (%)"}</Text><View style={[styles.inputRow, direction]}><TextInput value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder={ar ? "مثال: 20" : "e.g. 20"} placeholderTextColor="#8AA09C" style={[styles.input, textAlign]} /><Text style={styles.percent}>%</Text></View><Text style={[styles.hint, textAlign]}>{ar ? "اترك الحقل فارغًا لإيقاف التنبيه. النطاق المقبول أكبر من 0 وأقل من 100." : "Leave it empty to turn alerts off. The accepted range is above 0 and below 100."}</Text></>}
    </View>
    <Pressable disabled={loading || saving || !user?.id} accessibilityRole="button" onPress={() => void save()} style={({ pressed }) => [styles.save, (loading || saving || !user?.id) && styles.disabled, pressed && styles.pressed]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons name="save" size={19} color="#FFFFFF" />}<Text style={styles.saveText}>{saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ هدف الهامش" : "Save margin target")}</Text></Pressable>
    {target.trim() ? <Pressable disabled={saving} accessibilityRole="button" onPress={() => void remove()} style={({ pressed }) => [styles.remove, pressed && styles.pressed]}><MaterialIcons name="remove-circle-outline" size={18} color="#7252A0" /><Text style={styles.removeText}>{ar ? "إيقاف تنبيهات الهدف" : "Turn off target alerts"}</Text></Pressable> : null}
    <View style={[styles.footer, direction]}><MaterialIcons name="verified-user" size={19} color="#176458" /><Text style={[styles.footerText, textAlign]}>{ar ? "يقارن التطبيق الهامش الإجمالي المحسوب بالهدف ويعرض الفرق فقط؛ يبقى قرار التسعير بيد التاجر." : "The app only compares a calculated gross margin with the target and shows the gap; the pricing decision remains with the merchant."}</Text></View>
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30, paddingTop: 12 }, row: { alignItems: "center", flexDirection: "row", gap: 12 }, rowReverse: { flexDirection: "row-reverse" }, flex: { flex: 1 }, right: { textAlign: "right" }, left: { textAlign: "left" }, back: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", marginBottom: 18, width: 44 }, hero: { backgroundColor: "#0B3B3A", borderRadius: 25, padding: 19 }, heroIcon: { alignItems: "center", backgroundColor: "#FFFFFF18", borderRadius: 16, height: 52, justifyContent: "center", width: 52 }, heroTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", lineHeight: 31 }, heroText: { color: "#D7F4EE", fontSize: 12, lineHeight: 19, marginTop: 5 }, notice: { alignItems: "flex-start", backgroundColor: "#EFF5FF", borderColor: "#C6D7F2", borderRadius: 16, borderWidth: 1, gap: 8, marginTop: 14, padding: 12 }, noticeText: { color: "#315B9C", flex: 1, fontSize: 11, fontWeight: "700", lineHeight: 17 }, formCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 20, borderWidth: 1, marginTop: 14, padding: 16 }, label: { color: "#14201F", fontSize: 13, fontWeight: "800" }, inputRow: { alignItems: "center", marginTop: 10 }, input: { backgroundColor: "#F8FAF9", borderColor: "#DDE7E4", borderRadius: 12, borderWidth: 1, color: "#14201F", flex: 1, fontSize: 16, fontWeight: "800", minHeight: 48, paddingHorizontal: 12 }, percent: { color: "#0F766E", fontSize: 17, fontWeight: "800" }, hint: { color: "#63847D", fontSize: 10, lineHeight: 16, marginTop: 10 }, save: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 14, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 14, minHeight: 49 }, saveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, remove: { alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 5, marginTop: 10, minHeight: 40, paddingHorizontal: 10 }, removeText: { color: "#7252A0", fontSize: 11, fontWeight: "800" }, footer: { alignItems: "flex-start", backgroundColor: "#E7F6F1", borderColor: "#B7DED4", borderRadius: 15, borderWidth: 1, gap: 8, marginTop: 18, padding: 12 }, footerText: { color: "#176458", flex: 1, fontSize: 10, fontWeight: "700", lineHeight: 16 }, loading: { alignItems: "center", padding: 15 }, loadingText: { color: "#63847D", fontSize: 12, marginTop: 8 }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.72 },
});
