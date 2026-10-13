// Login

import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./AppText";
import { Colors, useTheme } from "../../providers/ThemeProvider";

type Props = {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export default function GoogleButton({ onPress, loading = false, disabled = false }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      style={({ pressed }) => [s.btn, (loading || pressed) && s.dim]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
    >
      {loading ? (
        <ActivityIndicator color={colors.textPrimary} size="small" />
      ) : (
        <View style={s.inner}>
          <View style={s.icon}>
            <Text style={s.g}>G</Text>
          </View>
          <Text style={s.text}>Continue with Google</Text>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    btn: {
      backgroundColor: c.surface,
      width: "100%",
      height: 56,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    dim: { opacity: 0.7 },
    inner: { flexDirection: "row", alignItems: "center", gap: 12 },
    icon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: "#FFFFFF",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: "#e2e8f0",
    },
    g: { fontSize: 15, fontWeight: "900", color: "#4285F4" },
    text: { fontSize: 16, fontWeight: "700", color: c.textPrimary },
  });
