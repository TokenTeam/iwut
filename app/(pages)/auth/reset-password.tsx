import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";

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
  resetAuthCenterPassword,
  sendResetPasswordMail,
} from "@/services/auth-center";

function readResetLink(value: string) {
  const trimmed = value.trim();
  if (/^\d{0,6}$/.test(trimmed)) return { code: trimmed };

  try {
    const url = new URL(trimmed);
    return {
      code: url.searchParams.get("code")?.replace(/\D/g, "").slice(0, 6),
      email: url.searchParams.get("email") ?? undefined,
    };
  } catch {
    return { code: trimmed.replace(/\D/g, "").slice(0, 6) };
  }
}

export default function ResetPasswordScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const haptic = useHaptics();
  const isDark = useColorScheme() === "dark";
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const codeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [email, setEmail] = useState(() => params.email ?? "");
  const [verifyCode, setVerifyCode] = useState(() =>
    (params.code ?? "").replace(/\D/g, "").slice(0, 6),
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mailSent, setMailSent] = useState(false);
  const [error, setError] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const validEmail = EMAIL_PATTERN.test(normalizedEmail);
  const canSend = validEmail && !sending && cooldown === 0 && !busy;
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

  const handleSendMail = async () => {
    if (!canSend) return;
    haptic();
    setSending(true);
    setError("");
    try {
      await sendResetPasswordMail(normalizedEmail);
      setMailSent(true);
      setCooldown(60);
    } catch (cause) {
      setError(t(authErrorKey(cause, "account.resetMailFailed")));
    } finally {
      setSending(false);
    }
  };

  const mailButtonLabel =
    cooldown > 0
      ? t("account.resendCountdown", { n: cooldown })
      : mailSent
        ? t("account.resetMailResend")
        : t("account.resetMailSend");

  const handleReset = async () => {
    if (!canSubmit) return;
    if (password !== confirmPassword) {
      setError(t("account.passwordMismatch"));
      return;
    }

    haptic();
    setBusy(true);
    setError("");
    try {
      await resetAuthCenterPassword(normalizedEmail, verifyCode, password);
      Alert.alert(t("account.resetSuccess"), t("account.resetSuccessHint"), [
        {
          text: t("account.goLogin"),
          onPress: () => {
            if (router.canGoBack()) router.back();
            else router.replace("/auth/login" as never);
          },
        },
      ]);
    } catch (cause) {
      setError(t(authErrorKey(cause, "account.resetFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 24 }}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: isDark ? "#171717" : "#F5F5F5" }}
    >
      <Stack.Screen options={{ title: t("account.resetTitle") }} />

      <AuthHero
        icon="key"
        title={t("account.resetHeading")}
        subtitle={t("account.resetSubtitle")}
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
        {mailSent ? (
          <Text
            selectable
            style={{ color: isDark ? "#A3A3A3" : "#737373", lineHeight: 20 }}
          >
            {t("account.resetMailSent")}
          </Text>
        ) : null}
        <AuthTextField
          ref={codeRef}
          autoCapitalize="none"
          autoCorrect={false}
          label={t("account.resetCode")}
          onChangeText={(value) => {
            const parsed = readResetLink(value);
            setVerifyCode(parsed.code ?? "");
            if (parsed.email) setEmail(parsed.email);
          }}
          onSubmitEditing={() => passwordRef.current?.focus()}
          placeholder={t("account.resetCodePlaceholder")}
          returnKeyType="next"
          submitBehavior="submit"
          right={
            <AuthInlineButton
              busy={sending}
              disabled={!canSend}
              label={mailButtonLabel}
              onPress={handleSendMail}
            />
          }
          value={verifyCode}
        />
        <AuthTextField
          ref={passwordRef}
          autoCapitalize="none"
          autoComplete="new-password"
          label={t("account.newPassword")}
          onChangeText={setPassword}
          onSubmitEditing={() => confirmRef.current?.focus()}
          placeholder={t("account.newPasswordPlaceholder")}
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
          onSubmitEditing={handleReset}
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
        label={t("account.resetPassword")}
        onPress={handleReset}
      />
    </ScrollView>
  );
}
