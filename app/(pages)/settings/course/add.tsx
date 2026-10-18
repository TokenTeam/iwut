import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { Ionicons } from "@expo/vector-icons";
import { RangeSlider } from "@react-native-assets/slider";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, ChevronUp } from "lucide";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import Toast from "react-native-toast-message";

import { CourseShareSheet } from "@/components/share/course-share-sheet";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { MorphingIcon } from "@/components/ui/morphing-icon";
import { ScrollLockProvider, useScrollLock } from "@/components/ui/scroll-lock";
import { WEEKDAY_KEYS as DAY_KEYS } from "@/constants/weekdays";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useLatest } from "@/hooks/use-latest";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import {
  type CourseTimeSlot as TimeSlot,
  createEmptySlot,
  recordsToSlots,
  slotsToRecords,
} from "@/lib/course-editor";
import { MAX_SECTION, MAX_WEEK, weeksToRanges } from "@/lib/course-weeks";
import { useT } from "@/lib/i18n";
import {
  formatCourseTimeRange,
  getCourseSectionsForTime,
  isValidCourseTimeRange,
  SECTION_TIMES,
} from "@/services/course-time";
import { useCourseStore } from "@/store/course";

const SLOT_LAYOUT_TRANSITION = LinearTransition.duration(220);

function formatWeeks(
  weeks: Set<number>,
  notSelectedLabel: string,
  weeksSuffix: string,
): string {
  if (weeks.size === 0) return notSelectedLabel;
  const ranges = weeksToRanges(weeks);
  return (
    ranges.map(([s, e]) => (s === e ? `${s}` : `${s}-${e}`)).join(", ") +
    weeksSuffix
  );
}

