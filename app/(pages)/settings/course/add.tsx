import { Ionicons } from "@expo/vector-icons";
import { RangeSlider } from "@react-native-assets/slider";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { type Course, useCourseStore } from "@/store/course";

const DAY_OPTIONS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const MAX_WEEK = 20;
const MAX_SECTION = 16;

interface TimeSlot {
  day: number;
  sectionStart: number;
  sectionEnd: number;
  room: string;
  weeks: Set<number>;
}

function createEmptySlot(): TimeSlot {
  return {
    day: 1,
    sectionStart: 1,
    sectionEnd: 2,
    room: "",
    weeks: new Set(),
  };
}

function recordsToSlots(records: Course[]): TimeSlot[] {
  const map = new Map<string, TimeSlot>();
  for (const r of records) {
    const key = `${r.day}-${r.sectionStart}-${r.sectionEnd}-${r.room}`;
    if (map.has(key)) {
      const slot = map.get(key)!;
      for (let w = r.weekStart; w <= r.weekEnd; w++) slot.weeks.add(w);
    } else {
      const weeks = new Set<number>();
      for (let w = r.weekStart; w <= r.weekEnd; w++) weeks.add(w);
      map.set(key, {
        day: r.day,
        sectionStart: r.sectionStart,
        sectionEnd: r.sectionEnd,
        room: r.room,
        weeks,
      });
    }
  }
  return map.size > 0 ? [...map.values()] : [createEmptySlot()];
}

function weeksToRanges(weeks: Set<number>): [number, number][] {
  const sorted = [...weeks].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const ranges: [number, number][] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push([start, end]);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push([start, end]);
  return ranges;
}

function formatWeeks(weeks: Set<number>): string {
  if (weeks.size === 0) return "未选择";
  const ranges = weeksToRanges(weeks);
  return (
    ranges.map(([s, e]) => (s === e ? `${s}` : `${s}-${e}`)).join(", ") + " 周"
  );
}

