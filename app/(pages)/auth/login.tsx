import { Stack, router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AuthPrimaryButton } from "@/components/auth/auth-primary-button";
import { AuthHero } from "@/components/auth/auth-hero";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import { EMAIL_PATTERN, authErrorKey } from "@/services/auth-center";
import { useAccountStore } from "@/store/account";

export default function AuthLoginScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const haptic = useHaptics();
  const isDark = useColorScheme() === "dark";
  const login = useAccountStore((s) => s.login);
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canSubmit =
    EMAIL_PATTERN.test(email.trim()) && password.length > 0 && !busy;

  const handleLogin = async () => {
    if (!canSubmit) return;
    haptic();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/");
      }
    } catch (cause) {
      setError(t(authErrorKey(cause, "account.loginFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 28 }}
      style={{ flex: 1, backgroundColor: isDark ? "#171717" : "#F5F5F5" }}
    >
      <Stack.Screen options={{ title: t("account.loginTitle") }} />

      <AuthHero
        icon="person"
        title={t("account.loginHeading")}
        subtitle={t("account.loginSubtitle")}
      />

      <View style={{ gap: 16 }}>
        <AuthTextField
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          label={t("account.email")}
          onChangeText={setEmail}
          onSubmitEditing={() => passwordRef.current?.focus()}
          placeholder={t("account.emailPlaceholder")}
          returnKeyType="next"
          submitBehavior="submit"
          value={email}
        />
        <AuthTextField
          ref={passwordRef}
          autoCapitalize="none"
          autoComplete="current-password"
          label={t("account.password")}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
          placeholder={t("account.passwordPlaceholder")}
          returnKeyType="done"
          secureTextEntry
          value={password}
        />
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            haptic();
            router.push("/auth/reset-password" as never);
          }}
          style={{ alignSelf: "flex-end" }}
        >
          <Text style={{ color: "#007AFF", fontSize: 14, fontWeight: "600" }}>
            {t("account.forgotPassword")}
          </Text>
        </Pressable>
        {error ? (
          <Text selectable style={{ color: "#FF3B30", lineHeight: 20 }}>
            {error}
          </Text>
        ) : null}
      </View>

      <AuthPrimaryButton
        busy={busy}
        disabled={!canSubmit}
        label={t("account.signIn")}
        onPress={handleLogin}
      />

      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Text selectable style={{ color: isDark ? "#A3A3A3" : "#737373" }}>
          {t("account.noAccount")}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptic();
            router.push({
              pathname: "/auth/register",
              params: { from: "login" },
            } as never);
          }}
          hitSlop={8}
        >
          <Text style={{ color: "#007AFF", fontWeight: "600" }}>
            {t("account.goRegister")}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
