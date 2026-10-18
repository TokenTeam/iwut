import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

import { Fonts } from "@/constants/theme";
import { useHaptics } from "@/hooks/use-haptics";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import { type ResolvedScanAction, resolveScanAction } from "@/lib/scan";

export default function ShareScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const haptic = useHaptics();
  const params = useLocalSearchParams<{ data?: string | string[] }>();
  const data = getFirstParam(params.data) ?? "";
  const result = useMemo(() => resolveScanAction(data, { t }), [data, t]);
  const [executing, setExecuting] = useState(false);

  const execute = async () => {
    if (result.status !== "matched" || executing) return;
    setExecuting(true);
    try {
      const next = await result.handler.execute(result.envelope, { t });
      Toast.show({
        type: "success",
        text1: next.title,
        text2: next.description,
        position: "bottom",
      });
      leaveShare();
    } catch {
      Toast.show({
        type: "error",
        text1: t("scan.executeFailed"),
        position: "bottom",
      });
    } finally {
      setExecuting(false);
    }
  };

  const matched = result.status === "matched" ? result : null;
  const copyContent = async () => {
    haptic();
    try {
      await Clipboard.setStringAsync(data);
      Toast.show({
        type: "success",
        text1: t("scan.contentCopied"),
        position: "bottom",
      });
    } catch {
      Toast.show({
        type: "error",
        text1: t("scan.copyFailed"),
        position: "bottom",
      });
    }
  };

  const description =
    result.status === "matched"
      ? result.preview.description
      : invalidReasonText(result.reason, t);

  return (
    <>
      <Stack.Screen
        options={{
          title: matched ? t("share.receiveTitle") : t("scan.resultTitle"),
        }}
      />
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerClassName="px-4 pt-4 pb-8"
      >
        <View className="overflow-hidden rounded-2xl bg-white dark:bg-neutral-800">
          <View className="items-center px-5 pb-6 pt-8">
            <View
              className={`h-16 w-16 items-center justify-center rounded-full ${matched ? "bg-blue-50 dark:bg-blue-950" : "bg-red-50 dark:bg-red-950"}`}
            >
              <Ionicons
                name={matched ? "share-social-outline" : "alert-circle-outline"}
                size={32}
                color={matched ? "#3b82f6" : "#ef4444"}
              />
            </View>
            <Text className="mt-4 text-center text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              {matched?.preview.title ?? t("scan.resultTitle")}
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-neutral-500 dark:text-neutral-400">
              {description}
            </Text>
          </View>

          {!matched && data.length > 0 && (
            <View className="mx-5 mb-6 flex-row items-center overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-900">
              <View className="min-w-0 flex-1 py-4 pl-4">
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  className="text-sm leading-6 text-neutral-900 dark:text-neutral-100"
                  style={{ fontFamily: Fonts.mono }}
                >
                  {data.replace(/\r\n|[\n\r\u2028\u2029]/g, " ")}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("scan.copyContent")}
                className="m-1 h-12 w-12 shrink-0 items-center justify-center rounded-lg active:bg-neutral-200 dark:active:bg-neutral-800"
                onPress={() => void copyContent()}
              >
                <Ionicons name="copy-outline" size={22} color="#3b82f6" />
              </Pressable>
            </View>
          )}

          {matched?.preview.details && (
            <View className="mx-5 mb-6 overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-900">
              {matched.preview.details.map((item, index) => (
                <View key={`${item.label}-${index}`}>
                  {index > 0 && (
                    <View className="mx-4 border-b border-neutral-200 dark:border-neutral-700" />
                  )}
                  <View className="flex-row items-center px-4 py-3">
                    <Text className="w-24 text-sm text-neutral-500 dark:text-neutral-400">
                      {item.label}
                    </Text>
                    <Text
                      className="flex-1 text-right text-sm font-medium text-neutral-900 dark:text-neutral-100"
                      numberOfLines={2}
                    >
                      {item.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="mt-4 flex-row gap-3">
          <Pressable
            className="flex-1 items-center rounded-xl bg-neutral-200 py-3 active:bg-neutral-300 dark:bg-neutral-700 dark:active:bg-neutral-600"
            disabled={executing}
            onPress={() => {
              haptic();
              leaveShare();
            }}
          >
            <Text className="text-base font-medium text-neutral-600 dark:text-neutral-300">
              {matched ? t("common.cancel") : t("common.ok")}
            </Text>
          </Pressable>
          {matched && (
            <Pressable
              className="flex-1 items-center rounded-xl bg-blue-500 py-3 active:bg-blue-600 disabled:opacity-60"
              disabled={executing}
              onPress={() => {
                haptic();
                void execute();
              }}
            >
              {executing ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-base font-medium text-white">
                  {matched.preview.confirmText}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function leaveShare() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}

function getFirstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function invalidReasonText(
  reason: Extract<ResolvedScanAction, { status: "invalid" }>["reason"],
  t: ReturnType<typeof useT>,
): string {
  switch (reason) {
    case "empty":
      return t("scan.invalidEmpty");
    case "tooLarge":
      return t("scan.invalidTooLarge");
    case "unsupported":
      return t("scan.invalidUnsupported");
    case "noHandler":
      return t("scan.invalidNoHandler");
    default:
      return t("scan.invalidMalformed");
  }
}
