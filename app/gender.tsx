// Gender

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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { FemaleCharacter, MaleCharacter } from "../components/brand/GenderCharacters";
import StepProgress from "../components/ui/StepProgress";
import { supabase } from "../lib/supabase";
import { getSessionUser } from "../lib/auth/session";
import { resetTo } from "../lib/navigation";
import { Colors, useTheme } from "../providers/ThemeProvider";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CHARACTER_SIZE = 116;

export default function GenderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

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
    (async () => {
      try {
        const user = await getSessionUser();
        if (!user) {
          router.replace("/");
          return;
        }
        setUserId(user.id);

        let age = parseFloat(params.age as string);
        let height = parseFloat(params.height as string);
        let weight = parseFloat(params.weight as string);
        let bmi = parseFloat(params.bmi as string);

        // Prefill
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
  }, [params.age, params.bmi, params.height, params.weight, router]);

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

      resetTo(router, {
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
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={s.loadingText}>Preparing your journey...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      <View style={s.topHeader}>
        <View style={s.progressWrap}>
          <StepProgress step={2} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>Tell us your biological sex</Text>
        <Text style={s.description}>
          This helps us calculate your metabolism accurately
        </Text>

        <View style={s.cardsRow}>
          {/* Male */}
          <AnimatedPressable
            style={[s.genderCard, s.maleCard, maleStyle]}
            onPressIn={() => (maleScale.value = withSpring(0.96))}
            onPressOut={() => (maleScale.value = withSpring(1))}
            onPress={() => select("Male", 5)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Male"
          >
            <View style={s.character}>
              <MaleCharacter size={CHARACTER_SIZE} backdrop={isDark ? "#1F3A57" : "#CFE4FB"} />
            </View>
            <Text style={s.genderLabel}>Male</Text>
          </AnimatedPressable>

          {/* Female */}
          <AnimatedPressable
            style={[s.genderCard, s.femaleCard, femaleStyle]}
            onPressIn={() => (femaleScale.value = withSpring(0.96))}
            onPressOut={() => (femaleScale.value = withSpring(1))}
            onPress={() => select("Female", -161)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Female"
          >
            <View style={s.character}>
              <FemaleCharacter size={CHARACTER_SIZE} backdrop={isDark ? "#4A2A3F" : "#FAD1EA"} />
            </View>
            <Text style={s.genderLabel}>Female</Text>
          </AnimatedPressable>
        </View>

        <View style={s.noteRow}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
          <Text style={s.noteText}>Only used to estimate your daily calorie needs</Text>
        </View>
      </ScrollView>

      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors, isDark: boolean) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    pressed: { opacity: 0.7 },
    loadingContainer: {
      flex: 1,
      backgroundColor: c.background,
      justifyContent: "center",
      alignItems: "center",
    },
    // Header
    topHeader: {
      paddingTop: 22,
      paddingBottom: 12,
      paddingHorizontal: 24,
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      justifyContent: "center",
      alignItems: "center",
    },
    progressWrap: { width: "100%" },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 40,
      flexGrow: 1,
      justifyContent: "center",
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: c.textPrimary,
      textAlign: "center",
      marginBottom: 8,
    },
    description: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 28,
      paddingHorizontal: 16,
      fontWeight: "500",
    },
    cardsRow: { flexDirection: "row", gap: 14, width: "100%" },
    genderCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 28,
      paddingVertical: 22,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
    },
    maleCard: {
      borderColor: c.borderStrong,
      backgroundColor: c.surfaceAlt,
    },
    femaleCard: {
      borderColor: "#fdb8e9",
      backgroundColor: isDark ? "#2A1A25" : "#FFF3FB",
    },
    character: { marginBottom: 14 },
    genderLabel: {
      fontSize: 22,
      fontWeight: "800",
      color: c.textPrimary,
      letterSpacing: 0.5,
    },
    noteRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 22,
    },
    noteText: { fontSize: 12.5, fontWeight: "600", color: c.textMuted },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.background + "F2",
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: { marginTop: 24, fontSize: 18, color: c.textSecondary, fontWeight: "700" },
  });
