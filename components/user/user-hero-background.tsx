import { LinearGradient } from "expo-linear-gradient";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet } from "react-native";

import { UserHeroArtwork } from "@/components/user/user-hero-artwork";

const USER_HERO_GRADIENT = {
  light: ["#5AA0F0", "#6F7AF5"] as const,
  dark: ["#2A3A7A", "#3A3675"] as const,
};

export function UserHeroBackground({
  artworkStyle,
  idPrefix,
  isDark,
}: Readonly<{
  artworkStyle: StyleProp<ViewStyle>;
  idPrefix: string;
  isDark: boolean;
}>) {
  return (
    <>
      <LinearGradient
        colors={isDark ? USER_HERO_GRADIENT.dark : USER_HERO_GRADIENT.light}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <UserHeroArtwork idPrefix={idPrefix} style={artworkStyle} />
    </>
  );
}
