import AsyncStorage from "@react-native-async-storage/async-storage";

export type MarginTargetEvaluation = {
  targetPercent: number;
  actualPercent?: number;
  status: "below_target" | "on_target" | "needs_cost";
  gapPercent?: number;
};

const storageKey = (userId: string) => `ain-altajir-margin-target:${userId}`;

/** A target is optional and must be explicitly set by the merchant; no percentage is assumed. */
export function normalizeMarginTargetPercent(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 100) return undefined;
  const rounded = Number(value.toFixed(1));
  return rounded > 0 && rounded < 100 ? rounded : undefined;
}

/** Evaluates only an already-calculated gross margin; this function never changes a price or recommendation. */
export function evaluateMarginTarget(actualPercent: number | undefined, targetPercent: number | undefined): MarginTargetEvaluation | undefined {
  const target = normalizeMarginTargetPercent(targetPercent);
  if (!target) return undefined;
  if (typeof actualPercent !== "number" || !Number.isFinite(actualPercent)) return { targetPercent: target, status: "needs_cost" };
  const normalizedActual = Number(actualPercent.toFixed(1));
  const gapPercent = Number((normalizedActual - target).toFixed(1));
  return { targetPercent: target, actualPercent: normalizedActual, gapPercent, status: gapPercent < 0 ? "below_target" : "on_target" };
}

export async function loadMarginTargetPercent(userId: string): Promise<number | undefined> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return undefined;
  try {
    return normalizeMarginTargetPercent(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export async function saveMarginTargetPercent(userId: string, targetPercent: number | undefined) {
  const normalized = normalizeMarginTargetPercent(targetPercent);
  if (!normalized) {
    await AsyncStorage.removeItem(storageKey(userId));
    return undefined;
  }
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(normalized));
  return normalized;
}
