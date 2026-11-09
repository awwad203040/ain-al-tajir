import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { HapticTab } from "@/components/haptic-tab";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { SubscriptionGuard } from "@/components/subscription-guard";

export default function TabLayout() {
  const colors = useColors();
  const { t } = useApp();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 16 : Math.max(insets.bottom, 10);
  const tabBarHeight = 64 + bottomPadding;

  return (
    <SubscriptionGuard>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 10,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("home"),
          tabBarIcon: ({ color, focused }) => <MaterialIcons size={25} name={focused ? "home" : "home-filled"} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: t("sales"),
          tabBarIcon: ({ color }) => <MaterialIcons size={25} name="bar-chart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="losses"
        options={{
          title: t("lossCenter"),
          tabBarIcon: ({ color }) => <MaterialIcons size={25} name="policy" color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: t("inventory"),
          tabBarIcon: ({ color }) => <MaterialIcons size={25} name="inventory-2" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("more"),
          tabBarIcon: ({ color }) => <MaterialIcons size={25} name="grid-view" color={color} />,
        }}
      />
    </Tabs>
    </SubscriptionGuard>
  );
}
