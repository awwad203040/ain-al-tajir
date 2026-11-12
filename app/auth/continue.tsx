import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useApp } from "@/lib/app-context";
import { trpc } from "@/lib/trpc";

import { checkLocalTrialAccess } from "@/lib/local-account";

export default function AuthContinueScreen() {
  const { isRTL } = useApp();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const account = trpc.access.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login" as never);
      return;
    }
    if (account.isLoading) return;
    const kind = account.data?.access.kind;
    if (kind === "branch_manager") {
      router.replace("/branch-transfers" as never);
    } else if (kind === "setup") {
      router.replace("/onboarding" as never);
    } else {
      // For trial, paid, or offline/standalone mobile, route directly to dashboard!
      router.replace("/(tabs)/dashboard" as never);
    }
  }, [account.data?.access.kind, account.isLoading, authLoading, isAuthenticated]);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="items-center justify-center px-6">
      <View className="h-16 w-16 items-center justify-center rounded-3xl bg-primary/10">
        {account.isError ? <MaterialIcons name="error-outline" size={31} color="#C73737" /> : <ActivityIndicator color="#0F766E" size="large" />}
      </View>
      <Text className="mt-5 text-center text-xl font-bold text-foreground">{isRTL ? "جارٍ تجهيز حسابك" : "Preparing your account"}</Text>
      <Text className="mt-2 text-center text-sm leading-6 text-muted">{isRTL ? "نتحقق من بيانات المتجر وفترة الاستخدام أو حالة الاشتراك قبل المتابعة." : "We are checking the store profile, free period, or subscription status before continuing."}</Text>
    </ScreenContainer>
  );
}
