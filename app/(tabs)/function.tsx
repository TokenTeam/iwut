import { Ionicons } from "@expo/vector-icons";
import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { IS_DEV } from "@/constants/is-dev";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useResolvedLang, useT } from "@/lib/i18n";
import type { FunctionWebApp } from "@/services/function-apps";
import { resolveLocalizedString } from "@/services/update-config";
import { useFunctionAppsStore } from "@/store/function-apps";
import { useScheduleStore } from "@/store/schedule";

function openWeb(uri: string) {
  router.push({ pathname: "/browser", params: { uri } });
}

export default function FunctionScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const lang = useResolvedLang();
  const haptic = useHaptics();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const hasBgImage = useScheduleStore((s) => !!s.backgroundImageUri);
  const { height } = useWindowDimensions();
  const [showBrowser, setShowBrowser] = useState(false);
  const [uri, setUri] = useState("");
  const [pendingLanApp, setPendingLanApp] = useState<FunctionWebApp | null>(
    null,
  );

  const remoteSections = useFunctionAppsStore((s) => s.sections);
  const fetchFunctionApps = useFunctionAppsStore((s) => s.fetch);
  const sections = remoteSections;

  useEffect(() => {
    fetchFunctionApps();
  }, [fetchFunctionApps]);

  const handleOpenApp = (app: FunctionWebApp) => {
    haptic();
    if (app.route) {
      router.push(app.route as Href);
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
      <View style={{ flex: 1, paddingTop: insets.top }}>
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

          {sections.map((section) => (
            <View key={section.id} className="mb-5">
              <Text className="mb-3 px-6 text-base font-semibold text-neutral-800 dark:text-neutral-100">
                {resolveLocalizedString(section.title, lang) ?? ""}
              </Text>
              <View className="flex-row flex-wrap px-2">
                {section.items.map((app) => (
                  <AppItem
                    key={app.id}
                    app={app}
                    label={resolveLocalizedString(app.label, lang) ?? ""}
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
            app: pendingLanApp
              ? (resolveLocalizedString(pendingLanApp.label, lang) ?? "")
              : "",
          })}
          confirmText={t("fn.lanConfirm")}
          onConfirm={handleConfirmLan}
        />
      </View>
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
  app: FunctionWebApp;
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
        <Ionicons
          name={app.icon as React.ComponentProps<typeof Ionicons>["name"]}
          size={20}
          color={app.color}
        />
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
