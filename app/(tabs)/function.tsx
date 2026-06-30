import { Ionicons } from "@expo/vector-icons";
import { type Href, router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TabBackground } from "@/components/layout/tab-background";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { IS_DEV } from "@/constants/is-dev";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { type TKey, useT } from "@/lib/i18n";
import { useScheduleStore } from "@/store/schedule";

type WebApp = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  labelKey: TKey;
  color: string;
  // 应用内页面：走 expo-router 类型安全路由（即时跳转，也是 iwut:// 深链接的目标）
  route?: Href;
  // 外部网页：在内置浏览器打开
  uri?: string;
  lan?: boolean;
};

type Section = {
  titleKey: TKey;
  items: WebApp[];
};

const SECTIONS: Section[] = [
  {
    titleKey: "fn.section.study",
    items: [
      {
        icon: "document-text-outline",
        labelKey: "fn.app.exam",
        color: "#3b82f6",
        route: "/exam",
      },
      {
        icon: "book-outline",
        labelKey: "fn.app.classroom",
        color: "#0d9488",
        uri: "https://classroom-iwut.tokenteam.net",
        lan: false,
      },
      {
        icon: "easel-outline",
        labelKey: "fn.app.icSpace",
        color: "#06b6d4",
        uri: "https://zhlgd.whut.edu.cn/tpass/login?service=https%3A%2F%2Fzw.whut.edu.cn%2Frem%2Fstatic%2Fsso%2FwebOAuthRed",
        lan: true,
      },
      {
        icon: "school-outline",
        labelKey: "fn.app.jwxt",
        color: "#8b5cf6",
        uri: "https://zhlgd.whut.edu.cn/tpass/login?service=https%3A%2F%2Fjwxt.whut.edu.cn%2Fjwapp%2Fsys%2Fhomeapp%2Findex.do%3FforceCas%3D1",
        lan: false,
      },
      {
        icon: "library-outline",
        labelKey: "fn.app.library",
        color: "#3b82f6",
        uri: "https://library-info-iwut.tokenteam.net",
        lan: true,
      },
    ],
  },
  {
    titleKey: "fn.section.life",
    items: [
      {
        icon: "card-outline",
        labelKey: "fn.app.card",
        color: "#10b981",
        uri: "https://cardcare-iwut.tokenteam.net",
        lan: false,
      },
      {
        icon: "flash-outline",
        labelKey: "fn.app.elec",
        color: "#eab308",
        uri: "https://zhlgd.whut.edu.cn/tpass/login?service=http://nyyzf.whut.edu.cn/MobileWebOnlineHall/#/",
        lan: false,
      },
      {
        icon: "wifi-outline",
        labelKey: "fn.app.netPay",
        color: "#2563eb",
        uri: "https://zhlgd.whut.edu.cn/tpass/login?service=http://cwsf.whut.edu.cn/netdetails515N023",
        lan: false,
      },
    ],
  },
  {
    titleKey: "fn.section.info",
    items: [
      {
        icon: "newspaper-outline",
        labelKey: "fn.app.campusNews",
        color: "#f97316",
        uri: "http://i.whut.edu.cn",
        lan: true,
      },
    ],
  },
];

function openWeb(uri: string) {
  router.push({ pathname: "/browser", params: { uri } });
}

