// Survey

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/AppText";
import StepProgress from "../components/ui/StepProgress";
import { supabase } from "../lib/supabase";
import { getSessionUser } from "../lib/auth/session";
import { resetTo } from "../lib/navigation";
import { Colors, useTheme } from "../providers/ThemeProvider";

type HeightUnit = "cm" | "ftin";
type WeightUnit = "kg" | "lbs";

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

type Segment<T extends string> = { value: T; label: string };

function Segmented<T extends string>({
  options,
  value,
  onChange,
  s,
}: {
  options: Segment<T>[];
  value: T;
  onChange: (next: T) => void;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.segmented}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[s.segment, active && s.segmentActive]}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[s.segmentText, active && s.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SurveyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [userId, setUserId] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState(""); // Units
  const [feet, setFeet] = useState(""); // Units
  const [inches, setInches] = useState("");
  const [weight, setWeight] = useState(""); // Units
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [focused, setFocused] = useState<string | null>(null);

  // Navigation
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
        .select("age, height_cm, weight_kg")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setAge(data.age?.toString() || "");
        setHeight(data.height_cm?.toString() || "");
        setWeight(data.weight_kg?.toString() || "");
      }
    })();
  }, [router]);

  const changeHeightUnit = (next: HeightUnit) => {
    if (next === heightUnit) return;
    if (next === "ftin") {
      const cm = parseFloat(height);
      if (!isNaN(cm)) {
        const totalInches = cm / CM_PER_INCH;
        setFeet(Math.floor(totalInches / 12).toString());
        setInches(Math.round(totalInches % 12).toString());
      }
    } else {
      const feetNum = parseFloat(feet) || 0;
      const inchesNum = parseFloat(inches) || 0;
      if (feet || inches) {
        setHeight(Math.round((feetNum * 12 + inchesNum) * CM_PER_INCH).toString());
      }
    }
    setHeightUnit(next);
  };

  const changeWeightUnit = (next: WeightUnit) => {
    if (next === weightUnit) return;
    const current = parseFloat(weight);
    if (!isNaN(current)) {
      const converted = next === "lbs" ? current / KG_PER_LB : current * KG_PER_LB;
      setWeight((Math.round(converted * 10) / 10).toString());
    }
    setWeightUnit(next);
  };

  const submit = async () => {
    const ageNum = parseFloat(age);

    // Conversion
    let heightNum: number;
    if (heightUnit === "cm") {
      heightNum = parseFloat(height);
    } else {
      const feetNum = parseFloat(feet) || 0;
      const inchesNum = parseFloat(inches) || 0;
      heightNum = (feetNum * 12 + inchesNum) * CM_PER_INCH;
    }

    const weightInput = parseFloat(weight);
    const weightNum =
      weightUnit === "kg" ? weightInput : weightInput * KG_PER_LB;

    const heightEntered = heightUnit === "cm" ? !!height : !!feet || !!inches;

    if (
      !age ||
      !heightEntered ||
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
        "Age: 13–120 | Height: 100–250 cm (3'3\"–8'2\") | Weight: 30–300 kg (66–661 lbs)"
      );
    }

    const bmi = parseFloat(
      (weightNum / ((heightNum / 100) * (heightNum / 100))).toFixed(1)
    );

    try {
      const { error } = await supabase
        .from("weighApp")
        .upsert({
          id: userId,
          age: ageNum,
          height_cm: heightNum,
          weight_kg: weightNum,
          bmi,
        });

      if (error) throw error;

      // Navigation
      resetTo(router, {
        pathname: "/gender",
        params: {
          age: ageNum.toString(),
          height: heightNum.toString(),
          weight: weightNum.toString(),
          bmi: bmi.toString(),
        },
      });
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save");
    }
  };

  const inputStyle = (name: string) => [s.input, focused === name && s.inputFocused];
  const focusProps = (name: string) => ({
    onFocus: () => setFocused(name),
    onBlur: () => setFocused((cur) => (cur === name ? null : cur)),
  });

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        style={s.container}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepProgress step={1} />

          <Text style={s.title}>Let&apos;s Get Started</Text>
          <Text style={s.subtitle}>Tell us a bit about yourself</Text>

          <View style={s.card}>
            {/* Age */}
            <Text style={s.label}>Age</Text>
            <TextInput
              style={inputStyle("age")}
              placeholder="Years"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={age}
              onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ""))}
              {...focusProps("age")}
            />

            {/* Height */}
            <View style={s.labelRow}>
              <Text style={s.label}>Height</Text>
              <Segmented<HeightUnit>
                s={s}
                value={heightUnit}
                onChange={changeHeightUnit}
                options={[
                  { value: "cm", label: "cm" },
                  { value: "ftin", label: "ft/in" },
                ]}
              />
            </View>
            {heightUnit === "cm" ? (
              <TextInput
                style={inputStyle("height")}
                placeholder="Height in cm"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={height}
                onChangeText={(text) => setHeight(text.replace(/[^0-9.]/g, ""))}
                {...focusProps("height")}
              />
            ) : (
              <View style={s.rowInputs}>
                <TextInput
                  style={[...inputStyle("feet"), s.rowInput]}
                  placeholder="Feet"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={feet}
                  onChangeText={(text) => setFeet(text.replace(/[^0-9]/g, ""))}
                  {...focusProps("feet")}
                />
                <TextInput
                  style={[...inputStyle("inches"), s.rowInput]}
                  placeholder="Inches"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={inches}
                  onChangeText={(text) => setInches(text.replace(/[^0-9.]/g, ""))}
                  {...focusProps("inches")}
                />
              </View>
            )}

            {/* Weight */}
            <View style={s.labelRow}>
              <Text style={s.label}>Weight</Text>
              <Segmented<WeightUnit>
                s={s}
                value={weightUnit}
                onChange={changeWeightUnit}
                options={[
                  { value: "kg", label: "kg" },
                  { value: "lbs", label: "lbs" },
                ]}
              />
            </View>
            <TextInput
              style={[...inputStyle("weight"), s.inputLast]}
              placeholder={weightUnit === "kg" ? "Weight in kg" : "Weight in lbs"}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={weight}
              onChangeText={(text) => setWeight(text.replace(/[^0-9.]/g, ""))}
              {...focusProps("weight")}
            />
          </View>

          <Pressable
            style={({ pressed }) => [s.btn, pressed && s.pressed]}
            onPress={submit}
            accessibilityRole="button"
          >
            <Text style={s.btnTxt}>Save & continue</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.onAccent} />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    pressed: { opacity: 0.8 },
    scrollContent: {
      paddingTop: Platform.OS === "android" ? 60 : 64,
      paddingBottom: 40,
      paddingHorizontal: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: c.textPrimary,
      marginTop: 28,
      textAlign: "center",
      letterSpacing: 0.3,
    },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
      marginTop: 6,
      marginBottom: 24,
      textAlign: "center",
      fontWeight: "500",
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 20,
    },
    label: { fontSize: 14, fontWeight: "800", color: c.textPrimary, marginBottom: 8 },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    input: {
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.border,
      width: "100%",
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 14,
      fontSize: 17,
      color: c.textPrimary,
      marginBottom: 18,
    },
    inputFocused: { borderColor: c.accent },
    inputLast: { marginBottom: 0 },
    rowInputs: { flexDirection: "row", gap: 12 },
    rowInput: { flex: 1, width: undefined },

    segmented: {
      flexDirection: "row",
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      padding: 3,
    },
    segment: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 9 },
    segmentActive: { backgroundColor: c.accent },
    segmentText: { fontSize: 13, fontWeight: "700", color: c.textSecondary },
    segmentTextActive: { color: c.onAccent },

    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: c.accent,
      width: "100%",
      paddingVertical: 17,
      borderRadius: 16,
      marginTop: 24,
    },
    btnTxt: { color: c.onAccent, fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
  });
