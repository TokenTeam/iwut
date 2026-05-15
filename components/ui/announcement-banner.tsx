import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

import { useHaptics } from "@/hooks/use-haptics";
import type { Announcement, AnnouncementType } from "@/services/announcements";
import { useAnnouncementStore } from "@/store/announcements";

const TYPE_STYLES: Record<
  AnnouncementType,
  {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    color: string;
  }
> = {
  info: { icon: "information-circle-outline", color: "#3b82f6" },
  warning: { icon: "warning-outline", color: "#ca8a04" },
  event: { icon: "megaphone-outline", color: "#10b981" },
  maintenance: { icon: "construct-outline", color: "#737373" },
};

const AUTO_INTERVAL_MS = 5000;
const RESUME_DELAY_MS = 10000;

export function AnnouncementBanner({
  announcements,
  isDark,
}: {
  announcements: Announcement[];
  isDark: boolean;
}) {
  const [width, setWidth] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const pausedUntilRef = useRef(0);
  const activeIdxRef = useRef(0);
  const expandedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  const idsKey = announcements.map((a) => a.id).join("|");
  const [prevIdsKey, setPrevIdsKey] = useState(idsKey);
  if (prevIdsKey !== idsKey) {
    setPrevIdsKey(idsKey);
    setActiveIdx(0);
  }

  useEffect(() => {
    expandedIdsRef.current = new Set();
    if (width > 0) {
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [idsKey, width]);

  useEffect(() => {
    if (announcements.length <= 1 || width === 0) return;
    const id = setInterval(() => {
      if (Date.now() < pausedUntilRef.current) return;
      if (expandedIdsRef.current.size > 0) return;
      const next = (activeIdxRef.current + 1) % announcements.length;
      setActiveIdx(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    }, AUTO_INTERVAL_MS);
    return () => clearInterval(id);
  }, [announcements.length, width]);

  const handleExpandedChange = useCallback((id: string, expanded: boolean) => {
    if (expanded) {
      expandedIdsRef.current.add(id);
    } else {
      expandedIdsRef.current.delete(id);
    }
  }, []);

  if (announcements.length === 0) return null;

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIdx(idx);
    pausedUntilRef.current = Date.now() + RESUME_DELAY_MS;
  };

  return (
    <Animated.View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ marginHorizontal: 24, marginTop: 14 }}
      layout={LinearTransition.duration(180)}
    >
      {width > 0 && (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumEnd}
            scrollEnabled={announcements.length > 1}
          >
            {announcements.map((a) => (
              <AnnouncementCard
                key={a.id}
                announcement={a}
                width={width}
                isDark={isDark}
                onExpandedChange={handleExpandedChange}
              />
            ))}
          </ScrollView>
          {announcements.length > 1 && (
            <DotIndicator
              count={announcements.length}
              activeIdx={activeIdx}
              isDark={isDark}
            />
          )}
        </>
      )}
    </Animated.View>
  );
}

function AnnouncementCard({
  announcement,
  width,
  isDark,
  onExpandedChange,
}: {
  announcement: Announcement;
  width: number;
  isDark: boolean;
  onExpandedChange: (id: string, expanded: boolean) => void;
}) {
  const router = useRouter();
  const haptic = useHaptics();
  const dismiss = useAnnouncementStore((s) => s.dismiss);
  const [expanded, setExpanded] = useState(false);

  const typeStyle = TYPE_STYLES[announcement.type];
  const hasBody = !!announcement.body;
  const hasLink = announcement.link !== null;

  useEffect(() => {
    onExpandedChange(announcement.id, expanded);
    return () => onExpandedChange(announcement.id, false);
  }, [announcement.id, expanded, onExpandedChange]);

  const triggerLink = () => {
    const link = announcement.link;
    if (!link) return;
    haptic();
    if (link.kind === "internal") {
      router.push(link.url as never);
    } else {
      Linking.openURL(link.url).catch(() => {});
    }
  };

  const handleCardPress = () => {
    if (hasBody) {
      haptic();
      setExpanded((v) => !v);
    } else if (hasLink) {
      triggerLink();
    }
  };

  const handleDismiss = () => {
    haptic();
    dismiss(announcement.id);
  };

  const trailingIcon: React.ComponentProps<typeof Ionicons>["name"] | null =
    hasBody
      ? expanded
        ? "chevron-up"
        : "chevron-down"
      : hasLink
        ? "chevron-forward"
        : null;

  const cardInner = (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 12,
        backgroundColor: isDark
          ? "rgba(255,255,255,0.04)"
          : "rgba(0,0,0,0.025)",
        overflow: "hidden",
      }}
    >
      <View style={{ width: 3, backgroundColor: typeStyle.color }} />
      <View
        style={{
          flex: 1,
          paddingVertical: 10,
          paddingLeft: 10,
          paddingRight: announcement.dismissible ? 32 : 12,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <Ionicons
          name={typeStyle.icon}
          size={16}
          color={typeStyle.color}
          style={{ marginTop: 1 }}
        />
        <Animated.View
          style={{ flex: 1 }}
          layout={LinearTransition.duration(180)}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: isDark ? "#f5f5f5" : "#1c1c1e",
            }}
            numberOfLines={1}
          >
            {announcement.title}
          </Text>
          {announcement.body ? (
            <Text
              style={{
                fontSize: 12,
                marginTop: 2,
                lineHeight: 18,
                color: isDark ? "#a3a3a3" : "#737373",
              }}
              numberOfLines={expanded ? undefined : 1}
            >
              {announcement.body}
            </Text>
          ) : null}
          {expanded && hasLink ? (
            <Pressable
              onPress={triggerLink}
              hitSlop={4}
              style={({ pressed }) => ({
                alignSelf: "flex-start",
                marginTop: 8,
                opacity: pressed ? 0.5 : 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
              })}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: typeStyle.color,
                }}
              >
                查看详情
              </Text>
              <Ionicons
                name="chevron-forward"
                size={12}
                color={typeStyle.color}
              />
            </Pressable>
          ) : null}
        </Animated.View>
        {trailingIcon ? (
          <Ionicons
            name={trailingIcon}
            size={14}
            color={isDark ? "#525252" : "#a3a3a3"}
            style={{ marginTop: 2 }}
          />
        ) : null}
      </View>
    </View>
  );

  return (
    <Animated.View style={{ width }} layout={LinearTransition.duration(180)}>
      <View style={{ position: "relative" }}>
        <Pressable
          onPress={handleCardPress}
          disabled={!hasBody && !hasLink}
          style={({ pressed }) => ({
            opacity: pressed && (hasBody || hasLink) ? 0.7 : 1,
          })}
        >
          {cardInner}
        </Pressable>
        {announcement.dismissible && (
          <Pressable
            onPress={handleDismiss}
            hitSlop={6}
            style={({ pressed }) => ({
              position: "absolute",
              top: 0,
              right: 0,
              paddingVertical: 10,
              paddingHorizontal: 10,
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Ionicons
              name="close"
              size={14}
              color={isDark ? "#525252" : "#a3a3a3"}
            />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

function DotIndicator({
  count,
  activeIdx,
  isDark,
}: {
  count: number;
  activeIdx: number;
  isDark: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 4,
        justifyContent: "center",
        marginTop: 8,
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const active = i === activeIdx;
        return (
          <View
            key={i}
            style={{
              width: active ? 12 : 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: active
                ? isDark
                  ? "rgba(59,130,246,0.7)"
                  : "#3b82f6"
                : isDark
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(0,0,0,0.12)",
            }}
          />
        );
      })}
    </View>
  );
}
