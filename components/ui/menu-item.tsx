import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Children, ComponentProps, ReactNode, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";

export function MenuItem({
  icon,
  iconBg,
  label,
  href,
  onPress,
  value,
  right,
  showArrow,
  badge,
  highlight,
}: Readonly<{
  icon: ComponentProps<typeof MaterialIcons>["name"];
  iconBg?: string;
  label: string;
  href?: string;
  onPress?: () => void;
  value?: string;
  right?: ReactNode;
  showArrow?: boolean;
  badge?: boolean;
  highlight?: boolean;
}>) {
  const router = useRouter();
  const scheme = useColorScheme();
  const iconColor = Colors[scheme === "dark" ? "dark" : "light"].icon;
  const haptic = useHaptics();

  const hasCustomRight = right !== undefined;
  const shouldShowArrow = showArrow ?? !hasCustomRight;

  // 从外部带参跳转时闪烁高亮，提示用户目标项位置
  const flash = useSharedValue(0);
  useEffect(() => {
    if (!highlight) return;
    flash.value = 0;
    flash.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 340 }),
          withTiming(0, { duration: 340 }),
        ),
        2,
        false,
      ),
    );
  }, [highlight, flash]);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const handlePress = () => {
    haptic();
    onPress?.();
    if (href) {
      router.push(href as any);
    }
  };

  return (
    <Pressable
      className="flex-row items-center px-4 py-3 active:bg-neutral-100 dark:active:bg-neutral-700"
      onPress={handlePress}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: "rgba(59,130,246,0.18)",
          },
          flashStyle,
        ]}
      />
      {iconBg ? (
        <View className="relative">
          <View
            className="h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: iconBg }}
          >
            <IconSymbol name={icon} size={18} color="#fff" />
          </View>
          {badge && (
            <View className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-red-500 dark:border-neutral-800" />
          )}
        </View>
      ) : (
        <View className="relative w-8 items-center">
          <IconSymbol name={icon} size={22} color={iconColor} />
          {badge && (
            <View className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500 dark:border-neutral-800" />
          )}
        </View>
      )}
      <Text className="ml-3 flex-1 text-base text-neutral-900 dark:text-neutral-100">
        {label}
      </Text>
      {value && (
        <Text className="mr-1 text-sm text-neutral-400 dark:text-neutral-500">
          {value}
        </Text>
      )}
      {hasCustomRight && right}
      {shouldShowArrow && (
        <IconSymbol name="chevron-right" size={20} color={iconColor} />
      )}
    </Pressable>
  );
}

export function MenuGroup({
  title,
  children,
}: Readonly<{
  title?: string;
  children: ReactNode;
}>) {
  const items = Children.toArray(children);

  return (
    <View className="mb-4">
      {title && (
        <Text className="mb-1 ml-4 text-xs uppercase text-neutral-400 dark:text-neutral-500">
          {title}
        </Text>
      )}
      <View className="overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
        {items.map((child, index) => (
          <View key={index}>
            {child}
            {index < items.length - 1 && (
              <View className="mx-4 border-b border-neutral-200 dark:border-neutral-700" />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
