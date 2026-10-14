// Typography
import {
  Outfit_100Thin,
  Outfit_200ExtraLight,
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
  useFonts,
} from "@expo-google-fonts/outfit";

const FAMILY: Record<string, string> = {
  "100": "Outfit_100Thin",
  "200": "Outfit_200ExtraLight",
  "300": "Outfit_300Light",
  "400": "Outfit_400Regular",
  "500": "Outfit_500Medium",
  "600": "Outfit_600SemiBold",
  "700": "Outfit_700Bold",
  "800": "Outfit_800ExtraBold",
  "900": "Outfit_900Black",
};

/* Font */
export function fontFamilyFor(weight: unknown): string {
  if (weight === undefined || weight === null || weight === "normal") return FAMILY["400"];
  if (weight === "bold") return FAMILY["700"];
  const n = Math.round(Number(weight) / 100) * 100;
  if (!Number.isFinite(n)) return FAMILY["400"];
  if (n <= 100) return FAMILY["100"];
  if (n >= 900) return FAMILY["900"];
  return FAMILY[String(n)] ?? FAMILY["400"];
}

/* Loading */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Outfit_100Thin,
    Outfit_200ExtraLight,
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });
  return loaded || !!error;
}
