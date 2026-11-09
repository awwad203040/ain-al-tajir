import AsyncStorage from "@react-native-async-storage/async-storage";

export const SALES_CHANNELS = [
  { id: "storefront", icon: "storefront", name: { ar: "المتجر الإلكتروني", en: "Online store" } },
  { id: "marketplace", icon: "shopping-bag", name: { ar: "سوق إلكتروني", en: "Marketplace" } },
  { id: "social", icon: "campaign", name: { ar: "البيع عبر التواصل", en: "Social selling" } },
  { id: "physical", icon: "point-of-sale", name: { ar: "نقطة بيع", en: "Point of sale" } },
  { id: "other", icon: "sell", name: { ar: "قناة أخرى", en: "Other channel" } },
] as const;

export type SalesChannelId = (typeof SALES_CHANNELS)[number]["id"];
export type SalesChannelFeeProfile = {
  channelId: SalesChannelId;
  feeMinor: number;
  updatedAt: string;
};

const channelIds = new Set<string>(SALES_CHANNELS.map((channel) => channel.id));
const storageKey = (userId: string) => `ain-altajir-sales-channel-fees:${userId}`;

function isFeeProfile(value: unknown): value is SalesChannelFeeProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<SalesChannelFeeProfile>;
  return typeof profile.channelId === "string" && channelIds.has(profile.channelId) && typeof profile.feeMinor === "number" && Number.isInteger(profile.feeMinor) && profile.feeMinor > 0 && profile.feeMinor <= 1_000_000_000 && typeof profile.updatedAt === "string";
}

/** Keeps only merchant-entered, positive per-unit profiles, using the latest entry for a channel. */
export function normalizeSalesChannelFeeProfiles(value: unknown): SalesChannelFeeProfile[] {
  if (!Array.isArray(value)) return [];
  const byChannel = new Map<SalesChannelId, SalesChannelFeeProfile>();
  value.filter(isFeeProfile).forEach((profile) => {
    const existing = byChannel.get(profile.channelId);
    if (!existing || profile.updatedAt >= existing.updatedAt) byChannel.set(profile.channelId, profile);
  });
  return SALES_CHANNELS.map((channel) => byChannel.get(channel.id)).filter((profile): profile is SalesChannelFeeProfile => Boolean(profile));
}

export function feeProfileForChannel(profiles: SalesChannelFeeProfile[], channelId?: SalesChannelId) {
  return channelId ? profiles.find((profile) => profile.channelId === channelId) : undefined;
}

export async function loadSalesChannelFeeProfiles(userId: string): Promise<SalesChannelFeeProfile[]> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  try {
    return normalizeSalesChannelFeeProfiles(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export async function saveSalesChannelFeeProfiles(userId: string, profiles: SalesChannelFeeProfile[]) {
  const normalized = normalizeSalesChannelFeeProfiles(profiles);
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(normalized));
  return normalized;
}
