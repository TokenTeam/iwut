import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { ShareSheet } from "@/components/share/share-sheet";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import {
  BUILTIN_PALETTE_NAME_KEYS,
  BUILTIN_PALETTES,
  type ColorPalette,
  validateColorPalette,
} from "@/constants/course-palettes";
import { useHaptics } from "@/hooks/use-haptics";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import {
  buildSchedulePaletteScanEnvelope,
  buildShareableSchedulePalette,
  resolveScanAction,
  SCHEDULE_PALETTE_SCAN_TYPE,
} from "@/lib/scan";
import { useScheduleStore } from "@/store/schedule";

function PaletteRow({
  palette,
  isActive,
  displayName,
  onPress,
  onDelete,
}: {
  palette: ColorPalette;
  isActive: boolean;
  displayName: string;
  onPress: () => void;
  onDelete?: () => void;
}) {
  return (
    <Pressable
      className="flex-row items-center gap-3 px-4 py-3.5 active:bg-neutral-50 dark:active:bg-neutral-700"
      onPress={onPress}
    >
      <Text
        style={{ width: 56 }}
        numberOfLines={1}
        className={`text-sm ${
          isActive
            ? "font-semibold text-blue-500 dark:text-blue-400"
            : "text-neutral-900 dark:text-neutral-100"
        }`}
      >
        {displayName}
      </Text>
      <View
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        {palette.colors.slice(0, 8).map((color, i) => (
          <View
            key={`${color}-${i}`}
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: color,
            }}
          />
        ))}
        {palette.colors.length > 8 && (
          <Text className="text-xs text-neutral-400 dark:text-neutral-500">
            ...
          </Text>
        )}
      </View>
      {onDelete && (
        <Pressable hitSlop={12} onPress={onDelete} style={{ marginRight: 8 }}>
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </Pressable>
      )}
      <Ionicons
        name={isActive ? "checkmark-circle" : "ellipse-outline"}
        size={20}
        color={isActive ? "#3b82f6" : "#d4d4d4"}
      />
    </Pressable>
  );
}

