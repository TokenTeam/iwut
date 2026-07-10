import { Stack, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { ProfileEditForm } from "@/components/account/profile-edit-form";
import { AuthPrimaryButton } from "@/components/auth/auth-primary-button";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import { useAccountStore } from "@/store/account";

export default function ProfileEditScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const isDark = useColorScheme() === "dark";
  const mode = useAccountStore((s) => s.mode);
  const profile = useAccountStore((s) => s.profile);
  const profileLoading = useAccountStore((s) => s.profileLoading);
  const profileLoadFailed = useAccountStore((s) => s.profileLoadFailed);
  const refreshProfile = useAccountStore((s) => s.refreshProfile);

  useFocusEffect(
    useCallback(() => {
      if (mode === "authenticated" && !profile) void refreshProfile();
    }, [mode, profile, refreshProfile]),
  );

  if (profile) {
    return (
      <>
        <Stack.Screen options={{ title: t("account.editProfileTitle") }} />
        <ProfileEditForm profile={profile} />
      </>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        flexGrow: 1,
        padding: 24,
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
      }}
      style={{ flex: 1, backgroundColor: isDark ? "#171717" : "#F5F5F5" }}
    >
      <Stack.Screen options={{ title: t("account.editProfileTitle") }} />
      {profileLoading ? <ActivityIndicator size="large" /> : null}
      <Text
        selectable
        style={{
          color: isDark ? "#A3A3A3" : "#737373",
          textAlign: "center",
          lineHeight: 21,
        }}
      >
        {profileLoadFailed
          ? t("account.profileLoadFailed")
          : t("account.profileLoading")}
      </Text>
      {profileLoadFailed ? (
        <View style={{ width: "100%" }}>
          <AuthPrimaryButton
            label={t("account.tapToRetry")}
            onPress={() => void refreshProfile()}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
