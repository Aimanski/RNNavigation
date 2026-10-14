// Teaser

import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../ui/AppText";
import { WeekPlan } from "../../lib/health/mealPlan";
import { Colors, useTheme } from "../../providers/ThemeProvider";
import { SUGGEST_GREEN, suggestTint } from "./palette";

export default function PlanTeaser({
  plan,
  goal,
  loading,
  todayIndex,
  onOpen,
}: {
  plan: WeekPlan | null;
  goal: number | null;
  loading: boolean;
  todayIndex: number;
  onOpen: () => void;
}) {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const day = plan ? plan.days[Math.max(todayIndex, 0)] : undefined;
  const count = day ? day.meals.reduce((total, m) => total + m.items.length, 0) : 0;

  return (
    <View style={s.card}>
      <View style={s.headRow}>
        <View style={s.headIcon}>
          <Ionicons name="sparkles" size={20} color="#ffffff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Suggested For You</Text>
          <Text style={s.subtitle} numberOfLines={2}>
            {plan && day
              ? `Day ${day.day} today: ${count} foods, ${day.kcal.toLocaleString()} of ${plan.goal.toLocaleString()} kcal`
              : goal
                ? "A weekly plan made from your goal, tastes and allergies"
                : "Set up your profile to get a weekly plan"}
          </Text>
        </View>
        {loading && !plan && <ActivityIndicator size="small" color={SUGGEST_GREEN} />}
      </View>

      {!!plan && (
        <View style={s.weekRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {plan.days.map((d, i) => (
            <View key={d.date} style={s.weekCol}>
              <View style={s.barTrack}>
                <View
                  style={[
                    s.barFill,
                    { height: `${Math.min(100, Math.round((d.kcal / plan.goal) * 100))}%` },
                    i === todayIndex && s.barToday,
                  ]}
                />
              </View>
              <Text style={[s.weekLabel, i === todayIndex && s.weekLabelToday]}>{d.weekday[0]}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [s.button, pressed && s.pressed]}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel="View your meal plan"
      >
        <Text style={s.buttonText}>View Your Meal Plan</Text>
        <Ionicons name="arrow-forward" size={18} color="#ffffff" />
      </Pressable>
    </View>
  );
}

const makeStyles = (c: Colors, isDark: boolean) => {
  const tint = suggestTint(isDark);
  return StyleSheet.create({
    pressed: { opacity: 0.85 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: SUGGEST_GREEN,
      padding: 16,
      marginBottom: 14,
      gap: 14,
    },
    headRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    headIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: SUGGEST_GREEN,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 19, fontWeight: "800", color: c.textPrimary },
    subtitle: { fontSize: 13, fontWeight: "600", color: c.textSecondary, marginTop: 1, lineHeight: 18 },
    weekRow: { flexDirection: "row", gap: 8, backgroundColor: tint, borderRadius: 14, padding: 10 },
    weekCol: { flex: 1, alignItems: "center", gap: 6 },
    barTrack: {
      width: "100%",
      height: 40,
      borderRadius: 8,
      backgroundColor: c.surface,
      justifyContent: "flex-end",
      overflow: "hidden",
    },
    barFill: { width: "100%", backgroundColor: "#86d6a3", borderRadius: 8 },
    barToday: { backgroundColor: SUGGEST_GREEN },
    weekLabel: { fontSize: 12, fontWeight: "700", color: c.textMuted },
    weekLabelToday: { color: SUGGEST_GREEN, fontWeight: "800" },
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: SUGGEST_GREEN,
      borderRadius: 14,
      paddingVertical: 14,
    },
    buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  });
};
