// Onboarding

import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./AppText";
import { Colors, useTheme } from "../../providers/ThemeProvider";

export const ONBOARDING_STEPS = 6;

export default function StepProgress({ step }: { step: number }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View
      style={s.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${ONBOARDING_STEPS}`}
    >
      <View style={s.bars}>
        {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
          <View key={i} style={[s.bar, i < step && s.barDone]} />
        ))}
      </View>
      <Text style={s.label}>
        Step {step} of {ONBOARDING_STEPS}
      </Text>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    wrap: { width: "100%", alignItems: "center", gap: 8 },
    bars: { flexDirection: "row", gap: 6, width: "100%" },
    bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.border },
    barDone: { backgroundColor: c.accent },
    label: { fontSize: 12, fontWeight: "700", color: c.textMuted, letterSpacing: 0.4 },
  });
