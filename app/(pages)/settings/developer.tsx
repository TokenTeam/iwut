import { Redirect, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import Toast from "react-native-toast-message";

import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { IS_DEV } from "@/constants/is-dev";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import { resetDataAndReload } from "@/lib/reset";

export default function DeveloperSettingsScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const [resetVisible, setResetVisible] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (!IS_DEV) return <Redirect href="/" />;

  const handleReset = async () => {
    setResetVisible(false);
    setResetting(true);

    try {
      await resetDataAndReload();
    } catch (error) {
      reportError(error, { module: "developer-settings", action: "reset" });
      setResetting(false);
      Toast.show({
        type: "error",
        text1: t("developer.resetFailed"),
        position: "bottom",
      });
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
        <MenuGroup title={t("developer.dataSection")}>
          <MenuItem
            icon="restart-alt"
            iconBg="#FF3B30"
            label={t("developer.reset")}
            showArrow={false}
            right={resetting ? <ActivityIndicator size="small" /> : undefined}
            onPress={resetting ? undefined : () => setResetVisible(true)}
          />
        </MenuGroup>
      </ScrollView>

      <ConfirmSheet
        visible={resetVisible}
        onClose={() => setResetVisible(false)}
        title={t("developer.resetTitle")}
        description={t("developer.resetDesc")}
        confirmText={t("developer.resetConfirm")}
        destructive
        onConfirm={handleReset}
      />
    </View>
  );
}
