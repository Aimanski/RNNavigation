// Typography
import {
  Nunito_200ExtraLight,
  Nunito_300Light,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from "@expo-google-fonts/nunito";

const FAMILY: Record<string, string> = {
  "200": "Nunito_200ExtraLight",
  "300": "Nunito_300Light",
  "400": "Nunito_400Regular",
  "500": "Nunito_500Medium",
  "600": "Nunito_600SemiBold",
  "700": "Nunito_700Bold",
  "800": "Nunito_800ExtraBold",
  "900": "Nunito_900Black",
};

/* Font */
export function fontFamilyFor(weight: unknown): string {
  if (weight === undefined || weight === null || weight === "normal") return FAMILY["400"];
  if (weight === "bold") return FAMILY["700"];
  const n = Math.round(Number(weight) / 100) * 100;
  if (!Number.isFinite(n)) return FAMILY["400"];
  if (n <= 200) return FAMILY["200"];
  if (n >= 900) return FAMILY["900"];
  return FAMILY[String(n)] ?? FAMILY["400"];
}

/* Loading */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Nunito_200ExtraLight,
    Nunito_300Light,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });
  return loaded || !!error;
}
