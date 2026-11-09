import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppHeader, PrimaryButton } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { haptic } from "@/lib/haptics";
import { saveFreeRegistrationDraft, validateFreeRegistration } from "@/lib/free-registration";
import { startOAuthLogin } from "@/constants/oauth";

export default function RegisterScreen() {
  const { isRTL } = useApp();
  const [form, setForm] = useState({ ownerName: "", contactPhone: "", ownerEmail: "" });
  const [starting, setStarting] = useState(false);
  const fields = [
    { key: "ownerName", label: isRTL ? "اسم صاحب المتجر" : "Store owner name", icon: "person-outline", keyboard: "default" },
    { key: "contactPhone", label: isRTL ? "رقم الجوال" : "Mobile number", icon: "phone-iphone", keyboard: "phone-pad" },
    { key: "ownerEmail", label: isRTL ? "البريد الإلكتروني" : "Email address", icon: "alternate-email", keyboard: "email-address" },
  ] as const;

  const begin = async () => {
    const invalid = validateFreeRegistration(form);
    if (invalid) {
      const copy = invalid === "owner_name" ? (isRTL ? "أدخل اسمًا صحيحًا لصاحب المتجر." : "Enter a valid store-owner name.") : invalid === "owner_email" ? (isRTL ? "أدخل بريدًا إلكترونيًا صحيحًا." : "Enter a valid email address.") : (isRTL ? "أدخل رقم جوال صحيحًا." : "Enter a valid mobile number.");
      return Alert.alert(isRTL ? "تحقق من بياناتك" : "Check your details", copy);
    }
    setStarting(true);
    try {
      await saveFreeRegistrationDraft(form);
      await startOAuthLogin();
    } finally { setStarting(false); }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-6">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#14201F" />
          </Pressable>
          <AppHeader title={isRTL ? "سجّل للتجربة المجانية" : "Register for free use"} subtitle={isRTL ? "أدخل بياناتك أولًا، ثم سجّل دخولك بأمان لاستكمال بيانات المتجر وبدء 7 أيام مجانًا." : "Enter your details, then sign in securely to complete store details and start 7 days free."} />
          <View className="gap-4">
            {fields.map((field) => (
              <View key={field.key}>
                <Text className={`mb-2 text-sm font-semibold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{field.label}</Text>
                <View style={styles.inputWrap}>
                  <MaterialIcons name={field.icon} size={20} color="#667A77" />
                  <TextInput
                    value={form[field.key]}
                    onChangeText={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
                    autoCapitalize={field.key === "ownerEmail" ? "none" : "sentences"}
                    keyboardType={field.keyboard}
                    returnKeyType={field.key === "ownerEmail" ? "done" : "next"}
                    style={[styles.input, isRTL ? styles.textRight : styles.textLeft]}
                  />
                </View>
              </View>
            ))}
          </View>
          <View className="mt-6 rounded-2xl bg-primary/10 p-4"><View className={`flex-row items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}><MaterialIcons name="event-available" size={21} color="#0F766E" /><Text className={`flex-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "لن تُطلب بطاقة. تحفظ هذه البيانات مع ملف متجرك وتبدأ الفترة المجانية بعد إكمال الإعداد." : "No card is required. These details are saved with your store profile and free use starts after setup."}</Text></View></View>
          <View className="mt-7">
            <PrimaryButton label={starting ? (isRTL ? "جارٍ فتح تسجيل الدخول…" : "Opening sign-in…") : (isRTL ? "متابعة وتسجيل الدخول" : "Continue and sign in")} onPress={() => void begin()} icon="login" />
            <Pressable accessibilityRole="button" onPress={() => { haptic.light(); router.replace("/login"); }} style={styles.loginLink}><Text className="text-sm font-semibold text-primary">{isRTL ? "لديك حساب؟ تسجيل الدخول" : "Already have an account? Sign in"}</Text></Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 28, paddingTop: 12 },
  backButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE7E4",
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    marginBottom: 24,
    width: 44,
  },
  inputWrap: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 16, borderWidth: 1, flexDirection: "row", paddingHorizontal: 15 },
  input: { color: "#14201F", flex: 1, fontSize: 16, minHeight: 54, paddingHorizontal: 12 },
  textRight: { textAlign: "right" },
  textLeft: { textAlign: "left" },
  loginLink: { alignItems: "center", padding: 16 },
});
