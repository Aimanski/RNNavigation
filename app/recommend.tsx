// Recommendation

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../components/ui/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import StepProgress from "../components/ui/StepProgress";
import { supabase } from "../lib/supabase";
import { getSessionUser } from "../lib/auth/session";
import { resetTo } from "../lib/navigation";
import { Colors, useTheme } from "../providers/ThemeProvider";

type IconName = keyof typeof Ionicons.glyphMap;
type GoalKey = "lose" | "maintain" | "gain";

export default function RecommendScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [tdee, setTdee] = useState(0);
  const [bmi, setBmi] = useState<number | null>(null);
  const [selected, setSelected] = useState<GoalKey>("maintain");
  const [loading, setLoading] = useState(true);

  // Loading
  useEffect(() => {
    (async () => {
      try {
        const user = await getSessionUser();
        if (!user) return router.replace("/");

        const { data, error } = await supabase
          .from("weighApp")
          .select("tdee, bmi")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (!data?.tdee || data.tdee <= 0) {
          Alert.alert("Hold up!", "Please set your activity level first");
          router.replace("/activity");
          return;
        }

        setTdee(data.tdee);
        setBmi(data.bmi || null);

        // Selection
        if (data.bmi) {
          if (data.bmi < 18.5) setSelected("gain");
          else if (data.bmi >= 18.5 && data.bmi <= 24.9) setSelected("maintain");
          if (data.bmi >= 25) setSelected("lose");
        }

        setLoading(false);
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to load your data");
        router.replace("/activity");
      }
    })();
  }, [router]);

  const saveAndFinish = async () => {
    setLoading(true);
    try {
      const user = await getSessionUser();
      if (!user) return;

      let targetCalories = tdee;
      if (selected === "lose") targetCalories = tdee - 500;
      if (selected === "gain") targetCalories = tdee + 500;

      const { error } = await supabase
        .from("weighApp")
        .update({ goal_calories: targetCalories })
        .eq("id", user.id);

      if (error) throw error;

      resetTo(router, "/preferences");
    } catch (err: any) {
      Alert.alert("Oops", err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={s.loadingText}>Preparing your plan...</Text>
      </SafeAreaView>
    );
  }

  // Recommendation
  const getRecommendedGoal = (): GoalKey | null => {
    if (!bmi) return null;
    if (bmi < 18.5) return "gain";
    if (bmi >= 18.5 && bmi <= 24.9) return "maintain";
    if (bmi >= 25) return "lose";
    return null;
  };

  const recommendedGoal = getRecommendedGoal();

  const goals: {
    key: GoalKey;
    title: string;
    kcal: number;
    subtitle: string;
    color: string;
    icon: IconName;
  }[] = [
    { key: "lose", title: "Lose Weight", kcal: tdee - 500, subtitle: "-500 kcal deficit", color: "#f87171", icon: "arrow-down" },
    { key: "maintain", title: "Maintain Weight", kcal: tdee, subtitle: "Perfect balance", color: "#0B6FDB", icon: "remove" },
    { key: "gain", title: "Gain Weight", kcal: tdee + 500, subtitle: "+500 kcal surplus", color: "#60a5fa", icon: "arrow-up" },
  ];

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right", "bottom"]}>
      <View style={s.topHeader}>
        <StepProgress step={4} />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>What&apos;s Your Goal?</Text>
        <Text style={s.subtitle}>
          Your daily maintenance: <Text style={s.tdee}>{tdee.toLocaleString()}</Text> kcal
        </Text>

        {goals.map((goal) => {
          const active = selected === goal.key;
          return (
            <Pressable
              key={goal.key}
              style={({ pressed }) => [
                s.card,
                active && s.selectedCard,
                pressed && s.pressed,
              ]}
              onPress={() => setSelected(goal.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <View style={[s.goalIcon, { backgroundColor: goal.color + "26" }]}>
                <Ionicons name={goal.icon} size={26} color={goal.color} />
              </View>

              <View style={s.cardInfo}>
                <View style={s.titleRow}>
                  <Text style={s.cardTitle}>{goal.title}</Text>
                  {recommendedGoal === goal.key && (
                    <View style={s.recommendedBadge}>
                      <Text style={s.recommendedText}>Recommended</Text>
                    </View>
                  )}
                </View>
                <Text style={s.cardSub}>{goal.subtitle}</Text>
              </View>

              <View style={s.kcalWrap}>
                <Text style={[s.kcal, active && s.kcalActive]}>
                  {goal.kcal.toLocaleString()}
                </Text>
                <Text style={s.kcalUnit}>kcal/day</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={s.bottomBar}>
        <Pressable
          style={({ pressed }) => [s.ctaButton, pressed && s.pressed]}
          onPress={saveAndFinish}
          accessibilityRole="button"
        >
          <Text style={s.ctaText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.onAccent} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    pressed: { opacity: 0.8 },
    loadingContainer: {
      flex: 1,
      backgroundColor: c.background,
      justifyContent: "center",
      alignItems: "center",
    },
    topHeader: {
      paddingTop: 22,
      paddingHorizontal: 24,
    },
    scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: c.textPrimary,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: "center",
      marginTop: 6,
      marginBottom: 22,
      fontWeight: "600",
    },
    tdee: { fontWeight: "900", color: c.accent, fontSize: 16 },

    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingVertical: 18,
      paddingHorizontal: 16,
      marginBottom: 14,
    },
    selectedCard: { borderColor: c.accent, backgroundColor: c.surfaceAlt },
    goalIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: "center",
      justifyContent: "center",
    },
    cardInfo: { flex: 1 },
    titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
    cardTitle: { fontSize: 17, fontWeight: "800", color: c.textPrimary },
    cardSub: { fontSize: 13.5, color: c.textSecondary, marginTop: 3, fontWeight: "600" },
    recommendedBadge: {
      backgroundColor: c.accent,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
    },
    recommendedText: { color: c.onAccent, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
    kcalWrap: { alignItems: "flex-end" },
    kcal: { fontSize: 20, fontWeight: "900", color: c.textPrimary },
    kcalActive: { color: c.accent },
    kcalUnit: { fontSize: 11, fontWeight: "600", color: c.textMuted, marginTop: 1 },

    bottomBar: {
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 16,
      backgroundColor: c.background,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    ctaButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: c.accent,
      paddingVertical: 17,
      borderRadius: 16,
    },
    ctaText: { color: c.onAccent, fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
    loadingText: {
      marginTop: 24,
      fontSize: 18,
      color: c.textSecondary,
      fontWeight: "700",
    },
  });
