import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useApp } from "@/lib/app-context";
import { haptic } from "@/lib/haptics";
import { loadConnectorStates, saveConnectorState, type ConnectorState } from "@/lib/store-connector-storage";
import { saveStoreCatalogProducts } from "@/lib/store-product-catalog";
import { parseStoreProductWorkbook, parseStoreWorkbook, requiredColumns, STORE_CONNECTORS, type StoreConnectorId, type StoreDatasetType } from "@/lib/store-connectors";

const DATASETS: { id: StoreDatasetType; ar: string; en: string }[] = [{ id: "products", ar: "المنتجات", en: "Products" }, { id: "sales", ar: "المبيعات", en: "Sales" }, { id: "inventory", ar: "المخزون", en: "Inventory" }];

export function StoreIntegrationsPanel() {
  const { isRTL, language } = useApp();
  const { user } = useAuth();
  const [dataset, setDataset] = useState<StoreDatasetType>("products");
  const [states, setStates] = useState<Record<string, ConnectorState>>({});
  const [busy, setBusy] = useState<StoreConnectorId | null>(null);
  useEffect(() => { void loadConnectorStates().then(setStates); }, []);
  const persist = async (value: ConnectorState) => setStates(await saveConnectorState(value));
  const pick = async (connectorId: StoreConnectorId) => {
    haptic.light(); setBusy(connectorId);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if ((asset.size ?? 0) > 5 * 1024 * 1024) throw new Error(language === "ar" ? "حجم الملف أكبر من 5 ميجابايت." : "File is larger than 5 MB.");
      const bytes = asset.file ? await asset.file.arrayBuffer() : await new File(asset.uri).arrayBuffer();
      const outcome = parseStoreWorkbook(bytes, dataset);
      if (!outcome.valid) {
        const issue = outcome.missing.length ? `${language === "ar" ? "أعمدة مفقودة" : "Missing columns"}: ${outcome.missing.join(", ")}` : outcome.errors.join(" · ");
        await persist({ connectorId, status: "sync_error", lastDataset: dataset, lastFileName: asset.name, errorSummary: issue });
        Alert.alert(language === "ar" ? "لم يتم قبول الاستيراد" : "Import not accepted", issue); return;
      }
      const productCatalog = dataset === "products" ? parseStoreProductWorkbook(bytes) : undefined;
      if (productCatalog && !productCatalog.valid) {
        const issue = productCatalog.errors.join(" · ") || (language === "ar" ? "تعذر قراءة قائمة المنتجات." : "Could not read the product catalog.");
        await persist({ connectorId, status: "sync_error", lastDataset: dataset, lastFileName: asset.name, errorSummary: issue });
        Alert.alert(language === "ar" ? "لم يتم قبول الاستيراد" : "Import not accepted", issue); return;
      }
      if (productCatalog) {
        const userId = user?.id;
        if (!userId) throw new Error(language === "ar" ? "يلزم حساب تاجر مسجل لحفظ كتالوج المنتجات." : "A signed-in merchant account is required to save the product catalog.");
        await saveStoreCatalogProducts(String(userId), productCatalog.products.map((product) => ({ ...product, importedAt: new Date().toISOString() })));
      }
      await persist({ connectorId, status: "synced", lastDataset: dataset, lastFileName: asset.name, rowsImported: outcome.rowCount, lastSyncAt: new Date().toISOString() });
      const productsWithCost = productCatalog?.products.filter((product) => product.costMinor).length ?? 0;
      const acceptedMessage = productCatalog ? (language === "ar" ? `تم حفظ ${productCatalog.products.length} منتجًا محليًا للمقارنة الذكية${productsWithCost ? `، منها ${productsWithCost} مع تكلفة اختيارية.` : ""}` : `${productCatalog.products.length} products were saved locally for Smart Comparison${productsWithCost ? `, including optional cost for ${productsWithCost}.` : "."}`) : (language === "ar" ? `تم قبول ${outcome.rowCount} صفًا.` : `${outcome.rowCount} rows were accepted.`);
      Alert.alert(language === "ar" ? "تم التحقق من الملف" : "File validated", acceptedMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : (language === "ar" ? "تعذر قراءة الملف." : "Could not read the file.");
      await persist({ connectorId, status: "sync_error", lastDataset: dataset, errorSummary: message });
      Alert.alert(language === "ar" ? "فشل الاستيراد" : "Import failed", message);
    } finally { setBusy(null); }
  };
  return <View>
    <View className="mb-5 rounded-3xl bg-[#0B3B3A] p-5"><View className={`flex-row items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}><View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><MaterialIcons name="sync" size={24} color="#fff" /></View><View className="flex-1"><Text className={`text-lg font-bold text-white ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "مصادر بيانات موثوقة" : "Trusted data sources"}</Text><Text className={`mt-1 text-xs leading-5 text-white/70 ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "ربط رسمي عبر اتفاقية شريك، أو استيراد ملف صادر من نظامك. لا نستخرج بيانات المواقع العامة." : "Official partner connection, or import a system export. We never scrape public sites."}</Text></View></View></View>
    <Text className={`mb-3 text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "نوع البيانات" : "Dataset"}</Text><View className={`mb-4 flex-row gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>{DATASETS.map((item) => <Pressable key={item.id} onPress={() => setDataset(item.id)} style={[styles.chip, dataset === item.id && styles.activeChip]}><Text className={`text-xs font-bold ${dataset === item.id ? "text-white" : "text-muted"}`}>{item[language]}</Text></Pressable>)}</View>
    <View className="mb-5 rounded-2xl border border-border bg-surface p-4"><Text className={`text-sm font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "الأعمدة المطلوبة" : "Required columns"}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{requiredColumns(dataset).join(" · ")}</Text>{dataset === "products" ? <Text className={`mt-2 text-[11px] leading-5 text-primary ${isRTL ? "text-right" : "text-left"}`}>{isRTL ? "يمكن إضافة عمود اختياري: cost أو cost_price أو تكلفة المنتج؛ يُستخدم كحد أدنى للتوصية فقط." : "Optional column: cost, cost_price, or product cost; it is used only as a recommendation floor."}</Text> : null}</View>
    <View className="gap-3">{STORE_CONNECTORS.filter((connector) => connector.id === "custom").map((connector) => { const state = states[connector.id]; const errored = state?.status === "sync_error"; return <View key={connector.id} style={styles.card}><View className={`flex-row items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}><View style={[styles.icon, { backgroundColor: `${connector.color}18` }]}><MaterialIcons name={connector.icon} size={22} color={connector.color} /></View><View className="flex-1"><Text className={`text-base font-bold text-foreground ${isRTL ? "text-right" : "text-left"}`}>{connector.name[language]}</Text><Text className={`mt-1 text-xs leading-5 text-muted ${isRTL ? "text-right" : "text-left"}`}>{connector.description[language]}</Text></View></View>{state?.lastSyncAt ? <Text className={`mt-3 text-[11px] ${isRTL ? "text-right" : "text-left"} text-success`}>{isRTL ? `تم التحقق: ${state.rowsImported} صفًا · ${state.lastFileName}` : `Validated: ${state.rowsImported} rows · ${state.lastFileName}`}</Text> : null}{errored ? <Text className={`mt-3 text-[11px] leading-5 text-error ${isRTL ? "text-right" : "text-left"}`}>{state.errorSummary}</Text> : null}<View className={`mt-4 flex-row gap-2 ${isRTL ? "flex-row-reverse" : ""}`}><Pressable disabled={busy === connector.id} onPress={() => void pick(connector.id)} style={[styles.import, busy === connector.id && styles.disabled]}><MaterialIcons name="upload-file" size={17} color="#fff" /><Text className="text-xs font-bold text-white">{busy === connector.id ? (isRTL ? "جارٍ التحقق…" : "Checking…") : (isRTL ? "استيراد ملف" : "Import file")}</Text></Pressable></View></View>; })}</View>
  </View>;
}
const styles = StyleSheet.create({ chip: { alignItems: "center", backgroundColor: "#fff", borderColor: "#DDE7E4", borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 40 }, activeChip: { backgroundColor: "#0F766E", borderColor: "#0F766E" }, card: { backgroundColor: "#fff", borderColor: "#DDE7E4", borderRadius: 20, borderWidth: 1, padding: 15 }, icon: { alignItems: "center", borderRadius: 15, height: 45, justifyContent: "center", width: 45 }, import: { alignItems: "center", backgroundColor: "#0F766E", borderRadius: 13, flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 42 }, disabled: { opacity: 0.55 } });
