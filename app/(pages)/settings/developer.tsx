import * as Sentry from "@sentry/react-native";
import { Redirect, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import Toast from "react-native-toast-message";

import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { IS_DEV } from "@/constants/is-dev";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";

export default function DeveloperSettingsScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const [sendingSentryTest, setSendingSentryTest] = useState(false);

  if (!IS_DEV) return <Redirect href="/" />;

  const handleSentryTest = async () => {
    if (__DEV__) {
      Toast.show({
        type: "info",
        text1: t("developer.sentryUnavailable"),
        position: "bottom",
      });
      return;
    }

    setSendingSentryTest(true);
    try {
      Sentry.captureException(new Error("This is a test event"), {
        tags: {
          source: "developer",
          test_event: "true",
        },
      });

      const flushed = await Sentry.flush();
      Toast.show({
        type: flushed ? "success" : "error",
        text1: t(
          flushed ? "developer.sentryTestSent" : "developer.sentryTestFailed",
        ),
        position: "bottom",
      });
    } catch (error) {
      console.error("Failed to send Sentry test event", error);
      Toast.show({
        type: "error",
        text1: t("developer.sentryTestFailed"),
        position: "bottom",
      });
    } finally {
      setSendingSentryTest(false);
    }
  };

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <Stack.Screen options={{ title: t("developer.title") }} />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="px-4 pt-4"
      >
        <MenuGroup title={t("developer.sentrySection")}>
          <MenuItem
            icon="bug-report"
            iconBg="#6C5FC7"
            label={t("developer.sentryTest")}
            showArrow={false}
            right={
              sendingSentryTest ? <ActivityIndicator size="small" /> : undefined
            }
            onPress={sendingSentryTest ? undefined : handleSentryTest}
          />
        </MenuGroup>
      </ScrollView>
    </View>
  );
}
