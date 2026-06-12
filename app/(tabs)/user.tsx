import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaskedView from "@react-native-masked-view/masked-view";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, {
  Defs,
  G,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";

import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { MenuGroup, MenuItem } from "@/components/ui/menu-item";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";
import { useT } from "@/lib/i18n";
import { reportError } from "@/lib/report";
import { useUserBindStore } from "@/store/user-bind";

const HEADER_GRADIENT = {
  light: ["#5aa0f0", "#6f7af5"] as const,
  dark: ["#2a3a7a", "#3a3675"] as const,
};

const MASK_COLORS = ["#000000", "#000000", "rgba(0,0,0,0)"] as const;
const MASK_LOCATIONS = [0, 0.6, 1] as const;

const HERO_PADDING_TOP = 40;
const HERO_PADDING_BOTTOM = 100;
const MENU_PULL_UP = 60;

const defaultAvatar = require("@/assets/images/default-avatar.png");

function HeaderSection({
  isDark,
  children,
}: {
  isDark: boolean;
  children: ReactNode;
}) {
  return (
    <MaskedView
      style={styles.header}
      maskElement={
        <LinearGradient
          colors={MASK_COLORS}
          locations={MASK_LOCATIONS}
          style={StyleSheet.absoluteFill}
        />
      }
    >
      <LinearGradient
        colors={isDark ? HEADER_GRADIENT.dark : HEADER_GRADIENT.light}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.svgWrap} pointerEvents="none">
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 375 224"
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            <RadialGradient
              id="maskRadial"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(365 224) rotate(-140.338) scale(254.602 199.44)"
            >
              <Stop offset="0" stopColor="#6371FF" stopOpacity="1" />
              <Stop offset="1" stopColor="#0085FF" stopOpacity="0" />
            </RadialGradient>
            <SvgLinearGradient
              id="shape1"
              x1="407.5"
              y1="-34"
              x2="211"
              y2="270"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#CBE9FF" stopOpacity="0" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="1" />
            </SvgLinearGradient>
            <SvgLinearGradient
              id="shape2"
              x1="379.5"
              y1="-10.5"
              x2="242"
              y2="281.5"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="1" stopColor="#96C5FF" stopOpacity="0.29" />
            </SvgLinearGradient>
            <Mask
              id="alphaMask"
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="375"
              height="224"
              maskType="alpha"
            >
              <Rect
                width="375"
                height="224"
                fill="url(#maskRadial)"
                fillOpacity="0.9"
              />
            </Mask>
          </Defs>
          <G opacity={0.6}>
            <G mask="url(#alphaMask)">
              <Path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M242.188 270.156H211.312L273.062 208.406L211.312 146.656L334.812 23.1562H365.688L303.938 84.9062L365.688 146.656L242.188 270.156ZM334.812 146.656L288.5 100.344L242.188 146.656L288.5 192.969L334.812 146.656Z"
                fill="url(#shape1)"
              />
              <Path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M165 146.656L311.656 0L342.531 0L365.688 23.1562H334.812L311.656 46.3125L412 146.656L265.344 293.312H234.469L211.312 270.156H242.188L265.344 247L165 146.656ZM365.688 146.656L288.5 69.4688L211.312 146.656L288.5 223.844L365.688 146.656Z"
                fill="url(#shape2)"
              />
            </G>
          </G>
        </Svg>
      </View>
      <SafeAreaView edges={["top"]}>{children}</SafeAreaView>
    </MaskedView>
  );
}

const AVATAR_SIZE = 64;

const styles = StyleSheet.create({
  header: {
    overflow: "hidden",
  },
  svgWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    aspectRatio: 375 / 224,
  },
  heroPadding: {
    paddingTop: HERO_PADDING_TOP,
    paddingBottom: HERO_PADDING_BOTTOM,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 4,
  },
  heroBody: {
    flex: 1,
    marginLeft: 16,
    height: AVATAR_SIZE,
    justifyContent: "center",
  },
  avatarRing: {
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  heroName: {
    fontSize: 19,
    fontWeight: "700",
    color: "#ffffff",
  },
  heroMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
  },
  heroSubtle: {
    marginTop: 2,
    fontSize: 13,
    color: "rgba(255,255,255,0.82)",
    fontVariant: ["tabular-nums"],
  },
  logoutBtn: {
    height: 32,
    width: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  scrollView: {
    marginTop: -MENU_PULL_UP,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 32,
  },
});

