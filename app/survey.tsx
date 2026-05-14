// app/survey.tsx

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
} from "react-native";
import { supabase } from "../lib/supabase";

export default function SurveyScreen() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  // BLOCK HARDWARE BACK BUTTON
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => backHandler.remove();
  }, []);

  // FIX #2/#3: Only fetch userId and pre-fill existing values.
  // Do NOT redirect based on completion — AuthProvider already navigated
  // here because the profile is incomplete. Redirecting again from here
  // causes the double-screen loop.
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
        .maybeSingle();

      if (data) {
        setAge(data.age?.toString() || "");
        setHeight(data.height_cm?.toString() || "");
        setWeight(data.weight_kg?.toString() || "");
      }
    })();
  }, []);

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
        .upsert({
          id: userId,
          age: ageNum,
          height_cm: heightNum,
          weight_kg: weightNum,
          bmi,
        });

      if (error) throw error;

      // Navigate forward only — never backwards from here
      router.push({
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

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        style={s.container}
      >
        <Text style={s.title}>Let's Get Started</Text>
        <Text style={s.subtitle}>Tell us a bit about yourself</Text>

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

        <Pressable style={s.btn} onPress={submit}>
          <Text style={s.btnTxt}>SAVE & CONTINUE</Text>
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
    paddingTop: 80,
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 30,
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
  btn: {
    backgroundColor: "#10b981",
    width: "100%",
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 20,
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
