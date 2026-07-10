import type { AuthCenterProfile } from "@/services/auth-center";

export function readAuthCenterProfileText(
  attrs: Record<string, unknown> | undefined,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = attrs?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

export function getAuthCenterAvatarUrl(
  profile: AuthCenterProfile | null | undefined,
) {
  const url = readAuthCenterProfileText(profile?.attrs, [
    "avatarUrl",
    "avatar_url",
  ]);
  return url.startsWith("https://") ? url : "";
}