export default function AddEditCourseScreen() {
  const router = useRouter();
  const { name: editName } = useLocalSearchParams<{ name?: string }>();
  const isEdit = !!editName;

  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  const courses = useCourseStore((s) => s.courses);
  const addCourse = useCourseStore((s) => s.addCourse);
  const removeCoursesByName = useCourseStore((s) => s.removeCoursesByName);

  const existingRecords = useMemo(
    () => (editName ? courses.filter((c) => c.name === editName) : []),
    [editName, courses],
  );

  const [name, setName] = useState("");
  const [teacher, setTeacher] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([createEmptySlot()]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  useEffect(() => {
    if (isEdit && existingRecords.length > 0) {
      setName(existingRecords[0].name);
      setTeacher(existingRecords[0].teacher);
      setSlots(recordsToSlots(existingRecords));
      setExpandedIndex(null);
    }
  }, [isEdit, existingRecords]);

  const toggleExpand = useCallback((index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex((prev) => (prev === index ? null : index));
  }, []);

  const updateSlot = useCallback((index: number, patch: Partial<TimeSlot>) => {
    setSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }, []);

  const addSlot = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSlots((prev) => [...prev, createEmptySlot()]);
    setExpandedIndex(slots.length);
  }, [slots.length]);

  const removeSlot = useCallback(
    (index: number) => {
      if (slots.length <= 1) {
        Toast.show({
          type: "error",
          text1: "至少保留一个时段",
          position: "bottom",
        });
        return;
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSlots((prev) => prev.filter((_, i) => i !== index));
      setExpandedIndex((prev) => {
        if (prev === null) return null;
        if (prev === index) return null;
        if (prev > index) return prev - 1;
        return prev;
      });
    },
    [slots.length],
  );

  const inputBg = isDark ? "#262626" : "#f5f5f5";
  const inputColor = isDark ? "#e5e5e5" : "#1c1c1e";
  const placeholderColor = isDark ? "#525252" : "#a3a3a3";
  const labelColor = isDark ? "#a3a3a3" : "#525252";
  const chipBg = isDark ? "#262626" : "#f5f5f5";
  const chipText = isDark ? "#d4d4d4" : "#525252";
  const cardBg = isDark ? "#262626" : "#ffffff";

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Toast.show({
        type: "error",
        text1: "请输入课程名称",
        position: "bottom",
      });
      return;
    }
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (slot.weeks.size === 0) {
        Toast.show({
          type: "error",
          text1: `时段 ${i + 1} 未选择周次`,
          position: "bottom",
        });
        setExpandedIndex(i);
        return;
      }
      if (slot.sectionEnd < slot.sectionStart) {
        Toast.show({
          type: "error",
          text1: `时段 ${i + 1} 节次范围有误`,
          position: "bottom",
        });
        setExpandedIndex(i);
        return;
      }
    }

    if (isEdit) {
      removeCoursesByName(editName!);
    }

    for (const slot of slots) {
      const ranges = weeksToRanges(slot.weeks);
      for (const [ws, we] of ranges) {
        addCourse({
          name: trimmedName,
          room: slot.room.trim(),
          teacher: teacher.trim(),
          day: slot.day,
          weekStart: ws,
          weekEnd: we,
          sectionStart: slot.sectionStart,
          sectionEnd: slot.sectionEnd,
          source: "manual",
        });
      }
    }

    Toast.show({
      type: "success",
      text1: isEdit ? "课程已更新" : "课程已添加",
      position: "bottom",
    });
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: isEdit ? "编辑课程" : "添加课程" }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1 bg-neutral-100 dark:bg-neutral-900"
          contentContainerClassName="px-4 pt-4 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-4 overflow-hidden rounded-xl bg-white dark:bg-neutral-800">
            <View className="px-4 py-3">
              <Text
                style={{ fontSize: 12, color: labelColor, marginBottom: 6 }}
              >
                课程名称
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="如：高等数学"
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
                教师
              </Text>
              <TextInput
                value={teacher}
                onChangeText={setTeacher}
                placeholder="可选"
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

          {/* 时段列表 */}
          {slots.map((slot, index) => (
            <SlotCard
              key={index}
              slot={slot}
              index={index}
              expanded={expandedIndex === index}
              canDelete={slots.length > 1}
              onToggle={() => toggleExpand(index)}
              onUpdate={(patch) => updateSlot(index, patch)}
              onDelete={() => removeSlot(index)}
              isDark={isDark}
              labelColor={labelColor}
              chipBg={chipBg}
              chipText={chipText}
              inputBg={inputBg}
              inputColor={inputColor}
              placeholderColor={placeholderColor}
              cardBg={cardBg}
            />
          ))}

          <Pressable
            className="mb-4 flex-row items-center justify-center rounded-xl border border-dashed border-blue-400 py-3 active:bg-blue-50 dark:border-blue-600 dark:active:bg-neutral-800"
            onPress={addSlot}
          >
            <Ionicons name="add" size={18} color="#3b82f6" />
            <Text className="ml-1 text-sm font-medium text-blue-500">
              添加时段
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSave}
            className="items-center rounded-xl bg-blue-500 py-3.5 active:bg-blue-600"
          >
            <Text className="text-base font-semibold text-white">保存</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
}) {
  const toggleWeek = (w: number) => {
    const next = new Set(slot.weeks);
    if (next.has(w)) next.delete(w);
    else next.add(w);
    onUpdate({ weeks: next });
  };

  const selectAllWeeks = () => {
    onUpdate({
      weeks: new Set(Array.from({ length: MAX_WEEK }, (_, i) => i + 1)),
    });
  };

  const clearAllWeeks = () => {
    onUpdate({ weeks: new Set() });
  };

  const summary = `${DAY_OPTIONS[slot.day - 1]} 第${slot.sectionStart}-${slot.sectionEnd}节${slot.room ? ` ${slot.room}` : ""} | ${formatWeeks(slot.weeks)}`;

  return (
    <View
      className="mb-3 overflow-hidden rounded-xl"
      style={{ backgroundColor: cardBg }}
    >
      {/* 摘要行 */}
      <Pressable
        className="flex-row items-center px-4 py-3.5"
        onPress={onToggle}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "#3b82f6",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>
            {index + 1}
          </Text>
        </View>
        <Text
          className="flex-1 text-sm text-neutral-700 dark:text-neutral-300"
          numberOfLines={1}
        >
          {summary}
        </Text>
        {canDelete && (
          <Pressable hitSlop={12} onPress={onDelete} style={{ marginRight: 8 }}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </Pressable>
        )}
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={isDark ? "#525252" : "#a3a3a3"}
        />
      </Pressable>

      {/* 展开编辑区域 */}
      {expanded && (
        <View className="px-4 pb-4">
          <View className="mb-3 border-t border-neutral-200 dark:border-neutral-700" />

          {/* 星期 */}
          <Text style={{ fontSize: 12, color: labelColor, marginBottom: 8 }}>
            星期
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
            {DAY_OPTIONS.map((label, i) => {
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

          {/* 教室 */}
          <Text style={{ fontSize: 12, color: labelColor, marginBottom: 6 }}>
            教室
          </Text>
          <TextInput
            value={slot.room}
            onChangeText={(v) => onUpdate({ room: v })}
            placeholder="可选"
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

          {/* 周次 */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 12, color: labelColor }}>
              周次（可多选）
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable onPress={selectAllWeeks} hitSlop={8}>
                <Text style={{ fontSize: 12, color: "#3b82f6" }}>全选</Text>
              </Pressable>
              <Pressable onPress={clearAllWeeks} hitSlop={8}>
                <Text style={{ fontSize: 12, color: "#3b82f6" }}>清空</Text>
              </Pressable>
            </View>
          </View>
          <View
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
                <Pressable
                  key={w}
                  onPress={() => toggleWeek(w)}
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
                </Pressable>
              );
            })}
          </View>

          {/* 节次范围 */}
          <Text style={{ fontSize: 12, color: labelColor, marginBottom: 4 }}>
            节次范围
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: isDark ? "#e5e5e5" : "#1c1c1e",
              textAlign: "center",
              marginBottom: 4,
            }}
          >
            第 {slot.sectionStart} - {slot.sectionEnd} 节
          </Text>
          <RangeSlider
            range={[slot.sectionStart, slot.sectionEnd]}
            minimumValue={1}
            maximumValue={MAX_SECTION}
            step={1}
            onValueChange={([s, e]) =>
              onUpdate({ sectionStart: s, sectionEnd: e })
            }
            inboundColor="#3b82f6"
            outboundColor={isDark ? "#404040" : "#d4d4d4"}
            thumbTintColor="#3b82f6"
            thumbSize={22}
            trackHeight={4}
            style={{ height: 40 }}
          />
        </View>
      )}
    </View>
  );
}
