// app/gender.tsx

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
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

const maleImg = require("../assets/images/lalaki.png");
const femaleImg = require("../assets/images/babae.png");

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function GenderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const maleScale = useSharedValue(1);
  const femaleScale = useSharedValue(1);

  const maleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: maleScale.value }],
  }));
  const femaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: femaleScale.value }],
  }));

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/");
          return;
        }
        setUserId(user.id);

        let age = parseFloat(params.age as string);
        let height = parseFloat(params.height as string);
        let weight = parseFloat(params.weight as string);
        let bmi = parseFloat(params.bmi as string);

        // FIX #2/#3: If params are missing, load from DB to pre-fill —
        // but do NOT redirect forward if gender is already set.
        // AuthProvider already determined this is the right screen.
        if (!age || !height || !weight) {
          const { data, error } = await supabase
            .from("weighApp")
            .select("age, height_cm, weight_kg, bmi")
            .eq("id", user.id)
            .single();

          if (error || !data || !data.age || !data.height_cm || !data.weight_kg) {
            Alert.alert("Incomplete", "Please complete your profile first.");
            router.replace("/survey");
            return;
          }

          age = data.age;
          height = data.height_cm;
          weight = data.weight_kg;
          bmi = data.bmi || 0;
        }

        setProfile({ age, height, weight, bmi });
      } catch (e: any) {
        Alert.alert("Error", e.message || "Failed to load profile");
        router.replace("/survey");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const select = async (gender: "Male" | "Female", bmrOffset: number) => {
    if (!userId || !profile) return;

    setLoading(true);
    try {
      const { age, height, weight } = profile;
      const bmr = 10 * weight + 6.25 * height - 5 * age + bmrOffset;

      const { error } = await supabase
        .from("weighApp")
        .update({
          gender,
          bmr: parseFloat(bmr.toFixed(2)),
        })
        .eq("id", userId);

      if (error) throw error;

      router.push({
        pathname: "/activity",
        params: {
          age: age.toString(),
          height: height.toString(),
          weight: weight.toString(),
          bmi: profile.bmi.toString(),
          bmr: bmr.toFixed(2),
        },
      });
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save gender");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={s.loadingText}>Preparing your journey...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      <View style={s.topHeader}>
        <Text style={s.title}>Next step...</Text>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent}>
        <Text style={s.subtitle}>Tell us your biological sex</Text>
        <Text style={s.description}>
          This helps us calculate your metabolism accurately
        </Text>

        <View style={s.cardsColumn}>
          {/* MALE */}
          <AnimatedPressable
            style={[s.genderCard, s.maleCard, maleStyle]}
            onPressIn={() => (maleScale.value = withSpring(0.96))}
            onPressOut={() => (maleScale.value = withSpring(1))}
            onPress={() => select("Male", 5)}
            disabled={loading}
          >
            <Image source={maleImg} style={s.image} resizeMode="contain" />
            <Text style={s.genderLabel}>Male</Text>
          </AnimatedPressable>

          {/* FEMALE */}
          <AnimatedPressable
            style={[s.genderCard, s.femaleCard, femaleStyle]}
            onPressIn={() => (femaleScale.value = withSpring(0.96))}
            onPressOut={() => (femaleScale.value = withSpring(1))}
            onPress={() => select("Female", -161)}
            disabled={loading}
          >
            <Image source={femaleImg} style={s.image} resizeMode="contain" />
            <Text style={s.genderLabel}>Female</Text>
          </AnimatedPressable>
        </View>
      </ScrollView>

      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      )}
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
    paddingTop: Platform.OS === "android" ? 45 : 24,
    paddingBottom: 40, paddingHorizontal: 24, alignItems: "center",
  },
  title: {
    fontSize: 36, fontWeight: "900", color: "#064e3b",
    textAlign: "center", letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 21, fontWeight: "800", color: "#059669",
    textAlign: "center", marginBottom: 12,
  },
  description: {
    fontSize: 17, color: "#065f46", textAlign: "center",
    lineHeight: 26, marginBottom: 50, paddingHorizontal: 32, fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 24, paddingBottom: 120,
    alignItems: "center", flexGrow: 1,
  },
  cardsColumn: { width: "100%", maxWidth: 400, gap: 36, alignItems: "center" },
  genderCard: {
    width: "100%", height: 300, backgroundColor: "#ffffff",
    borderRadius: 42, padding: 32, alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981", shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28, shadowRadius: 40, elevation: 30, borderWidth: 4,
  },
  maleCard: { borderColor: "#86efac" },
  femaleCard: { borderColor: "#fdb8e9" },
  image: { width: 180, height: 180, marginBottom: 24 },
  genderLabel: {
    fontSize: 34, fontWeight: "900", color: "#065f46", letterSpacing: 1.8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(248, 255, 249, 0.97)",
    justifyContent: "center", alignItems: "center", zIndex: 10,
  },
  loadingText: { marginTop: 24, fontSize: 19, color: "#059669", fontWeight: "700" },
});
