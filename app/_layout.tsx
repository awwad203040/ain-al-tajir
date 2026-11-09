import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { ActivityIndicator, Platform, View } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { AppProvider, useApp } from "@/lib/app-context";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { useAuth } from "@/hooks/use-auth";
import { clearTrialReminderSchedule, getTrialReminderPreference, scheduleTrialReminders } from "@/lib/trial-notifications";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export const unstable_settings = {
  anchor: "(tabs)",
};

function AppReadyGate({ children }: { children: React.ReactNode }) {
  const { isReady } = useApp();
  if (!isReady) {
    return (
      <View style={{ alignItems: "center", backgroundColor: "#F4F7F6", flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color="#0F766E" size="large" />
      </View>
    );
  }
  return children;
}

function BranchNotificationObserver() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const openBranchReceipt = (response: Notifications.NotificationResponse | null) => {
      const route = response?.notification.request.content.data?.route;
      if (route === "/branch-transfers") router.push("/branch-transfers" as never);
      if (route === "/inventory-operations") router.push("/inventory-operations" as never);
    };
    void Notifications.getLastNotificationResponseAsync().then(openBranchReceipt).catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(openBranchReceipt);
    return () => subscription.remove();
  }, []);
  return null;
}

function TrialReminderObserver() {
  const { isAuthenticated } = useAuth();
  const { language } = useApp();
  const account = trpc.access.status.useQuery(undefined, { enabled: isAuthenticated, retry: false, staleTime: 30_000 });

  useEffect(() => {
    if (Platform.OS === "web" || !isAuthenticated || account.isLoading) return;
    void (async () => {
      const enabled = await getTrialReminderPreference();
      if (enabled && account.data?.access.kind === "trial" && account.data.profile?.trialEndsAt) {
        await scheduleTrialReminders(account.data.profile.trialEndsAt, language);
      } else if (!enabled || account.data?.access.kind === "paid" || account.data?.access.kind === "subscription") {
        await clearTrialReminderSchedule();
      }
    })();
  }, [account.data?.access.kind, account.data?.profile?.trialEndsAt, account.isLoading, isAuthenticated, language]);
  return null;
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
          {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
          {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="auth/continue" />
            <Stack.Screen name="register" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="assistant" />
            <Stack.Screen name="price-scout" />
            <Stack.Screen name="channel-fees" />
            <Stack.Screen name="margin-target" />
            <Stack.Screen name="pricing-decisions" />
            <Stack.Screen name="procurement" />
            <Stack.Screen name="inventory-operations" />
            <Stack.Screen name="replenishment-history" />
            <Stack.Screen name="replenishment-history/[requestId]" />
            <Stack.Screen name="replenishment-variance" />
            <Stack.Screen name="branch-transfers" />
            <Stack.Screen name="scan-barcode" />
            <Stack.Screen name="insight/[id]" />
            <Stack.Screen name="module/[slug]" />
            <Stack.Screen name="subscription/success" />
            <Stack.Screen name="subscription/cancel" />
            <Stack.Screen name="legal/[document]" />
            <Stack.Screen name="oauth/callback" />
          </Stack>
          <BranchNotificationObserver />
          <TrialReminderObserver />
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <AppProvider>
          <SafeAreaProvider initialMetrics={providerInitialMetrics}>
            <SafeAreaFrameContext.Provider value={frame}>
              <SafeAreaInsetsContext.Provider value={insets}>
                <AppReadyGate>{content}</AppReadyGate>
              </SafeAreaInsetsContext.Provider>
            </SafeAreaFrameContext.Provider>
          </SafeAreaProvider>
        </AppProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AppProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}><AppReadyGate>{content}</AppReadyGate></SafeAreaProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
