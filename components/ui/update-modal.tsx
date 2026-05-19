import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Markdown from "react-native-markdown-renderer";
import Toast from "react-native-toast-message";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHaptics } from "@/hooks/use-haptics";
import { getResolvedLang, useT } from "@/lib/i18n";
import {
  getCurrentChannel,
  resolveLocalizedString,
  resolveLocalizedStringArray,
  type Release,
} from "@/services/update-config";
import { REQUIRED_MAX_DISMISS, useUpdateStore } from "@/store/update";

const FALLBACK_IOS_URL = "itms-apps://apps.apple.com/cn/app/id6761684977";

const MODAL_SHADOW = {
  shadowColor: "#000",
  shadowOpacity: 0.18,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 12,
} as const;

const CONTENT_PADDING = { paddingHorizontal: 20, paddingBottom: 4 } as const;
const CHANGELOG_SCROLL_STYLE = { maxHeight: 220 } as const;
const CHANGELOG_CONTAINER_STYLE = { padding: 12 } as const;

function buildFallbackAndroidUrl(version: string): string {
  return `https://download.tokenteam.dev/iwut/${version}/${getCurrentChannel()}.apk`;
}

function formatReleasedAt(
  iso: string | null,
  lang: "zh" | "en",
): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return lang === "zh"
    ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    : d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export function UpdateModal() {
  const t = useT();
  const lang = getResolvedLang();
  const haptic = useHaptics();
  const isDark = useColorScheme() === "dark";

  // IMPORTANT: subscribe to primitive / stable-reference fields one by one.
  // Returning a freshly-allocated object from a selector causes zustand's
  // default `Object.is` equality check to always miss → React's getSnapshot
  // warning → infinite re-render loop. Derive composites locally instead.
  const modalOpen = useUpdateStore((s) => s.modalOpen);
  const hasUpdate = useUpdateStore((s) => s.hasUpdate);
  const level = useUpdateStore((s) => s.level);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const applicableReleases = useUpdateStore((s) => s.applicableReleases);
  const reason = useUpdateStore((s) => s.reason);
  const downloadUrl = useUpdateStore((s) => s.downloadUrl);
  const blockedByMinVersion = useUpdateStore((s) => s.blockedByMinVersion);
  const requiredDismissVersion = useUpdateStore(
    (s) => s.requiredDismiss?.version ?? null,
  );
  const requiredDismissCount = useUpdateStore(
    (s) => s.requiredDismiss?.count ?? 0,
  );
  const closeModal = useUpdateStore((s) => s.closeModal);

  const [showChangelog, setShowChangelog] = useState(false);
  // Collapse the changelog when the targeted release changes — a user who
  // expanded v1.4.0's log shouldn't see v1.5.0 auto-expanded after a refresh.
  // This "adjust state during render" pattern is React's recommended
  // alternative to a setState-in-effect (which triggers cascading renders):
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevLatestVersion, setPrevLatestVersion] = useState(latestVersion);
  if (prevLatestVersion !== latestVersion) {
    setPrevLatestVersion(latestVersion);
    setShowChangelog(false);
  }

  if (!modalOpen || !hasUpdate || !latestVersion) return null;

  const isRequired = level === "required";
  const dismissCount =
    requiredDismissVersion === latestVersion ? requiredDismissCount : 0;
  const remaining = isRequired
    ? Math.max(0, REQUIRED_MAX_DISMISS - dismissCount)
    : REQUIRED_MAX_DISMISS;
  const hardBlock = blockedByMinVersion || (isRequired && remaining === 0);

  const primaryRelease: Release | undefined = applicableReleases[0];
  const titleStr =
    resolveLocalizedString(primaryRelease?.title ?? null, lang) ??
    t("update.modalTitleDefault", { v: latestVersion });
  const releasedAt = formatReleasedAt(primaryRelease?.releasedAt ?? null, lang);
  const reasonStr = resolveLocalizedString(reason, lang);

  // Aggregate highlights & changelog from every applicable release so users
  // skipping multiple versions still see the cumulative What's New list.
  const showVersionHeading = applicableReleases.length > 1;
  const highlights = applicableReleases.flatMap((r) =>
    resolveLocalizedStringArray(r.highlights, lang),
  );
  const changelog = applicableReleases
    .map((r) => {
      const body = resolveLocalizedString(r.changelog, lang);
      if (!body) return null;
      return showVersionHeading ? `## v${r.version}\n\n${body}` : body;
    })
    .filter((s): s is string => s !== null)
    .join("\n\n");
  const hasHighlights = highlights.length > 0;
  const hasChangelog = changelog.length > 0;
  const showEmptyHint = !hasHighlights && !hasChangelog && !reasonStr;

  // Single source of truth for the red footer text — collapses two adjacent
  // ternary blocks rendering the same <Text> styling with different copy.
  const bottomHint = hardBlock
    ? blockedByMinVersion
      ? t("update.hardBlockDesc", { v: latestVersion })
      : t("update.requiredExhausted")
    : isRequired
      ? t("update.requiredRemaining", { n: remaining })
      : null;

  const handleClose = () => {
    if (hardBlock) return;
    haptic();
    setShowChangelog(false);
    closeModal();
  };

  const handleUpdate = () => {
    haptic();
    const url =
      Platform.OS === "ios"
        ? (downloadUrl?.ios ?? FALLBACK_IOS_URL)
        : (downloadUrl?.android ?? buildFallbackAndroidUrl(latestVersion));
    Linking.openURL(url).catch(() => {
      Toast.show({
        type: "error",
        text1: t("update.downloadFailed"),
        position: "bottom",
      });
    });
  };

  return (
    <Modal
      visible={modalOpen}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <Pressable
          className="absolute inset-0"
          onPress={hardBlock ? undefined : handleClose}
        />
        <View
          className="w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-neutral-800"
          style={MODAL_SHADOW}
        >
          <Header
            title={titleStr}
            version={latestVersion}
            releasedAt={releasedAt}
            isRequired={isRequired}
            requiredBadge={t("update.requiredBadge")}
          />

          <View style={CONTENT_PADDING}>
            {hasHighlights ? (
              <View className="mt-1">
                <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t("update.highlightsTitle")}
                </Text>
                <View className="gap-1.5">
                  {highlights.map((h, i) => (
                    <View key={i} className="flex-row gap-2">
                      <Text className="text-sm leading-5 text-neutral-500 dark:text-neutral-400">
                        •
                      </Text>
                      <Text className="flex-1 text-sm leading-5 text-neutral-700 dark:text-neutral-200">
                        {h}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {isRequired && reasonStr ? (
              <View
                className={`${hasHighlights ? "mt-4" : "mt-1"} rounded-xl bg-red-50 p-3 dark:bg-red-950/40`}
              >
                <Text className="mb-1 text-xs font-semibold text-red-600 dark:text-red-300">
                  {t("update.requiredReasonTitle")}
                </Text>
                <Text className="text-sm leading-5 text-red-700 dark:text-red-200">
                  {reasonStr}
                </Text>
              </View>
            ) : null}

            {hasChangelog ? (
              <Pressable
                onPress={() => {
                  haptic();
                  setShowChangelog((v) => !v);
                }}
                className="mt-4 flex-row items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-700"
              >
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t("update.viewFullChangelog")}
                </Text>
                <Ionicons
                  name={showChangelog ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={isDark ? "#a3a3a3" : "#737373"}
                />
              </Pressable>
            ) : null}

            {showChangelog && hasChangelog ? (
              <ChangelogBlock content={changelog} isDark={isDark} />
            ) : null}

            {showEmptyHint ? (
              <Text className="mb-2 mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {t("update.newVersionTipNoChangelog", { v: latestVersion })}
              </Text>
            ) : null}
          </View>

          <View className="px-5 pb-5 pt-3">
            <View className="flex-row gap-3">
              {!hardBlock ? (
                <Pressable
                  onPress={handleClose}
                  className="flex-1 items-center rounded-xl bg-neutral-100 py-3 active:bg-neutral-200 dark:bg-neutral-700 dark:active:bg-neutral-600"
                >
                  <Text className="text-base font-medium text-neutral-700 dark:text-neutral-200">
                    {t("update.actionLater")}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={handleUpdate}
                className={`flex-1 items-center rounded-xl py-3 ${
                  isRequired
                    ? "bg-red-500 active:bg-red-600"
                    : "bg-blue-500 active:bg-blue-600"
                }`}
              >
                <Text className="text-base font-semibold text-white">
                  {t("update.actionUpdate")}
                </Text>
              </Pressable>
            </View>

            {bottomHint ? (
              <Text className="mt-3 text-center text-xs text-red-500 dark:text-red-400">
                {bottomHint}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Header({
  title,
  version,
  releasedAt,
  isRequired,
  requiredBadge,
}: {
  title: string;
  version: string;
  releasedAt: string | null;
  isRequired: boolean;
  requiredBadge: string;
}) {
  return (
    <View className="flex-row items-center gap-3 border-b border-neutral-100 px-5 pb-4 pt-5 dark:border-neutral-700">
      <View
        className={`h-12 w-12 items-center justify-center rounded-full ${
          isRequired ? "bg-red-500" : "bg-blue-500"
        }`}
      >
        <Ionicons name="arrow-up" size={22} color="#fff" />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            className="flex-shrink text-lg font-semibold text-neutral-900 dark:text-neutral-100"
            numberOfLines={1}
          >
            {title}
          </Text>
          {isRequired ? (
            <View className="rounded-full bg-red-100 px-2 py-0.5 dark:bg-red-900/60">
              <Text className="text-[11px] font-semibold text-red-600 dark:text-red-300">
                {requiredBadge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
          {`v${version}${releasedAt ? ` · ${releasedAt}` : ""}`}
        </Text>
      </View>
    </View>
  );
}

function ChangelogBlock({
  content,
  isDark,
}: {
  content: string;
  isDark: boolean;
}) {
  return (
    <View className="mt-2 overflow-hidden rounded-xl bg-neutral-50 dark:bg-neutral-900/50">
      <ScrollView
        style={CHANGELOG_SCROLL_STYLE}
        contentContainerStyle={CHANGELOG_CONTAINER_STYLE}
        showsVerticalScrollIndicator
      >
        <Markdown
          style={isDark ? DARK_MARKDOWN_STYLES : LIGHT_MARKDOWN_STYLES}
          onLinkPress={(url) => {
            Linking.openURL(url).catch(() => {});
          }}
        >
          {content}
        </Markdown>
      </ScrollView>
    </View>
  );
}

// Compact mobile-friendly markdown theme. Sizing aligns with the surrounding
// modal copy (text-sm = 14, leading-5 = 20). Headings are only +1px so the
// changelog reads like body text with light emphasis rather than a fully
// nested document.
function buildMarkdownStyles(isDark: boolean) {
  const fg = isDark ? "#e5e5e5" : "#404040";
  const mutedFg = isDark ? "#a3a3a3" : "#737373";
  const headingFg = isDark ? "#fafafa" : "#171717";
  const codeBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  const codeFg = isDark ? "#fca5a5" : "#dc2626";
  const linkFg = isDark ? "#60a5fa" : "#2563eb";
  const ruleColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  // Body / headings use a *single-step* type scale: same 12.5px size, only
  // weight separates levels. Keeps the changelog visually flat and
  // proportional to the surrounding 14px modal copy, which the user reads
  // first. Avoids the "huge heading dwarfs the bullet next to it" effect.
  const body = { fontSize: 12.5, lineHeight: 16, color: fg };
  const heading = { ...body, color: headingFg, fontWeight: "600" as const };

  return {
    body,
    // `text` is the lib's catch-all key for INLINE text inside any block.
    // Without this, body.fontSize only affects the wrapping View and inline
    // <Text> falls back to RN's ~14px default — making body look bigger than
    // headings whose fontSize we set explicitly.
    text: body,
    paragraph: { marginTop: 0, marginBottom: 0 },
    heading1: { ...heading, fontSize: 13, marginTop: 0, marginBottom: 0 },
    heading2: { ...heading, marginTop: 2, marginBottom: 0 },
    heading3: { ...heading, marginTop: 1, marginBottom: 0 },
    heading4: { ...heading, marginTop: 1, marginBottom: 0 },
    heading5: { ...heading, marginTop: 1, marginBottom: 0 },
    heading6: { ...heading, color: mutedFg, marginTop: 1, marginBottom: 0 },
    strong: { fontWeight: "600" as const, color: headingFg },
    em: { fontStyle: "italic" as const },
    s: { textDecorationLine: "line-through" as const },
    list_item: { marginBottom: 0 },
    bullet_list: { marginTop: 0, marginBottom: 0 },
    ordered_list: { marginTop: 0, marginBottom: 0 },
    bullet_list_icon: { color: mutedFg, marginRight: 6, lineHeight: 16 },
    ordered_list_icon: { color: mutedFg, marginRight: 6, lineHeight: 16 },
    code_inline: {
      backgroundColor: codeBg,
      color: codeFg,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      fontSize: 11.5,
    },
    code_block: {
      backgroundColor: codeBg,
      color: fg,
      padding: 6,
      borderRadius: 6,
      fontSize: 11.5,
      lineHeight: 15,
      marginVertical: 2,
    },
    fence: {
      backgroundColor: codeBg,
      color: fg,
      padding: 6,
      borderRadius: 6,
      fontSize: 11.5,
      lineHeight: 15,
      marginVertical: 2,
    },
    blockquote: {
      backgroundColor: codeBg,
      borderLeftColor: mutedFg,
      borderLeftWidth: 3,
      paddingLeft: 6,
      paddingVertical: 2,
      marginVertical: 2,
    },
    link: { color: linkFg },
    hr: { backgroundColor: ruleColor, height: 1, marginVertical: 3 },
  };
}

// Pre-build both themes once at module load — the styles never depend on
// runtime state, so re-deriving them per render is pure waste.
const LIGHT_MARKDOWN_STYLES = buildMarkdownStyles(false);
const DARK_MARKDOWN_STYLES = buildMarkdownStyles(true);
