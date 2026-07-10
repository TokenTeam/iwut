import type { ComponentProps, ReactNode, Ref } from "react";
import { Text, TextInput, View } from "react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";

type AuthTextFieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  right?: ReactNode;
  ref?: Ref<TextInput>;
};

export function AuthTextField({
  label,
  right,
  style,
  ref,
  ...props
}: AuthTextFieldProps) {
  const isDark = useColorScheme() === "dark";

  return (
    <View style={{ gap: 7 }}>
      <Text
        selectable
        style={{ color: isDark ? "#D4D4D4" : "#525252", fontSize: 14 }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TextInput
          {...props}
          ref={ref}
          placeholderTextColor={isDark ? "#737373" : "#A3A3A3"}
          style={[
            {
              flex: 1,
              height: 44,
              borderRadius: 12,
              borderCurve: "continuous",
              paddingHorizontal: 14,
              color: isDark ? "#FAFAFA" : "#171717",
              backgroundColor: isDark ? "#262626" : "#FFFFFF",
              borderWidth: 1,
              borderColor: isDark ? "#404040" : "#E5E5E5",
              fontSize: 15,
            },
            style,
          ]}
        />
        {right}
      </View>
    </View>
  );
}
