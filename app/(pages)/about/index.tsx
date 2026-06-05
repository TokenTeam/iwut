import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { IS_DEV } from "@/constants/is-dev";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import { useUpdateStore } from "@/store/update";

const icon = require("@/assets/images/icon.png");
const uniLabel = require("@/assets/images/icon_uni_label.svg");

export default function AboutScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const version = Constants.expoConfig?.version ?? "N/A";
  const commit = Constants.expoConfig?.extra?.commit ?? "unknown";
  const hasUpdate = useUpdateStore((s) => s.hasUpdate);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const checking = useUpdateStore((s) => s.checking);
  const check = useUpdateStore((s) => s.check);
  const openUpdateModal = useUpdateStore((s) => s.openModal);

  const copyToClipboard = useCallback(
    async (label: string, value: string) => {
      await Clipboard.setStringAsync(value);
      Toast.show({
        type: "success",
        text1: t("about.copied", { label }),
        position: "bottom",
      });
    },
    [t],
  );

  const handleCheckUpdate = useCallback(async () => {
    await check({ force: true });
    const { hasUpdate: updated } = useUpdateStore.getState();
    if (updated) {
      openUpdateModal();
    } else {
      Toast.show({
        type: "success",
        text1: t("about.upToDate"),
        position: "bottom",
      });
    }
  }, [check, openUpdateModal, t]);

  return (
    <>
      <Stack.Screen options={{ title: t("about.title") }} />
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerClassName="grow px-4 pt-4 pb-8"
      >
        <View className="mb-4 items-center rounded-2xl bg-white py-10 dark:bg-neutral-800">
          <Image
            source={icon}
            style={{ width: 80, height: 80, borderRadius: 18 }}
          />
          <Text className="mt-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {t("about.appName")}
          </Text>
          <Text className="mt-1.5 text-sm text-neutral-400 dark:text-neutral-500">
            {version}
            {IS_DEV ? " (Dev)" : ""}
          </Text>
        </View>

        <MenuGroup title={t("about.infoGroup")}>
          <MenuItem
            icon="info-outline"
            label={t("about.version")}
            value={version}
            showArrow={false}
            onPress={() => copyToClipboard(t("about.version"), version)}
          />
          <MenuItem
            icon="commit"
            label={t("about.commit")}
            value={commit}
            showArrow={false}
            onPress={() => copyToClipboard(t("about.commit"), commit)}
          />
        </MenuGroup>

        <MenuGroup title={t("about.updateGroup")}>
          <MenuItem
            icon="system-update"
            iconBg="#34C759"
            label={t("about.checkUpdate")}
            value={
              hasUpdate && latestVersion
                ? t("about.newVersionAvailable", { v: latestVersion })
                : undefined
            }
            badge={hasUpdate}
            showArrow={false}
            right={checking ? <ActivityIndicator size="small" /> : undefined}
            onPress={handleCheckUpdate}
          />
        </MenuGroup>

        <MenuGroup title={t("about.linksGroup")}>
          <MenuItem
            icon="language"
            iconBg="#007AFF"
            label={t("about.website")}
            onPress={() => Linking.openURL("https://iwut.tokenteam.net")}
          />
          <MenuItem
            icon="code"
            iconBg="#333"
            label={t("about.github")}
            onPress={() => Linking.openURL("https://github.com/tokenteam/iwut")}
          />
        </MenuGroup>

        <View className="mt-auto items-center pt-6">
          <Image
            source={uniLabel}
            style={{
              width: 77,
              height: 18,
              tintColor: Colors[isDark ? "dark" : "light"].icon,
            }}
          />
          <Text className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
            {t("about.icp")}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
