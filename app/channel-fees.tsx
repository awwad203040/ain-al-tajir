import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useAuth } from "@/hooks/use-auth";
import { useApp } from "@/lib/app-context";
import { haptic } from "@/lib/haptics";
import { loadSalesChannelFeeProfiles, SALES_CHANNELS, saveSalesChannelFeeProfiles, type SalesChannelFeeProfile, type SalesChannelId } from "@/lib/sales-channel-fees";
import { toPriceMinor } from "@/shared/price-research";

type FeeDraft = Record<SalesChannelId, string>;

function emptyDraft(): FeeDraft {
  return Object.fromEntries(SALES_CHANNELS.map((channel) => [channel.id, ""])) as FeeDraft;
}

export default function ChannelFeesScreen() {
  return <SubscriptionGuard><ChannelFeesContent /></SubscriptionGuard>;
}

function ChannelFeesContent() {
  const { user } = useAuth();
  const { isRTL, language } = useApp();
  const ar = language === "ar";
  const [draft, setDraft] = useState<FeeDraft>(emptyDraft);
  const [loading, setLoading] = useState(Boolean(user?.id));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setDraft(emptyDraft());
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    void loadSalesChannelFeeProfiles(String(user.id)).then((profiles) => {
      if (!active) return;
      const next = emptyDraft();
      profiles.forEach((profile) => { next[profile.channelId] = (profile.feeMinor / 100).toFixed(2); });
      setDraft(next);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user?.id]);

  const savedCount = useMemo(() => Object.values(draft).filter((value) => Boolean(value.trim())).length, [draft]);
  const direction = isRTL ? styles.rowReverse : styles.row;
  const textAlign = isRTL ? styles.right : styles.left;

  const updateFee = (channelId: SalesChannelId, value: string) => {
    setDraft((current) => ({ ...current, [channelId]: value }));
  };

  const save = async () => {
    if (!user?.id || saving) return;
    const profiles: SalesChannelFeeProfile[] = [];
    for (const channel of SALES_CHANNELS) {
      const value = draft[channel.id].trim();
      if (!value) continue;
      const feeMinor = toPriceMinor(value);
      if (!feeMinor) {
        Alert.alert(ar ? "تحقق من الرسوم" : "Check fees", ar ? `أدخل مبلغًا موجبًا بالريال لقناة «${channel.name.ar}»، أو اترك الحقل فارغًا لإزالته.` : `Enter a positive SAR amount for “${channel.name.en}”, or clear the field to remove it.`);
        return;
      }
      profiles.push({ channelId: channel.id, feeMinor, updatedAt: new Date().toISOString() });
    }
    setSaving(true);
    try {
      await saveSalesChannelFeeProfiles(String(user.id), profiles);
      haptic.success();
      Alert.alert(ar ? "تم حفظ الرسوم" : "Fees saved", ar ? "ستظهر هذه المبالغ عند اختيار القناة في المقارنة الذكية. يمكنك تعديل مبلغ التطبيق قبل التوصية." : "These amounts appear when you choose a channel in Smart Comparison. You can still edit the applied amount before a recommendation.");
    } catch {
      Alert.alert(ar ? "تعذر الحفظ" : "Could not save", ar ? "حاول مرة أخرى بعد التحقق من مساحة الجهاز." : "Try again after checking available device storage.");
    } finally {
      setSaving(false);
    }
  };

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4">
    <FlatList
      data={SALES_CHANNELS}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#14201F" /></Pressable>
        <View style={styles.hero}><View style={[styles.row, direction]}><View style={styles.heroIcon}><MaterialIcons name="account-balance-wallet" size={26} color="#C6F2E9" /></View><View style={styles.flex}><Text style={[styles.heroTitle, textAlign]}>{ar ? "رسوم قنوات البيع" : "Sales channel fees"}</Text><Text style={[styles.heroText, textAlign]}>{ar ? "أدخل التكلفة الإضافية الحقيقية لكل وحدة حسب قناة البيع. لا توجد رسوم افتراضية أو أسعار منصات مفترضة." : "Enter the actual added cost per unit for each sales channel. No default fees or assumed marketplace rates are used."}</Text></View></View></View>
        <View style={[styles.notice, direction]}><MaterialIcons name="info-outline" size={19} color="#315B9C" /><Text style={[styles.noticeText, textAlign]}>{ar ? "يشمل المبلغ ما تختاره أنت مثل الشحن والعمولة والضريبة لكل وحدة. يطبق كحد أدنى للتوصية فقط، ويمكن تعديله في كل مقارنة. اترك الحقل فارغًا إذا لم تكن تريد تطبيق رسوم على القناة." : "Include only costs you choose, such as shipping, commission, and tax per unit. It is used only as a recommendation floor and remains editable in each comparison. Leave a field blank to remove a channel fee."}</Text></View>
        <View style={[styles.sectionHead, direction]}><Text style={[styles.sectionTitle, textAlign]}>{ar ? "مبلغ إضافي لكل وحدة (ر.س)" : "Added cost per unit (SAR)"}</Text><Text style={styles.count}>{savedCount} {ar ? "مبالغ مدخلة" : "entered"}</Text></View>
      </>}
      renderItem={({ item }) => <View style={styles.rowCard}><View style={[styles.row, direction]}><View style={styles.channelIcon}><MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={21} color="#0F766E" /></View><View style={styles.flex}><Text style={[styles.channelName, textAlign]}>{item.name[language]}</Text><Text style={[styles.channelHint, textAlign]}>{ar ? "تستخدم فقط عندما تختار هذه القناة." : "Used only when you select this channel."}</Text></View></View><View style={[styles.inputRow, direction]}><TextInput value={draft[item.id]} onChangeText={(value) => updateFee(item.id, value)} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#8AA09C" style={[styles.input, textAlign]} /><Text style={styles.sar}>SAR</Text><Pressable accessibilityRole="button" onPress={() => updateFee(item.id, "")} style={({ pressed }) => [styles.clear, pressed && styles.pressed]}><MaterialIcons name="close" size={18} color="#63847D" /><Text style={styles.clearText}>{ar ? "مسح" : "Clear"}</Text></Pressable></View></View>}
      ListFooterComponent={<View style={styles.footer}><Pressable disabled={saving || loading || !user?.id} accessibilityRole="button" onPress={() => void save()} style={({ pressed }) => [styles.save, (saving || loading || !user?.id) && styles.disabled, pressed && styles.pressed]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons name="save" size={19} color="#FFFFFF" />}<Text style={styles.saveText}>{saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ رسوم القنوات" : "Save channel fees")}</Text></Pressable><Text style={[styles.footerText, textAlign]}>{ar ? "تُحفظ هذه الإعدادات محليًا ضمن حسابك على هذا الجهاز، ولا ترسل أي معلومات إلى منصات البيع." : "These settings are stored locally for your account on this device; no data is sent to sales platforms."}</Text></View>}
      ListEmptyComponent={loading ? <View style={styles.loading}><ActivityIndicator color="#0F766E" /><Text style={styles.loadingText}>{ar ? "جارٍ تحميل الإعدادات…" : "Loading settings…"}</Text></View> : null}
    />
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28, paddingTop: 12 }, row: { alignItems: "center", flexDirection: "row", gap: 10 }, rowReverse: { flexDirection: "row-reverse" }, flex: { flex: 1 }, right: { textAlign: "right" }, left: { textAlign: "left" }, back: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", marginBottom: 18, width: 44 }, hero: { backgroundColor: "#0B3B3A", borderRadius: 25, padding: 19 }, heroIcon: { alignItems: "center", backgroundColor: "#FFFFFF18", borderRadius: 16, height: 52, justifyContent: "center", width: 52 }, heroTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", lineHeight: 31 }, heroText: { color: "#D7F4EE", fontSize: 12, lineHeight: 19, marginTop: 5 }, notice: { alignItems: "flex-start", backgroundColor: "#EFF5FF", borderColor: "#C6D7F2", borderRadius: 16, borderWidth: 1, gap: 8, marginTop: 14, padding: 12 }, noticeText: { color: "#315B9C", flex: 1, fontSize: 11, fontWeight: "700", lineHeight: 17 }, sectionHead: { justifyContent: "space-between", marginBottom: 9, marginTop: 20 }, sectionTitle: { color: "#14201F", fontSize: 15, fontWeight: "800" }, count: { color: "#0F766E", fontSize: 10, fontWeight: "800" }, rowCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 18, borderWidth: 1, marginBottom: 9, padding: 13 }, channelIcon: { alignItems: "center", backgroundColor: "#E8F5F1", borderRadius: 12, height: 38, justifyContent: "center", width: 38 }, channelName: { color: "#14201F", fontSize: 13, fontWeight: "800" }, channelHint: { color: "#6C827D", fontSize: 10, marginTop: 2 }, inputRow: { marginTop: 12 }, input: { backgroundColor: "#F8FAF9", borderColor: "#DDE7E4", borderRadius: 11, borderWidth: 1, color: "#14201F", flex: 1, fontSize: 14, fontWeight: "700", minHeight: 43, paddingHorizontal: 11 }, sar: { color: "#63847D", fontSize: 10, fontWeight: "800" }, clear: { alignItems: "center", flexDirection: "row", gap: 3, minHeight: 40, paddingHorizontal: 3 }, clearText: { color: "#63847D", fontSize: 10, fontWeight: "800" }, footer: { marginTop: 9 }, save: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 14, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 49 }, saveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, footerText: { color: "#63847D", fontSize: 10, lineHeight: 16, marginTop: 10 }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.72 }, loading: { alignItems: "center", padding: 26 }, loadingText: { color: "#63847D", fontSize: 12, marginTop: 9 },
});
