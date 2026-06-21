import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type PagerView from "react-native-pager-view";
import { type PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { getDayLabels } from "@/constants/weekdays";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useMinuteNow } from "@/hooks/use-minute-now";
import {
  AnimatedPagerView,
  usePagerPosition,
} from "@/hooks/use-pager-position";
import { type TKey, useT } from "@/lib/i18n";
import { getExamStatus } from "@/services/exam-status";
import { isExamInTerm, shouldClearExamDataForTerm } from "@/services/exam-term";
import { useCourseStore } from "@/store/course";
import type { Exam, ExamStatus, NotArrangedExamCourse } from "@/store/exam";
import { useExamStore } from "@/store/exam";
import { useSettingsStore } from "@/store/settings";

type ExamTab = "upcoming" | "finished" | "notArranged";

const TAB_KEYS: { key: ExamTab; label: TKey }[] = [
  { key: "upcoming", label: "exam.tabUpcoming" },
  { key: "finished", label: "exam.tabFinished" },
  { key: "notArranged", label: "exam.tabNotArranged" },
];

type ExamDateParts = { month: string; day: string; weekday: string };

function parseExamDate(date: string): ExamDateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return {
    month: String(Number(m[2])),
    day: String(Number(m[3])),
    weekday: getDayLabels()[(d.getDay() + 6) % 7],
  };
}

function statusColor(status: ExamStatus, isDark: boolean) {
  switch (status) {
    case "upcoming":
      return { accent: "#3b82f6", soft: isDark ? "#1e3a5f" : "#dbeafe" };
    case "ongoing":
      return { accent: "#10b981", soft: isDark ? "#0f3d31" : "#d1fae5" };
    case "finished":
      return {
        accent: isDark ? "#8e8e93" : "#9ca3af",
        soft: isDark ? "#2a2a2c" : "#e5e7eb",
      };
    default:
      return { accent: "#f59e0b", soft: isDark ? "#3d2f10" : "#fef3c7" };
  }
}

