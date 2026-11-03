import type { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import type { ComponentProps } from "react";

import type { TKey } from "@/lib/i18n";

export type WebApp = {
  icon: ComponentProps<typeof Ionicons>["name"];
  labelKey: TKey;
  color: string;
  route?: Href;
  uri?: string;
  lan?: boolean;
  filter?: FilterRule;
};

export type Section = {
  titleKey: TKey;
  items: WebApp[];
};

export type FilterUser = {
  isBound: boolean;
  studentId: string;
  college: string;
  eduLevel: string;
  cardId: string;
};

export type UserMatch = {
  studentIds?: readonly string[];
  studentIdPrefixes?: readonly string[];
  colleges?: readonly string[];
  eduLevels?: readonly string[];
  hasCardId?: boolean;
};

export type FilterRule = {
  requireBound?: boolean;
  allow?: readonly UserMatch[];
  deny?: readonly UserMatch[];
};
