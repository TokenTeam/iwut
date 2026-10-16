import { Highlight as PrismHighlight, themes } from "prism-react-renderer";
import { Fragment, memo } from "react";
import {
  Text,
  type TextProps,
  type TextStyle,
  useColorScheme,
} from "react-native";

type HighlightProps = Omit<TextProps, "children"> & {
  text: string;
  language: string;
};

export const Highlight = memo(function Highlight({
  text,
  language,
  style,
  ...props
}: HighlightProps) {
  const theme = useColorScheme() === "dark" ? themes.vsDark : themes.vsLight;

  return (
    <PrismHighlight code={text} language={language} theme={theme}>
      {({ tokens, getTokenProps }) => (
        <Text {...props} style={[{ color: theme.plain.color }, style]}>
          {tokens.map((line, lineIndex) => (
            <Fragment key={lineIndex}>
              {lineIndex > 0 ? "\n" : null}
              {line.map((token, tokenIndex) => {
                const tokenStyle = getTokenProps({ token }).style;
                // 仅传递原生文本支持的主题属性，不引入网页布局样式
                const nativeStyle: TextStyle = {
                  color: tokenStyle?.color,
                  fontStyle:
                    tokenStyle?.fontStyle === "italic" ? "italic" : "normal",
                  fontWeight:
                    tokenStyle?.fontWeight === "bold" ? "bold" : "normal",
                  opacity:
                    typeof tokenStyle?.opacity === "number"
                      ? tokenStyle.opacity
                      : undefined,
                };
                return (
                  <Text key={tokenIndex} style={nativeStyle}>
                    {token.empty ? "" : token.content}
                  </Text>
                );
              })}
            </Fragment>
          ))}
        </Text>
      )}
    </PrismHighlight>
  );
});
