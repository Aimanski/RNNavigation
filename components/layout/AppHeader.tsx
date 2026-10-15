// Header

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import BrandLogo from "../brand/BrandLogo";
import { Text } from "../ui/AppText";
import { fetchAvatarUrl } from "../../lib/avatar";
import { cache } from "../../lib/cache";
import { getSessionUser } from "../../lib/auth/session";
import { Colors, useTheme } from "../../providers/ThemeProvider";

const AVATAR_CACHE_KEY = "header:avatar";

export default function AppHeader() {
  const { colors } = useTheme();
  const router = useRouter();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    () => cache.get<string | null>(AVATAR_CACHE_KEY) ?? null
  );

  // Caching
  useEffect(() => {
    let cancelled = false;

    const loadAvatar = async () => {
      const user = await getSessionUser();
      if (!user || cancelled) return;

      const url = await fetchAvatarUrl(user);
      if (cancelled) return;
      cache.set(AVATAR_CACHE_KEY, url);
      setAvatarUrl(url);
    };

    loadAvatar();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={s.container}>
      <View style={s.sideWrap}>
        <View style={s.brandRow}>
          <BrandLogo variant="mark" width={30} />
          <Text style={s.appName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            WeighApp
          </Text>
        </View>
      </View>
      <View style={[s.sideWrap, s.sideWrapRight]}>
        {/* Navigation */}
        <Pressable
          style={({ pressed }) => [s.avatarBtn, pressed && { opacity: 0.8 }]}
          onPress={() => router.replace("/setting")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open Settings"
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
          ) : (
            <Ionicons name="person" size={17} color={colors.onAccent} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 12,
      paddingBottom: 12,
      paddingHorizontal: 20,
      backgroundColor: c.background,
      borderBottomWidth: 1.5,
      borderBottomColor: c.border,
    },
    sideWrap: { flex: 1 },
    sideWrapRight: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    appName: {
      flexShrink: 1,
      fontSize: 17,
      fontWeight: "900",
      color: c.accent,
      letterSpacing: -0.3,
    },
    avatarBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.accent,
      overflow: "hidden",
    },
    avatarImg: {
      width: 34,
      height: 34,
    },
  });
