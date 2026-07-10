import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
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

export function UserHeroArtwork({
  idPrefix,
  style,
}: Readonly<{ idPrefix: string; style?: StyleProp<ViewStyle> }>) {
  const maskRadialId = `${idPrefix}-mask-radial`;
  const shape1Id = `${idPrefix}-shape-1`;
  const shape2Id = `${idPrefix}-shape-2`;
  const alphaMaskId = `${idPrefix}-alpha-mask`;

  return (
    <View pointerEvents="none" style={style}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 375 224"
        preserveAspectRatio="xMidYMid meet"
      >
        <Defs>
          <RadialGradient
            id={maskRadialId}
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
            id={shape1Id}
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
            id={shape2Id}
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
            id={alphaMaskId}
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
              fill={`url(#${maskRadialId})`}
              fillOpacity="0.9"
            />
          </Mask>
        </Defs>
        <G opacity={0.6}>
          <G mask={`url(#${alphaMaskId})`}>
            <Path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M242.188 270.156H211.312L273.062 208.406L211.312 146.656L334.812 23.1562H365.688L303.938 84.9062L365.688 146.656L242.188 270.156ZM334.812 146.656L288.5 100.344L242.188 146.656L288.5 192.969L334.812 146.656Z"
              fill={`url(#${shape1Id})`}
            />
            <Path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M165 146.656L311.656 0L342.531 0L365.688 23.1562H334.812L311.656 46.3125L412 146.656L265.344 293.312H234.469L211.312 270.156H242.188L265.344 247L165 146.656ZM365.688 146.656L288.5 69.4688L211.312 146.656L288.5 223.844L365.688 146.656Z"
              fill={`url(#${shape2Id})`}
            />
          </G>
        </G>
      </Svg>
    </View>
  );
}
