import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";

import { AuthInlineButton } from "@/components/auth/auth-inline-button";
import { AuthPrimaryButton } from "@/components/auth/auth-primary-button";
import { AuthHero } from "@/components/auth/auth-hero";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import {
  EMAIL_PATTERN,
  authErrorKey,
  sendRegisterCode,
} from "@/services/auth-center";
import { AutoLoginFailedError, useAccountStore } from "@/store/account";

export default function AuthRegisterScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const haptic = useHaptics();
  const isDark = useColorScheme() === "dark";
  const { from } = useLocalSearchParams<{ from?: string }>();
  const register = useAccountStore((s) => s.register);
  const codeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const validEmail = EMAIL_PATTERN.test(normalizedEmail);
  const canSendCode = validEmail && !sendingCode && cooldown === 0 && !busy;
  const canSubmit =
    validEmail &&
    verifyCode.length === 6 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    !busy;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1_000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendCode = async () => {
    if (!canSendCode) return;
    haptic();
    setSendingCode(true);
    setError("");
    try {
      await sendRegisterCode(normalizedEmail);
      setCooldown(60);
    } catch (cause) {
      setError(t(authErrorKey(cause, "account.codeSendFailed")));
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async () => {
    if (!canSubmit) return;
    if (password !== confirmPassword) {
      setError(t("account.passwordMismatch"));
      return;
    }

    haptic();
    setBusy(true);
    setError("");
    try {
      await register(normalizedEmail, verifyCode, password);
      if (!router.canGoBack()) {
        router.replace("/");
      } else if (from === "login") {
        router.dismiss(2);
      } else {
        router.back();
      }
    } catch (cause) {
      if (cause instanceof AutoLoginFailedError) {
        Toast.show({
          type: "info",
          text1: t("account.registeredPleaseLogin"),
          position: "bottom",
        });
        if (from === "login" && router.canGoBack()) {
          router.back();
        } else {
          router.replace("/auth/login" as never);
        }
        return;
      }
      setError(t(authErrorKey(cause, "account.registerFailed")));
    } finally {
      setBusy(false);
    }
  };

  const codeButtonLabel =
    cooldown > 0
      ? t("account.resendCountdown", { n: cooldown })
      : t("account.sendCode");

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 24 }}
      style={{ flex: 1, backgroundColor: isDark ? "#171717" : "#F5F5F5" }}
    >
      <Stack.Screen options={{ title: t("account.registerTitle") }} />

      <AuthHero
        icon="person-add"
        title={t("account.registerHeading")}
        subtitle={t("account.registerSubtitle")}
      />

      <View style={{ gap: 14 }}>
        <AuthTextField
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          label={t("account.email")}
          onChangeText={setEmail}
          onSubmitEditing={() => codeRef.current?.focus()}
          placeholder={t("account.emailPlaceholder")}
          returnKeyType="next"
          submitBehavior="submit"
          value={email}
        />
        <AuthTextField
          ref={codeRef}
          autoComplete="one-time-code"
          keyboardType="number-pad"
          label={t("account.verifyCode")}
          maxLength={6}
          onChangeText={(value) => {
            const digits = value.replace(/\D/g, "");
            setVerifyCode(digits);
            if (digits.length === 6) passwordRef.current?.focus();
          }}
          placeholder={t("account.verifyCodePlaceholder")}
          right={
            <AuthInlineButton
              busy={sendingCode}
              disabled={!canSendCode}
              label={codeButtonLabel}
              onPress={handleSendCode}
            />
          }
          value={verifyCode}
        />
        <AuthTextField
          ref={passwordRef}
          autoCapitalize="none"
          autoComplete="new-password"
          label={t("account.password")}
          onChangeText={setPassword}
          onSubmitEditing={() => confirmRef.current?.focus()}
          placeholder={t("account.passwordPlaceholder")}
          returnKeyType="next"
          secureTextEntry
          submitBehavior="submit"
          value={password}
        />
        <AuthTextField
          ref={confirmRef}
          autoCapitalize="none"
          autoComplete="new-password"
          label={t("account.confirmPassword")}
          onChangeText={setConfirmPassword}
          onSubmitEditing={handleRegister}
          placeholder={t("account.confirmPasswordPlaceholder")}
          returnKeyType="done"
          secureTextEntry
          value={confirmPassword}
        />
        {error ? (
          <Text selectable style={{ color: "#FF3B30", lineHeight: 20 }}>
            {error}
          </Text>
        ) : null}
      </View>

      <AuthPrimaryButton
        busy={busy}
        disabled={!canSubmit}
        label={t("account.register")}
        onPress={handleRegister}
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
          {t("account.hasAccount")}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/auth/login" as never);
            }
          }}
          hitSlop={8}
        >
          <Text style={{ color: "#007AFF", fontWeight: "600" }}>
            {t("account.goLogin")}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
