// NativeWind + Pressable: className can swallow onPress. Disable className mapping globally.
import { Pressable } from "react-native";
import { remapProps } from "nativewind";
try {
  remapProps(Pressable, { className: false });
} catch (e) {
  console.warn("[nativewind-pressable] remapProps error:", e);
}
