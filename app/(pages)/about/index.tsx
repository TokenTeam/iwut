import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import * as Updates from "expo-updates";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { IS_DEV } from "@/constants/is-dev";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useUpdateStore } from "@/store/update";

const icon = require("@/assets/images/icon.png");
const uniLabel = require("@/assets/images/icon_uni_label.svg");

export default function AboutScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const version = Constants.expoConfig?.version ?? "N/A";
  const commit = Constants.expoConfig?.extra?.commit ?? "unknown";
  const hasUpdate = useUpdateStore((s) => s.hasUpdate);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const checking = useUpdateStore((s) => s.checking);
  const check = useUpdateStore((s) => s.check);

  const copyToClipboard = useCallback(async (label: string, value: string) => {
    await Clipboard.setStringAsync(value);
    Toast.show({
      type: "success",
      text1: `已复制${label}`,
      position: "bottom",
    });
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    await check();
    const { hasUpdate: updated, latestVersion: latest } =
      useUpdateStore.getState();
    if (updated) {
      Toast.show({
        type: "info",
        text1: "发现新版本",
        text2: `v${latest} 可用，点击下载`,
        position: "bottom",
        onPress: () => {
          if (Platform.OS === "ios") {
            Linking.openURL("itms-apps://apps.apple.com/cn/app/id6761684977");
          } else {
            const channel = Updates.channel ?? "production";
            Linking.openURL(
              `https://download.tokenteam.dev/iwut/${latest}/${channel}.apk`,
            );
          }
          Toast.hide();
        },
      });
    } else {
      Toast.show({
        type: "success",
        text1: "当前已是最新版本",
        position: "bottom",
      });
    }
  }, [check]);

  return (
    <>
      <Stack.Screen options={{ title: "关于" }} />
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerClassName="px-4 pt-4 pb-8"
      >
        <View className="mb-4 items-center rounded-2xl bg-white py-10 dark:bg-neutral-800">
          <Image
            source={icon}
            style={{ width: 80, height: 80, borderRadius: 18 }}
          />
          <Text className="mt-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            掌上吾理
          </Text>
          <Text className="mt-1.5 text-sm text-neutral-400 dark:text-neutral-500">
            {version}
            {IS_DEV ? " (Dev)" : ""}
          </Text>
        </View>

        <MenuGroup title="信息">
          <MenuItem
            icon="info-outline"
            label="版本号"
            value={version}
            showArrow={false}
            onPress={() => copyToClipboard("版本号", version)}
          />
          <MenuItem
            icon="commit"
            label="Commit"
            value={commit}
            showArrow={false}
            onPress={() => copyToClipboard("Commit", commit)}
          />
        </MenuGroup>

        <MenuGroup title="更新">
          <MenuItem
            icon="system-update"
            iconBg="#34C759"
            label="检查更新"
            value={
              hasUpdate && latestVersion ? `新版本 ${latestVersion}` : undefined
            }
            badge={hasUpdate}
            showArrow={false}
            right={checking ? <ActivityIndicator size="small" /> : undefined}
            onPress={handleCheckUpdate}
          />
        </MenuGroup>

        <MenuGroup title="链接">
          <MenuItem
            icon="language"
            iconBg="#007AFF"
            label="官方网站"
            onPress={() => Linking.openURL("https://iwut.tokenteam.net")}
          />
          <MenuItem
            icon="code"
            iconBg="#333"
            label="GitHub"
            onPress={() => Linking.openURL("https://github.com/tokenteam/iwut")}
          />
        </MenuGroup>

        <View className="flex-1" />
      </ScrollView>

      <View className="absolute bottom-8 left-0 right-0 items-center">
        <Image
          source={uniLabel}
          style={{
            width: 77,
            height: 18,
            tintColor: Colors[isDark ? "dark" : "light"].icon,
          }}
        />
      </View>
    </>
  );
}
