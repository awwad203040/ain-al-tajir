import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useApp } from "@/lib/app-context";
import { haptic } from "@/lib/haptics";
import { startOAuthLogin } from "@/constants/oauth";

export default function LoginScreen() {
  const { t, isRTL, language, setLanguage } = useApp();
  const { isAuthenticated, loading } = useAuth();
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace("/auth/continue" as never);
  }, [isAuthenticated, loading]);

  const signIn = async () => {
    setStarting(true);
    try {
      await startOAuthLogin();
    } finally {
      setStarting(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-6">
      <ScrollView contentContainerStyle={styles.loginContent} showsVerticalScrollIndicator={false}>
        <View className={`mb-8 flex-row items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
          <View className={`flex-row items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Image source={require("@/assets/images/icon.png")} style={styles.logo} />
            <Text className="text-lg font-bold text-foreground">{t("appName")}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => { haptic.selection(); void setLanguage(language === "ar" ? "en" : "ar"); }} style={({ pressed }) => [styles.languageButton, pressed && styles.pressed]}>
            <MaterialIcons name="language" size={18} color="#0F766E" />
            <Text className="text-sm font-bold text-primary">{language === "ar" ? "EN" : "ع"}</Text>
          </Pressable>
        </View>

        <View className="mb-8">
          <Text className={`text-3xl font-bold leading-10 text-foreground ${isRTL ? "text-right" : "text-left"}`}>{t("welcome")}</Text>
          <Text className={`mt-3 text-base leading-7 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "أنشئ ملف متجرك بعد الدخول وابدأ استخدامًا مجانيًا لمدة 7 أيام، ثم اختر الاشتراك عند انتهاء المدة." : "Sign in, complete your store profile, and start a 7-day free period before choosing a subscription."}</Text>
        </View>

        <View className="mb-6 rounded-3xl border border-border bg-surface p-5">
          {[
            { icon: "verified-user", ar: "جلسة دخول فعلية ومشفرة", en: "A real, secure sign-in session" },
            { icon: "event-available", ar: "فترة استخدام مجانية لمدة 7 أيام", en: "A 7-day free usage period" },
            { icon: "storefront", ar: "بيانات المتجر محفوظة في حسابك", en: "Store details stay linked to your account" },
          ].map((item) => (
            <View key={item.ar} className={`mb-4 last:mb-0 flex-row items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-primary/10"><MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={20} color="#0F766E" /></View>
              <Text className={`flex-1 text-sm font-semibold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{language === "ar" ? item.ar : item.en}</Text>
            </View>
          ))}
        </View>

        <View className="gap-3">
          <PrimaryButton label={starting ? (isRTL ? "جارٍ فتح تسجيل الدخول…" : "Opening sign-in…") : (isRTL ? "تسجيل الدخول" : "Sign in")} onPress={() => void signIn()} icon="login" />
          <Pressable accessibilityRole="button" onPress={() => { haptic.light(); router.push("/register"); }} style={({ pressed }) => [styles.freeRegistrationButton, pressed && styles.pressed]}>
            <MaterialIcons name="person-add-alt-1" size={19} color="#0F766E" />
            <Text style={styles.freeRegistrationText}>{isRTL ? "تسجيل جديد — ابدأ 7 أيام مجانًا" : "New registration — start 7 days free"}</Text>
          </Pressable>
        </View>

        <View className="mt-7 rounded-2xl bg-primary/10 p-4">
          <View className={`flex-row items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            <MaterialIcons name="info-outline" color="#0F766E" size={21} />
            <Text className={`flex-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "لن تُطلب بطاقة أو تُنفذ أي عملية دفع عند بدء الفترة المجانية. تُفتح أدوات الحساب لمدة 7 أيام بعد حفظ بيانات التاجر والمتجر." : "No card is requested and no charge is made when free use starts. Account tools open for 7 days after merchant and store details are saved."}</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loginContent: { flexGrow: 1, justifyContent: "center", paddingBottom: 24, paddingTop: 16 },
  logo: { borderRadius: 14, height: 44, width: 44 },
  languageButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 9 },
  freeRegistrationButton: { alignItems: "center", backgroundColor: "#E4F5F1", borderColor: "#9FCAC2", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 50 },
  freeRegistrationText: { color: "#0F766E", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.72 },
});
