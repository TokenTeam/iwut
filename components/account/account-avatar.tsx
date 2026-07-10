import { Image } from "expo-image";
import { View } from "react-native";

const defaultAvatar = require("@/assets/images/default-avatar.png");

export function AccountAvatar({
  size = 64,
  uri,
}: Readonly<{
  size?: number;
  uri?: string;
}>) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.18)",
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.3)",
      }}
    >
      <Image
        contentFit="cover"
        placeholder={defaultAvatar}
        source={uri ? { uri } : defaultAvatar}
        style={{ width: "100%", height: "100%" }}
        transition={150}
      />
    </View>
  );
}
