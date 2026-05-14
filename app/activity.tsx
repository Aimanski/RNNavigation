// app/activity.tsx

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ActivityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const nextScale = useSharedValue(1);
  const backScale = useSharedValue(1);

  const animatedNextStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nextScale.value }],
  }));
  const animatedBackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/"); return; }

        let age = parseFloat(params.age as string);
        let height = parseFloat(params.height as string);
        let weight = parseFloat(params.weight as string);
        let bmi = parseFloat(params.bmi as string);
        let bmr = parseFloat(params.bmr as string);

        // FIX #2/#3: If params missing, load from DB to pre-fill —
        // but do NOT redirect to /main if tdee is already set.
        // AuthProvider decided this screen is appropriate.
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
      } catch (err) {
        Alert.alert("Error", "Failed to load profile");
        router.replace("/survey");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleNext = async () => {
    if (!selectedId || !profile?.bmr) {
      Alert.alert("Oops", "Please select your activity level");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const multipliers: Record<string, number> = {
        "1": 1.2, "2": 1.375, "3": 1.55, "4": 1.725, "5": 1.9,
      };

      const tdee = Math.round(profile.bmr * multipliers[selectedId]);

      await supabase.from("weighApp").update({ tdee }).eq("id", user.id);

      Alert.alert("Great job!", `Your daily calorie needs: ${tdee} kcal`, [
        { text: "Continue", onPress: () => router.replace("/recommend") },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const goBackToGender = () => {
    if (!profile) return;
    router.push({
      pathname: "/gender",
      params: {
        age: profile.age.toString(),
        height: profile.height.toString(),
        weight: profile.weight.toString(),
        bmi: profile.bmi.toString(),
      },
    });
  };

  const options = [
    { id: "1", title: "Sedentary",        desc: "Little or no exercise" },
    { id: "2", title: "Lightly Active",   desc: "Light exercise 1–3 days/week" },
    { id: "3", title: "Moderately Active",desc: "Moderate exercise 3–5 days/week" },
    { id: "4", title: "Very Active",      desc: "Hard exercise 6–7 days/week" },
    { id: "5", title: "Extra Active",     desc: "Very hard exercise + physical job" },
  ];

  if (loading || !profile) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={s.loadingText}>Preparing your personalized plan...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      <View style={s.topHeader}>
        <Text style={s.header}>How active are you?</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.subtitle}>
          This helps us calculate your daily calorie needs
        </Text>

        <View style={[s.card, { width: width - 48 }]}>
          {options.map((opt) => (
            <Pressable
              key={opt.id}
              style={[s.optionCard, selectedId === opt.id && s.selectedCard]}
              onPress={() => setSelectedId(opt.id)}
            >
              <View style={s.optionContent}>
                <Text style={[s.optionTitle, selectedId === opt.id && s.selectedTitle]}>
                  {opt.title}
                </Text>
                <Text style={[s.optionDesc, selectedId === opt.id && s.selectedDesc]}>
                  {opt.desc}
                </Text>
              </View>
              {selectedId === opt.id && (
                <View style={s.checkmark}>
                  <Text style={s.checkmarkText}>✓</Text>
                </View>
              )}
            </Pressable>
          ))}

          <View style={s.buttonContainer}>
            <Pressable style={s.secondaryButton} onPress={goBackToGender}>
              <Text style={s.secondaryText}>Back</Text>
            </Pressable>

            <AnimatedPressable
              style={[
                s.primaryButton,
                (!selectedId || loading) && s.disabledButton,
                animatedNextStyle,
              ]}
              onPressIn={() => (nextScale.value = withSpring(0.95))}
              onPressOut={() => (nextScale.value = withSpring(1))}
              onPress={handleNext}
              disabled={!selectedId || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryText}>Continue</Text>
              )}
            </AnimatedPressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fff9" },
  loadingContainer: {
    flex: 1, backgroundColor: "#f8fff9",
    justifyContent: "center", alignItems: "center",
  },
  topHeader: {
    paddingTop: Platform.OS === "android" ? 45 : 20,
    paddingBottom: 36, paddingHorizontal: 24,
    backgroundColor: "#f8fff9",
    flexDirection: "row", alignItems: "center",
  },
  header: {
    fontSize: 20, fontWeight: "900", color: "#064e3b",
    flex: 1, textAlign: "center", letterSpacing: 0.6, marginTop: 6,
  },
  subtitle: {
    fontSize: 17, color: "#059669", textAlign: "center",
    paddingHorizontal: 40, marginBottom: 32,
    fontWeight: "600", lineHeight: 24,
  },
  scrollContent: {
    paddingHorizontal: 24, paddingTop: 10,
    paddingBottom: 120, alignItems: "center", flexGrow: 1,
  },
  card: {
    backgroundColor: "#ffffff", borderRadius: 32, padding: 32,
    shadowColor: "#10b981", shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24, shadowRadius: 32, elevation: 22,
    borderWidth: 2, borderColor: "#d1fae5",
    alignSelf: "center", maxWidth: 540, width: "100%",
  },
  optionCard: {
    backgroundColor: "#f0fdf4", borderRadius: 24, padding: 22,
    marginBottom: 18, borderWidth: 2.5, borderColor: "transparent",
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#10b981", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 10,
  },
  selectedCard: {
    backgroundColor: "#ecfdf5", borderColor: "#86efac", shadowOpacity: 0.25,
  },
  optionContent: { flex: 1, paddingRight: 16 },
  optionTitle: { fontSize: 19, fontWeight: "800", color: "#065f46", marginBottom: 6 },
  selectedTitle: { color: "#047857" },
  optionDesc: { fontSize: 15.5, color: "#059669", lineHeight: 22, fontWeight: "500" },
  selectedDesc: { fontWeight: "700" },
  checkmark: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#10b981", justifyContent: "center",
    alignItems: "center", borderWidth: 3, borderColor: "#fff",
  },
  checkmarkText: { color: "#fff", fontSize: 24, fontWeight: "bold", marginTop: -2 },
  buttonContainer: { flexDirection: "row", gap: 18, marginTop: 32 },
  secondaryButton: {
    flex: 1, backgroundColor: "#ecfdf5", borderWidth: 3,
    borderColor: "#86efac", paddingVertical: 20,
    borderRadius: 20, alignItems: "center",
  },
  secondaryText: { color: "#059669", fontSize: 18, fontWeight: "800", letterSpacing: 0.4 },
  primaryButton: {
    flex: 2, backgroundColor: "#10b981", paddingVertical: 20,
    borderRadius: 20, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 16, elevation: 14,
  },
  disabledButton: { opacity: 0.7 },
  primaryText: { color: "#ffffff", fontSize: 18.5, fontWeight: "800", letterSpacing: 0.8 },
  loadingText: {
    marginTop: 24, color: "#059669", fontSize: 18,
    fontWeight: "700", textAlign: "center",
  },
});
