import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { AccountAvatar } from "@/components/account/account-avatar";
import { AuthPrimaryButton } from "@/components/auth/auth-primary-button";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { readAuthCenterProfileText } from "@/lib/auth-center-profile";
import { useT } from "@/lib/i18n";
import {
  type AuthCenterProfile,
  EMAIL_PATTERN,
  authErrorKey,
} from "@/services/auth-center";
import { useAccountStore } from "@/store/account";

const FIELD_GROUPS = [
  {
    title: "account.basicInfo",
    fields: [
      { key: "nick", label: "account.nickname", maxLength: 64 },
      { key: "realName", label: "account.realName", maxLength: 64 },
      { key: "gender", label: "account.gender", maxLength: 32 },
      { key: "birthday", label: "account.birthday", maxLength: 32 },
      { key: "avatarUrl", label: "account.avatarUrl", maxLength: 512 },
    ],
  },
  {
    title: "account.campusInfo",
    fields: [
      {
        key: "studentNumber",
        label: "account.studentNumber",
        maxLength: 64,
      },
      { key: "school", label: "account.school", maxLength: 128 },
      { key: "region", label: "account.region", maxLength: 64 },
      { key: "whutEmail", label: "account.campusEmail", maxLength: 254 },
    ],
  },
  {
    title: "account.contactInfo",
    fields: [
      { key: "phone", label: "account.phone", maxLength: 32 },
      { key: "qq", label: "account.qq", maxLength: 32 },
    ],
  },
] as const;

const ATTR_ALIASES = {
  nick: "nickname",
  realName: "real_name",
  avatarUrl: "avatar_url",
  studentNumber: "student_number",
  whutEmail: "whut_email",
} as const;

type ProfileFieldKey = (typeof FIELD_GROUPS)[number]["fields"][number]["key"];
type ProfileValues = Record<ProfileFieldKey, string>;

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function createProfileValues(profile: AuthCenterProfile): ProfileValues {
  return {
    nick: readAuthCenterProfileText(profile.attrs, ["nick", "nickname"]),
    realName: readAuthCenterProfileText(profile.attrs, [
      "realName",
      "real_name",
    ]),
    gender: readAuthCenterProfileText(profile.attrs, ["gender"]),
    birthday: readAuthCenterProfileText(profile.attrs, ["birthday"]),
    avatarUrl: readAuthCenterProfileText(profile.attrs, [
      "avatarUrl",
      "avatar_url",
    ]),
    studentNumber: readAuthCenterProfileText(profile.attrs, [
      "studentNumber",
      "student_number",
    ]),
    school: readAuthCenterProfileText(profile.attrs, ["school"]),
    region: readAuthCenterProfileText(profile.attrs, ["region"]),
    whutEmail: readAuthCenterProfileText(profile.attrs, [
      "whutEmail",
      "whut_email",
    ]),
    phone: readAuthCenterProfileText(profile.attrs, ["phone"]),
    qq: readAuthCenterProfileText(profile.attrs, ["qq"]),
  };
}

export function ProfileEditForm({
  profile,
}: Readonly<{ profile: AuthCenterProfile }>) {
  const t = useT();
  const isDark = useColorScheme() === "dark";
  const updateProfile = useAccountStore((s) => s.updateProfile);
  const [initialValues] = useState<ProfileValues>(() =>
    createProfileValues(profile),
  );
  const [values, setValues] = useState<ProfileValues>(() => initialValues);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const changedAttrs: Record<string, string> = {};
  for (const key of Object.keys(values) as ProfileFieldKey[]) {
    const trimmed = values[key].trim();
    if (trimmed !== initialValues[key]) changedAttrs[key] = trimmed;
  }
  const hasChanges = Object.keys(changedAttrs).length > 0;

  const handleSave = async () => {
    if (!hasChanges || busy) return;
    if (changedAttrs.avatarUrl && !isHttpsUrl(changedAttrs.avatarUrl)) {
      setError(t("account.invalidAvatarUrl"));
      return;
    }
    if (changedAttrs.whutEmail && !EMAIL_PATTERN.test(changedAttrs.whutEmail)) {
      setError(t("account.invalidCampusEmail"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const attrs = { ...changedAttrs };
      for (const [key, alias] of Object.entries(ATTR_ALIASES)) {
        if (key in attrs && Object.hasOwn(profile.attrs, alias)) {
          attrs[alias] = attrs[key];
        }
      }
      await updateProfile(attrs);
      Toast.show({ type: "success", text1: t("account.profileUpdateSuccess") });
      router.back();
    } catch (cause) {
      setError(t(authErrorKey(cause, "account.profileUpdateFailed")));
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
      <View style={{ alignItems: "center", gap: 10 }}>
        <AccountAvatar size={84} uri={values.avatarUrl.trim()} />
        <Text
          selectable
          style={{
            color: isDark ? "#A3A3A3" : "#737373",
            fontSize: 13,
            lineHeight: 19,
            textAlign: "center",
          }}
        >
          {t("account.profileEditHint")}
        </Text>
      </View>

      {FIELD_GROUPS.map((group) => (
        <View key={group.title} style={{ gap: 14 }}>
          <Text
            selectable
            style={{
              color: isDark ? "#A3A3A3" : "#737373",
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            {t(group.title)}
          </Text>
          {group.fields.map((field) => (
            <AuthTextField
              key={field.key}
              autoCapitalize={
                field.key === "avatarUrl" || field.key === "whutEmail"
                  ? "none"
                  : "sentences"
              }
              autoCorrect={false}
              keyboardType={
                field.key === "whutEmail"
                  ? "email-address"
                  : field.key === "phone" || field.key === "qq"
                    ? "phone-pad"
                    : field.key === "avatarUrl"
                      ? "url"
                      : "default"
              }
              label={t(field.label)}
              maxLength={field.maxLength}
              onChangeText={(value) => {
                setError("");
                setValues((current) => ({
                  ...current,
                  [field.key]: value,
                }));
              }}
              placeholder={t("account.notFilled")}
              returnKeyType="next"
              value={values[field.key]}
            />
          ))}
        </View>
      ))}

      {error ? (
        <Text selectable style={{ color: "#FF3B30", lineHeight: 20 }}>
          {error}
        </Text>
      ) : null}

      <AuthPrimaryButton
        busy={busy}
        disabled={!hasChanges}
        label={t("account.saveProfile")}
        onPress={handleSave}
      />
    </ScrollView>
  );
}