export default function FunctionScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const haptic = useHaptics();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const hasBgImage = useScheduleStore((s) => !!s.backgroundImageUri);
  const { height } = useWindowDimensions();
  const [showBrowser, setShowBrowser] = useState(false);
  const [uri, setUri] = useState("");
  const [pendingLanApp, setPendingLanApp] = useState<WebApp | null>(null);

  const handleOpenApp = (app: WebApp) => {
    haptic();
    if (app.route) {
      router.push(app.route);
      return;
    }
    if (!app.uri) return;
    if (app.lan) {
      setPendingLanApp(app);
      return;
    }
    openWeb(app.uri);
  };

  const handleConfirmLan = () => {
    const nextUri = pendingLanApp?.uri;
    setPendingLanApp(null);
    if (nextUri) openWeb(nextUri);
  };

  return (
    <View style={{ flex: 1 }}>
      <TabBackground />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pb-2 pt-8">
            <View className="flex-row items-center justify-between">
              <Text
                className="text-[32px] font-bold tracking-tight text-neutral-900 dark:text-neutral-50"
                numberOfLines={1}
              >
                {t("fn.title")}
              </Text>
              {IS_DEV && (
                <Pressable
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.04)",
                  }}
                  onPress={() => {
                    haptic();
                    setShowBrowser(true);
                  }}
                >
                  <Ionicons
                    name="globe-outline"
                    size={20}
                    color={isDark ? "#a3a3a3" : "#737373"}
                  />
                </Pressable>
              )}
            </View>
            <Text
              className={`mt-1.5 text-base ${
                hasBgImage
                  ? "text-neutral-500 dark:text-neutral-400"
                  : "text-neutral-400 dark:text-neutral-500"
              }`}
            >
              {t("fn.subtitle")}
            </Text>
          </View>

          <View
            className={`mx-6 my-4 h-px ${
              hasBgImage
                ? "bg-neutral-400/40 dark:bg-neutral-500/40"
                : "bg-neutral-100 dark:bg-neutral-800/60"
            }`}
          />

          {SECTIONS.map((section) => (
            <View key={section.titleKey} className="mb-5">
              <Text className="mb-3 px-6 text-base font-semibold text-neutral-800 dark:text-neutral-100">
                {t(section.titleKey)}
              </Text>
              <View className="flex-row flex-wrap px-2">
                {section.items.map((app) => (
                  <AppItem
                    key={app.labelKey}
                    app={app}
                    label={t(app.labelKey)}
                    isDark={isDark}
                    hasBg={hasBgImage}
                    onPress={() => handleOpenApp(app)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        {IS_DEV && (
          <Modal
            visible={showBrowser}
            transparent
            animationType="fade"
            onRequestClose={() => setShowBrowser(false)}
          >
            <KeyboardAvoidingView
              className="flex-1"
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <Pressable
                className="flex-1 bg-black/40"
                style={{ paddingTop: height * 0.3 }}
                onPress={() => setShowBrowser(false)}
              >
                <Pressable
                  className="mx-8 rounded-3xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-800"
                  onPress={() => {}}
                >
                  <View className="mb-4 flex-row items-center gap-2">
                    <Ionicons name="globe-outline" size={20} color="#3b82f6" />
                    <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
                      {t("browser.openWeb")}
                    </Text>
                  </View>
                  <View className="h-12 flex-row items-center rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-700/50">
                    <TextInput
                      className="flex-1 text-base text-neutral-900 dark:text-neutral-100"
                      style={{
                        height: 48,
                        paddingHorizontal: 8,
                        textAlignVertical: "center",
                      }}
                      value={uri}
                      onChangeText={setUri}
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      returnKeyType="go"
                      onSubmitEditing={() => {
                        setShowBrowser(false);
                        router.push({ pathname: "/browser", params: { uri } });
                      }}
                    />
                    <Pressable
                      className="mr-1.5 h-9 w-9 items-center justify-center rounded-xl bg-blue-500 active:bg-blue-600"
                      onPress={() => {
                        setShowBrowser(false);
                        router.push({ pathname: "/browser", params: { uri } });
                      }}
                    >
                      <Ionicons name="arrow-forward" size={20} color="white" />
                    </Pressable>
                  </View>
                </Pressable>
              </Pressable>
            </KeyboardAvoidingView>
          </Modal>
        )}

        <ConfirmSheet
          visible={pendingLanApp !== null}
          onClose={() => setPendingLanApp(null)}
          title={t("fn.lanTitle")}
          description={t("fn.lanDesc", {
            app: pendingLanApp ? t(pendingLanApp.labelKey) : "",
          })}
          confirmText={t("fn.lanConfirm")}
          onConfirm={handleConfirmLan}
        />
      </SafeAreaView>
    </View>
  );
}

function AppItem({
  app,
  label,
  isDark,
  hasBg,
  onPress,
}: {
  app: WebApp;
  label: string;
  isDark: boolean;
  hasBg: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="w-1/5 items-center py-3"
      onPress={onPress}
      style={({ pressed }) => ({
        width: "20%",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          overflow: "hidden",
          // 有背景图时先垫近实底，避免图标淹没在图片纹理里
          backgroundColor: hasBg
            ? isDark
              ? "rgba(28,28,30,0.88)"
              : "rgba(255,255,255,0.9)"
            : "transparent",
          borderWidth: hasBg ? StyleSheet.hairlineWidth : 0,
          borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isDark ? `${app.color}18` : `${app.color}12`,
          }}
        />
        <Ionicons name={app.icon} size={20} color={app.color} />
      </View>
      <Text
        className={`mt-2 text-xs ${
          hasBg
            ? "font-medium text-neutral-800 dark:text-neutral-200"
            : "text-neutral-700 dark:text-neutral-300"
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
