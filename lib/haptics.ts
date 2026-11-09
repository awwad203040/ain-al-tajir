import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export const haptic = {
  light: () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  selection: () => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
  },
  success: () => {
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
};
