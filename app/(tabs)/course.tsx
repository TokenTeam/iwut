import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { Schedule } from "@/components/layout/schedule";
import { ScrollPicker } from "@/components/ui/scroll-picker";
import { getCurrentDayOfWeek, getCurrentWeek } from "@/lib/date";
import { useCourseStore } from "@/store/course";
import { useUserBindStore } from "@/store/user-bind";

const MAX_WEEK = 20;

export default function CourseScreen() {
  const courses = useCourseStore((store) => store.courses);
  const termStart = useCourseStore((store) => store.termStart);
  const isBound = useUserBindStore((store) => store.isBound);
  const [week, setWeek] = useState<number>(() => getCurrentWeek(termStart));
  const today = getCurrentDayOfWeek();
  const [showWeekPicker, setShowWeekPicker] = useState<boolean>(false);

  useEffect(() => {
    if (termStart) setWeek(getCurrentWeek(termStart));
  }, [termStart]);
  const [fabOpen, setFabOpen] = useState(false);
  const fabProgress = useSharedValue(0);

  useEffect(() => {
    fabProgress.value = withTiming(fabOpen ? 1 : 0, { duration: 200 });
  }, [fabOpen, fabProgress]);

  const bachelorFabStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(fabProgress.value, [0, 1], [0, -70]),
      },
    ],
    opacity: fabProgress.value,
  }));

  const masterFabStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(fabProgress.value, [0, 1], [0, -130]),
      },
    ],
    opacity: fabProgress.value,
  }));

  const fabButtonStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(fabProgress.value, [0, 1], [0, 45])}deg`,
      },
    ],
  }));

  const fabOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fabProgress.value, [0, 1], [0, 0.15]),
  }));

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View className="h-12 w-full flex-row items-center justify-center">
        <Pressable
          className="w-10 items-center"
          style={{ opacity: week <= 1 ? 0 : 1 }}
          disabled={week <= 1}
          onPress={() => setWeek((w) => w - 1)}
        >
          <Ionicons name="chevron-back" size={20} color="gray" />
        </Pressable>

        <Pressable
          className="w-20 items-center"
          onPress={() => {
            setShowWeekPicker(true);
          }}
        >
          <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            第 {week} 周
          </Text>
        </Pressable>

        <Pressable
          className="w-10 items-center"
          style={{ opacity: week >= MAX_WEEK ? 0 : 1 }}
          disabled={week >= MAX_WEEK}
          onPress={() => setWeek((w) => w + 1)}
        >
          <Ionicons name="chevron-forward" size={20} color="gray" />
        </Pressable>
      </View>

      <Schedule
        courses={courses}
        week={week}
        today={week === getCurrentWeek(termStart) ? today : undefined}
      />

      {isBound && courses.length === 0 && (
        <>
          <Animated.View
            className="absolute inset-0 bg-black"
            style={fabOverlayStyle}
            pointerEvents={fabOpen ? "auto" : "none"}
          >
            <Pressable className="flex-1" onPress={() => setFabOpen(false)} />
          </Animated.View>

          <Animated.View
            className="absolute bottom-14 right-9 flex-row items-center"
            style={masterFabStyle}
            pointerEvents={fabOpen ? "auto" : "none"}
          >
            <View className="mr-3 rounded-lg bg-white px-3 py-1.5 dark:bg-neutral-700">
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                研究生
              </Text>
            </View>
            <Pressable
              className="h-14 w-14 items-center justify-center rounded-full bg-purple-500"
              onPress={() => {
                setFabOpen(false);
                router.push("/browser/course/master");
              }}
            >
              <Ionicons name="library" size={22} color="white" />
            </Pressable>
          </Animated.View>

          <Animated.View
            className="absolute bottom-14 right-9 flex-row items-center"
            style={bachelorFabStyle}
            pointerEvents={fabOpen ? "auto" : "none"}
          >
            <View className="mr-3 rounded-lg bg-white px-3 py-1.5 dark:bg-neutral-700">
              <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                本科生
              </Text>
            </View>
            <Pressable
              className="h-14 w-14 items-center justify-center rounded-full bg-green-500"
              onPress={() => {
                setFabOpen(false);
                router.push("/browser/course/bachelor");
              }}
            >
              <Ionicons name="school" size={22} color="white" />
            </Pressable>
          </Animated.View>

          <Pressable
            className="absolute bottom-12 right-8 h-16 w-16 items-center justify-center rounded-full bg-blue-500"
            onPress={() => setFabOpen((v) => !v)}
          >
            <Animated.View style={fabButtonStyle}>
              <Ionicons name="add" size={32} color="white" />
            </Animated.View>
          </Pressable>
        </>
      )}

      <Modal
        visible={showWeekPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWeekPicker(false)}
      >
        <View className="flex-1 justify-end">
          <Pressable
            className="absolute inset-0"
            onPress={() => setShowWeekPicker(false)}
          >
            <LinearGradient
              colors={["rgba(0,0,0,0.03)", "rgba(0,0,0,0.1)"]}
              className="flex-1"
            />
          </Pressable>
          <View className="rounded-t-2xl overflow-hidden">
            <View className="bg-white pb-8 pt-5 dark:bg-neutral-800">
              <ScrollPicker
                items={Array.from(
                  { length: MAX_WEEK },
                  (_, i) => `第 ${i + 1} 周`,
                )}
                selectedIndex={week - 1}
                onSelect={(i) => {
                  setWeek(i + 1);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
