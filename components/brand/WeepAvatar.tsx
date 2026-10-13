// Mascot
import { Image, ImageStyle, StyleProp } from "react-native";

const WEEP = require("../../assets/images/weep-avatar.png");

export default function WeepAvatar({ size, style }: { size: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={WEEP}
      accessibilityLabel="Weep"
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
    />
  );
}
