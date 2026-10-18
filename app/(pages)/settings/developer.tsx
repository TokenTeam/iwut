import * as Sentry from "@sentry/react-native";
import { Redirect, Stack } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Switch, View } from "react-native";
import Toast from "react-native-toast-message";

import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { IS_DEV } from "@/constants/is-dev";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import { useDeveloperOptionsStore } from "@/store/developer-options";
import { useTelemetryStore } from "@/store/telemetry";

const log = logger.extend("Developer");

export default function DeveloperSettingsScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const [sendingSentryTest, setSendingSentryTest] = useState(false);
  const [sentryConfirmVisible, setSentryConfirmVisible] = useState(false);
  const sendingSentryTestRef = useRef(false);
  const enabled = useDeveloperOptionsStore((s) => s.enabled);
  const setEnabled = useDeveloperOptionsStore((s) => s.setEnabled);

  if (!IS_DEV || !enabled) return <Redirect href="/(tabs)/user" />;

  const handleSentryTest = async () => {
    if (sendingSentryTestRef.current) return;
    setSentryConfirmVisible(false);
    if (!useTelemetryStore.getState().enabled) {
      Toast.show({
        type: "info",
        text1: t("settings.telemetryDisabled"),
        position: "bottom",
      });
      return;
    }
    if (__DEV__) {
      Toast.show({
        type: "info",
        text1: t("developer.sentryUnavailable"),
        position: "bottom",
      });
      return;
    }

    sendingSentryTestRef.current = true;
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
      log.error("Failed to send Sentry test event", error);
      Toast.show({
        type: "error",
        text1: t("developer.sentryTestFailed"),
        position: "bottom",
      });
    } finally {
      sendingSentryTestRef.current = false;
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
        <MenuGroup>
          <MenuItem
            icon="developer-mode"
            iconBg="#FF9500"
            label={t("developer.enable")}
            showArrow={false}
            onPress={() => setEnabled(false)}
            right={
              <Switch
                accessibilityLabel={t("developer.enable")}
                value={enabled}
                onValueChange={setEnabled}
              />
            }
          />
        </MenuGroup>
        <MenuGroup title={t("developer.debugSection")}>
          <MenuItem
            icon="article"
            iconBg="#007AFF"
            label={t("developer.viewLogs")}
            href="/(pages)/settings/developer-logs"
          />
        </MenuGroup>
        <MenuGroup title={t("developer.sentrySection")}>
          <MenuItem
            icon="bug-report"
            iconBg="#6C5FC7"
            label={t("developer.sentryTest")}
            showArrow={false}
            right={
              sendingSentryTest ? <ActivityIndicator size="small" /> : undefined
            }
            onPress={
              sendingSentryTest
                ? undefined
                : () => setSentryConfirmVisible(true)
            }
          />
        </MenuGroup>
      </ScrollView>
      <ConfirmSheet
        visible={sentryConfirmVisible}
        onClose={() => setSentryConfirmVisible(false)}
        title={t("developer.sentryTest")}
        description={t("developer.sentryTestConfirmDesc")}
        confirmText={t("developer.sentryTestConfirm")}
        onConfirm={() => void handleSentryTest()}
      />
    </View>
  );
}
