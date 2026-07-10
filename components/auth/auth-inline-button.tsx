import { ActivityIndicator, Pressable, Text } from "react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";

export function AuthInlineButton({
  busy,
  disabled,
  label,
  onPress,
}: Readonly<{
  busy?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}>) {
  const isDark = useColorScheme() === "dark";
  const unavailable = busy || disabled;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 102,
        height: 44,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isDark ? "#262626" : "#FFFFFF",
        borderWidth: 1,
        borderColor: isDark ? "#404040" : "#E5E5E5",
        opacity: unavailable ? 0.45 : pressed ? 0.72 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator size="small" color="#007AFF" />
      ) : (
        <Text
          style={{
            color: "#007AFF",
            fontSize: 14,
            fontWeight: "600",
            fontVariant: ["tabular-nums"],
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
