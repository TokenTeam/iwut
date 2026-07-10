import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import { useAccountStore } from "@/store/account";

const PROFILE_ROWS = [
  { keys: ["nick", "nickname"], label: "account.nickname", icon: "person" },
  { keys: ["realName", "real_name"], label: "account.realName", icon: "badge" },
  {
    keys: ["studentNumber", "student_number"],
    label: "account.studentNumber",
    icon: "school",
  },
  { keys: ["school"], label: "account.school", icon: "account-balance" },
  { keys: ["region"], label: "account.region", icon: "location-on" },
  { keys: ["phone"], label: "account.phone", icon: "phone" },
  { keys: ["qq"], label: "account.qq", icon: "chat" },
  { keys: ["birthday"], label: "account.birthday", icon: "cake" },
  { keys: ["gender"], label: "account.gender", icon: "wc" },
  {
    keys: ["whutEmail", "whut_email"],
    label: "account.campusEmail",
    icon: "alternate-email",
  },
] as const;

function readProfileText(
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

export default function AccountScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const isDark = useColorScheme() === "dark";
  const mode = useAccountStore((s) => s.mode);
  const email = useAccountStore((s) => s.email);
  const profile = useAccountStore((s) => s.profile);
  const profileLoading = useAccountStore((s) => s.profileLoading);
  const profileLoadFailed = useAccountStore((s) => s.profileLoadFailed);
  const refreshProfile = useAccountStore((s) => s.refreshProfile);
  const logout = useAccountStore((s) => s.logout);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const authenticated = mode === "authenticated";
  const displayName =
    readProfileText(profile?.attrs, ["nick", "nickname"]) ||
    readProfileText(profile?.attrs, ["realName", "real_name"]);
  const profileRows = PROFILE_ROWS.map((item) => ({
    ...item,
    value: readProfileText(profile?.attrs, item.keys),
  })).filter((item) => item.value);

  useEffect(() => {
    if (authenticated) void refreshProfile();
  }, [authenticated, refreshProfile]);

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 36, gap: 12 }}
        refreshControl={
          authenticated ? (
            <RefreshControl
              refreshing={profileLoading}
              onRefresh={() => void refreshProfile()}
            />
          ) : undefined
        }
        style={{ flex: 1, backgroundColor: isDark ? "#171717" : "#F5F5F5" }}
      >
        <Stack.Screen options={{ title: t("account.centerTitle") }} />
        <View style={{ paddingHorizontal: 8, paddingBottom: 8, gap: 6 }}>
          <Text
            selectable
            style={{
              color: isDark ? "#FAFAFA" : "#171717",
              fontSize: 26,
              fontWeight: "700",
            }}
          >
            {authenticated
              ? displayName || t("account.signedInHeading")
              : t("account.guestHeading")}
          </Text>
          <Text
            selectable
            style={{
              color: isDark ? "#A3A3A3" : "#737373",
              fontSize: 14,
              lineHeight: 21,
            }}
          >
            {authenticated
              ? t("account.signedInSubtitle")
              : t("account.guestSubtitle")}
          </Text>
        </View>

        {authenticated ? (
          <MenuGroup title={t("account.profileSection")}>
            <MenuItem
              icon="mail"
              iconBg="#007AFF"
              label={t("account.email")}
              value={profile?.email || email}
              showArrow={false}
            />
            {profileRows.map((item) => (
              <MenuItem
                key={item.label}
                icon={item.icon}
                iconBg="#5856D6"
                label={t(item.label)}
                value={item.value}
                showArrow={false}
              />
            ))}
            {profile?.createdAt ? (
              <MenuItem
                icon="event"
                iconBg="#34C759"
                label={t("account.registeredAt")}
                value={profile.createdAt.slice(0, 10)}
                showArrow={false}
              />
            ) : null}
            {profileLoading && !profile ? (
              <MenuItem
                icon="sync"
                iconBg="#8E8E93"
                label={t("account.profileLoading")}
                right={<ActivityIndicator size="small" />}
                showArrow={false}
              />
            ) : null}
            {profileLoadFailed ? (
              <MenuItem
                icon="sync-problem"
                iconBg="#FF9500"
                label={t("account.profileLoadFailed")}
                value={t("account.tapToRetry")}
                onPress={() => void refreshProfile()}
              />
            ) : null}
          </MenuGroup>
        ) : (
          <MenuGroup title={t("account.accountSection")}>
            <MenuItem
              icon="login"
              iconBg="#007AFF"
              label={t("account.signIn")}
              onPress={() => router.push("/auth/login" as never)}
            />
          </MenuGroup>
        )}

        {authenticated ? (
          <MenuGroup title={t("account.accountSection")}>
            <MenuItem
              icon="logout"
              iconBg="#FF3B30"
              label={t("account.signOut")}
              showArrow={false}
              onPress={() => setLogoutVisible(true)}
            />
          </MenuGroup>
        ) : null}
      </ScrollView>

      <ConfirmSheet
        visible={logoutVisible}
        onClose={() => setLogoutVisible(false)}
        title={t("account.signOutTitle")}
        description={t("account.signOutDescription")}
        confirmText={t("account.signOut")}
        destructive
        onConfirm={() => {
          logout().catch((error) =>
            reportError(error, { module: "auth-center" }),
          );
          setLogoutVisible(false);
        }}
      />
    </>
  );
}