export default function AddEditCourseScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    prefillName?: string;
    prefillRoom?: string;
    prefillTeacher?: string;
    prefillDay?: string;
    prefillSectionStart?: string;
    prefillSectionEnd?: string;
  }>();
  const editName = params.name;
  const isEdit = !!editName;

  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const dayOptions = DAY_KEYS.map((k) => t(k));
  const weeksSuffix = t("courseAdd.weeksUnit");
  const notSelectedLabel = t("courseAdd.weeksNotSelected");

  const courses = useCourseStore((s) => s.courses);
  const saveCourse = useCourseStore((s) => s.saveCourse);
  const removeCoursesByName = useCourseStore((s) => s.removeCoursesByName);

  const existingRecords = useMemo(
    () => (editName ? courses.filter((c) => c.name === editName) : []),
    [editName, courses],
  );

  const prefillSlot = useMemo<TimeSlot | null>(() => {
    if (isEdit) return null;
    const day = Number(params.prefillDay);
    const ss = Number(params.prefillSectionStart);
    const se = Number(params.prefillSectionEnd);
    if (!day || !ss || !se) return null;
    return {
      ...createEmptySlot(),
      day: Math.min(7, Math.max(1, day)),
      sectionStart: ss,
      sectionEnd: Math.max(ss, se),
      timeMode: "sections",
      room: params.prefillRoom ?? "",
      weeks: new Set<number>(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  const [name, setName] = useState(() => {
    if (isEdit && existingRecords.length > 0) return existingRecords[0].name;
    return params.prefillName ?? "";
  });
  const [teacher, setTeacher] = useState(() => {
    if (isEdit && existingRecords.length > 0)
      return existingRecords[0].teacher ?? "";
    return params.prefillTeacher ?? "";
  });
  const [slots, setSlots] = useState<TimeSlot[]>(() => {
    if (isEdit && existingRecords.length > 0)
      return recordsToSlots(existingRecords);
    if (prefillSlot) return [prefillSlot];
    return [createEmptySlot()];
  });
  const [expandedId, setExpandedId] = useState<string | null>(() =>
    isEdit && existingRecords.length > 0 ? null : slots[0].id,
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  // 拖动周次或节次时锁定页面滚动，避免手势冲突
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const scrollLockCount = useRef(0);

  const acquireScrollLock = useCallback(() => {
    scrollLockCount.current += 1;
    setScrollEnabled(false);
  }, []);

  const releaseScrollLock = useCallback(() => {
    scrollLockCount.current = Math.max(0, scrollLockCount.current - 1);
    setScrollEnabled(scrollLockCount.current === 0);
  }, []);

  const scrollLock = useMemo(
    () => ({
      acquire: acquireScrollLock,
      release: releaseScrollLock,
    }),
    [acquireScrollLock, releaseScrollLock],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const updateSlot = useCallback((id: string, patch: Partial<TimeSlot>) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const addSlot = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const slot = createEmptySlot();
    setSlots((prev) => [...prev, slot]);
    setExpandedId(slot.id);
  }, []);

  const removeSlot = useCallback(
    (id: string) => {
      if (slots.length <= 1) {
        Toast.show({
          type: "error",
          text1: t("courseAdd.minSlotRequired"),
          position: "bottom",
        });
        return;
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSlots((prev) => prev.filter((slot) => slot.id !== id));
      setExpandedId((prev) => (prev === id ? null : prev));
    },
    [slots.length, t],
  );

  const inputBg = isDark ? "#333333" : "#f5f5f5";
  const inputColor = isDark ? "#e5e5e5" : "#1c1c1e";
  const placeholderColor = isDark ? "#525252" : "#a3a3a3";
  const labelColor = isDark ? "#a3a3a3" : "#525252";
  const chipBg = isDark ? "#333333" : "#f5f5f5";
  const chipText = isDark ? "#d4d4d4" : "#525252";
  const cardBg = isDark ? "#262626" : "#ffffff";

  const handleDelete = () => {
    if (!editName) return;
    removeCoursesByName(editName);
    setShowDeleteConfirm(false);
    Toast.show({
      type: "success",
      text1: t("courseManage.deleted", { name: editName }),
      position: "bottom",
    });
    router.back();
  };

  const validateDraft = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Toast.show({
        type: "error",
        text1: t("courseAdd.needCourseName"),
        position: "bottom",
      });
      return false;
    }
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (
        slot.timeMode === "time" &&
        !isValidCourseTimeRange(slot.startTime, slot.endTime)
      ) {
        Toast.show({
          type: "error",
          text1: t("courseAdd.slotInvalidTime", { n: i + 1 }),
          position: "bottom",
        });
        setExpandedId(slot.id);
        return false;
      }
      if (slot.weeks.size === 0) {
        Toast.show({
          type: "error",
          text1: t("courseAdd.slotNoWeeks", { n: i + 1 }),
          position: "bottom",
        });
        setExpandedId(slot.id);
        return false;
      }
      if (slot.sectionEnd < slot.sectionStart) {
        Toast.show({
          type: "error",
          text1: t("courseAdd.slotInvalidRange", { n: i + 1 }),
          position: "bottom",
        });
        setExpandedId(slot.id);
        return false;
      }
    }

    return true;
  };

  const handleSave = () => {
    if (!validateDraft()) return;
    saveCourse(slotsToRecords(slots, name, teacher), editName);

    Toast.show({
      type: "success",
      text1: isEdit ? t("courseAdd.courseUpdated") : t("courseAdd.courseAdded"),
      position: "bottom",
    });
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: isEdit ? t("courseAdd.titleEdit") : t("courseAdd.titleAdd"),
          fullScreenGestureEnabled: false,
        }}
      />
      <ScrollLockProvider value={scrollLock}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            className="flex-1 bg-neutral-100 dark:bg-neutral-900"
            contentContainerClassName="px-4 pt-4 pb-8"
            keyboardShouldPersistTaps="handled"
            scrollEnabled={scrollEnabled}
          >
            <View className="mb-4 overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
              <View className="px-4 py-3">
                <Text
                  style={{ fontSize: 12, color: labelColor, marginBottom: 6 }}
                >
                  {t("courseAdd.courseName")}
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t("courseAdd.courseNamePlaceholder")}
                  placeholderTextColor={placeholderColor}
                  editable={!isEdit}
                  style={{
                    fontSize: 16,
                    color: isEdit ? placeholderColor : inputColor,
                    backgroundColor: inputBg,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                />
              </View>
              <View className="mx-4 border-b border-neutral-200 dark:border-neutral-700" />
              <View className="px-4 py-3">
                <Text
                  style={{ fontSize: 12, color: labelColor, marginBottom: 6 }}
                >
                  {t("courseAdd.teacher")}
                </Text>
                <TextInput
                  value={teacher}
                  onChangeText={setTeacher}
                  placeholder={t("courseAdd.teacherPlaceholder")}
                  placeholderTextColor={placeholderColor}
                  style={{
                    fontSize: 16,
                    color: inputColor,
                    backgroundColor: inputBg,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                />
              </View>
            </View>

            {slots.map((slot, index) => (
              <Animated.View key={slot.id} layout={SLOT_LAYOUT_TRANSITION}>
                <SlotCard
                  slot={slot}
                  index={index}
                  expanded={expandedId === slot.id}
                  canDelete={slots.length > 1}
                  onToggle={() => toggleExpand(slot.id)}
                  onUpdate={(patch) => updateSlot(slot.id, patch)}
                  onDelete={() => removeSlot(slot.id)}
                  isDark={isDark}
                  labelColor={labelColor}
                  chipBg={chipBg}
                  chipText={chipText}
                  inputBg={inputBg}
                  inputColor={inputColor}
                  placeholderColor={placeholderColor}
                  cardBg={cardBg}
                  dayOptions={dayOptions}
                  t={t}
                  notSelectedLabel={notSelectedLabel}
                  weeksSuffix={weeksSuffix}
                />
              </Animated.View>
            ))}

            <Animated.View layout={SLOT_LAYOUT_TRANSITION}>
              <Pressable
                className="mb-4 flex-row items-center justify-center rounded-xl border border-dashed border-blue-400 py-3 active:bg-blue-50 dark:border-blue-600 dark:active:bg-neutral-800"
                onPress={addSlot}
              >
                <Ionicons name="add" size={18} color="#3b82f6" />
                <Text className="ml-1 text-sm font-medium text-blue-500">
                  {t("courseAdd.addSlot")}
                </Text>
              </Pressable>
            </Animated.View>

            <Animated.View layout={SLOT_LAYOUT_TRANSITION}>
              {isEdit ? (
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={handleSave}
                    className="flex-1 flex-row items-center justify-center rounded-xl bg-blue-500 py-3.5 active:bg-blue-600"
                  >
                    <Ionicons name="save-outline" size={18} color="#ffffff" />
                    <Text className="ml-1.5 text-base font-semibold text-white">
                      {t("common.save")}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (validateDraft()) setShareVisible(true);
                    }}
                    className="flex-1 flex-row items-center justify-center rounded-xl bg-white py-3.5 active:bg-neutral-50 dark:bg-neutral-800 dark:active:bg-neutral-700"
                  >
                    <Ionicons
                      name="qr-code-outline"
                      size={18}
                      color="#3b82f6"
                    />
                    <Text className="ml-1.5 text-base font-medium text-blue-500">
                      {t("common.share")}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setShowDeleteConfirm(true)}
                    className="flex-1 flex-row items-center justify-center rounded-xl bg-red-500 py-3.5 active:bg-red-600"
                  >
                    <Ionicons name="trash-outline" size={18} color="#ffffff" />
                    <Text className="ml-1.5 text-base font-semibold text-white">
                      {t("common.delete")}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={handleSave}
                  className="items-center rounded-xl bg-blue-500 py-3.5 active:bg-blue-600"
                >
                  <Text className="text-base font-semibold text-white">
                    {t("common.save")}
                  </Text>
                </Pressable>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ScrollLockProvider>

      <ConfirmSheet
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t("courseManage.deleteCourseTitle")}
        description={t("courseManage.deleteCourseDesc", {
          name: editName ?? "",
        })}
        confirmText={t("common.delete")}
        destructive
        onConfirm={handleDelete}
      />

      <CourseShareSheet
        courseName={shareVisible ? (editName ?? null) : null}
        records={
          shareVisible ? slotsToRecords(slots, name, teacher) : undefined
        }
        onClose={() => setShareVisible(false)}
      />
    </>
  );
}

function SlotCard({
  slot,
  index,
  expanded,
  canDelete,
  onToggle,
  onUpdate,
  onDelete,
  isDark,
  labelColor,
  chipBg,
  chipText,
  inputBg,
  inputColor,
  placeholderColor,
  cardBg,
  dayOptions,
  t,
  notSelectedLabel,
  weeksSuffix,
}: {
  slot: TimeSlot;
  index: number;
  expanded: boolean;
  canDelete: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<TimeSlot>) => void;
  onDelete: () => void;
  isDark: boolean;
  labelColor: string;
  chipBg: string;
  chipText: string;
  inputBg: string;
  inputColor: string;
  placeholderColor: string;
  cardBg: string;
  dayOptions: string[];
  t: ReturnType<typeof useT>;
  notSelectedLabel: string;
  weeksSuffix: string;
}) {
  const [editingTime, setEditingTime] = useState<
    "startTime" | "endTime" | null
  >(null);
  const updateTime = (field: "startTime" | "endTime", value: string) => {
    const startTime = field === "startTime" ? value : (slot.startTime ?? "");
    const endTime = field === "endTime" ? value : (slot.endTime ?? "");
    onUpdate({
      [field]: value,
      ...getCourseSectionsForTime(startTime, endTime),
    });
  };
  const scrollLock = useScrollLock();
  const onUpdateRef = useLatest(onUpdate);
  const cellLayouts = useRef<
    Record<number, { x: number; y: number; w: number; h: number }>
  >({});
  const gridSize = useRef({ w: 0, h: 0 });
  const downCoords = useRef({ x: 0, y: 0 });
  const startedOnCell = useRef(false);
  const baseWeeks = useRef<Set<number>>(new Set());
  const startWeek = useRef<number | null>(null);
  const lastWeek = useRef<number | null>(null);
  const paintMode = useRef<boolean | null>(null);
  const weekGestureLocked = useRef(false);
  const sliderTouchLocked = useRef(false);
  const sliderSlidingLocked = useRef(false);
  const weeksRef = useLatest(slot.weeks);

  useEffect(() => {
    if (!expanded) return;
    return () => {
      for (const lock of [
        weekGestureLocked,
        sliderTouchLocked,
        sliderSlidingLocked,
      ]) {
        if (!lock.current) continue;
        lock.current = false;
        scrollLock.release();
      }
      paintMode.current = null;
      startWeek.current = null;
      lastWeek.current = null;
      startedOnCell.current = false;
    };
  }, [expanded, scrollLock]);

  const findWeekAt = (x: number, y: number): number | null => {
    for (const key in cellLayouts.current) {
      const r = cellLayouts.current[key];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return Number(key);
      }
    }
    return null;
  };

  const lockWeekGesture = () => {
    if (weekGestureLocked.current) return;
    weekGestureLocked.current = true;
    scrollLock.acquire();
  };

  const releaseWeekGesture = () => {
    if (!weekGestureLocked.current) return;
    weekGestureLocked.current = false;
    scrollLock.release();
  };

  const lockSliderTouch = () => {
    if (sliderTouchLocked.current) return;
    sliderTouchLocked.current = true;
    scrollLock.acquire();
  };

  const releaseSliderTouch = () => {
    if (!sliderTouchLocked.current) return;
    sliderTouchLocked.current = false;
    scrollLock.release();
  };

  const lockSliderSliding = () => {
    if (sliderSlidingLocked.current) return;
    sliderSlidingLocked.current = true;
    scrollLock.acquire();
  };

  const releaseSliderSliding = () => {
    if (!sliderSlidingLocked.current) return;
    sliderSlidingLocked.current = false;
    scrollLock.release();
  };

  const resetWeekGesture = () => {
    paintMode.current = null;
    startWeek.current = null;
    lastWeek.current = null;
    startedOnCell.current = false;
    releaseWeekGesture();
  };

  const shouldStartWeekGesture = (x: number, y: number) => {
    startedOnCell.current = findWeekAt(x, y) != null;
    if (startedOnCell.current) {
      downCoords.current = { x, y };
      lockWeekGesture();
    }
    return startedOnCell.current;
  };

  // 按拖动起点和当前周次更新整个区间，区间外恢复为手势开始时的状态
  const applyRange = (b: number) => {
    if (startWeek.current === null || paintMode.current === null) return;
    if (lastWeek.current === b) return;
    lastWeek.current = b;
    const lo = Math.min(startWeek.current, b);
    const hi = Math.max(startWeek.current, b);
    const next = new Set(baseWeeks.current);
    for (let w = lo; w <= hi; w++) {
      if (paintMode.current) next.add(w);
      else next.delete(w);
    }
    onUpdateRef.current({ weeks: next });
  };

  // 初始化只注册回调，手势触发时才读取 ref
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        return shouldStartWeekGesture(locationX, locationY);
      },
      onStartShouldSetPanResponder: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        return shouldStartWeekGesture(locationX, locationY);
      },
      onMoveShouldSetPanResponder: (_e, g) =>
        startedOnCell.current && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
      onPanResponderGrant: (e) => {
        lockWeekGesture();
        baseWeeks.current = new Set(weeksRef.current);
        const { locationX, locationY } = e.nativeEvent;
        const w = findWeekAt(locationX, locationY);
        startWeek.current = w;
        lastWeek.current = null;
        // 起点未选中时选中整个区间，已选中时取消整个区间
        paintMode.current = w != null ? !baseWeeks.current.has(w) : null;
        if (w != null) applyRange(w);
      },
      onPanResponderMove: (_e, gs) => {
        const currentGridX = downCoords.current.x + gs.dx;
        const currentGridY = downCoords.current.y + gs.dy;
        if (
          currentGridX < 0 ||
          currentGridX > gridSize.current.w ||
          currentGridY < 0 ||
          currentGridY > gridSize.current.h
        ) {
          return;
        }
        const w = findWeekAt(currentGridX, currentGridY);
        if (w != null) applyRange(w);
      },
      onPanResponderRelease: resetWeekGesture,
      onPanResponderTerminate: resetWeekGesture,
      onPanResponderTerminationRequest: () => false,
    }),
  );

  const selectAllWeeks = () => {
    onUpdate({
      weeks: new Set(Array.from({ length: MAX_WEEK }, (_, i) => i + 1)),
    });
  };

  const clearAllWeeks = () => {
    onUpdate({ weeks: new Set() });
  };

  const weeksLabel = formatWeeks(slot.weeks, notSelectedLabel, weeksSuffix);
  const sectionTimeRange = formatCourseTimeRange(slot);
  const primarySummary = `${dayOptions[slot.day - 1]} · ${t(
    "courseAdd.currentRange",
    {
      start: slot.sectionStart,
      end: slot.sectionEnd,
    },
  )}`;
  const secondarySummary = [slot.room.trim(), sectionTimeRange]
    .filter(Boolean)
    .join(" · ");
  const summary = slot.room
    ? t("courseAdd.slotSummaryWithRoom", {
        weekday: dayOptions[slot.day - 1],
        start: slot.sectionStart,
        end: slot.sectionEnd,
        room: slot.room,
        weeks: weeksLabel,
      })
    : t("courseAdd.slotSummary", {
        weekday: dayOptions[slot.day - 1],
        start: slot.sectionStart,
        end: slot.sectionEnd,
        weeks: weeksLabel,
      });

  return (
    <Animated.View
      layout={SLOT_LAYOUT_TRANSITION}
      className="mb-3 overflow-hidden rounded-xl"
      style={{ backgroundColor: cardBg, borderCurve: "continuous" }}
    >
      <Pressable
        className="flex-row items-center px-4 py-3.5"
        onPress={() => {
          setEditingTime(null);
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityLabel={
          slot.timeMode === "time"
            ? `${primarySummary} · ${secondarySummary} · ${weeksLabel}`
            : summary
        }
        accessibilityState={{ expanded }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: "#3b82f6",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: "#fff",
              fontVariant: ["tabular-nums"],
            }}
          >
            {index + 1}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: "600",
                color: isDark ? "#f5f5f5" : "#171717",
              }}
            >
              {primarySummary}
            </Text>
            <View
              style={{
                maxWidth: 96,
                borderRadius: 6,
                backgroundColor: isDark ? "#172554" : "#eff6ff",
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: isDark ? "#60a5fa" : "#2563eb",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {weeksLabel}
              </Text>
            </View>
          </View>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 13,
              color: isDark ? "#a3a3a3" : "#737373",
            }}
          >
            {secondarySummary}
          </Text>
        </View>
        <MorphingIcon
          icon={expanded ? ChevronUp : ChevronDown}
          size={16}
          color={isDark ? "#525252" : "#a3a3a3"}
          style={{ marginLeft: 10 }}
        />
      </Pressable>

      {expanded && (
        <Animated.View
          entering={FadeIn.delay(50).duration(170)}
          exiting={FadeOut.duration(100)}
          className="px-4 pb-4"
        >
          <View className="mb-3 border-t border-neutral-200 dark:border-neutral-700" />

          <Text style={{ fontSize: 12, color: labelColor, marginBottom: 8 }}>
            {t("courseAdd.weekday")}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
            {dayOptions.map((label, i) => {
              const selected = slot.day === i + 1;
              return (
                <Pressable
                  key={label}
                  onPress={() => onUpdate({ day: i + 1 })}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 8,
                    alignItems: "center",
                    backgroundColor: selected ? "#3b82f6" : chipBg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: selected ? "700" : "500",
                      color: selected ? "#fff" : chipText,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ fontSize: 12, color: labelColor, marginBottom: 6 }}>
            {t("courseAdd.room")}
          </Text>
          <TextInput
            value={slot.room}
            onChangeText={(v) => onUpdate({ room: v })}
            placeholder={t("courseAdd.roomPlaceholder")}
            placeholderTextColor={placeholderColor}
            style={{
              fontSize: 15,
              color: inputColor,
              backgroundColor: inputBg,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 9,
              marginBottom: 16,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 12, color: labelColor }}>
              {t("courseAdd.weeks")}
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable onPress={selectAllWeeks} hitSlop={8}>
                <Text style={{ fontSize: 12, color: "#3b82f6" }}>
                  {t("courseAdd.selectAll")}
                </Text>
              </Pressable>
              <Pressable onPress={clearAllWeeks} hitSlop={8}>
                <Text style={{ fontSize: 12, color: "#3b82f6" }}>
                  {t("courseAdd.clear")}
                </Text>
              </Pressable>
            </View>
          </View>
          <View
            {...panResponder.panHandlers}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              gridSize.current = { w: width, h: height };
            }}
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {Array.from({ length: MAX_WEEK }, (_, i) => i + 1).map((w) => {
              const selected = slot.weeks.has(w);
              return (
                <View
                  key={w}
                  pointerEvents="none"
                  onLayout={(e) => {
                    const { x, y, width, height } = e.nativeEvent.layout;
                    cellLayouts.current[w] = { x, y, w: width, h: height };
                  }}
                  style={{
                    width: 44,
                    height: 36,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: selected ? "#3b82f6" : chipBg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: selected ? "700" : "500",
                      color: selected ? "#fff" : chipText,
                    }}
                  >
                    {w}
                  </Text>
                </View>
              );
            })}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <Text style={{ fontSize: 12, color: labelColor }}>
              {t(
                slot.timeMode === "time"
                  ? "courseAdd.directTime"
                  : "courseAdd.sectionRange",
              )}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditingTime(null);
                onUpdate(
                  slot.timeMode === "sections"
                    ? {
                        timeMode: "time",
                        startTime:
                          slot.startTime ?? SECTION_TIMES[slot.sectionStart][0],
                        endTime:
                          slot.endTime ?? SECTION_TIMES[slot.sectionEnd][1],
                      }
                    : {
                        timeMode: "sections",
                        startTime: undefined,
                        endTime: undefined,
                      },
                );
              }}
              hitSlop={8}
            >
              <Text style={{ fontSize: 12, color: "#3b82f6" }}>
                {t(
                  slot.timeMode === "time"
                    ? "courseAdd.switchToSections"
                    : "courseAdd.switchToTime",
                )}
              </Text>
            </Pressable>
          </View>
          <View
            style={{
              minHeight: 64,
              justifyContent: "center",
              paddingHorizontal: slot.timeMode === "time" ? 14 : 0,
              paddingVertical: slot.timeMode === "time" ? 9 : 0,
            }}
          >
            {slot.timeMode === "time" && (
              <View
                pointerEvents="none"
                collapsable={false}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  backgroundColor: inputBg,
                  borderRadius: 10,
                }}
              />
            )}
            {slot.timeMode === "time" ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                {(["startTime", "endTime"] as const).map((field) => (
                  <View
                    key={field}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      paddingLeft: field === "endTime" ? 14 : 0,
                      paddingRight: field === "startTime" ? 14 : 0,
                      borderLeftWidth: field === "endTime" ? 1 : 0,
                      borderLeftColor: isDark ? "#404040" : "#e5e5e5",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: labelColor,
                        marginBottom: 4,
                      }}
                    >
                      {t(
                        field === "startTime"
                          ? "courseAdd.startTime"
                          : "courseAdd.endTime",
                      )}
                    </Text>
                    {Platform.OS === "web" ? (
                      <TextInput
                        value={slot[field] ?? ""}
                        onChangeText={(value) => updateTime(field, value)}
                        placeholder="HH:mm"
                        accessibilityLabel={t(
                          field === "startTime"
                            ? "courseAdd.startTime"
                            : "courseAdd.endTime",
                        )}
                        maxLength={5}
                        style={{
                          color: inputColor,
                          paddingHorizontal: 0,
                          paddingVertical: 0,
                          minHeight: 24,
                          fontSize: 16,
                          fontVariant: ["tabular-nums"],
                        }}
                      />
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${t(field === "startTime" ? "courseAdd.startTime" : "courseAdd.endTime")} ${slot[field] ?? ""}`}
                        onPress={() =>
                          setEditingTime(editingTime === field ? null : field)
                        }
                        hitSlop={8}
                        style={{
                          minHeight: 24,
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: inputColor,
                            fontSize: 16,
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {slot[field]}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <>
                <Text
                  style={{
                    fontSize: 15,
                    lineHeight: 20,
                    fontWeight: "600",
                    color: isDark ? "#e5e5e5" : "#1c1c1e",
                    textAlign: "center",
                    marginBottom: 4,
                  }}
                >
                  {t("courseAdd.currentRange", {
                    start: slot.sectionStart,
                    end: slot.sectionEnd,
                  })}
                  {sectionTimeRange ? ` (${sectionTimeRange})` : ""}
                </Text>
                <View
                  onStartShouldSetResponderCapture={() => {
                    lockSliderTouch();
                    return false;
                  }}
                  onTouchEnd={releaseSliderTouch}
                  onTouchCancel={releaseSliderTouch}
                >
                  <RangeSlider
                    range={[slot.sectionStart, slot.sectionEnd]}
                    minimumValue={1}
                    maximumValue={MAX_SECTION}
                    step={1}
                    onValueChange={([s, e]) =>
                      onUpdate({
                        sectionStart: s,
                        sectionEnd: e,
                        startTime: undefined,
                        endTime: undefined,
                      })
                    }
                    onSlidingStart={lockSliderSliding}
                    onSlidingComplete={releaseSliderSliding}
                    inboundColor="#3b82f6"
                    outboundColor={isDark ? "#404040" : "#d4d4d4"}
                    thumbTintColor="#3b82f6"
                    thumbSize={22}
                    trackHeight={4}
                    style={{ height: 40 }}
                  />
                </View>
              </>
            )}
          </View>
          {slot.timeMode === "time" && editingTime && Platform.OS !== "web" && (
            <DateTimePicker
              value={
                new Date(
                  2000,
                  0,
                  1,
                  ...((slot[editingTime] ?? "08:00").split(":").map(Number) as [
                    number,
                    number,
                  ]),
                )
              }
              mode="time"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              is24Hour
              themeVariant={isDark ? "dark" : "light"}
              onDismiss={() => setEditingTime(null)}
              onValueChange={(_event, date) => {
                updateTime(
                  editingTime,
                  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
                );
                if (Platform.OS === "android") setEditingTime(null);
              }}
            />
          )}

          {canDelete && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: isDark ? "#404040" : "#e5e5e5",
                marginTop: 8,
                paddingTop: 12,
              }}
            >
              <Pressable
                onPress={onDelete}
                accessibilityRole="button"
                accessibilityLabel={t("courseAdd.deleteSlot")}
                style={({ pressed }) => ({
                  minHeight: 44,
                  borderRadius: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "#450a0a" : "#fef2f2",
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <Ionicons name="trash-outline" size={17} color="#ef4444" />
                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#ef4444",
                  }}
                >
                  {t("courseAdd.deleteSlot")}
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
}
