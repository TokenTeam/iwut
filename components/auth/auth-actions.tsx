import { ActivityIndicator, Pressable, Text, View } from "react-native";

import type { AuthMode } from "@/lib/auth/form";
import { useT } from "@/lib/i18n";

export function AuthActions({
  mode,
  pending,
  registered,
  onSubmit,
  onSwitchMode,
}: {
  mode: AuthMode;
  pending: boolean;
  registered: boolean;
  onSubmit: () => void;
  onSwitchMode: () => void;
}) {
  const t = useT();
  const isRegister = mode === "register";
  const label = registered
    ? "auth.goToLogin"
    : pending
      ? isRegister
        ? "auth.registering"
        : "auth.loggingIn"
      : isRegister
        ? "auth.register"
        : "auth.login";

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={registered ? onSwitchMode : onSubmit}
        disabled={pending}
        accessibilityRole="button"
        accessibilityState={{ disabled: pending, busy: pending }}
        style={({ pressed }) => ({
          minHeight: 54,
          borderRadius: 18,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#007AFF",
          paddingHorizontal: 14,
          paddingVertical: 14,
          opacity: pending ? 0.42 : pressed ? 0.82 : 1,
        })}
      >
        <View className="flex-row items-center justify-center gap-2">
          {pending && <ActivityIndicator size="small" color="#fff" />}
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>
            {t(label)}
          </Text>
        </View>
      </Pressable>
      {!registered && (
        <View className="flex-row flex-wrap items-center justify-center gap-x-1">
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            {t(isRegister ? "auth.haveAccount" : "auth.noAccount")}
          </Text>
          <Pressable
            onPress={onSwitchMode}
            disabled={pending}
            accessibilityRole="link"
            style={({ pressed }) => ({
              minHeight: 44,
              justifyContent: "center",
              opacity: pending || pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ color: "#007AFF", fontSize: 14, fontWeight: "500" }}>
              {t(isRegister ? "auth.goToLogin" : "auth.goToRegister")}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
