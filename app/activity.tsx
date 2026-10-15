// Activity

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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

const OPTIONS: { id: string; title: string; desc: string; icon: IconName }[] = [
  { id: "1", title: "Sedentary", desc: "Little or no exercise", icon: "bed-outline" },
  { id: "2", title: "Lightly Active", desc: "Light exercise 1–3 days/week", icon: "walk-outline" },
  { id: "3", title: "Moderately Active", desc: "Moderate exercise 3–5 days/week", icon: "bicycle-outline" },
  { id: "4", title: "Very Active", desc: "Hard exercise 6–7 days/week", icon: "barbell-outline" },
  { id: "5", title: "Extra Active", desc: "Very hard exercise + physical job", icon: "flame-outline" },
];

export default function ActivityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await getSessionUser();
        if (!user) { router.replace("/"); return; }

        let age = parseFloat(params.age as string);
        let height = parseFloat(params.height as string);
        let weight = parseFloat(params.weight as string);
        let bmi = parseFloat(params.bmi as string);
        let bmr = parseFloat(params.bmr as string);

        // Prefill
        if (!age || !height || !weight || !bmi || !bmr) {
          const { data, error } = await supabase
            .from("weighApp")
            .select("age, height_cm, weight_kg, bmi, bmr")
            .eq("id", user.id)
            .single();

          if (error || !data) {
            Alert.alert("Error", "Profile not found. Please complete setup again.");
            router.replace("/survey");
            return;
          }

          age = data.age;
          height = data.height_cm;
          weight = data.weight_kg;
          bmi = data.bmi || 0;
          bmr = data.bmr;
        }

        if (!bmr || bmr <= 0) {
          Alert.alert("Error", "BMR is missing. Please select gender again.");
          router.replace("/gender");
          return;
        }

        setProfile({ age, height, weight, bmi, bmr });
      } catch {
        Alert.alert("Error", "Failed to load profile");
        router.replace("/survey");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.age, params.bmi, params.bmr, params.height, params.weight, router]);

  const handleNext = async () => {
    if (!selectedId || !profile?.bmr) {
      Alert.alert("Oops", "Please select your activity level");
      return;
    }

    setLoading(true);
    try {
      const user = await getSessionUser();
      if (!user) return;

      const multipliers: Record<string, number> = {
        "1": 1.2, "2": 1.375, "3": 1.55, "4": 1.725, "5": 1.9,
      };

      const tdee = Math.round(profile.bmr * multipliers[selectedId]);

      await supabase.from("weighApp").update({ tdee }).eq("id", user.id);

      resetTo(router, "/recommend");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={s.loadingText}>Preparing your personalized plan...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right", "bottom"]}>
      <View style={s.topHeader}>
        <StepProgress step={3} />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>How active are you?</Text>
        <Text style={s.subtitle}>This helps us calculate your daily calorie needs</Text>

        {OPTIONS.map((opt) => {
          const selected = selectedId === opt.id;
          return (
            <Pressable
              key={opt.id}
              style={({ pressed }) => [
                s.optionCard,
                selected && s.selectedCard,
                pressed && s.pressed,
              ]}
              onPress={() => setSelectedId(opt.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={[s.optionIcon, selected && s.optionIconSelected]}>
                <Ionicons
                  name={opt.icon}
                  size={24}
                  color={selected ? colors.onAccent : colors.accent}
                />
              </View>

              <View style={s.optionContent}>
                <Text style={s.optionTitle}>{opt.title}</Text>
                <Text style={s.optionDesc}>{opt.desc}</Text>
              </View>

              <View style={[s.radio, selected && s.radioSelected]}>
                {selected && <Ionicons name="checkmark" size={16} color={colors.onAccent} />}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={s.bottomBar}>
        <Pressable
          style={({ pressed }) => [
            s.primaryButton,
            !selectedId && s.disabledButton,
            pressed && s.pressed,
          ]}
          onPress={handleNext}
          disabled={!selectedId || loading}
        >
          <Text style={s.primaryText}>Continue</Text>
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
      fontWeight: "500",
    },

    optionCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    selectedCard: { backgroundColor: c.surfaceAlt, borderColor: c.accent },
    optionIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    optionIconSelected: { backgroundColor: c.accent },
    optionContent: { flex: 1 },
    optionTitle: { fontSize: 17, fontWeight: "800", color: c.textPrimary },
    optionDesc: {
      fontSize: 13.5,
      color: c.textSecondary,
      marginTop: 2,
      fontWeight: "500",
    },
    radio: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: { backgroundColor: c.accent, borderColor: c.accent },

    bottomBar: {
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 16,
      backgroundColor: c.background,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    secondaryButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingVertical: 16,
      borderRadius: 16,
    },
    secondaryText: { color: c.textPrimary, fontSize: 16, fontWeight: "800" },
    primaryButton: {
      flex: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: c.accent,
      paddingVertical: 16,
      borderRadius: 16,
    },
    disabledButton: { opacity: 0.45 },
    primaryText: { color: c.onAccent, fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
    loadingText: {
      marginTop: 24,
      color: c.textSecondary,
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
    },
  });
