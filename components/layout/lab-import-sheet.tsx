import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import {
  fetchActiveLabTerm,
  fetchLabCaptcha,
  fetchLabProjects,
  LabApiError,
  labProjectsToCourses,
  loginLabSystem,
  type LabCaptcha,
} from "@/services/course-import/lab-import";
import { syncWidgetData } from "@/services/widget-sync";
import { useCourseStore } from "@/store/course";
import { useUserBindStore } from "@/store/user-bind";

const ACCENT = "#3b82f6";

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * 实验课程导入弹层。实验教学系统账号密码与智慧理工大一致，
 * 用户只需输入图片验证码。
 */
export function LabImportSheet({ visible, onClose }: Props) {
  const t = useT();
  const [submitting, setSubmitting] = useState(false);

  return (
    <BottomSheet
      visible={visible}
      onClose={submitting ? () => {} : onClose}
      title={t("course.labImportTitle")}
    >
      {/* 关闭时卸载内容，重新打开时回到初始状态 */}
      {visible && (
        <LabImportBody
          onClose={onClose}
          submitting={submitting}
          setSubmitting={setSubmitting}
        />
      )}
    </BottomSheet>
  );
}

function LabImportBody({
  onClose,
  submitting,
  setSubmitting,
}: {
  onClose: () => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
}) {
  const t = useT();
  const isDark = useColorScheme() === "dark";

  const [captcha, setCaptcha] = useState<LabCaptcha | null>(null);
  const [code, setCode] = useState("");
  const closedRef = useRef(false);

  const failAndClose = (message?: string) => {
    Toast.show({
      type: "error",
      text1: t("course.importFail"),
      text2: message || t("course.importFailSub"),
      position: "bottom",
    });
    onClose();
  };

  const loadCaptcha = () => {
    fetchLabCaptcha()
      .then((next) => {
        if (!closedRef.current) setCaptcha(next);
      })
      .catch((e: unknown) => {
        if (closedRef.current) return;
        reportError(e instanceof Error ? e : new Error(String(e)), {
          module: "course-lab",
          stage: "captcha",
        });
        failAndClose();
      });
  };

  useEffect(() => {
    closedRef.current = false;
    loadCaptcha();
    return () => {
      closedRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshCaptcha = () => {
    setCaptcha(null);
    setCode("");
    loadCaptcha();
  };

  const handleSubmit = async () => {
    if (!captcha || submitting) return;
    const trimmed = code.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      const credentials = await useUserBindStore.getState().getCredentials();
      if (!credentials) {
        failAndClose(t("course.needBindTitle"));
        return;
      }

      const token = await loginLabSystem({
        studentNumber: credentials.username,
        password: credentials.password,
        captcha: trimmed,
        captchaKey: captcha.key,
      });

      const term = await fetchActiveLabTerm(token);
      if (!term) {
        failAndClose(t("course.labNoTerm"));
        return;
      }

      const projects = await fetchLabProjects(token, term.id);
      if (projects.length === 0) {
        failAndClose(t("course.labNoData", { term: term.name }));
        return;
      }

      const { termStart, setLabCourses } = useCourseStore.getState();
      const { courses } = labProjectsToCourses(projects, termStart);
      if (courses.length === 0) {
        failAndClose(t("course.parseFailed"));
        return;
      }

      setLabCourses(courses);
      syncWidgetData().catch(() => {});
      Toast.show({
        type: "success",
        text1: t("course.importSuccess"),
        text2: t("course.labImportSuccessSub", { n: courses.length }),
        position: "bottom",
      });
      onClose();
    } catch (e) {
      // 验证码错误时刷新验证码让用户重试，不关闭弹层
      if (e instanceof LabApiError && e.code === 400) {
        Toast.show({
          type: "error",
          text1: e.message || t("course.importFail"),
          position: "bottom",
        });
        refreshCaptcha();
        return;
      }
      reportError(e instanceof Error ? e : new Error(String(e)), {
        module: "course-lab",
        stage: "import",
      });
      failAndClose(e instanceof LabApiError ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const inputBg = isDark ? "#333333" : "#f5f5f5";
  const inputColor = isDark ? "#e5e5e5" : "#1c1c1e";
  const placeholderColor = isDark ? "#525252" : "#a3a3a3";
  const canSubmit = !!captcha && code.trim().length > 0 && !submitting;

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <Text
        style={{
          fontSize: 13,
          color: isDark ? "#a3a3a3" : "#737373",
          marginBottom: 14,
        }}
      >
        {t("course.labCaptchaHint")}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <Pressable
          onPress={refreshCaptcha}
          disabled={!captcha || submitting}
          style={{
            width: 120,
            height: 48,
            borderRadius: 10,
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: isDark ? "#404040" : "#e5e5e5",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {captcha ? (
            <Image
              source={{ uri: captcha.image }}
              style={{ width: 120, height: 48 }}
              contentFit="contain"
            />
          ) : (
            <ActivityIndicator size="small" color={ACCENT} />
          )}
        </Pressable>
        <Pressable
          onPress={refreshCaptcha}
          disabled={!captcha || submitting}
          hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Ionicons name="refresh" size={15} color={ACCENT} />
          <Text style={{ fontSize: 13, color: ACCENT }}>
            {t("course.labCaptchaRefresh")}
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder={t("course.labCaptchaPlaceholder")}
        placeholderTextColor={placeholderColor}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        textContentType="none"
        importantForAutofill="no"
        editable={!submitting}
        onSubmitEditing={() => void handleSubmit()}
        style={{
          fontSize: 16,
          color: inputColor,
          backgroundColor: inputBg,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 11,
          marginBottom: 16,
        }}
      />

      <Pressable
        onPress={() => void handleSubmit()}
        disabled={!canSubmit}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          paddingVertical: 13,
          backgroundColor: ACCENT,
          opacity: canSubmit ? 1 : 0.5,
        }}
      >
        {submitting && (
          <ActivityIndicator
            size="small"
            color="#fff"
            style={{ marginRight: 8 }}
          />
        )}
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
          {submitting ? t("course.importingWait") : t("course.labConfirm")}
        </Text>
      </Pressable>
    </View>
  );
}
