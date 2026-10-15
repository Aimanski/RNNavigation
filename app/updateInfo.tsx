// Update

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/AppText";
import KeyboardSafeView from "../components/layout/KeyboardSafeView";
import { SafeAreaView } from "react-native-safe-area-context";
import { GOAL_LABEL, GOAL_OFFSET, recalc, recommendedGoalForBmi, type Energy } from "../lib/health/energy";
import { goBackOr } from "../lib/navigation";
import { supabase } from "../lib/supabase";
import { getSessionUser } from "../lib/auth/session";
import { Colors, useTheme } from "../providers/ThemeProvider";

export default function UpdateInfoScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [liveBmi, setLiveBmi] = useState<number | null>(null);
  // Profile
  const [saved, setSaved] = useState<{
    gender: string | null;
    bmi: number | null;
    bmr: number | null;
    tdee: number | null;
    goalCalories: number | null;
  }>({ gender: null, bmi: null, bmr: null, tdee: null, goalCalories: null });
  const [saving, setSaving] = useState(false);

  // Prefill
  useEffect(() => {
    (async () => {
      const user = await getSessionUser();
      if (!user) {
        router.replace("/");
        return;
      }
      setUserId(user.id);

      const { data } = await supabase
        .from("weighApp")
        .select("age, height_cm, weight_kg, gender, bmi, bmr, tdee, goal_calories")
        .eq("id", user.id)
        .single();

      if (data) {
        setAge(data.age?.toString() || "");
        setHeight(data.height_cm?.toString() || "");
        setWeight(data.weight_kg?.toString() || "");
        setSaved({
          gender: data.gender ?? null,
          bmi: data.bmi ?? null,
          bmr: data.bmr ?? null,
          tdee: data.tdee ?? null,
          goalCalories: data.goal_calories ?? null,
        });
      }
    })();
  }, [router]);

  // Navigation
  useEffect(() => {
    if (height && weight) {
      const h = parseFloat(height);
      const w = parseFloat(weight);
      if (!isNaN(h) && !isNaN(w) && h > 0 && w > 0) {
        const bmiValue = w / ((h / 100) ** 2);
        setLiveBmi(parseFloat(bmiValue.toFixed(1)));
      } else {
        setLiveBmi(null);
      }
    } else {
      setLiveBmi(null);
    }
  }, [height, weight]);

  // Preview
  const preview: Energy | null = useMemo(() => {
    const a = parseFloat(age), h = parseFloat(height), w = parseFloat(weight);
    if (!(a >= 13 && a <= 120 && h >= 100 && h <= 250 && w >= 30 && w <= 300)) return null;
    return recalc(
      { gender: saved.gender, age: a, heightCm: h, weightKg: w },
      { bmr: saved.bmr, tdee: saved.tdee, goalCalories: saved.goalCalories }
    );
  }, [age, height, weight, saved]);

  const getBmiCategory = (bmi: number) => {
    if (bmi < 18.5) return { text: "Underweight", color: "#3b82f6" };
    if (bmi < 25) return { text: "Normal", color: "#10b981" };
    if (bmi < 30) return { text: "Overweight", color: "#fbbf24" };
    return { text: "Obese", color: "#ef4444" };
  };

  const submit = async () => {
    const ageNum = parseFloat(age);
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);

    if (
      !age ||
      !height ||
      !weight ||
      isNaN(ageNum) ||
      isNaN(heightNum) ||
      isNaN(weightNum) ||
      ageNum < 13 ||
      ageNum > 120 ||
      heightNum < 100 ||
      heightNum > 250 ||
      weightNum < 30 ||
      weightNum > 300
    ) {
      return Alert.alert(
        "Invalid Input",
        "Age: 13–120 | Height: 100–250 cm | Weight: 30–300 kg"
      );
    }

    if (saving) return;
    setSaving(true);

    // Calculation
    const energy = recalc(
      { gender: saved.gender, age: ageNum, heightCm: heightNum, weightKg: weightNum },
      { bmr: saved.bmr, tdee: saved.tdee, goalCalories: saved.goalCalories }
    );
    const bmi = energy
      ? energy.bmi
      : parseFloat((weightNum / ((heightNum / 100) * (heightNum / 100))).toFixed(1));

    try {
      const { error } = await supabase
        .from("weighApp")
        .update({
          age: ageNum,
          height_cm: heightNum,
          weight_kg: weightNum,
          bmi,
          ...(energy ? { bmr: energy.bmr, tdee: energy.tdee, goal_calories: energy.goalCalories } : {}),
        })
        .eq("id", userId);

      if (error) throw error;

      const done = () => goBackOr(router, "/setting");

      if (!energy) {
        // Setup
        Alert.alert("Success", "Information updated!", [{ text: "OK", onPress: done }]);
        return;
      }

      // Goal
      const before = saved.bmi ? recommendedGoalForBmi(saved.bmi) : null;
      const recommended = recommendedGoalForBmi(bmi);
      const summary =
        `Your BMI is ${bmi}. Your daily calorie need (TDEE) is now ${energy.tdee.toLocaleString()} kcal and your ` +
        `goal is ${energy.goalCalories.toLocaleString()} kcal.`;

      if (before !== null && recommended !== before && recommended !== energy.goal) {
        const newGoal = energy.tdee + GOAL_OFFSET[recommended];
        Alert.alert(
          "Information updated",
          `${summary}\n\nWith this BMI the recommended goal is ${GOAL_LABEL[recommended]} (${newGoal.toLocaleString()} kcal). Switch to it?`,
          [
            { text: "Keep my goal", style: "cancel", onPress: done },
            {
              text: "Switch",
              onPress: async () => {
                const { error: goalError } = await supabase
                  .from("weighApp")
                  .update({ goal_calories: newGoal })
                  .eq("id", userId);
                if (goalError) Alert.alert("Couldn't switch goal", goalError.message);
                done();
              },
            },
          ]
        );
      } else {
        Alert.alert("Information updated", summary, [{ text: "OK", onPress: done }]);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const bmiCategory = liveBmi ? getBmiCategory(liveBmi) : null;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
        <View style={s.headerContainer}>
          <Text style={s.header}>Update Your Info</Text>

        </View>

        <KeyboardSafeView
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
          style={s.flex}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.scrollContent}
          >
            <Text style={s.subtitle}>Keep your profile up-to-date</Text>

            <View style={s.card}>
              <Text style={s.label}>Age</Text>
              <View style={[s.inputWrap, focused === "age" && s.inputFocused]}>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={focused === "age" ? colors.accent : colors.textMuted}
                />
                <TextInput
                  style={s.input}
                  placeholder="Age (years)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={age}
                  onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ""))}
                  onFocus={() => setFocused("age")}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <Text style={[s.label, s.labelGap]}>Height</Text>
              <View style={[s.inputWrap, focused === "height" && s.inputFocused]}>
                <Ionicons
                  name="resize-outline"
                  size={20}
                  color={focused === "height" ? colors.accent : colors.textMuted}
                />
                <TextInput
                  style={s.input}
                  placeholder="Height (cm)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={height}
                  onChangeText={(text) => setHeight(text.replace(/[^0-9.]/g, ""))}
                  onFocus={() => setFocused("height")}
                  onBlur={() => setFocused(null)}
                />
              </View>

              <Text style={[s.label, s.labelGap]}>Weight</Text>
              <View style={[s.inputWrap, focused === "weight" && s.inputFocused]}>
                <Ionicons
                  name="barbell-outline"
                  size={20}
                  color={focused === "weight" ? colors.accent : colors.textMuted}
                />
                <TextInput
                  style={s.input}
                  placeholder="Weight (kg)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={weight}
                  onChangeText={(text) => setWeight(text.replace(/[^0-9.]/g, ""))}
                  onFocus={() => setFocused("weight")}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            {liveBmi && (
              <View style={s.bmiBox}>
                <Text style={s.bmiLabel}>Your BMI</Text>
                <Text style={s.bmiValue}>{liveBmi}</Text>
                <Text style={[s.bmiCategory, { color: bmiCategory?.color }]}>
                  {bmiCategory?.text}
                </Text>
              </View>
            )}

            {preview && (
              <View style={s.needsBox}>
                <Text style={s.needsTitle}>Your daily needs</Text>
                <Text style={s.needsSub}>Updated from your new numbers when you tap Update</Text>
                <View style={s.needsRow}>
                  <Text style={s.needsLabel}>BMR (at rest)</Text>
                  <Text style={s.needsValue}>{Math.round(preview.bmr).toLocaleString()} kcal</Text>
                </View>
                <View style={s.needsRow}>
                  <Text style={s.needsLabel}>TDEE (with activity)</Text>
                  <Text style={s.needsValue}>{preview.tdee.toLocaleString()} kcal</Text>
                </View>
                <View style={[s.needsRow, s.needsRowLast]}>
                  <Text style={s.needsLabel}>Daily goal ({GOAL_LABEL[preview.goal]})</Text>
                  <Text style={[s.needsValue, s.needsGoal]}>{preview.goalCalories.toLocaleString()} kcal</Text>
                </View>
                {saved.goalCalories !== null && saved.goalCalories !== preview.goalCalories && (
                  <Text style={s.needsChange}>was {saved.goalCalories.toLocaleString()} kcal</Text>
                )}
              </View>
            )}

            <Pressable
              style={({ pressed }) => [s.btn, (pressed || saving) && s.pressed]}
              onPress={submit}
              accessibilityRole="button"
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.onAccent} />
              <Text style={s.btnTxt}>Update</Text>
            </Pressable>
          </ScrollView>
        </KeyboardSafeView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    pressed: { opacity: 0.7 },

    headerContainer: {
      paddingTop: 12,
      paddingBottom: 16,
      paddingHorizontal: 20,
      backgroundColor: c.background,
      flexDirection: "row",
      alignItems: "center",
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      justifyContent: "center",
      alignItems: "center",
    },
    header: {
      flex: 1,
      textAlign: "center",
      fontSize: 22,
      fontWeight: "800",
      color: c.textPrimary,
    },
    headerSpacer: { width: 44 },

    scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },

    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "500",
      color: c.textSecondary,
      textAlign: "center",
      marginBottom: 16,
    },

    card: {
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 20,
      marginBottom: 16,
    },
    label: {
      fontSize: 15,
      fontWeight: "800",
      color: c.textPrimary,
      marginBottom: 10,
    },
    labelGap: { marginTop: 18 },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      paddingHorizontal: 16,
    },
    inputFocused: { borderColor: c.accent },
    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 16,
      color: c.textPrimary,
    },

    bmiBox: {
      backgroundColor: c.surface,
      paddingVertical: 20,
      paddingHorizontal: 20,
      borderRadius: 22,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: c.border,
      marginBottom: 16,
    },
    needsBox: {
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 18,
      marginBottom: 20,
    },
    needsTitle: { fontSize: 16, fontWeight: "800", color: c.textPrimary },
    needsSub: { fontSize: 12.5, fontWeight: "600", color: c.textMuted, marginTop: 2, marginBottom: 10 },
    needsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: 12,
    },
    needsRowLast: { borderBottomWidth: 0 },
    needsLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: c.textSecondary },
    needsValue: { fontSize: 15, fontWeight: "800", color: c.textPrimary },
    needsGoal: { color: c.accent },
    needsChange: { fontSize: 12.5, fontWeight: "600", color: c.textMuted, textAlign: "right", marginTop: 2 },
    bmiLabel: { fontSize: 15, fontWeight: "800", color: c.textSecondary },
    bmiValue: {
      fontSize: 44,
      fontWeight: "900",
      color: c.textPrimary,
      marginVertical: 4,
    },
    bmiCategory: { fontSize: 18, fontWeight: "800" },

    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: c.accent,
      borderRadius: 16,
      paddingVertical: 17,
    },
    btnTxt: { fontSize: 17, fontWeight: "800", color: c.onAccent },
  });