function statusLabel(
  status: ExamStatus,
  rawStatus: string,
  t: ReturnType<typeof useT>,
) {
  if (status === "unknown" && rawStatus && !/^[0-2]$/.test(rawStatus)) {
    return rawStatus;
  }
  const key: Record<ExamStatus, TKey> = {
    upcoming: "exam.statusUpcoming",
    ongoing: "exam.statusOngoing",
    finished: "exam.statusFinished",
    unknown: "exam.statusUnknown",
  };
  return t(key[status]);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function countdownLabel(
  startAt: string,
  nowMs: number,
  t: ReturnType<typeof useT>,
): string | null {
  const startMs = Date.parse(startAt);
  if (Number.isNaN(startMs)) return null;

  const startDay = new Date(startMs);
  startDay.setHours(0, 0, 0, 0);
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.round((startDay.getTime() - today.getTime()) / DAY_MS);
  if (diffDays <= 0) return t("exam.countdownToday");
  if (diffDays === 1) return t("exam.countdownTomorrow");
  return t("exam.countdownDays", { n: diffDays });
}

function MetaRow({
  icon,
  text,
  isDark,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  text: string;
  isDark: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={14} color={isDark ? "#737373" : "#a3a3a3"} />
      <Text
        className="flex-1 text-[13px] leading-[18px] text-neutral-600 dark:text-neutral-300"
        selectable
      >
        {text}
      </Text>
    </View>
  );
}

function StatusPill({
  status,
  rawStatus,
  isDark,
  t,
  label,
}: {
  status: ExamStatus;
  rawStatus: string;
  isDark: boolean;
  t: ReturnType<typeof useT>;
  label?: string;
}) {
  const { accent, soft } = statusColor(status, isDark);
  return (
    <View
      className="rounded-full px-2.5 py-1"
      style={{ backgroundColor: soft }}
    >
      <Text className="text-[11px] font-bold" style={{ color: accent }}>
        {label ?? statusLabel(status, rawStatus, t)}
      </Text>
    </View>
  );
}

function DateBadge({
  parts,
  accent,
  soft,
}: {
  parts: ExamDateParts | null;
  accent: string;
  soft: string;
}) {
  return (
    <View
      className="h-[52px] w-[52px] items-center justify-center rounded-2xl"
      style={{ backgroundColor: soft }}
    >
      {parts ? (
        <>
          <Text
            className="font-bold"
            style={{ color: accent, fontSize: 21, lineHeight: 24 }}
          >
            {parts.day}
          </Text>
          <Text
            className="font-semibold"
            style={{ color: accent, fontSize: 11, lineHeight: 13 }}
          >
            {parts.month}月
          </Text>
        </>
      ) : (
        <Ionicons name="help-outline" size={22} color={accent} />
      )}
    </View>
  );
}

function ExamCard({
  exam,
  isDark,
  nowMs,
  t,
}: {
  exam: Exam;
  isDark: boolean;
  nowMs: number;
  t: ReturnType<typeof useT>;
}) {
  const status = getExamStatus(exam, nowMs);
  const { accent, soft } = statusColor(status, isDark);
  const date = parseExamDate(exam.date);
  const timeRange = `${exam.startTime}-${exam.endTime}`;
  const timeText = date?.weekday ? `${date.weekday} ${timeRange}` : timeRange;
  const showCountdown =
    status === "upcoming" &&
    (!exam.rawStatus || /^[0-2]$/.test(exam.rawStatus));
  const pillLabel = showCountdown
    ? (countdownLabel(exam.startAt, nowMs, t) ?? undefined)
    : undefined;
  return (
    <View className="flex-row gap-3 rounded-2xl bg-white p-4 dark:bg-neutral-800">
      <DateBadge parts={date} accent={accent} soft={soft} />
      <View className="flex-1">
        <View className="flex-row items-start gap-2">
          <View className="flex-1">
            <Text
              className="text-base font-bold leading-[21px] text-neutral-900 dark:text-neutral-50"
              selectable
            >
              {exam.courseName || t("exam.unknownCourse")}
            </Text>
            {!!exam.courseCode && (
              <Text
                className="mt-1 text-[12px] text-neutral-400 dark:text-neutral-500"
                style={{ fontVariant: ["tabular-nums"] }}
                selectable
              >
                {exam.courseCode}
              </Text>
            )}
          </View>
          <StatusPill
            status={status}
            rawStatus={exam.rawStatus}
            isDark={isDark}
            t={t}
            label={pillLabel}
          />
        </View>

        <View className="my-3 h-px bg-neutral-100 dark:bg-neutral-700/60" />

        <View className="gap-2">
          <MetaRow icon="time-outline" text={timeText} isDark={isDark} />
          <MetaRow
            icon="location-outline"
            text={exam.place || t("exam.noPlace")}
            isDark={isDark}
          />
          <MetaRow
            icon="grid-outline"
            text={`${t("exam.seatNo")} · ${exam.seatNo || t("exam.seatPending")}`}
            isDark={isDark}
          />
          {!!exam.teacher && (
            <MetaRow
              icon="person-outline"
              text={exam.teacher}
              isDark={isDark}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function NotArrangedCard({
  item,
  isDark,
  t,
}: {
  item: NotArrangedExamCourse;
  isDark: boolean;
  t: ReturnType<typeof useT>;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-white p-4 dark:bg-neutral-800">
      <View
        className="h-11 w-11 items-center justify-center rounded-2xl"
        style={{ backgroundColor: isDark ? "#3d2f10" : "#fef3c7" }}
      >
        <Ionicons name="hourglass-outline" size={20} color="#f59e0b" />
      </View>
      <View className="flex-1 gap-1">
        <Text
          className="text-[15px] font-bold text-neutral-900 dark:text-neutral-50"
          selectable
        >
          {item.courseName || t("exam.unknownCourse")}
        </Text>
        <View className="flex-row items-center gap-2">
          {!!item.courseCode && (
            <Text
              className="text-[12px] text-neutral-400 dark:text-neutral-500"
              style={{ fontVariant: ["tabular-nums"] }}
              selectable
            >
              {item.courseCode}
            </Text>
          )}
          {!!item.courseCode && !!item.teacher && (
            <View className="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          )}
          {!!item.teacher && (
            <Text className="text-[12px] text-neutral-400 dark:text-neutral-500">
              {item.teacher}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const SEGMENT_PADDING = 4;

function SegmentedTabs({
  position,
  activeIndex,
  counts,
  isDark,
  t,
  onChange,
}: {
  position: SharedValue<number>;
  activeIndex: number;
  counts: Record<ExamTab, number>;
  isDark: boolean;
  t: ReturnType<typeof useT>;
  onChange: (index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const tabWidth =
    width > 0 ? (width - SEGMENT_PADDING * 2) / TAB_KEYS.length : 0;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: SEGMENT_PADDING + position.value * tabWidth }],
  }));

  return (
    <View
      onLayout={onLayout}
      className="mb-4 h-10 flex-row rounded-2xl bg-neutral-200/70 p-1 dark:bg-neutral-800"
    >
      {tabWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: SEGMENT_PADDING,
              bottom: SEGMENT_PADDING,
              left: 0,
              width: tabWidth,
              borderRadius: 12,
              backgroundColor: isDark ? "#404040" : "#ffffff",
              shadowColor: "#000",
              shadowOpacity: isDark ? 0 : 0.08,
              shadowOffset: { width: 0, height: 1 },
              shadowRadius: 3,
              elevation: 2,
            },
            indicatorStyle,
          ]}
        />
      )}
      {TAB_KEYS.map((item, index) => {
        const active = activeIndex === index;
        return (
          <Pressable
            key={item.key}
            className="flex-1 flex-row items-center justify-center gap-1.5"
            onPress={() => onChange(index)}
          >
            <Text
              className={`text-[13px] ${
                active
                  ? "font-bold text-neutral-900 dark:text-neutral-50"
                  : "font-medium text-neutral-500 dark:text-neutral-400"
              }`}
            >
              {t(item.label)}
            </Text>
            {counts[item.key] > 0 && (
              <Text
                className="text-[12px] font-bold"
                style={{
                  fontVariant: ["tabular-nums"],
                  color: active ? "#3b82f6" : isDark ? "#525252" : "#c4c4c4",
                }}
              >
                {counts[item.key]}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ExamScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const haptic = useHaptics();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const exams = useExamStore((s) => s.exams);
  const notArranged = useExamStore((s) => s.notArranged);
  const term = useExamStore((s) => s.term);
  const importedAt = useExamStore((s) => s.importedAt);
  const clearExamData = useExamStore((s) => s.clearExamData);
  const termStart = useCourseStore((s) => s.termStart);
  const examReminder = useSettingsStore((s) => s.examReminder);
  const [tab, setTab] = useState<ExamTab>("upcoming");

  const nowMs = useMinuteNow();
  useEffect(() => {
    if (shouldClearExamDataForTerm({ term, exams, termStart })) {
      clearExamData();
    }
  }, [clearExamData, exams, term, termStart]);

  const currentTermExams = useMemo(
    () => exams.filter((exam) => isExamInTerm(exam, termStart)),
    [exams, termStart],
  );
  const upcoming = useMemo(
    () =>
      currentTermExams
        .filter((exam) => getExamStatus(exam, nowMs) !== "finished")
        .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)),
    [currentTermExams, nowMs],
  );
  const finished = useMemo(
    () =>
      currentTermExams
        .filter((exam) => getExamStatus(exam, nowMs) === "finished")
        .sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt)),
    [currentTermExams, nowMs],
  );

  const counts: Record<ExamTab, number> = {
    upcoming: upcoming.length,
    finished: finished.length,
    notArranged: notArranged.length,
  };

  const pagerRef = useRef<PagerView>(null);
  const { position, handler: pagerScrollHandler } = usePagerPosition();
  const activeIndex = TAB_KEYS.findIndex((item) => item.key === tab);

  const importExams = () => {
    haptic();
    router.push("/browser/exam");
  };

  const goToPage = useCallback(
    (index: number) => {
      const next = TAB_KEYS[index]?.key;
      haptic();
      if (next) setTab(next);
      pagerRef.current?.setPage(index);
    },
    [haptic],
  );

  const handlePageSelected = useCallback(
    (e: PagerViewOnPageSelectedEvent) => {
      const next = TAB_KEYS[e.nativeEvent.position]?.key;
      if (!next) return;
      setTab((prev) => {
        if (prev !== next) haptic();
        return next;
      });
    },
    [haptic],
  );

  const hasAnyData = currentTermExams.length > 0 || notArranged.length > 0;

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <Stack.Screen options={{ title: t("exam.title") }} />

      <View className="px-4 pt-4">
        <View className="mb-4 rounded-2xl bg-white p-4 dark:bg-neutral-800">
          <View className="flex-row items-center gap-3">
            <View
              className="h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: isDark ? "#1e3a5f" : "#dbeafe" }}
            >
              <Ionicons
                name="document-text-outline"
                size={24}
                color="#3b82f6"
              />
            </View>
            <View className="flex-1">
              <Text className="text-[17px] font-bold text-neutral-900 dark:text-neutral-50">
                {term || t("exam.noTerm")}
              </Text>
              <Text className="mt-0.5 text-[13px] text-neutral-400 dark:text-neutral-500">
                {importedAt
                  ? t("exam.importedCount", { n: currentTermExams.length })
                  : t("exam.notImported")}
              </Text>
            </View>
            <Pressable
              className="p-1 active:opacity-60"
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("exam.reminderEntry")}
              onPress={() => {
                haptic();
                router.push({
                  pathname: "/settings",
                  params: { highlight: "examReminder" },
                });
              }}
            >
              <Ionicons
                name={examReminder ? "notifications" : "notifications-outline"}
                size={22}
                color={
                  examReminder ? "#3b82f6" : isDark ? "#525252" : "#a3a3a3"
                }
              />
            </Pressable>
          </View>

          <Pressable
            className="mt-4 h-11 flex-row items-center justify-center gap-2 rounded-xl bg-blue-500 active:bg-blue-600"
            onPress={importExams}
          >
            <Ionicons name="cloud-download-outline" size={18} color="white" />
            <Text className="text-[15px] font-bold text-white">
              {hasAnyData ? t("exam.reimport") : t("exam.importNow")}
            </Text>
          </Pressable>

          <View className="mt-3 flex-row items-center justify-center gap-1.5">
            <Ionicons
              name="information-circle-outline"
              size={13}
              color={isDark ? "#737373" : "#a3a3a3"}
            />
            <Text className="text-[12px] text-neutral-400 dark:text-neutral-500">
              {t("exam.disclaimer")}
            </Text>
          </View>
        </View>

        <SegmentedTabs
          position={position}
          activeIndex={activeIndex}
          counts={counts}
          isDark={isDark}
          t={t}
          onChange={goToPage}
        />
      </View>

      <AnimatedPagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageScroll={pagerScrollHandler as never}
        onPageSelected={handlePageSelected}
      >
        <View
          key="upcoming"
          collapsable={false}
          style={{ width: "100%", height: "100%" }}
        >
          <ExamListPage>
            {upcoming.length > 0 ? (
              upcoming.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  isDark={isDark}
                  nowMs={nowMs}
                  t={t}
                />
              ))
            ) : (
              <EmptyState
                icon="calendar-clear-outline"
                title={
                  hasAnyData ? t("exam.emptyUpcoming") : t("exam.emptyTitle")
                }
                subtitle={
                  hasAnyData ? t("exam.emptyCurrentSub") : t("exam.emptySub")
                }
                isDark={isDark}
              />
            )}
          </ExamListPage>
        </View>

        <View
          key="finished"
          collapsable={false}
          style={{ width: "100%", height: "100%" }}
        >
          <ExamListPage>
            {finished.length > 0 ? (
              finished.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  isDark={isDark}
                  nowMs={nowMs}
                  t={t}
                />
              ))
            ) : (
              <EmptyState
                icon="checkmark-done-outline"
                title={
                  hasAnyData ? t("exam.emptyFinished") : t("exam.emptyTitle")
                }
                subtitle={
                  hasAnyData ? t("exam.emptyCurrentSub") : t("exam.emptySub")
                }
                isDark={isDark}
              />
            )}
          </ExamListPage>
        </View>

        <View
          key="notArranged"
          collapsable={false}
          style={{ width: "100%", height: "100%" }}
        >
          <ExamListPage>
            {notArranged.length > 0 ? (
              notArranged.map((item) => (
                <NotArrangedCard
                  key={item.id}
                  item={item}
                  isDark={isDark}
                  t={t}
                />
              ))
            ) : (
              <EmptyState
                icon="checkmark-done-outline"
                title={
                  hasAnyData ? t("exam.emptyNotArranged") : t("exam.emptyTitle")
                }
                subtitle={
                  hasAnyData
                    ? t("exam.emptyNotArrangedSub")
                    : t("exam.emptySub")
                }
                isDark={isDark}
              />
            )}
          </ExamListPage>
        </View>
      </AnimatedPagerView>
    </View>
  );
}

function ExamListPage({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32,
          flexGrow: 1,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  isDark,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  isDark: boolean;
}) {
  return (
    <View className="min-h-[220px] items-center justify-center gap-3 rounded-2xl bg-white px-8 py-12 dark:bg-neutral-800">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-700/60">
        <Ionicons
          name={icon}
          size={28}
          color={isDark ? "#525252" : "#a3a3a3"}
        />
      </View>
      <Text className="text-base font-bold text-neutral-700 dark:text-neutral-200">
        {title}
      </Text>
      <Text className="text-center text-[13px] leading-[19px] text-neutral-400 dark:text-neutral-500">
        {subtitle}
      </Text>
    </View>
  );
}
