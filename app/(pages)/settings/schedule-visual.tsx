import { Slider } from "@react-native-assets/slider";
import { Stack } from "expo-router";
import { type ComponentProps, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useT } from "@/lib/i18n";
import { useScheduleStore } from "@/store/schedule";

export default function ScheduleVisualScreen() {
  const t = useT();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const backgroundImageOpacity = useScheduleStore(
    (s) => s.backgroundImageOpacity,
  );
  const backgroundImageBlurRadius = useScheduleStore(
    (s) => s.backgroundImageBlurRadius,
  );
  const courseCellOpacity = useScheduleStore((s) => s.courseCellOpacity);
  const otherWeekCellOpacity = useScheduleStore((s) => s.otherWeekCellOpacity);
  const locatorCellOpacity = useScheduleStore((s) => s.locatorCellOpacity);
  const setBackgroundImageOpacity = useScheduleStore(
    (s) => s.setBackgroundImageOpacity,
  );
  const setBackgroundImageBlurRadius = useScheduleStore(
    (s) => s.setBackgroundImageBlurRadius,
  );
  const setCourseCellOpacity = useScheduleStore((s) => s.setCourseCellOpacity);
  const setOtherWeekCellOpacity = useScheduleStore(
    (s) => s.setOtherWeekCellOpacity,
  );
  const setLocatorCellOpacity = useScheduleStore(
    (s) => s.setLocatorCellOpacity,
  );
  const resetScheduleVisual = useScheduleStore((s) => s.resetScheduleVisual);
  const [sliderResetVersion, setSliderResetVersion] = useState(0);

  const handleReset = () => {
    resetScheduleVisual();
    setSliderResetVersion((v) => v + 1);
  };

  return (
    <>
      <Stack.Screen options={{ title: t("scheduleVisual.title") }} />
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerClassName="px-4 pt-4 pb-8"
        contentInsetAdjustmentBehavior="automatic"
      >
        <MenuGroup title={t("scheduleVisual.backgroundGroup")}>
          <SettingSlider
            label={t("scheduleVisual.bgOpacity")}
            value={backgroundImageOpacity}
            onValueChange={setBackgroundImageOpacity}
            valueLabel={formatPercent(backgroundImageOpacity)}
            minLabel="0%"
            maxLabel="100%"
            icon="opacity"
            accentColor="#0ea5e9"
            min={0}
            max={1}
            step={0.01}
            isDark={isDark}
            resetVersion={sliderResetVersion}
          />
          <SettingSlider
            label={t("scheduleVisual.bgBlur")}
            value={backgroundImageBlurRadius}
            onValueChange={setBackgroundImageBlurRadius}
            valueLabel={t("scheduleVisual.blurValue", {
              n: backgroundImageBlurRadius,
            })}
            minLabel="0px"
            maxLabel="30px"
            icon="blur-on"
            accentColor="#8b5cf6"
            min={0}
            max={30}
            step={1}
            isDark={isDark}
            resetVersion={sliderResetVersion}
          />
        </MenuGroup>

        <MenuGroup title={t("scheduleVisual.cellsGroup")}>
          <SettingSlider
            label={t("scheduleVisual.courseCellOpacity")}
            value={courseCellOpacity}
            onValueChange={setCourseCellOpacity}
            valueLabel={formatPercent(courseCellOpacity)}
            minLabel="0%"
            maxLabel="100%"
            icon="dashboard"
            accentColor="#22c55e"
            min={0}
            max={1}
            step={0.01}
            isDark={isDark}
            resetVersion={sliderResetVersion}
          />
          <SettingSlider
            label={t("scheduleVisual.otherWeekCellOpacity")}
            value={otherWeekCellOpacity}
            onValueChange={setOtherWeekCellOpacity}
            valueLabel={formatPercent(otherWeekCellOpacity)}
            minLabel="0%"
            maxLabel="100%"
            icon="event-busy"
            accentColor="#64748b"
            min={0}
            max={1}
            step={0.01}
            isDark={isDark}
            resetVersion={sliderResetVersion}
          />
          <SettingSlider
            label={t("scheduleVisual.locatorCellOpacity")}
            value={locatorCellOpacity}
            onValueChange={setLocatorCellOpacity}
            valueLabel={formatPercent(locatorCellOpacity)}
            minLabel="0%"
            maxLabel="100%"
            icon="my-location"
            accentColor="#f59e0b"
            min={0}
            max={1}
            step={0.01}
            isDark={isDark}
            resetVersion={sliderResetVersion}
          />
        </MenuGroup>

        <MenuGroup title={t("scheduleVisual.actionsGroup")}>
          <MenuItem
            icon="restart-alt"
            iconBg="#3b82f6"
            label={t("scheduleVisual.reset")}
            showArrow={false}
            onPress={handleReset}
          />
        </MenuGroup>
      </ScrollView>
    </>
  );
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function SettingSlider({
  label,
  value,
  valueLabel,
  minLabel,
  maxLabel,
  icon,
  accentColor,
  onValueChange,
  min,
  max,
  step,
  isDark,
  resetVersion,
}: {
  label: string;
  value: number;
  valueLabel: string;
  minLabel: string;
  maxLabel: string;
  icon: ComponentProps<typeof IconSymbol>["name"];
  accentColor: string;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  isDark: boolean;
  resetVersion: number;
}) {
  const iconBg = withAlpha(accentColor, isDark ? 0.22 : 0.14);
  const valueBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const valueColor = isDark ? "#e5e5e5" : "#525252";
  const boundColor = isDark ? "#737373" : "#a3a3a3";

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 13, gap: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconBg,
          }}
        >
          <IconSymbol name={icon} size={18} color={accentColor} />
        </View>
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            color: isDark ? "#f5f5f5" : "#171717",
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            minWidth: 54,
            textAlign: "right",
            fontSize: 12,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
            color: valueColor,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
            overflow: "hidden",
            backgroundColor: valueBg,
          }}
        >
          {valueLabel}
        </Text>
      </View>
      <View style={{ paddingLeft: 44, gap: 4 }}>
        <Slider
          key={resetVersion}
          value={value}
          minimumValue={min}
          maximumValue={max}
          step={step}
          onValueChange={(next) => onValueChange(Number(next.toFixed(2)))}
          minimumTrackTintColor={accentColor}
          maximumTrackTintColor={isDark ? "#404040" : "#d4d4d4"}
          thumbTintColor={accentColor}
          thumbStyle={{
            borderWidth: 3,
            borderColor: isDark ? "#262626" : "#fff",
          }}
          thumbSize={24}
          trackHeight={5}
          style={{ height: 34 }}
        />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: boundColor,
              fontVariant: ["tabular-nums"],
            }}
          >
            {minLabel}
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: boundColor,
              fontVariant: ["tabular-nums"],
            }}
          >
            {maxLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
