import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Auth from "./_core/auth";

export const LOCAL_PROFILE_KEY = "ain-altajir-local-merchant-profile";
export const LOCAL_TRIAL_KEY = "ain-altajir-local-trial-active";

export type LocalMerchantProfile = {
  id: number;
  userId: number;
  ownerName: string;
  ownerEmail: string;
  contactPhone: string;
  storeName: string;
  businessType: string;
  city: string;
  branchCount: number;
  taxNumber?: string;
  trialStartedAt: string;
  trialEndsAt: string;
};

export async function createLocalUserSession(input: {
  name: string;
  email: string;
  phone?: string;
}): Promise<Auth.User> {
  const user: Auth.User = {
    id: 1,
    openId: "owner_local_" + Date.now(),
    name: input.name,
    email: input.email,
    loginMethod: "local",
    lastSignedIn: new Date(),
  };

  await Auth.setSessionToken("local_token_" + Date.now());
  await Auth.setUserInfo(user);

  const now = new Date();
  const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await AsyncStorage.setItem(
    LOCAL_TRIAL_KEY,
    JSON.stringify({
      active: true,
      trialStartedAt: now.toISOString(),
      trialEndsAt: trialEnds.toISOString(),
    }),
  );

  return user;
}

export async function ensureLocalUserSession(): Promise<Auth.User> {
  const existingUser = await Auth.getUserInfo();
  if (existingUser) {
    const token = await Auth.getSessionToken();
    if (!token) {
      await Auth.setSessionToken("local_token_existing");
    }
    return existingUser;
  }

  return createLocalUserSession({
    name: "تاجر عين التاجر",
    email: "owner@ain-altajir.sa",
    phone: "0500000000",
  });
}

export async function loginAsDemoUser(): Promise<Auth.User> {
  const user = await createLocalUserSession({
    name: "التاجر التجريبي",
    email: "demo@ain-altajir.sa",
    phone: "0555555555",
  });

  const now = new Date();
  const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const demoProfile: LocalMerchantProfile = {
    id: 1,
    userId: 1,
    ownerName: "التاجر التجريبي",
    ownerEmail: "demo@ain-altajir.sa",
    contactPhone: "0555555555",
    storeName: "متجر الرواد (تجريبي)",
    businessType: "تجزئة وعطور",
    city: "الرياض",
    branchCount: 3,
    taxNumber: "300000000000003",
    trialStartedAt: now.toISOString(),
    trialEndsAt: trialEnds.toISOString(),
  };

  await saveLocalMerchantProfile(demoProfile);
  return user;
}

export async function saveLocalMerchantProfile(
  profile: Partial<LocalMerchantProfile>,
): Promise<LocalMerchantProfile> {
  const now = new Date();
  const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const fullProfile: LocalMerchantProfile = {
    id: profile.id ?? 1,
    userId: profile.userId ?? 1,
    ownerName: profile.ownerName ?? "صاحب المتجر",
    ownerEmail: profile.ownerEmail ?? "owner@ain-altajir.sa",
    contactPhone: profile.contactPhone ?? "0500000000",
    storeName: profile.storeName ?? "متجري",
    businessType: profile.businessType ?? "تجارة عامة",
    city: profile.city ?? "الرياض",
    branchCount: profile.branchCount ?? 1,
    taxNumber: profile.taxNumber,
    trialStartedAt: profile.trialStartedAt ?? now.toISOString(),
    trialEndsAt: profile.trialEndsAt ?? trialEnds.toISOString(),
  };

  await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(fullProfile));
  await AsyncStorage.setItem(
    LOCAL_TRIAL_KEY,
    JSON.stringify({
      active: true,
      trialStartedAt: fullProfile.trialStartedAt,
      trialEndsAt: fullProfile.trialEndsAt,
    }),
  );

  return fullProfile;
}

export async function getLocalMerchantProfile(): Promise<LocalMerchantProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as LocalMerchantProfile) : null;
  } catch {
    return null;
  }
}

export async function checkLocalTrialAccess(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_TRIAL_KEY);
    if (!raw) return true;
    const data = JSON.parse(raw);
    if (data.trialEndsAt) {
      return new Date(data.trialEndsAt).getTime() > Date.now();
    }
    return true;
  } catch {
    return true;
  }
}
