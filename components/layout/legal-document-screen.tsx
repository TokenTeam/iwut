import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, ScrollView } from "react-native";
import Markdown from "react-native-markdown-renderer";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMarkRouteInteractive } from "@/hooks/use-mark-route-interactive";

export function LegalDocumentScreen({
  title,
  markdownAsset,
}: Readonly<{
  title: string;
  markdownAsset: number;
}>) {
  useMarkRouteInteractive();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const [markdown, setMarkdown] = useState("");

  useEffect(() => {
    let active = true;

    readMarkdownAsset(markdownAsset)
      .then((content) => {
        if (active) setMarkdown(content);
      })
      .catch(() => {
        if (active) setMarkdown("");
      });

    return () => {
      active = false;
    };
  }, [markdownAsset]);

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView
        className="flex-1 bg-neutral-100 dark:bg-neutral-900"
        contentContainerClassName="px-4 py-4"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator
      >
        <Markdown
          style={isDark ? DARK_MARKDOWN_STYLES : LIGHT_MARKDOWN_STYLES}
          onLinkPress={(url) => {
            Linking.openURL(url).catch(() => {});
          }}
        >
          {markdown}
        </Markdown>
      </ScrollView>
    </>
  );
}

async function readMarkdownAsset(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();

  const uri = asset.localUri ?? asset.uri;
  if (/^https?:\/\//.test(uri)) {
    const response = await fetch(uri);
    return response.text();
  }

  return new File(uri).text();
}

function buildMarkdownStyles(isDark: boolean) {
  const fg = isDark ? "#e5e5e5" : "#404040";
  const mutedFg = isDark ? "#a3a3a3" : "#737373";
  const headingFg = isDark ? "#fafafa" : "#171717";
  const codeBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const codeFg = isDark ? "#fca5a5" : "#dc2626";
  const linkFg = isDark ? "#60a5fa" : "#2563eb";
  const ruleColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const borderColor = isDark ? "#404040" : "#e5e5e5";

  const body = { fontSize: 14, lineHeight: 22, color: fg };
  const heading = { color: headingFg, fontWeight: "700" as const };

  return {
    body: {
      ...body,
      paddingHorizontal: 2,
      paddingVertical: 2,
    },
    text: body,
    paragraph: { marginTop: 0, marginBottom: 10 },
    heading1: {
      ...heading,
      fontSize: 22,
      lineHeight: 30,
      marginTop: 0,
      marginBottom: 12,
    },
    heading2: {
      ...heading,
      fontSize: 18,
      lineHeight: 26,
      marginTop: 16,
      marginBottom: 8,
    },
    heading3: {
      ...heading,
      fontSize: 16,
      lineHeight: 24,
      marginTop: 12,
      marginBottom: 6,
    },
    heading4: { ...heading, fontSize: 15, marginTop: 10, marginBottom: 4 },
    heading5: { ...heading, fontSize: 14, marginTop: 8, marginBottom: 4 },
    heading6: {
      ...heading,
      color: mutedFg,
      fontSize: 14,
      marginTop: 8,
      marginBottom: 4,
    },
    strong: { fontWeight: "700" as const, color: headingFg },
    em: { fontStyle: "italic" as const },
    list: { marginBottom: 8 },
    listItem: { flex: 1, flexWrap: "wrap" as const },
    list_item: { marginBottom: 6 },
    bullet_list: { marginTop: 0, marginBottom: 8 },
    ordered_list: { marginTop: 0, marginBottom: 8 },
    bullet_list_icon: { color: mutedFg, marginRight: 8, lineHeight: 22 },
    ordered_list_icon: { color: mutedFg, marginRight: 8, lineHeight: 22 },
    listUnorderedItem: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      marginTop: 4,
    },
    listUnorderedItemIcon: {
      color: mutedFg,
      marginLeft: 0,
      marginRight: 8,
      lineHeight: 22,
    },
    listOrderedItem: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      marginTop: 4,
    },
    listOrderedItemIcon: {
      color: mutedFg,
      marginLeft: 0,
      marginRight: 8,
      lineHeight: 22,
    },
    listOrderedItemText: body,
    listUnorderedItemText: body,
    code_inline: {
      backgroundColor: codeBg,
      color: codeFg,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      fontSize: 13,
    },
    code_block: {
      backgroundColor: codeBg,
      color: fg,
      padding: 10,
      borderRadius: 8,
      fontSize: 13,
      lineHeight: 20,
      marginVertical: 6,
    },
    fence: {
      backgroundColor: codeBg,
      color: fg,
      padding: 10,
      borderRadius: 8,
      fontSize: 13,
      lineHeight: 20,
      marginVertical: 6,
    },
    blockquote: {
      backgroundColor: codeBg,
      borderLeftColor: mutedFg,
      borderLeftWidth: 3,
      paddingLeft: 10,
      paddingVertical: 6,
      marginVertical: 8,
    },
    table: {
      borderWidth: 1,
      borderColor,
      marginVertical: 8,
    },
    thead: { backgroundColor: codeBg },
    th: { padding: 6, borderColor, borderWidth: 1 },
    tr: { borderColor, borderBottomWidth: 1 },
    td: { padding: 6, borderColor, borderWidth: 1 },
    tableHeader: { backgroundColor: codeBg },
    tableHeaderCell: {
      flex: 1,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor,
      color: headingFg,
      fontWeight: "700" as const,
    },
    tableRow: {
      flexDirection: "row" as const,
      borderBottomWidth: 1,
      borderColor,
    },
    tableRowCell: {
      flex: 1,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor,
      color: fg,
    },
    link: { color: linkFg },
    hr: { backgroundColor: ruleColor, height: 1, marginVertical: 12 },
  };
}

const LIGHT_MARKDOWN_STYLES = buildMarkdownStyles(false);
const DARK_MARKDOWN_STYLES = buildMarkdownStyles(true);
