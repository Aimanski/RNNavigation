// app/recommend.tsx — FINAL PREMIUM VERSION + BMI-BASED RECOMMENDATION

import { useRouter } from "expo-router";
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

export default function RecommendScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [tdee, setTdee] = useState(0);
  const [bmi, setBmi] = useState<number | null>(null);
  const [selected, setSelected] = useState<"lose" | "maintain" | "gain">("maintain");
  const [loading, setLoading] = useState(true);

  const ctaScale = useSharedValue(1);
  const animatedCtaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  // Block hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  // Load TDEE + BMI
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.replace("/Index");

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

        // Auto-select recommended goal based on BMI
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let targetCalories = tdee;
      if (selected === "lose") targetCalories = tdee - 500;
      if (selected === "gain") targetCalories = tdee + 500;

      const { error } = await supabase
        .from("weighApp")
        .update({ goal_calories: targetCalories })
        .eq("id", user.id);

      if (error) throw error;

      router.replace("/main");
    } catch (err: any) {
      Alert.alert("Oops", err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={s.loadingText}>Preparing your plan...</Text>
      </SafeAreaView>
    );
  }

  // Determine which goal is recommended based on BMI
  const getRecommendedGoal = () => {
    if (!bmi) return null;
    if (bmi < 18.5) return "gain";
    if (bmi >= 18.5 && bmi <= 24.9) return "maintain";
    if (bmi >= 25) return "lose";
    return null;
  };

  const recommendedGoal = getRecommendedGoal();

  const goals = [
    {
      key: "lose" as const,
      title: "Lose Weight",
      desc: `${tdee - 500} kcal/day`,
      subtitle: "-500 kcal deficit",
      color: "#f87171",
      gradient: ["#fef2f2", "#fee2e2"],
    },
    {
      key: "maintain" as const,
      title: "Maintain Weight",
      desc: `${tdee} kcal/day`,
      subtitle: "Perfect balance",
      color: "#10b981",
      gradient: ["#ecfdf5", "#d1fae5"],
    },
    {
      key: "gain" as const,
      title: "Gain Weight",
      desc: `${tdee + 500} kcal/day`,
      subtitle: "+500 kcal surplus",
      color: "#60a5fa",
      gradient: ["#eff6ff", "#dbeafe"],
    },
  ];

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      {/* Premium Header */}
      <View style={s.topHeader}>
        <Text style={s.title}>What’s Your Goal?</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.subtitle}>
          Your daily maintenance: <Text style={s.tdee}>{tdee}</Text> kcal
        </Text>

        <View style={s.cards}>
          {goals.map((goal) => (
            <Pressable
              key={goal.key}
              style={[
                s.card,
                selected === goal.key && s.selectedCard,
              ]}
              onPress={() => setSelected(goal.key)}
            >
              <View style={s.cardHeader}>
                <View style={[s.dot, { backgroundColor: goal.color }]} />
                <Text style={[s.cardTitle, selected === goal.key && s.selectedTitle]}>
                  {goal.title}
                </Text>
                {recommendedGoal === goal.key && (
                  <View style={s.recommendedBadge}>
                    <Text style={s.recommendedText}>Recommended</Text>
                  </View>
                )}
              </View>

              <Text style={[s.cardDesc, selected === goal.key && s.selectedDesc]}>
                {goal.desc}
              </Text>
              <Text style={s.cardSub}>{goal.subtitle}</Text>
            </Pressable>
          ))}
        </View>

        {/* Final CTA */}
        <AnimatedPressable
          style={[
            s.ctaButton,
            loading && s.disabledButton,
            animatedCtaStyle,
          ]}
          onPressIn={() => (ctaScale.value = withSpring(0.96))}
          onPressOut={() => (ctaScale.value = withSpring(1))}
          onPress={saveAndFinish}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.ctaText}>Start My Journey!</Text>
          )}
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// PREMIUM & RESPONSIVE STYLES + RECOMMENDED BADGE
const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fff9",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f8fff9",
    justifyContent: "center",
    alignItems: "center",
  },
  topHeader: {
    paddingTop: Platform.OS === "android" ? 45 : 24,
    paddingBottom: 40,
    paddingHorizontal: 24,
    backgroundColor: "#f8fff9",
    alignItems: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#064e3b",
    textAlign: "center",
    letterSpacing: 0.8,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#059669",
    textAlign: "center",
    marginBottom: 40,
    fontWeight: "700",
    paddingHorizontal: 20,
    lineHeight: 26,
  },
  tdee: {
    fontWeight: "900",
    color: "#10b981",
    fontSize: 17,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    alignItems: "center",
    flexGrow: 1,
  },
  cards: {
    gap: 22,
    width: "100%",
    maxWidth: 540,
    marginBottom: 50,
  },
  card: {
    backgroundColor: "#ffffff",
    paddingVertical: 32,
    paddingHorizontal: 28,
    borderRadius: 32,
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 20,
    borderWidth: 2.5,
    borderColor: "#ecfdf5",
  },
  selectedCard: {
    borderColor: "#10b981",
    backgroundColor: "#f0fdf4",
    shadowOpacity: 0.3,
    transform: [{ scale: 1.04 }],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "#fff",
  },
  cardTitle: {
    fontSize: 25,
    fontWeight: "900",
    color: "#065f46",
  },
  selectedTitle: {
    color: "#10b981",
  },
  cardDesc: {
    fontSize: 30,
    fontWeight: "900",
    color: "#065f46",
    marginVertical: 10,
    letterSpacing: 0.5,
  },
  selectedDesc: {
    color: "#10b981",
  },
  cardSub: {
    fontSize: 17,
    color: "#059669",
    fontWeight: "700",
    marginTop: 4,
  },
  recommendedBadge: {
    backgroundColor: "#10b981",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 8,
  },
  recommendedText: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  ctaButton: {
    backgroundColor: "#10b981",
    paddingVertical: 22,
    paddingHorizontal: 40,
    borderRadius: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 22,
    minWidth: 280,
  },
  disabledButton: {
    opacity: 0.75,
  },
  ctaText: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 1,
  },
  loadingText: {
    marginTop: 24,
    fontSize: 18,
    color: "#059669",
    fontWeight: "700",
  },
});