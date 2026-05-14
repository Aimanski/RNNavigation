// app/updateInfo.tsx — FRESH GREEN PREMIUM VERSION (same logic, beautiful redesign)

import { Ionicons } from "@expo/vector-icons"; // Added for back button (safe, no logic change)
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function UpdateInfoScreen() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [liveBmi, setLiveBmi] = useState<number | null>(null);

  // Load current data
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      setUserId(user.id);

      const { data } = await supabase
        .from("weighApp")
        .select("age, height_cm, weight_kg")
        .eq("id", user.id)
        .single();

      if (data) {
        setAge(data.age?.toString() || "");
        setHeight(data.height_cm?.toString() || "");
        setWeight(data.weight_kg?.toString() || "");
      }
    })();
  }, []);

  // Block hardware back (optional — keeps user in flow)
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => backHandler.remove();
  }, []);

  // Live BMI
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

    const bmi = parseFloat(
      (weightNum / ((heightNum / 100) * (heightNum / 100))).toFixed(1)
    );

    try {
      const { error } = await supabase
        .from("weighApp")
        .update({
          age: ageNum,
          height_cm: heightNum,
          weight_kg: weightNum,
          bmi,
        })
        .eq("id", userId);

      if (error) throw error;

      Alert.alert("Success", "Information updated!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update");
    }
  };

  const bmiCategory = liveBmi ? getBmiCategory(liveBmi) : null;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        style={s.container}
      >
        <Pressable onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={28} color="#10b981" />
        </Pressable>

        <Text style={s.title}>Update Your Info</Text>
        <Text style={s.subtitle}>Keep your profile up-to-date</Text>

        <TextInput
          style={s.input}
          placeholder="Age (years)"
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
          value={age}
          onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ""))}
        />

        <TextInput
          style={s.input}
          placeholder="Height (cm)"
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
          value={height}
          onChangeText={(text) => setHeight(text.replace(/[^0-9.]/g, ""))}
        />

        <TextInput
          style={s.input}
          placeholder="Weight (kg)"
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
          value={weight}
          onChangeText={(text) => setWeight(text.replace(/[^0-9.]/g, ""))}
        />

        {liveBmi && (
          <View style={s.bmiBox}>
            <Text style={s.bmiLabel}>Your BMI</Text>
            <Text style={s.bmiValue}>{liveBmi}</Text>
            <Text style={[s.bmiCategory, { color: bmiCategory?.color }]}>
              {bmiCategory?.text}
            </Text>
          </View>
        )}

        <Pressable style={s.btn} onPress={submit}>
          <Text style={s.btnTxt}>UPDATE</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f8fff9",
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#065f46",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#059669",
    marginBottom: 60,
    textAlign: "center",
    lineHeight: 26,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#f0fdf4",
    borderWidth: 2,
    borderColor: "#86efac",
    width: "100%",
    padding: 20,
    borderRadius: 20,
    fontSize: 17,
    color: "#065f46",
    marginBottom: 18,
  },
  bmiBox: {
    backgroundColor: "#f0fdf4",
    padding: 24,
    borderRadius: 24,
    alignItems: "center",
    marginTop: 20,
    width: "100%",
    borderWidth: 2,
    borderColor: "#86efac",
  },
  bmiLabel: {
    fontSize: 18,
    color: "#059669",
    fontWeight: "600",
  },
  bmiValue: {
    fontSize: 48,
    fontWeight: "900",
    color: "#065f46",
    marginVertical: 8,
  },
  bmiCategory: {
    fontSize: 20,
    fontWeight: "800",
  },
  btn: {
    backgroundColor: "#10b981",
    width: "100%",
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 12,
  },
  btnTxt: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});