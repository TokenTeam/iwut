import Feather from "@expo/vector-icons/Feather";
import { type Ref, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
  View,
} from "react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useT } from "@/lib/i18n";

export function AuthField({
  label,
  error,
  password = false,
  inputRef,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  password?: boolean;
  inputRef?: Ref<TextInputInstance>;
}) {
  const t = useT();
  const isDark = useColorScheme() === "dark";
  const [visible, setVisible] = useState(false);
  const muted = isDark ? "#a3a3a3" : "#737373";

  return (
    <View style={{ gap: 8 }}>
      <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </Text>
      <View
        className="flex-row items-center"
        style={{
          minHeight: 48,
          borderRadius: 10,
          backgroundColor: isDark ? "#262626" : "#f5f5f5",
          borderWidth: error ? 1 : 0,
          borderColor: "#ef4444",
        }}
      >
        <TextInput
          {...props}
          ref={inputRef}
          accessibilityLabel={label}
          className="flex-1 text-base text-neutral-900 dark:text-neutral-100"
          style={{ minWidth: 0, paddingHorizontal: 14, paddingVertical: 11 }}
          placeholderTextColor={muted}
          selectionColor="#3b82f6"
          secureTextEntry={password && !visible}
        />
        {password && (
          <Pressable
            onPress={() => setVisible((value) => !value)}
            disabled={props.editable === false}
            accessibilityRole="button"
            accessibilityLabel={t(
              visible ? "auth.hidePassword" : "auth.showPassword",
            )}
            hitSlop={4}
            style={({ pressed }) => ({
              width: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Feather
              name={visible ? "eye" : "eye-off"}
              size={20}
              color={muted}
            />
          </Pressable>
        )}
      </View>
      {error && (
        <Text
          selectable
          accessibilityLiveRegion="polite"
          className="text-sm leading-5 text-red-600 dark:text-red-400"
        >
          {error}
        </Text>
      )}
    </View>
  );
}
