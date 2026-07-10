import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Text, View } from "react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";

export function AuthHero({
  icon,
  subtitle,
  title,
}: Readonly<{
  icon: ComponentProps<typeof Ionicons>["name"];
  subtitle: string;
  title: string;
}>) {
  const isDark = useColorScheme() === "dark";

  return (
    <View style={{ alignItems: "center", gap: 12, paddingTop: 24 }}>
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 24,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDark ? "#1E3A5F" : "#E1F0FF",
        }}
      >
        <Ionicons name={icon} size={36} color="#007AFF" />
      </View>
      <Text
        selectable
        style={{
          color: isDark ? "#FAFAFA" : "#171717",
          fontSize: 28,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        selectable
        style={{
          color: isDark ? "#A3A3A3" : "#737373",
          fontSize: 15,
          lineHeight: 22,
          textAlign: "center",
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}
