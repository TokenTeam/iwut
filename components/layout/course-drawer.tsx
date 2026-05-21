import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useT } from "@/lib/i18n";

const HEADER_HEIGHT = 40;

interface Props {
  visible: boolean;
  onClose: () => void;
  isBound: boolean;
  onManage: () => void;
  onReimport: () => void;
  onOpenSettings: () => void;
}

const ENTER_MS = 240;
const EXIT_MS = 200;

export function CourseDrawer({
  visible,
  onClose,
  isBound,
  onManage,
  onReimport,
  onOpenSettings,
}: Props) {
  const t = useT();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const drawerWidth = Math.round(screenWidth * 0.66);
  const topOffset = insets.top + HEADER_HEIGHT;

  // 控制 Modal 卸载时机，让退出动画能完整播放。
  // - render 阶段：visible 变 true 时立刻 mount（避免 effect 同步 setState）
  // - effect 阶段：写 SharedValue 启动动画（reanimated 不允许 render 阶段写 value）
  // - 动画 callback：visible 变 false 且动画跑完后再异步 unmount
  const [mounted, setMounted] = useState(visible);
  const [prevVisible, setPrevVisible] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setMounted(true);
  }

  // 跳过首次 effect，避免初始 visible=false 启动一个"假"的 withTiming(0)：
  // 那个 callback 会延迟到 EXIT_MS 后才跑，期间用户若点开抽屉，
  // 旧 callback 会把刚 set 为 true 的 mounted 又改回 false，导致抽屉展不开。
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    if (visible) {
      progress.value = withTiming(1, {
        duration: ENTER_MS,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progress.value = withTiming(
        0,
        { duration: EXIT_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }
  }, [visible, progress]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * drawerWidth }],
  }));

  const cardSolid = Colors[isDark ? "dark" : "light"].background;
  const primaryText = isDark ? "#f5f5f5" : "#1c1c1e";
  const chevronColor = isDark ? "#525252" : "#c4c4c4";

  // iOS 同一 presenter 同时只能持有一个 Modal，抽屉未 dismiss 完前打开下一个 Modal
  // 会被 UIKit 拒绝。把 action 暂存到 ref，等 <Modal onDismiss>（iOS 在原生 dismiss
  // 完成时触发）回调里再执行。Android 的 Modal 是 Dialog 模拟，无此限制。
  const pendingActionRef = useRef<(() => void) | null>(null);

  const dismissThen = (action: () => void) => {
    if (Platform.OS === "ios") {
      pendingActionRef.current = action;
      onClose();
    } else {
      onClose();
      action();
    }
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={() => {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        action?.();
      }}
    >
      {/* 遮罩仅覆盖 header 下方区域，不影响顶部菜单按钮和周数栏 */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: topOffset,
            left: 0,
            right: 0,
            bottom: 0,
          },
          overlayStyle,
        ]}
      >
        <BlurView
          intensity={25}
          tint={isDark ? "dark" : "default"}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.12)",
            },
          ]}
          onPress={onClose}
        />
      </Animated.View>

      {/* 左侧抽屉从 header 下方开始，高度跟随内容 */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: topOffset,
            left: 0,
            width: drawerWidth,
            backgroundColor: cardSolid,
            borderBottomRightRadius: 20,
            overflow: "hidden",
          },
          drawerStyle,
        ]}
        pointerEvents="box-none"
      >
        <View
          style={{
            paddingTop: 12,
            paddingBottom: 20,
            paddingHorizontal: 10,
            gap: 2,
          }}
        >
          <DrawerItem
            icon="list-outline"
            label={t("course.drawer.manage")}
            tint="#3b82f6"
            textColor={primaryText}
            chevronColor={chevronColor}
            isDark={isDark}
            onPress={() => dismissThen(onManage)}
          />
          <DrawerItem
            icon="refresh-outline"
            label={t("course.drawer.reimport")}
            tint="#10b981"
            textColor={primaryText}
            chevronColor={chevronColor}
            isDark={isDark}
            disabled={!isBound}
            onPress={() => dismissThen(onReimport)}
          />
          <DrawerItem
            icon="settings-outline"
            label={t("course.drawer.settings")}
            tint="#8e8e93"
            textColor={primaryText}
            chevronColor={chevronColor}
            isDark={isDark}
            onPress={() => dismissThen(onOpenSettings)}
          />
        </View>
      </Animated.View>
    </Modal>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function DrawerItem({
  icon,
  label,
  tint,
  textColor,
  chevronColor,
  isDark,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  tint: string;
  textColor: string;
  chevronColor: string;
  isDark: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const iconBg = hexToRgba(tint, isDark ? 0.22 : 0.14);
  const hoverBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: pressed ? hoverBg : "transparent",
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: "500",
          color: textColor,
        }}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={chevronColor} />
    </Pressable>
  );
}