export default function PaletteScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const haptic = useHaptics();
  const colorPalette = useScheduleStore((s) => s.colorPalette);
  const setColorPalette = useScheduleStore((s) => s.setColorPalette);
  const customPalettes = useScheduleStore((s) => s.customPalettes);
  const addCustomPalette = useScheduleStore((s) => s.addCustomPalette);
  const removeCustomPalette = useScheduleStore((s) => s.removeCustomPalette);
  const courseColorOverrides = useScheduleStore((s) => s.courseColorOverrides);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);

  const paletteName = (p: ColorPalette): string => {
    const key = BUILTIN_PALETTE_NAME_KEYS[p.name];
    return key ? t(key) : p.name;
  };

  const shareablePalette = useMemo(
    () => buildShareableSchedulePalette(colorPalette, courseColorOverrides),
    [colorPalette, courseColorOverrides],
  );
  const shareEnvelope = useMemo(
    () => buildSchedulePaletteScanEnvelope(shareablePalette),
    [shareablePalette],
  );

  const handleImport = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text.trim()) {
        Toast.show({
          type: "error",
          text1: t("palette.clipboardEmpty"),
          position: "bottom",
        });
        return;
      }

      const scanResult = resolveScanAction(text, { t });
      if (
        scanResult.status === "matched" &&
        scanResult.envelope.type === SCHEDULE_PALETTE_SCAN_TYPE
      ) {
        try {
          const next = await scanResult.handler.execute(scanResult.envelope, {
            t,
          });
          Toast.show({
            type: "success",
            text1: next.title,
            text2: next.description,
            position: "bottom",
          });
        } catch {
          Toast.show({
            type: "error",
            text1: t("scan.executeFailed"),
            position: "bottom",
          });
        }
        return;
      }

      const data = JSON.parse(text);
      if (!validateColorPalette(data)) {
        Toast.show({
          type: "error",
          text1: t("palette.formatError"),
          text2: t("palette.formatErrorSub"),
          position: "bottom",
        });
        return;
      }
      addCustomPalette(data);
      setColorPalette(data);
      Toast.show({
        type: "success",
        text1: t("palette.imported", { name: paletteName(data) }),
        position: "bottom",
      });
    } catch {
      Toast.show({
        type: "error",
        text1: t("palette.formatError"),
        text2: t("palette.parseError"),
        position: "bottom",
      });
    }
  };

  const handleExport = async () => {
    await Clipboard.setStringAsync(JSON.stringify(shareablePalette, null, 2));
    Toast.show({
      type: "success",
      text1: t("palette.exported"),
      position: "bottom",
    });
  };

  const confirmDelete = () => {
    haptic();
    if (!deleteTarget) return;
    if (colorPalette.name === deleteTarget) {
      setColorPalette(BUILTIN_PALETTES[0]);
    }
    removeCustomPalette(deleteTarget);
    setDeleteTarget(null);
    Toast.show({
      type: "success",
      text1: t("palette.deleted", { name: deleteTarget }),
      position: "bottom",
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: t("palette.title") }} />
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerClassName="px-4 pt-4 pb-8"
      >
        <View className="mb-4 overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
          {BUILTIN_PALETTES.map((palette, index) => (
            <View key={palette.name}>
              {index > 0 && (
                <View className="mx-4 border-b border-neutral-200 dark:border-neutral-700" />
              )}
              <PaletteRow
                palette={palette}
                isActive={colorPalette.name === palette.name}
                displayName={paletteName(palette)}
                onPress={() => setColorPalette(palette)}
              />
            </View>
          ))}
        </View>

        {customPalettes.length > 0 && (
          <View className="mb-4 overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
            {customPalettes.map((palette, index) => (
              <View key={palette.name}>
                {index > 0 && (
                  <View className="mx-4 border-b border-neutral-200 dark:border-neutral-700" />
                )}
                <PaletteRow
                  palette={palette}
                  isActive={colorPalette.name === palette.name}
                  displayName={paletteName(palette)}
                  onPress={() => setColorPalette(palette)}
                  onDelete={() => setDeleteTarget(palette.name)}
                />
              </View>
            ))}
          </View>
        )}

        <MenuGroup title={t("palette.actions")}>
          <MenuItem
            icon="content-paste"
            iconBg="#007AFF"
            label={t("palette.importFromClipboard")}
            onPress={handleImport}
          />
          <MenuItem
            icon="qr-code-scanner"
            iconBg="#5856D6"
            label={t("palette.scanImport")}
            href="/scan"
          />
          <MenuItem
            icon="qr-code-2"
            iconBg="#FF9500"
            label={t("palette.shareScanCode")}
            onPress={() => setShareVisible(true)}
          />
          <MenuItem
            icon="ios-share"
            iconBg="#34C759"
            label={t("palette.exportToClipboard")}
            onPress={handleExport}
          />
        </MenuGroup>
      </ScrollView>

      <BottomSheet
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("palette.deleteTitle")}
      >
        <Text className="px-5 pb-4 text-sm text-neutral-500 dark:text-neutral-400">
          {t("palette.deleteDesc", { name: deleteTarget ?? "" })}
        </Text>
        <View className="mx-5 mb-2 flex-row gap-3">
          <Pressable
            className="flex-1 items-center rounded-xl bg-neutral-200 py-3 active:bg-neutral-300 dark:bg-neutral-700 dark:active:bg-neutral-600"
            onPress={() => {
              haptic();
              setDeleteTarget(null);
            }}
          >
            <Text className="text-base font-medium text-neutral-600 dark:text-neutral-300">
              {t("common.cancel")}
            </Text>
          </Pressable>
          <Pressable
            className="flex-1 items-center rounded-xl bg-red-500 py-3 active:bg-red-600"
            onPress={confirmDelete}
          >
            <Text className="text-base font-medium text-white">
              {t("palette.deleteConfirm")}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>

      <ShareSheet
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        title={t("palette.shareCodeTitle")}
        description={t("palette.shareCodeDesc")}
        envelope={shareEnvelope}
      />
    </>
  );
}
