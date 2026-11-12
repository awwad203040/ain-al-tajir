import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useApp } from "@/lib/app-context";
import { trpc } from "@/lib/trpc";
import { checkLocalTrialAccess } from "@/lib/local-account";

export function SubscriptionGuard({ children, allowBranchManager = false }: { children: ReactNode; allowBranchManager?: boolean }) {
  const { isRTL } = useApp();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [localTrialActive, setLocalTrialActive] = useState<boolean | null>(null);

  const account = trpc.access.status.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });
  const access = account.data?.access;

  useEffect(() => {
    let mounted = true;
    checkLocalTrialAccess().then((active) => {
      if (mounted) setLocalTrialActive(active);
    });
    return () => { mounted = false; };
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login" as never);
      return;
    }
    if (localTrialActive) return;
    if (account.isLoading) return;
    if (!access?.hasAccess && localTrialActive === false) {
      router.replace(access?.kind === "setup" ? "/onboarding" as never : "/module/subscription" as never);
      return;
    }
    if (access?.kind === "branch_manager" && !allowBranchManager) {
      router.replace("/branch-transfers" as never);
    }
  }, [access?.hasAccess, access?.kind, account.isLoading, allowBranchManager, authLoading, isAuthenticated, localTrialActive]);

  if (authLoading || localTrialActive === null) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="items-center justify-center px-6">
        <View className="h-16 w-16 items-center justify-center rounded-3xl bg-primary/10"><ActivityIndicator color="#0F766E" size="large" /></View>
        <Text className="mt-5 text-center text-base font-bold text-foreground">{isRTL ? "جارٍ التحقق من حسابك…" : "Checking your account…"}</Text>
        <Text className="mt-2 text-center text-sm leading-6 text-muted">{isRTL ? "تُفتح لوحة التحكم عند وجود فترة استخدام سارية أو اشتراك نشط." : "The dashboard opens with an active free period or subscription."}</Text>
      </ScreenContainer>
    );
  }

  if (localTrialActive || access?.hasAccess) {
    return children;
  }

  if (account.isLoading) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="items-center justify-center px-6">
        <View className="h-16 w-16 items-center justify-center rounded-3xl bg-primary/10"><ActivityIndicator color="#0F766E" size="large" /></View>
        <Text className="mt-5 text-center text-base font-bold text-foreground">{isRTL ? "جارٍ التحقق من حسابك…" : "Checking your account…"}</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="items-center justify-center px-6">
      <MaterialIcons name="lock-outline" size={32} color="#0F766E" />
    </ScreenContainer>
  );
}
