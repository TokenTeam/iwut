import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { ChevronDown, ChevronUp } from "lucide";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MorphingIcon } from "@/components/ui/morphing-icon";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import type { Grade } from "@/store/grade";
import { useGradeStore } from "@/store/grade";

function finiteNumber(value: string): number | null {
  if (!value.trim()) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function scoreColor(score: string, isDark: boolean): string {
  const numericScore = finiteNumber(score);
  if (numericScore !== null && numericScore < 60) return "#ef4444";
  if (!score) return isDark ? "#737373" : "#a3a3a3";
  return isDark ? "#60a5fa" : "#2563eb";
}

function formatSyncTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function GradeHeader({
  selectedTerm,
  hasTerms,
  termPickerVisible,
  hasSynced,
  syncedAt,
  onSync,
  onSelectTerm,
  isDark,
  t,
}: {
  selectedTerm: string | null;
  hasTerms: boolean;
  termPickerVisible: boolean;
  hasSynced: boolean;
  syncedAt: string;
  onSync: () => void;
  onSelectTerm: () => void;
  isDark: boolean;
  t: ReturnType<typeof useT>;
}) {
  const syncTime = formatSyncTime(syncedAt);

  return (
    <View
      className="overflow-hidden rounded-2xl bg-white p-4 dark:bg-neutral-800"
      style={{ borderCurve: "continuous" }}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: isDark ? "#1e3a5f" : "#dbeafe" }}
        >
          <Ionicons name="bar-chart-outline" size={24} color="#3b82f6" />
        </View>
        <Pressable
          className="flex-1 active:opacity-60"
          accessibilityRole="button"
          accessibilityLabel={t("grade.selectTerm")}
          disabled={!hasTerms}
          onPress={onSelectTerm}
        >
          <Text className="text-[11px] text-neutral-400 dark:text-neutral-500">
            {t("grade.termFilter")}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-1.5">
            <Text
              className="text-[18px] font-bold text-neutral-900 dark:text-neutral-50"
              numberOfLines={1}
            >
              {selectedTerm ?? t("grade.rangeAll")}
            </Text>
            {hasTerms && (
              <MorphingIcon
                icon={termPickerVisible ? ChevronUp : ChevronDown}
                size={17}
                color={isDark ? "#737373" : "#a3a3a3"}
              />
            )}
          </View>
        </Pressable>
        {hasSynced && (
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-xl bg-blue-500 active:bg-blue-600"
            accessibilityRole="button"
            accessibilityLabel={t("grade.requery")}
            onPress={onSync}
          >
            <Ionicons name="sync" size={20} color="#ffffff" />
          </Pressable>
        )}
      </View>

      <View className="mt-4 flex-row items-center rounded-xl bg-neutral-50 px-3 py-2.5 dark:bg-neutral-700/40">
        <Ionicons
          name="time-outline"
          size={16}
          color={isDark ? "#737373" : "#a3a3a3"}
        />
        <Text className="ml-2 flex-1 text-[12px] text-neutral-500 dark:text-neutral-400">
          {syncTime
            ? t("grade.lastRefreshed", { time: syncTime })
            : t("grade.notRefreshed")}
        </Text>
      </View>

      {!hasSynced && (
        <Pressable
          className="mt-3 h-11 flex-row items-center justify-center gap-2 rounded-xl bg-blue-500 active:bg-blue-600"
          accessibilityRole="button"
          accessibilityLabel={t("grade.queryNow")}
          onPress={onSync}
        >
          <Ionicons name="cloud-download-outline" size={18} color="#ffffff" />
          <Text className="text-[15px] font-bold text-white">
            {t("grade.queryNow")}
          </Text>
        </Pressable>
      )}

      <View className="mt-3 flex-row items-center justify-center gap-1.5">
        <Ionicons
          name="information-circle-outline"
          size={13}
          color={isDark ? "#737373" : "#a3a3a3"}
        />
        <Text className="text-[12px] text-neutral-400 dark:text-neutral-500">
          {t("grade.disclaimer")}
        </Text>
      </View>
    </View>
  );
}

function GradeRow({
  grade,
  isDark,
  t,
}: {
  grade: Grade;
  isDark: boolean;
  t: ReturnType<typeof useT>;
}) {
  const score = grade.totalScore || "--";
  const metadata = [
    grade.courseCode,
    grade.courseNature,
    grade.credits ? t("grade.creditValue", { n: grade.credits }) : "",
    grade.retakeLabel,
  ].filter(Boolean);

  return (
    <View className="flex-row items-center gap-4 px-4">
      <View className="flex-1 py-4">
        <Text className="text-[15px] font-semibold leading-5 text-neutral-900 dark:text-neutral-50">
          {grade.courseName || t("grade.unknownCourse")}
        </Text>
        <Text className="mt-1 text-[12px] leading-[17px] text-neutral-400 dark:text-neutral-500">
          {metadata.join("  ·  ") || "--"}
        </Text>
      </View>
      <View className="w-20 items-end">
        <Text
          className="text-[22px] font-bold leading-7"
          style={{
            color: scoreColor(grade.totalScore, isDark),
            fontVariant: ["tabular-nums"],
          }}
          numberOfLines={1}
        >
          {score}
        </Text>
      </View>
    </View>
  );
}

