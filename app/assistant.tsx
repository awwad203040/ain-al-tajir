import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppHeader, StatusPill, TrialBanner } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { getAssistantAnswer } from "@/lib/business-logic";
import { haptic } from "@/lib/haptics";

type Message = { id: string; role: "user" | "assistant"; text: string; label?: "actual" | "estimate" | "forecast" };

export default function AssistantScreen() {
  const { t, isRTL, language } = useApp();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: isRTL ? "اسألني عن المبيعات، المخزون، الخسائر، الفروع أو الموردين. سأوضح دائمًا إن كانت النتيجة فعلية أم تقديرية." : "Ask about sales, inventory, losses, branches, or suppliers. I'll always mark whether a result is actual or estimated.",
    },
  ]);
  const questions = language === "ar"
    ? ["أين أخسر؟", "ما المنتجات التي ستنفد؟", "ما الذي يجب أن أفعله اليوم؟"]
    : ["Where am I losing money?", "Which products will run out?", "What should I do today?"];

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    haptic.light();
    const result = getAssistantAnswer(clean, language);
    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: "user", text: clean }, { id: `a-${Date.now()}`, role: "assistant", ...result }]);
    setInput("");
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View>
              <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><MaterialIcons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#14201F" /></Pressable>
              <AppHeader title={t("assistant")} subtitle={isRTL ? "إجابات من بيانات المتجر المتاحة فقط." : "Answers only from available store data."} />
              <TrialBanner compact />
              <Text className={`mb-3 text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{t("suggestedQuestions")}</Text>
              <View className="mb-5 gap-2">
                {questions.map((question) => (
                  <Pressable key={question} onPress={() => send(question)} style={({ pressed }) => [styles.question, pressed && styles.pressed]}>
                    <View className={`flex-row items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}><MaterialIcons name="auto-awesome" size={17} color="#3F5DA8" /><Text className={`flex-1 text-sm font-semibold text-[#314A86] ${isRTL ? "text-right" : "text-left"}`}>{question}</Text></View>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.message, item.role === "user" ? styles.userMessage : styles.assistantMessage, isRTL ? { alignSelf: item.role === "user" ? "flex-start" : "flex-end" } : { alignSelf: item.role === "user" ? "flex-end" : "flex-start" }]}>
              {item.label ? <View className="mb-2"><StatusPill label={t(item.label)} tone={item.label === "actual" ? "success" : item.label === "forecast" ? "primary" : "warning"} /></View> : null}
              <Text className={`${item.role === "user" ? "text-white" : "text-foreground"} text-sm leading-6 ${isRTL ? "text-right" : "text-left"}`}>{item.text}</Text>
              {item.role === "assistant" && item.label ? <Text className={`mt-2 text-[10px] text-muted ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "المصدر: سجلات المتجر المتاحة في الحساب" : "Source: store records available in this account"}</Text> : null}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
        <View className="border-t border-border bg-background pt-3">
          <View style={styles.composer}>
            <TextInput value={input} onChangeText={setInput} placeholder={t("askAssistant")} placeholderTextColor="#8AA09C" returnKeyType="send" onSubmitEditing={() => send(input)} style={[styles.composerInput, isRTL ? styles.textRight : styles.textLeft]} />
            <Pressable accessibilityRole="button" onPress={() => send(input)} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}><MaterialIcons name={isRTL ? "west" : "east"} size={21} color="#FFFFFF" /></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 18, paddingTop: 12 },
  backButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", marginBottom: 20, width: 44 },
  question: { backgroundColor: "#F0F3FC", borderColor: "#D8DFF4", borderRadius: 16, borderWidth: 1, padding: 13 },
  message: { borderRadius: 20, maxWidth: "88%", padding: 14 },
  userMessage: { backgroundColor: "#0F766E", borderBottomRightRadius: 6 },
  assistantMessage: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderWidth: 1, borderBottomLeftRadius: 6 },
  composer: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 18, borderWidth: 1, flexDirection: "row", marginBottom: 4, paddingHorizontal: 6 },
  composerInput: { color: "#14201F", flex: 1, fontSize: 15, minHeight: 52, paddingHorizontal: 12 },
  sendButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 14, height: 42, justifyContent: "center", width: 42 },
  textRight: { textAlign: "right" },
  textLeft: { textAlign: "left" },
  pressed: { opacity: 0.72 },
});
