import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "ain-altajir-free-registration-draft";

export type FreeRegistrationDraft = { ownerName: string; ownerEmail: string; contactPhone: string };

export function validateFreeRegistration(input: FreeRegistrationDraft): string | undefined {
  if (input.ownerName.trim().length < 2) return "owner_name";
  if (!/^\S+@\S+\.\S+$/.test(input.ownerEmail.trim())) return "owner_email";
  if (input.contactPhone.replace(/\s/g, "").length < 7) return "contact_phone";
  return undefined;
}

export async function saveFreeRegistrationDraft(draft: FreeRegistrationDraft) {
  const normalized = { ownerName: draft.ownerName.trim(), ownerEmail: draft.ownerEmail.trim().toLowerCase(), contactPhone: draft.contactPhone.trim() };
  await AsyncStorage.setItem(KEY, JSON.stringify(normalized));
  return normalized;
}

export async function loadFreeRegistrationDraft(): Promise<FreeRegistrationDraft | undefined> {
  const raw = await AsyncStorage.getItem(KEY);
  try { return raw ? JSON.parse(raw) as FreeRegistrationDraft : undefined; } catch { return undefined; }
}

export async function clearFreeRegistrationDraft() {
  await AsyncStorage.removeItem(KEY);
}
