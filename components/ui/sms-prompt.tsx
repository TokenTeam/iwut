import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { useT } from "@/lib/i18n";

export function SmsPrompt({
  visible,
  phoneTail,
  submitting,
  code,
  onChangeCode,
  onSubmit,
  onCancel,
}: Readonly<{
  visible: boolean;
  phoneTail: string;
  submitting: boolean;
  code: string;
  onChangeCode: (code: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}>) {
  const t = useT();
  const canSubmit = code.trim().length > 0 && !submitting;
  const { height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          className="flex-1 bg-black/40"
          style={{ paddingTop: height * 0.3 }}
          onPress={submitting ? undefined : onCancel}
        >
          <Pressable
            className="mx-8 rounded-3xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-800"
            onPress={() => {}}
          >
            <View className="mb-2 flex-row items-center gap-2">
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color="#3b82f6"
              />
              <Text className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
                {t("sms.title")}
              </Text>
            </View>
            <Text className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
              {phoneTail
                ? t("sms.sentTo", { tail: phoneTail })
                : t("sms.enterCode")}
            </Text>
            <View className="h-12 flex-row items-center rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-700/50">
              <TextInput
                className="flex-1 text-base tracking-widest text-neutral-900 dark:text-neutral-100"
                style={{
                  height: 48,
                  paddingHorizontal: 12,
                  textAlignVertical: "center",
                }}
                value={code}
                onChangeText={(v) => onChangeCode(v.replace(/\D/g, ""))}
                autoFocus
                editable={!submitting}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                returnKeyType="go"
                placeholder={t("sms.placeholder")}
                placeholderTextColor="#a3a3a3"
                onSubmitEditing={onSubmit}
              />
              <Pressable
                className="mr-1.5 h-9 w-9 items-center justify-center rounded-xl bg-blue-500 active:bg-blue-600"
                style={{ opacity: canSubmit ? 1 : 0.4 }}
                disabled={!canSubmit}
                onPress={onSubmit}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="arrow-forward" size={20} color="white" />
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
