import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ConnectorStatus, StoreConnectorId, StoreDatasetType } from "@/lib/store-connectors";
import type { PartnerApiSettings, PartnerConnectorId } from "@/lib/partner-api-settings";

export type ConnectorState = { connectorId: StoreConnectorId; status: ConnectorStatus; lastSyncAt?: string; lastFileName?: string; lastDataset?: StoreDatasetType; rowsImported?: number; errorSummary?: string };
const KEY = "ain-altajir-connectors";
const PARTNER_API_KEY = "ain-altajir-partner-api-settings";

export async function loadConnectorStates(): Promise<Record<string, ConnectorState>> {
  const raw = await AsyncStorage.getItem(KEY);
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export async function saveConnectorState(state: ConnectorState) {
  const current = await loadConnectorStates();
  const next = { ...current, [state.connectorId]: state };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function loadPartnerApiSettings(connectorId: PartnerConnectorId): Promise<PartnerApiSettings | undefined> {
  const raw = await AsyncStorage.getItem(PARTNER_API_KEY);
  try { return raw ? (JSON.parse(raw) as Record<string, PartnerApiSettings>)[connectorId] : undefined; } catch { return undefined; }
}

export async function savePartnerApiSettings(settings: PartnerApiSettings) {
  const raw = await AsyncStorage.getItem(PARTNER_API_KEY);
  let current: Record<string, PartnerApiSettings> = {};
  try { current = raw ? JSON.parse(raw) : {}; } catch { current = {}; }
  const next = { ...current, [settings.connectorId]: settings };
  await AsyncStorage.setItem(PARTNER_API_KEY, JSON.stringify(next));
  return next;
}

export async function removePartnerApiSettings(connectorId: PartnerConnectorId) {
  const raw = await AsyncStorage.getItem(PARTNER_API_KEY);
  let current: Record<string, PartnerApiSettings> = {};
  try { current = raw ? JSON.parse(raw) : {}; } catch { current = {}; }
  delete current[connectorId];
  await AsyncStorage.setItem(PARTNER_API_KEY, JSON.stringify(current));
}
