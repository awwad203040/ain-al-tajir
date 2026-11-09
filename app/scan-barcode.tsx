import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { useApp } from "@/lib/app-context";
import { haptic } from "@/lib/haptics";

const SUPPORTED_BARCODES = ["ean13", "ean8", "upc_a", "upc_e", "code128"] as const;

export default function ScanBarcodeScreen() {
  return <SubscriptionGuard><ScanBarcodeContent /></SubscriptionGuard>;
}

function ScanBarcodeContent() {
  const { isRTL, language } = useApp();
  const ar = language === "ar";
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);
  const direction = isRTL ? "flex-row-reverse" : "flex-row";
  const textAlign = isRTL ? "text-right" : "text-left";

  const returnToScout = (barcode?: string) => {
    if (barcode) {
      router.replace({ pathname: "/price-scout", params: { barcode } } as never);
      return;
    }
    router.back();
  };

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    const barcode = data.trim();
    if (hasScanned || !barcode) return;
    setHasScanned(true);
    haptic.success();
    returnToScout(barcode);
  };

  if (!permission) {
    return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="items-center justify-center px-6"><Text className="text-sm text-muted">{ar ? "جارٍ تجهيز الكاميرا…" : "Preparing camera…"}</Text></ScreenContainer>;
  }

  if (!permission.granted) {
    return <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5"><View style={styles.permissionCard}><View style={styles.permissionIcon}><MaterialIcons name="photo-camera" size={30} color="#0F766E" /></View><Text className={`mt-5 text-xl font-bold text-foreground ${textAlign}`}>{ar ? "مسح باركود المنتج" : "Scan product barcode"}</Text><Text className={`mt-3 text-sm leading-6 text-muted ${textAlign}`}>{ar ? "يُستخدم الوصول إلى الكاميرا لمسح الباركود على جهازك فقط. لا تُحفظ أي صورة أو فيديو." : "Camera access is used only to scan a barcode on your device. No photo or video is saved."}</Text><Pressable accessibilityRole="button" onPress={() => void requestPermission()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><MaterialIcons name="camera-alt" size={19} color="#FFFFFF" /><Text style={styles.primaryText}>{ar ? "السماح بالكاميرا" : "Allow camera"}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => returnToScout()} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryText}>{ar ? "العودة للباحث" : "Back to Price Scout"}</Text></Pressable></View></ScreenContainer>;
  }

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-[#071F1E]">
    <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: [...SUPPORTED_BARCODES] }} onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}>
      <View style={styles.overlay}>
        <View className={`flex-row items-center justify-between ${direction}`}>
          <Pressable accessibilityRole="button" accessibilityLabel={ar ? "العودة" : "Back"} onPress={() => returnToScout()} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}><MaterialIcons name="close" size={23} color="#FFFFFF" /></Pressable>
          <View className="flex-1 px-4"><Text className={`text-lg font-bold text-white ${textAlign}`}>{ar ? "مسح باركود المنتج" : "Scan product barcode"}</Text><Text className={`mt-1 text-xs text-[#D7F4EE] ${textAlign}`}>{ar ? "ضع الرمز داخل الإطار" : "Position the code inside the frame"}</Text></View>
        </View>
        <View style={styles.scanArea}><View style={[styles.corner, styles.cornerTopLeft]} /><View style={[styles.corner, styles.cornerTopRight]} /><View style={[styles.corner, styles.cornerBottomLeft]} /><View style={[styles.corner, styles.cornerBottomRight]} /></View>
        <View style={styles.footer}><MaterialIcons name="security" size={17} color="#C6F2E9" /><Text style={styles.footerText}>{ar ? "يُرسل الرقم الممسوح إلى باحث الأسعار فقط." : "Only the scanned number is sent to Price Scout."}</Text></View>
      </View>
    </CameraView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
  overlay: { backgroundColor: "rgba(4, 30, 29, 0.38)", flex: 1, justifyContent: "space-between", padding: 20 },
  closeButton: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.38)", borderRadius: 15, borderWidth: 1, height: 46, justifyContent: "center", width: 46 },
  scanArea: { alignSelf: "center", borderColor: "rgba(198,242,233,0.58)", borderRadius: 18, borderWidth: 1, height: 220, position: "relative", width: "88%" },
  corner: { borderColor: "#C6F2E9", height: 38, position: "absolute", width: 38 },
  cornerTopLeft: { borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 16, left: -2, top: -2 },
  cornerTopRight: { borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 16, right: -2, top: -2 },
  cornerBottomLeft: { borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16, bottom: -2, left: -2 },
  cornerBottomRight: { borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16, bottom: -2, right: -2 },
  footer: { alignItems: "center", alignSelf: "center", backgroundColor: "rgba(4,30,29,0.74)", borderColor: "rgba(198,242,233,0.28)", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 13, paddingVertical: 10 },
  footerText: { color: "#D7F4EE", fontSize: 11, fontWeight: "700" },
  permissionCard: { backgroundColor: "#FFFFFF", borderColor: "#DDE7E4", borderRadius: 25, borderWidth: 1, marginTop: "auto", marginBottom: "auto", padding: 22 },
  permissionIcon: { alignItems: "center", backgroundColor: "#E4F5F1", borderRadius: 18, height: 62, justifyContent: "center", width: 62 },
  primaryButton: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 22, minHeight: 50 },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  secondaryButton: { alignItems: "center", justifyContent: "center", marginTop: 12, minHeight: 42 },
  secondaryText: { color: "#315B9C", fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
