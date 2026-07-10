import { ActivityIndicator, Pressable, Text } from "react-native";

export function AuthPrimaryButton({
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
  const unavailable = busy || disabled;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 54,
        borderRadius: 18,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#007AFF",
        opacity: unavailable ? 0.42 : pressed ? 0.82 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "700" }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
