import { Pressable, Text, View } from "react-native";

import { useHaptics } from "@/hooks/use-haptics";
import { useT } from "@/lib/i18n";

import { BottomSheet } from "./bottom-sheet";

export function ConfirmSheet({
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
  const resolvedConfirmText = confirmText ?? t("common.confirm");
  const resolvedCancelText = cancelText ?? t("common.cancel");
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <Text className="px-5 pb-4 text-sm text-neutral-500 dark:text-neutral-400">
        {description}
      </Text>
      <View className="mx-5 mb-2 flex-row gap-3">
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
    </BottomSheet>
  );
}
