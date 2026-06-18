import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { type ComponentProps, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHaptics } from "@/hooks/use-haptics";
import { useT } from "@/lib/i18n";
import { useUpdateStore } from "@/store/update";

const MENU_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.18,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 12,
} as const;

type Anchor = { top: number; right: number };

export function HomeMenu({ isDark }: Readonly<{ isDark: boolean }>) {
  const t = useT();
  const haptic = useHaptics();
  const hasUpdate = useUpdateStore((s) => s.hasUpdate);
  const openUpdateModal = useUpdateStore((s) => s.openModal);

  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const pendingAction = useRef<(() => void) | null>(null);

  const open = () => {
    haptic();
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      const topInset = Platform.OS === "android" ? insets.top : 0;
      setAnchor({
        top: y + h + 8 + topInset,
        right: Math.max(12, screenWidth - (x + w)),
      });
    });
  };

  const close = () => setAnchor(null);

  const select = (action: () => void) => {
    haptic();
    if (Platform.OS === "ios") {
      pendingAction.current = action;
      close();
    } else {
      close();
      action();
    }
  };

  return (
    <>
      <Pressable
        ref={triggerRef}
        hitSlop={8}
        className="relative p-1 active:opacity-60"
        onPress={open}
      >
        <Ionicons
          name="add-circle-outline"
          size={26}
          color={isDark ? "#e5e5e5" : "#404040"}
        />
        {hasUpdate && (
          <View className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 dark:border-neutral-900" />
        )}
      </Pressable>

      <Modal
        visible={anchor !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={close}
        onDismiss={() => {
          const action = pendingAction.current;
          pendingAction.current = null;
          action?.();
        }}
      >
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.12)",
            },
          ]}
          onPress={close}
        >
          {anchor && (
            <View
              className="rounded-2xl bg-white dark:bg-neutral-800"
              style={{
                position: "absolute",
                top: anchor.top,
                right: anchor.right,
                minWidth: 188,
                ...MENU_SHADOW,
              }}
            >
              <View className="overflow-hidden rounded-2xl">
                <MenuRow
                  icon="scan-outline"
                  iconBg="#5856d6"
                  label={t("scan.title")}
                  onPress={() => select(() => router.push("/scan"))}
                />
                {hasUpdate && (
                  <>
                    <View
                      className="bg-neutral-200 dark:bg-neutral-700"
                      style={{
                        height: StyleSheet.hairlineWidth,
                        marginLeft: 60,
                      }}
                    />
                    <MenuRow
                      icon="arrow-up-circle-outline"
                      iconBg="#007aff"
                      label={t("about.newVersionFound")}
                      trailingDot
                      onPress={() => select(openUpdateModal)}
                    />
                  </>
                )}
              </View>
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

function MenuRow({
  icon,
  iconBg,
  label,
  trailingDot,
  onPress,
}: Readonly<{
  icon: ComponentProps<typeof Ionicons>["name"];
  iconBg: string;
  label: string;
  trailingDot?: boolean;
  onPress: () => void;
}>) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 active:bg-neutral-100 dark:active:bg-neutral-700"
    >
      <View
        className="h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBg }}
      >
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <Text className="ml-3 flex-1 text-base text-neutral-900 dark:text-neutral-100">
        {label}
      </Text>
      {trailingDot && <View className="ml-3 h-2 w-2 rounded-full bg-red-500" />}
    </Pressable>
  );
}
