import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import {
  getAndroidBlurProps,
  useAndroidBlurTarget,
} from "@/components/ui/app-blur-target";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { findConflictWeeks, MAX_WEEK, weeksToRanges } from "@/lib/course-weeks";
import { type TKey, useT } from "@/lib/i18n";
import { formatCourseSectionTimeRange } from "@/services/course-time";
import { useCourseStore } from "@/store/course";

const DAY_KEYS: TKey[] = [
  "schedule.weekday.mon",
  "schedule.weekday.tue",
  "schedule.weekday.wed",
  "schedule.weekday.thu",
  "schedule.weekday.fri",
  "schedule.weekday.sat",
  "schedule.weekday.sun",
];

const ACCENT = "#3b82f6";

type WeekMode = "current" | "toEnd" | "all";

export interface QuickAddSlot {
  day: number; // 1..7
  sectionStart: number;
  sectionEnd: number;
}

interface Props {
  slot: QuickAddSlot | null;
  currentWeek: number;
  onClose: () => void;
}

export function QuickAddCourseModal({ slot, currentWeek, onClose }: Props) {
  const blurTarget = useAndroidBlurTarget();
  const slotKey = slot
    ? `${slot.day}-${slot.sectionStart}-${slot.sectionEnd}`
    : null;

  return (
    <Modal
      visible={!!slot}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <BlurView
            {...getAndroidBlurProps(blurTarget)}
            intensity={30}
            tint="dark"
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          {slot && slotKey && (
            <QuickAddBody
              key={slotKey}
              slot={slot}
              currentWeek={currentWeek}
              onClose={onClose}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface BodyProps {
  slot: QuickAddSlot;
  currentWeek: number;
  onClose: () => void;
}

function QuickAddBody({ slot, currentWeek, onClose }: BodyProps) {
  const t = useT();
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const courses = useCourseStore((s) => s.courses);
  const addCourse = useCourseStore((s) => s.addCourse);

  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");
  const [showTeacher, setShowTeacher] = useState(false);
  const [weekMode, setWeekMode] = useState<WeekMode | null>(null);
  // 冲突确认相关：保留冲突周次的展示标签和待提交的周次集合
  const [pendingConflict, setPendingConflict] = useState<{
    label: string;
    weeks: Set<number>;
  } | null>(null);

  const nameInputRef = useRef<TextInput | null>(null);
  const teacherInputRef = useRef<TextInput | null>(null);

  const subtitle = useMemo(() => {
    const weekday = t(DAY_KEYS[slot.day - 1]);
    const sectionLabel = t("schedule.sectionRange", {
      start: slot.sectionStart,
      end: slot.sectionEnd,
    });
    const time = formatCourseSectionTimeRange(
      slot.sectionStart,
      slot.sectionEnd,
    );
    return time
      ? `${weekday} · ${sectionLabel} · ${time}`
      : `${weekday} · ${sectionLabel}`;
  }, [slot, t]);

  const cardBg = isDark ? "#1c1c1e" : "#fff";
  const inputBg = isDark ? "#262626" : "#f5f5f5";
  const inputColor = isDark ? "#e5e5e5" : "#1c1c1e";
  const placeholderColor = isDark ? "#525252" : "#a3a3a3";
  const labelColor = isDark ? "#a3a3a3" : "#525252";
  const chipBg = isDark ? "#262626" : "#f5f5f5";
  const chipText = isDark ? "#d4d4d4" : "#525252";
  const dividerColor = isDark ? "#2c2c2e" : "#f1f1f1";

  const buildWeeksFromMode = (mode: WeekMode): Set<number> => {
    if (mode === "current") return new Set([currentWeek]);
    if (mode === "toEnd") {
      const s = new Set<number>();
      for (let w = currentWeek; w <= MAX_WEEK; w++) s.add(w);
      return s;
    }
    const s = new Set<number>();
    for (let w = 1; w <= MAX_WEEK; w++) s.add(w);
    return s;
  };

  const goCustom = () => {
    onClose();
    router.push({
      pathname: "/(pages)/settings/course/add",
      params: {
        prefillName: name.trim(),
        prefillRoom: room.trim(),
        prefillTeacher: teacher.trim(),
        prefillDay: String(slot.day),
        prefillSectionStart: String(slot.sectionStart),
        prefillSectionEnd: String(slot.sectionEnd),
      },
    });
  };

  const commitSave = (weeks: Set<number>) => {
    const trimmed = name.trim();
    const ranges = weeksToRanges(weeks);
    for (const [ws, we] of ranges) {
      addCourse({
        name: trimmed,
        room: room.trim(),
        teacher: teacher.trim(),
        day: slot.day,
        weekStart: ws,
        weekEnd: we,
        sectionStart: slot.sectionStart,
        sectionEnd: slot.sectionEnd,
        source: "manual",
      });
    }
    Toast.show({
      type: "success",
      text1: t("schedule.quickAdd.added"),
      position: "bottom",
    });
    onClose();
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Toast.show({
        type: "error",
        text1: t("schedule.quickAdd.needName"),
        position: "bottom",
      });
      nameInputRef.current?.focus();
      return;
    }
    if (!weekMode) {
      Toast.show({
        type: "error",
        text1: t("schedule.quickAdd.needWeeks"),
        position: "bottom",
      });
      return;
    }
    const weeks = buildWeeksFromMode(weekMode);
    if (weeks.size === 0) return;

    const conflicts = findConflictWeeks(
      courses,
      slot.day,
      slot.sectionStart,
      slot.sectionEnd,
      weeks,
    );

    if (conflicts.length > 0) {
      const label = weeksToRanges(new Set(conflicts))
        .map(([s, e]) => (s === e ? `${s}` : `${s}-${e}`))
        .join(", ");
      setPendingConflict({ label, weeks });
      return;
    }

    commitSave(weeks);
  };

  const canSave = name.trim().length > 0 && weekMode !== null;

  const weekChips: { id: WeekMode; label: string }[] = [
    { id: "current", label: t("schedule.quickAdd.weeksOnlyCurrent") },
    { id: "toEnd", label: t("schedule.quickAdd.weeksToEnd") },
    { id: "all", label: t("schedule.quickAdd.weeksAll") },
  ];

  return (
    <View
      style={{
        width: 300,
        backgroundColor: cardBg,
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
      {/* 头部色块 */}
      <View
        style={{
          backgroundColor: ACCENT,
          paddingHorizontal: 22,
          paddingTop: 22,
          paddingBottom: 18,
        }}
      >
        <Pressable
          onPress={onClose}
          style={{ position: "absolute", top: 12, right: 12 }}
          hitSlop={8}
        >
          <Ionicons
            name="close-circle"
            size={26}
            color="rgba(255,255,255,0.7)"
          />
        </Pressable>
        <Text
          style={{
            fontSize: 19,
            fontWeight: "700",
            color: "#fff",
            marginRight: 28,
            lineHeight: 26,
          }}
        >
          {t("schedule.quickAdd.title")}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.85)",
            marginTop: 6,
          }}
        >
          {subtitle}
        </Text>
      </View>

      <View style={{ padding: 18, gap: 12 }}>
        <TextInput
          ref={nameInputRef}
          value={name}
          onChangeText={setName}
          placeholder={t("schedule.quickAdd.namePlaceholder")}
          placeholderTextColor={placeholderColor}
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: inputColor,
            backgroundColor: inputBg,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 11,
          }}
        />

        <FieldRow icon="location-outline" iconColor={labelColor}>
          <TextInput
            value={room}
            onChangeText={setRoom}
            placeholder={t("schedule.quickAdd.roomPlaceholder")}
            placeholderTextColor={placeholderColor}
            style={{
              flex: 1,
              fontSize: 15,
              color: inputColor,
              paddingVertical: 0,
            }}
          />
        </FieldRow>

        <View style={{ height: 1, backgroundColor: dividerColor }} />

        {showTeacher ? (
          <FieldRow icon="person-outline" iconColor={labelColor}>
            <TextInput
              ref={teacherInputRef}
              value={teacher}
              onChangeText={setTeacher}
              placeholder={t("schedule.quickAdd.teacherPlaceholder")}
              placeholderTextColor={placeholderColor}
              style={{
                flex: 1,
                fontSize: 15,
                color: inputColor,
                paddingVertical: 0,
              }}
            />
          </FieldRow>
        ) : (
          <Pressable
            onPress={() => {
              setShowTeacher(true);
              setTimeout(() => teacherInputRef.current?.focus(), 60);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 4,
            }}
            hitSlop={6}
          >
            <Ionicons name="add" size={16} color={ACCENT} />
            <Text
              style={{
                marginLeft: 4,
                fontSize: 13,
                color: ACCENT,
                fontWeight: "500",
              }}
            >
              {t("schedule.quickAdd.addTeacher")}
            </Text>
          </Pressable>
        )}

        {/* 周次 chips */}
        <View style={{ marginTop: 4 }}>
          <Text
            style={{
              fontSize: 12,
              color: labelColor,
              marginBottom: 8,
            }}
          >
            {t("schedule.quickAdd.weeksLabel")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {weekChips.map((chip) => {
              const selected = weekMode === chip.id;
              return (
                <Pressable
                  key={chip.id}
                  onPress={() => setWeekMode(chip.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    backgroundColor: selected ? ACCENT : chipBg,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: selected ? "700" : "500",
                      color: selected ? "#fff" : chipText,
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 自定义入口 */}
        <Pressable
          onPress={goCustom}
          hitSlop={8}
          style={{
            marginTop: 6,
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: ACCENT,
              fontWeight: "500",
            }}
          >
            {t("schedule.quickAdd.presetsNotEnough")}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={12}
            color={ACCENT}
            style={{ marginLeft: 2 }}
          />
        </Pressable>

        {/* 主按钮 */}
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={({ pressed }) => ({
            marginTop: 4,
            alignItems: "center",
            borderRadius: 12,
            paddingVertical: 12,
            backgroundColor: canSave
              ? pressed
                ? "#2563eb"
                : ACCENT
              : isDark
                ? "#2c2c2e"
                : "#e5e7eb",
          })}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: canSave ? "#fff" : isDark ? "#525252" : "#a3a3a3",
            }}
          >
            {t("schedule.quickAdd.save")}
          </Text>
        </Pressable>
      </View>

      <ConfirmSheet
        visible={pendingConflict !== null}
        onClose={() => setPendingConflict(null)}
        title={t("schedule.quickAdd.conflictTitle")}
        description={t("schedule.quickAdd.conflictDesc", {
          weeks: pendingConflict?.label ?? "",
        })}
        confirmText={t("schedule.quickAdd.conflictConfirm")}
        destructive
        onConfirm={() => {
          const weeks = pendingConflict?.weeks;
          setPendingConflict(null);
          if (weeks) commitSave(weeks);
        }}
      />
    </View>
  );
}

function FieldRow({
  icon,
  iconColor,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Ionicons
        name={icon}
        size={17}
        color={iconColor}
        style={{ marginRight: 10 }}
      />
      {children}
    </View>
  );
}
