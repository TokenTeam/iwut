import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { AccountAvatar } from "@/components/account/account-avatar";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { UserHeroBackground } from "@/components/user/user-hero-background";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  getAuthCenterAvatarUrl,
  readAuthCenterProfileText,
} from "@/lib/auth-center-profile";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import { useAccountStore } from "@/store/account";

const PROFILE_ROWS = [
  {
    keys: ["nick", "nickname"],
    label: "account.nickname",
    icon: "person",
    iconBg: "#FF9500",
  },
  {
    keys: ["realName", "real_name"],
    label: "account.realName",
    icon: "badge",
    iconBg: "#5856D6",
  },
  {
    keys: ["studentNumber", "student_number"],
    label: "account.studentNumber",
    icon: "school",
    iconBg: "#34C759",
  },
  {
    keys: ["school"],
    label: "account.school",
    icon: "account-balance",
    iconBg: "#007AFF",
  },
  {
    keys: ["region"],
    label: "account.region",
    icon: "location-on",
    iconBg: "#FF2D55",
  },
  {
    keys: ["phone"],
    label: "account.phone",
    icon: "phone",
    iconBg: "#30B0C7",
  },
  { keys: ["qq"], label: "account.qq", icon: "chat", iconBg: "#12B7F5" },
  {
    keys: ["birthday"],
    label: "account.birthday",
    icon: "cake",
    iconBg: "#FF9F0A",
  },
  {
    keys: ["gender"],
    label: "account.gender",
    icon: "wc",
    iconBg: "#AF52DE",
  },
  {
    keys: ["whutEmail", "whut_email"],
    label: "account.campusEmail",
    icon: "alternate-email",
    iconBg: "#32ADE6",
  },
] as const;

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
    readAuthCenterProfileText(profile?.attrs, ["nick", "nickname"]) ||
    readAuthCenterProfileText(profile?.attrs, ["realName", "real_name"]);
  const avatarUrl = getAuthCenterAvatarUrl(profile);
  const profileRows = PROFILE_ROWS.map((item) => ({
    ...item,
    value: readAuthCenterProfileText(profile?.attrs, item.keys),
  }));
  const loadingValue = profileLoading && !profile ? t("common.loading") : "";
  const emptyValue = t("account.notFilled");

  useFocusEffect(
    useCallback(() => {
      if (authenticated) void refreshProfile();
    }, [authenticated, refreshProfile]),
  );

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
        {authenticated ? (
          <View
            style={{
              minHeight: 112,
              borderRadius: 24,
              borderCurve: "continuous",
              padding: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              overflow: "hidden",
            }}
          >
            <UserHeroBackground
              artworkStyle={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                aspectRatio: 375 / 224,
              }}
              idPrefix="account-card"
              isDark={isDark}
            />
            <AccountAvatar size={64} uri={avatarUrl} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text
                selectable
                numberOfLines={1}
                style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700" }}
              >
                {displayName || t("account.signedInHeading")}
              </Text>
              <Text
                selectable
                numberOfLines={1}
                style={{ color: "rgba(255,255,255,0.82)", fontSize: 13 }}
              >
                {profile?.email || email}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={t("common.edit")}
              accessibilityRole="button"
              disabled={!profile || profileLoading}
              onPress={() => router.push("/user/profile-edit" as never)}
              style={({ pressed }) => ({
                minHeight: 34,
                paddingHorizontal: 12,
                borderRadius: 17,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: "rgba(255,255,255,0.16)",
                opacity: !profile || profileLoading ? 0.45 : pressed ? 0.7 : 1,
              })}
            >
              <MaterialIcons name="edit" size={15} color="#FFFFFF" />
              <Text
                style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "600" }}
              >
                {t("common.edit")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 8, paddingBottom: 8, gap: 6 }}>
            <Text
              selectable
              style={{
                color: isDark ? "#FAFAFA" : "#171717",
                fontSize: 26,
                fontWeight: "700",
              }}
            >
              {t("account.guestHeading")}
            </Text>
            <Text
              selectable
              style={{
                color: isDark ? "#A3A3A3" : "#737373",
                fontSize: 14,
                lineHeight: 21,
              }}
            >
              {t("account.guestSubtitle")}
            </Text>
          </View>
        )}

        {authenticated ? (
          <MenuGroup title={t("account.profileSection")}>
            <MenuItem
              icon="mail"
              iconBg="#007AFF"
              label={t("account.email")}
              value={profile?.email || email}
              showArrow={false}
            />
            <MenuItem
              icon="account-circle"
              iconBg="#AF52DE"
              label={t("account.avatar")}
              value={
                avatarUrl ? t("account.configured") : loadingValue || emptyValue
              }
              showArrow={false}
            />
            {profileRows.map((item) => (
              <MenuItem
                key={item.label}
                icon={item.icon}
                iconBg={item.iconBg}
                label={t(item.label)}
                value={item.value || loadingValue || emptyValue}
                showArrow={false}
              />
            ))}
            <MenuItem
              icon="event"
              iconBg="#34C759"
              label={t("account.registeredAt")}
              value={
                profile?.createdAt?.slice(0, 10) || loadingValue || emptyValue
              }
              showArrow={false}
            />
            <MenuItem
              icon="update"
              iconBg="#32ADE6"
              label={t("account.profileUpdatedAt")}
              value={
                profile?.updatedAt?.slice(0, 10) || loadingValue || emptyValue
              }
              showArrow={false}
            />
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