function UnboundHero() {
  const t = useT();
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [styles.heroRow, { opacity: pressed ? 0.8 : 1 }]}
      onPress={() => router.push("/browser/bind")}
    >
      <View style={styles.avatarRing}>
        <MaterialIcons name="person-add" size={32} color="#ffffff" />
      </View>
      <View style={styles.heroBody}>
        <Text style={styles.heroName} numberOfLines={1}>
          {t("user.bindTitle")}
        </Text>
        <Text style={styles.heroMeta} numberOfLines={1}>
          {t("user.bindSubtitle")}
        </Text>
      </View>
      <MaterialIcons
        name="chevron-right"
        size={22}
        color="rgba(255,255,255,0.85)"
      />
    </Pressable>
  );
}

function BoundHero() {
  const t = useT();
  const studentId = useUserBindStore((s) => s.studentId);
  const studentName = useUserBindStore((s) => s.studentName);
  const college = useUserBindStore((s) => s.college);
  const eduLevel = useUserBindStore((s) => s.eduLevel);
  const unbind = useUserBindStore((s) => s.unbind);
  const [unbindVisible, setUnbindVisible] = useState(false);

  const meta = [eduLevel, college].filter(Boolean).join(" · ");

  return (
    <>
      <View style={styles.heroRow}>
        <View style={styles.avatarRing}>
          <Image
            source={defaultAvatar}
            style={styles.avatarImage}
            contentFit="cover"
          />
        </View>
        <View style={styles.heroBody}>
          <Text style={styles.heroName} numberOfLines={1}>
            {studentName}
          </Text>
          {meta ? (
            <Text style={styles.heroMeta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          <Text style={styles.heroSubtle} numberOfLines={1}>
            {studentId}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() => setUnbindVisible(true)}
          hitSlop={10}
        >
          <MaterialIcons name="logout" size={15} color="#ffffff" />
        </Pressable>
      </View>
      <ConfirmSheet
        visible={unbindVisible}
        onClose={() => setUnbindVisible(false)}
        title={t("user.unbindTitle")}
        description={t("user.unbindDesc")}
        confirmText={t("user.unbind")}
        destructive
        onConfirm={() => {
          unbind().catch((e) => reportError(e, { module: "user-bind" }));
          setUnbindVisible(false);
        }}
      />
    </>
  );
}

function UserHero() {
  const isBound = useUserBindStore((s) => s.isBound);
  return isBound ? <BoundHero /> : <UnboundHero />;
}

export default function UserScreen() {
  useMarkRouteInteractive();
  const t = useT();
  const isDark = useColorScheme() === "dark";
  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
      <HeaderSection isDark={isDark}>
        <View style={styles.heroPadding}>
          <UserHero />
        </View>
      </HeaderSection>

      <ScrollView
        className="flex-1"
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4">
          <MenuGroup title={t("user.menuTools")}>
            <MenuItem
              icon="wifi"
              iconBg="#007AFF"
              label={t("user.menuWlan")}
              href="/user/wlan"
            />
          </MenuGroup>
          <MenuGroup title={t("user.menuSettings")}>
            <MenuItem
              icon="settings"
              iconBg="#8E8E93"
              label={t("user.menuGeneral")}
              href="/settings"
            />
            <MenuItem
              icon="palette"
              iconBg="#5856D6"
              label={t("user.menuAppearance")}
              href="/settings/appearance"
            />
            <MenuItem
              icon="calendar-today"
              iconBg="#34C759"
              label={t("user.menuSchedule")}
              href="/settings/calendar"
            />
          </MenuGroup>
          <MenuGroup title={t("user.menuOther")}>
            <MenuItem
              icon="info"
              iconBg="#007AFF"
              label={t("user.menuAbout")}
              href="/about"
            />
          </MenuGroup>
        </View>
      </ScrollView>
    </View>
  );
}
