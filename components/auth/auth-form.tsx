import Feather from "@expo/vector-icons/Feather";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  type TextInputInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { AuthActions } from "@/components/auth/auth-actions";
import { AuthField } from "@/components/auth/auth-field";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { authClient } from "@/lib/auth";
import {
  getAuthErrorKey,
  validateAuthForm,
  type AuthErrors,
  type AuthMode,
  type AuthValues,
} from "@/lib/auth/form";
import { useT } from "@/lib/i18n";
import { isNetworkError } from "@/lib/network-error";

export function AuthForm({ mode }: { mode: AuthMode }) {
  useMarkRouteInteractive();
  const t = useT();
  const router = useRouter();
  const haptic = useHaptics();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const { email: initialEmail, from } = useLocalSearchParams<{
    email?: string;
    from?: string;
  }>();
  const isRegister = mode === "register";
  const [values, setValues] = useState<AuthValues>({
    name: "",
    email: typeof initialEmail === "string" ? initialEmail : "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<AuthErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [registered, setRegistered] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const nameRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function update<K extends keyof AuthValues>(key: K, value: AuthValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({
      ...previous,
      [key]: undefined,
      ...(key === "password" ? { confirmPassword: undefined } : {}),
    }));
    setRequestError(null);
  }

  function finish() {
    if (from === "onboarding") {
      router.dismissTo({
        pathname: "/onboarding",
        params: { step: "setup" },
      });
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/user");
  }

  async function submit() {
    if (submitting.current) return;
    haptic();
    const validation = validateAuthForm(mode, values);
    setErrors(validation);
    setRequestError(null);
    if (Object.keys(validation).length > 0) {
      if (validation.name) nameRef.current?.focus();
      else if (validation.email) emailRef.current?.focus();
      else if (validation.password) passwordRef.current?.focus();
      else if (validation.confirmPassword) confirmRef.current?.focus();
      return;
    }

    submitting.current = true;
    setPending(true);
    Keyboard.dismiss();
    try {
      const credentials = {
        email: values.email.trim(),
        password: values.password,
      };
      const result = isRegister
        ? await authClient.signUp.email({
            ...credentials,
            name: values.name.trim(),
          })
        : await authClient.signIn.email(credentials);
      if (!mounted.current) return;
      if (result.error) {
        setRequestError(t(getAuthErrorKey(result.error)));
        return;
      }
      if (
        !result.data?.user?.id ||
        !result.data.user.email ||
        (!isRegister && !result.data.token)
      ) {
        setRequestError(t("auth.requestFailed"));
        return;
      }
      setValues((previous) => ({
        ...previous,
        password: "",
        confirmPassword: "",
      }));
      if (isRegister && !result.data.token) {
        setRegistered(true);
        return;
      }
      Toast.show({
        type: "success",
        text1: t(isRegister ? "auth.registerSuccess" : "auth.loginSuccess"),
        position: "bottom",
      });
      finish();
    } catch (error) {
      if (mounted.current) {
        setRequestError(
          t(isNetworkError(error) ? "auth.networkError" : "auth.requestFailed"),
        );
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  }

  function switchMode() {
    if (submitting.current) return;
    haptic();
    router.replace({
      pathname: isRegister ? "/auth/login" : "/auth/register",
      params: {
        email: values.email.trim(),
        ...(from === "onboarding" ? { from } : {}),
      },
    });
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors[scheme].background },
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: Colors[scheme].background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 32,
            paddingBottom: Math.max(insets.bottom, 24),
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 440,
              alignSelf: "center",
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ marginBottom: 36 }}
              className="text-[32px] font-bold text-neutral-900 dark:text-neutral-50"
            >
              {t(isRegister ? "auth.register" : "auth.login")}
            </Text>

            <View style={{ gap: 16 }}>
              {registered ? (
                <View style={{ gap: 12 }}>
                  <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {t("auth.registerSuccess")}
                  </Text>
                  <Text
                    selectable
                    className="text-base text-neutral-700 dark:text-neutral-300"
                  >
                    {values.email.trim()}
                  </Text>
                  <Text className="text-sm leading-5 text-neutral-500 dark:text-neutral-400">
                    {t("auth.registeredHint")}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 20 }}>
                  {isRegister && (
                    <AuthField
                      inputRef={nameRef}
                      label={t("auth.name")}
                      placeholder={t("auth.namePlaceholder")}
                      value={values.name}
                      onChangeText={(value) => update("name", value)}
                      error={errors.name ? t(errors.name) : undefined}
                      editable={!pending}
                      autoComplete="nickname"
                      returnKeyType="next"
                      submitBehavior="submit"
                      onSubmitEditing={() => emailRef.current?.focus()}
                    />
                  )}
                  <AuthField
                    inputRef={emailRef}
                    label={t("auth.email")}
                    placeholder="name@example.com"
                    value={values.email}
                    onChangeText={(value) => update("email", value)}
                    error={errors.email ? t(errors.email) : undefined}
                    editable={!pending}
                    autoComplete="email"
                    textContentType="emailAddress"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                  <AuthField
                    inputRef={passwordRef}
                    label={t("auth.password")}
                    placeholder={t("auth.passwordPlaceholder")}
                    password
                    value={values.password}
                    onChangeText={(value) => update("password", value)}
                    error={errors.password ? t(errors.password) : undefined}
                    editable={!pending}
                    autoComplete={
                      isRegister ? "new-password" : "current-password"
                    }
                    textContentType={isRegister ? "newPassword" : "password"}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType={isRegister ? "next" : "done"}
                    submitBehavior="submit"
                    onSubmitEditing={() => {
                      if (isRegister) confirmRef.current?.focus();
                      else void submit();
                    }}
                  />
                  {isRegister && (
                    <AuthField
                      inputRef={confirmRef}
                      label={t("auth.confirmPassword")}
                      placeholder={t("auth.confirmPasswordPlaceholder")}
                      password
                      value={values.confirmPassword}
                      onChangeText={(value) => update("confirmPassword", value)}
                      error={
                        errors.confirmPassword
                          ? t(errors.confirmPassword)
                          : undefined
                      }
                      editable={!pending}
                      autoComplete="new-password"
                      textContentType="newPassword"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      submitBehavior="submit"
                      onSubmitEditing={() => void submit()}
                    />
                  )}
                </View>
              )}

              {requestError && (
                <View className="flex-row items-start gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-950">
                  <Feather name="alert-circle" size={18} color="#ef4444" />
                  <Text
                    selectable
                    accessibilityLiveRegion="polite"
                    className="flex-1 text-sm leading-5 text-red-700 dark:text-red-300"
                  >
                    {requestError}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ paddingTop: 24 }}>
              <AuthActions
                mode={mode}
                pending={pending}
                registered={registered}
                onSubmit={() => void submit()}
                onSwitchMode={switchMode}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
