import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountAvatar } from "@/components/account/account-avatar";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { UserHeroBackground } from "@/components/user/user-hero-background";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getAuthCenterAvatarUrl } from "@/lib/auth-center-profile";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import { useAccountStore } from "@/store/account";
import { useUserBindStore } from "@/store/user-bind";

const MASK_COLORS = ["#000000", "#000000", "rgba(0,0,0,0)"] as const;
const MASK_LOCATIONS = [0, 0.6, 1] as const;

const HERO_PADDING_TOP = 40;
const HERO_PADDING_BOTTOM = 100;
const MENU_PULL_UP = 60;

function HeaderSection({
  isDark,
  children,
}: {
  isDark: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <MaskedView
      style={styles.header}
      maskElement={
        <LinearGradient
          colors={MASK_COLORS}
          locations={MASK_LOCATIONS}
          style={StyleSheet.absoluteFill}
        />
      }
    >
      <UserHeroBackground
        artworkStyle={styles.svgWrap}
        idPrefix="user-page"
        isDark={isDark}
      />
      <View style={{ paddingTop: insets.top }}>{children}</View>
    </MaskedView>
  );
}

const AVATAR_SIZE = 64;

const styles = StyleSheet.create({
  header: {
    overflow: "hidden",
  },
  svgWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    aspectRatio: 375 / 224,
  },
  heroPadding: {
    paddingTop: HERO_PADDING_TOP,
    paddingBottom: HERO_PADDING_BOTTOM,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 4,
  },
  heroBody: {
    flex: 1,
    marginLeft: 16,
    height: AVATAR_SIZE,
    justifyContent: "center",
  },
  avatarRing: {
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  heroName: {
    fontSize: 19,
    fontWeight: "700",
    color: "#ffffff",
  },
  heroMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
  },
  heroSubtle: {
    marginTop: 2,
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
    fontVariant: ["tabular-nums"],
  },
  logoutBtn: {
    height: 32,
    width: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  scrollView: {
    marginTop: -MENU_PULL_UP,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 32,
  },
});

function UnboundHero() {
  const t = useT();
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [styles.heroRow, { opacity: pressed ? 0.8 : 1 }]}
      onPress={() => router.push("/browser/bind")}
    >
      <View style={styles.avatarRing}>
        <MaterialIcons name="person-add" size={32} color="#ffffff" />
      </View>
      <View style={styles.heroBody}>
        <Text style={styles.heroName} numberOfLines={1}>
          {t("user.bindTitle")}
        </Text>
        <Text style={styles.heroMeta} numberOfLines={1}>
          {t("user.bindSubtitle")}
        </Text>
      </View>
      <MaterialIcons
        name="chevron-right"
        size={22}
        color="rgba(255,255,255,0.85)"
      />
    </Pressable>
  );
}

function BoundHero() {
  const t = useT();
  const studentId = useUserBindStore((s) => s.studentId);
  const studentName = useUserBindStore((s) => s.studentName);
  const college = useUserBindStore((s) => s.college);
  const eduLevel = useUserBindStore((s) => s.eduLevel);
  const unbind = useUserBindStore((s) => s.unbind);
  const profile = useAccountStore((s) => s.profile);
  const [unbindVisible, setUnbindVisible] = useState(false);

  const avatarUrl = getAuthCenterAvatarUrl(profile);

  const meta = [eduLevel, college].filter(Boolean).join(" · ");

  return (
    <>
      <View style={styles.heroRow}>
        <AccountAvatar size={AVATAR_SIZE} uri={avatarUrl} />
        <View style={styles.heroBody}>
          <Text style={styles.heroName} numberOfLines={1}>
            {studentName}
          </Text>
          {meta ? (
            <Text style={styles.heroMeta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          <Text style={styles.heroSubtle} numberOfLines={1}>
            {studentId}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() => setUnbindVisible(true)}
          hitSlop={10}
        >
          <MaterialIcons name="logout" size={15} color="#ffffff" />
        </Pressable>
      </View>
      <ConfirmSheet
        visible={unbindVisible}
        onClose={() => setUnbindVisible(false)}
        title={t("user.unbindTitle")}
        description={t("user.unbindDesc")}
        confirmText={t("user.unbind")}
        destructive
        onConfirm={() => {
          unbind().catch((e) => reportError(e, { module: "user-bind" }));
          setUnbindVisible(false);
        }}
      />
    </>
  );
}

function UserHero() {
  const isBound = useUserBindStore((s) => s.isBound);
  return isBound ? <BoundHero /> : <UnboundHero />;
}

export default function UserScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const isDark = useColorScheme() === "dark";
  const accountMode = useAccountStore((s) => s.mode);
  const accountEmail = useAccountStore((s) => s.email);
  const refreshProfile = useAccountStore((s) => s.refreshProfile);
  const accountValue =
    accountMode === "authenticated"
      ? accountEmail
      : accountMode === "guest"
        ? t("account.guest")
        : t("account.notSignedIn");

  useFocusEffect(
    useCallback(() => {
      if (accountMode === "authenticated") void refreshProfile();
    }, [accountMode, refreshProfile]),
  );

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <HeaderSection isDark={isDark}>
        <View style={styles.heroPadding}>
          <UserHero />
        </View>
      </HeaderSection>

      <ScrollView
        className="flex-1"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4">
          <MenuGroup title={t("account.centerTitle")}>
            <MenuItem
              icon="account-circle"
              iconBg="#5856D6"
              label={t("account.account")}
              value={accountValue}
              href="/user/account"
            />
          </MenuGroup>
          <MenuGroup title={t("user.menuTools")}>
            <MenuItem
              icon="wifi"
              iconBg="#007AFF"
              label={t("user.menuWlan")}
              href="/user/wlan"
            />
          </MenuGroup>
          <MenuGroup title={t("user.menuSettings")}>
            <MenuItem
              icon="settings"
              iconBg="#8E8E93"
              label={t("user.menuGeneral")}
              href="/settings"
            />
            <MenuItem
              icon="palette"
              iconBg="#5856D6"
              label={t("user.menuAppearance")}
              href="/settings/appearance"
            />
            <MenuItem
              icon="calendar-today"
              iconBg="#34C759"
              label={t("user.menuSchedule")}
              href="/settings/calendar"
            />
          </MenuGroup>
          <MenuGroup title={t("user.menuOther")}>
            <MenuItem
              icon="info"
              iconBg="#007AFF"
              label={t("user.menuAbout")}
              href="/about"
            />
          </MenuGroup>
        </View>
      </ScrollView>
    </View>
  );
}