function GradeGroup({
  term,
  grades,
  isDark,
  t,
}: {
  term: string;
  grades: Grade[];
  isDark: boolean;
  t: ReturnType<typeof useT>;
}) {
  return (
    <View
      className="overflow-hidden rounded-2xl bg-white dark:bg-neutral-800"
      style={{ borderCurve: "continuous" }}
    >
      <View className="bg-neutral-50 px-4 py-3 dark:bg-neutral-700/40">
        <Text className="text-[14px] font-semibold text-neutral-800 dark:text-neutral-100">
          {term}
        </Text>
      </View>
      {grades.map((grade, index) => (
        <View key={grade.id}>
          <GradeRow grade={grade} isDark={isDark} t={t} />
          {index < grades.length - 1 && (
            <View className="mx-4 border-b border-neutral-200 dark:border-neutral-700" />
          )}
        </View>
      ))}
    </View>
  );
}

function EmptyState({
  isDark,
  t,
}: {
  isDark: boolean;
  t: ReturnType<typeof useT>;
}) {
  return (
    <View className="min-h-[220px] items-center justify-center gap-3 rounded-2xl bg-white px-8 py-12 dark:bg-neutral-800">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-700/60">
        <Ionicons
          name="bar-chart-outline"
          size={28}
          color={isDark ? "#525252" : "#a3a3a3"}
        />
      </View>
      <Text className="text-base font-bold text-neutral-700 dark:text-neutral-200">
        {t("grade.emptyTitle")}
      </Text>
      <Text className="text-center text-[13px] leading-[19px] text-neutral-400 dark:text-neutral-500">
        {t("grade.emptySub")}
      </Text>
    </View>
  );
}

function TermPicker({
  visible,
  terms,
  selectedTerm,
  onSelect,
  onClose,
  t,
}: {
  visible: boolean;
  terms: string[];
  selectedTerm: string | null;
  onSelect: (term: string | null) => void;
  onClose: () => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("grade.selectTerm")}
    >
      <ScrollView style={{ maxHeight: 420 }}>
        <View className="px-3 pb-2">
          {[null, ...terms].map((term) => {
            const selected = selectedTerm === term;
            return (
              <Pressable
                key={term ?? "all"}
                className="h-12 flex-row items-center rounded-xl px-3 active:bg-neutral-100 dark:active:bg-neutral-700"
                style={{
                  backgroundColor: selected
                    ? "rgba(59, 130, 246, 0.1)"
                    : "transparent",
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => onSelect(term)}
              >
                <Text
                  className={`flex-1 text-[15px] ${
                    selected
                      ? "font-semibold text-blue-500"
                      : "font-medium text-neutral-800 dark:text-neutral-100"
                  }`}
                >
                  {term ?? t("grade.rangeAll")}
                </Text>
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={20}
                  color={selected ? "#3b82f6" : "#a3a3a3"}
                />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

export default function GradeScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const haptic = useHaptics();
  const isDark = useColorScheme() === "dark";
  const grades = useGradeStore((state) => state.grades);
  const syncedAt = useGradeStore((state) => state.syncedAt);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [termPickerVisible, setTermPickerVisible] = useState(false);
  const hasSynced = Boolean(syncedAt);

  const terms = useMemo(
    () =>
      Array.from(
        new Set(grades.map((grade) => grade.term).filter(Boolean)),
      ).sort((a, b) => b.localeCompare(a)),
    [grades],
  );
  const activeTerm =
    selectedTerm && terms.includes(selectedTerm) ? selectedTerm : null;
  const groups = useMemo(() => {
    const gradesByTerm = new Map<string, Grade[]>();
    for (const grade of grades) {
      const termGrades = gradesByTerm.get(grade.term);
      if (termGrades) termGrades.push(grade);
      else gradesByTerm.set(grade.term, [grade]);
    }
    return (activeTerm ? [activeTerm] : terms).map((term) => ({
      term,
      grades: gradesByTerm.get(term) ?? [],
    }));
  }, [activeTerm, grades, terms]);
  const syncGrades = () => {
    haptic();
    router.push("/browser/grade");
  };

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <Stack.Screen options={{ title: t("grade.title") }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
      >
        <GradeHeader
          selectedTerm={activeTerm}
          hasTerms={terms.length > 0}
          termPickerVisible={termPickerVisible}
          hasSynced={hasSynced}
          syncedAt={syncedAt}
          onSync={syncGrades}
          onSelectTerm={() => {
            haptic();
            setTermPickerVisible(true);
          }}
          isDark={isDark}
          t={t}
        />

        {groups.length > 0 ? (
          groups.map((group) => (
            <GradeGroup
              key={group.term}
              term={group.term}
              grades={group.grades}
              isDark={isDark}
              t={t}
            />
          ))
        ) : (
          <EmptyState isDark={isDark} t={t} />
        )}
      </ScrollView>

      <TermPicker
        visible={termPickerVisible}
        terms={terms}
        selectedTerm={activeTerm}
        onClose={() => setTermPickerVisible(false)}
        onSelect={(term) => {
          haptic();
          setSelectedTerm(term);
          setTermPickerVisible(false);
        }}
        t={t}
      />
    </View>
  );
}
