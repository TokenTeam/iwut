import { BlurView } from "expo-blur";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import {
  getAndroidBlurProps,
  useAndroidBlurTarget,
} from "@/components/ui/app-blur-target";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useT } from "@/lib/i18n";

/**
 * Centered alert dialog with a full-screen blur backdrop. Mirrors the
 * `ConfirmSheet` API but presents as a middle-of-screen alert box instead of a
 * bottom drawer.
 */
export function AlertDialog({
  visible,
  onClose,
  title,
  description,
  confirmText,
  cancelText,
  destructive = false,
  onConfirm,
}: Readonly<{
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
}>) {
  const t = useT();
  const haptic = useHaptics();
  const isDark = useColorScheme() === "dark";
  const blurTarget = useAndroidBlurTarget();
  const resolvedConfirmText = confirmText ?? t("common.confirm");
  const resolvedCancelText = cancelText ?? t("common.cancel");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <BlurView
        {...getAndroidBlurProps(blurTarget)}
        intensity={25}
        tint={isDark ? "dark" : "default"}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Pressable
        className="flex-1 items-center justify-center px-10"
        style={{
          backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.12)",
        }}
        onPress={onClose}
      >
        <Pressable
          className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-800"
          onPress={() => {}}
        >
          <Text className="mb-2 text-center text-base font-semibold text-neutral-800 dark:text-neutral-100">
            {title}
          </Text>
          <Text className="mb-5 text-center text-sm leading-5 text-neutral-500 dark:text-neutral-400">
            {description}
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              className="flex-1 items-center rounded-xl bg-neutral-200 py-3 active:bg-neutral-300 dark:bg-neutral-700 dark:active:bg-neutral-600"
              onPress={() => {
                haptic();
                onClose();
              }}
            >
              <Text className="text-base font-medium text-neutral-600 dark:text-neutral-300">
                {resolvedCancelText}
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 items-center rounded-xl py-3 ${
                destructive
                  ? "bg-red-500 active:bg-red-600"
                  : "bg-blue-500 active:bg-blue-600"
              }`}
              onPress={() => {
                haptic();
                onConfirm();
              }}
            >
              <Text className="text-base font-medium text-white">
                {resolvedConfirmText}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
