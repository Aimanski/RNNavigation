// Branding
import { Image, ImageStyle, StyleProp } from "react-native";
import { useTheme } from "../../providers/ThemeProvider";

const MARK = require("../../assets/images/logo-mark.png");
const FULL_LIGHT = require("../../assets/images/logo-full-light.png");
const FULL_DARK = require("../../assets/images/logo-full-dark.png");

type Props = {
  variant?: "mark" | "full";
  /* Props */
  width: number;
  style?: StyleProp<ImageStyle>;
};

export default function BrandLogo({ variant = "full", width, style }: Props) {
  const { isDark } = useTheme();
  const source = variant === "mark" ? MARK : isDark ? FULL_DARK : FULL_LIGHT;
  const { width: w, height: h } = Image.resolveAssetSource(source);
  return (
    <Image
      source={source}
      accessibilityLabel="WeighApp logo"
      resizeMode="contain"
      style={[{ width, height: (width * h) / w }, style]}
    />
  );
}
