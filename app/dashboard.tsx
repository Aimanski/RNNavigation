// app/dashboard.tsx

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

const PH_TIMEZONE = "Asia/Manila";

const getPHDateString = (dateString: string): string => {
  const date = new Date(dateString);
  const year  = date.toLocaleString("en-US", { timeZone: PH_TIMEZONE, year: "numeric" });
  const month = date.toLocaleString("en-US", { timeZone: PH_TIMEZONE, month: "2-digit" });
  const day   = date.toLocaleString("en-US", { timeZone: PH_TIMEZONE, day: "2-digit" });
  return `${year}-${month}-${day}`;
};

const formatPHDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    timeZone: PH_TIMEZONE,
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
};

const getTodayPHDateString = (): string => {
  const now = new Date();
  const year  = now.toLocaleString("en-US", { timeZone: PH_TIMEZONE, year: "numeric" });
  const month = now.toLocaleString("en-US", { timeZone: PH_TIMEZONE, month: "2-digit" });
  const day   = now.toLocaleString("en-US", { timeZone: PH_TIMEZONE, day: "2-digit" });
  return `${year}-${month}-${day}`;
};

type CalorieEntry = { date: string; calories: number };
type MacroEntry   = { protein: number; carbs: number; fat: number };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function DashboardScreen() {
  const router = useRouter();

  const [dailyCalories, setDailyCalories] = useState<CalorieEntry[]>([]);
  const [todayCalories, setTodayCalories] = useState<number>(0);
  const [todayMacros,   setTodayMacros]   = useState<MacroEntry>({ protein: 0, carbs: 0, fat: 0 });
  const [calorieGoal,   setCalorieGoal]   = useState<number | null>(null);
  const [loading,       setLoading]       = useState(true);

  const backScale = useSharedValue(1);
  const animatedBackStyle = useAnimatedStyle(() => ({ transform: [{ scale: backScale.value }] }));

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted) { setLoading(false); return; }

        const userId   = user.id;
        const todayStr = getTodayPHDateString();

        const { data: profileData, error: profileError } = await supabase
          .from("weighApp")
          .select("goal_calories")
          .eq("id", userId)
          .single();

        if (mounted) setCalorieGoal(profileError ? null : (profileData?.goal_calories ?? 2000));

        const { data, error } = await supabase
          .from("selected_foods")
          .select("calories, quantity, protein, carbs, fat, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!mounted) return;

        const groupedByDate = data.reduce(
          (acc: Record<string, any>, item) => {
            const phDateStr = getPHDateString(item.created_at);
            if (!acc[phDateStr]) acc[phDateStr] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
            const qty = item.quantity ?? 1;
            acc[phDateStr].calories += (item.calories ?? 0) * qty;
            acc[phDateStr].protein  += (item.protein  ?? 0) * qty;
            acc[phDateStr].carbs    += (item.carbs    ?? 0) * qty;
            acc[phDateStr].fat      += (item.fat      ?? 0) * qty;
            return acc;
          },
          {}
        );

        const calorieHistory: CalorieEntry[] = Object.entries(groupedByDate)
          .map(([date, totals]) => ({ date, calories: Math.round((totals as any).calories) }))
          .sort((a, b) => b.date.localeCompare(a.date));

        if (!mounted) return;
        setDailyCalories(calorieHistory);

        const todayData = groupedByDate[todayStr] || { calories: 0, protein: 0, carbs: 0, fat: 0 };
        setTodayCalories(Math.round(todayData.calories));
        setTodayMacros({
          protein: parseFloat(todayData.protein.toFixed(1)),
          carbs:   parseFloat(todayData.carbs.toFixed(1)),
          fat:     parseFloat(todayData.fat.toFixed(1)),
        });
      } catch (err: any) {
        console.error("Error fetching data:", err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    // FIX: Store subscription and unsubscribe on cleanup to prevent memory leak
    const subscription = supabase
      .channel("selected_foods-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "selected_foods" }, () => {
        if (mounted) fetchData();
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(subscription);
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={s.loadingText}>Loading your summary…</Text>
      </SafeAreaView>
    );
  }

  const goal           = calorieGoal ?? 2000;
  const progress       = (todayCalories / goal) * 100;
  const displayProgress = Math.min(progress, 100);
  const isOver         = progress > 100;
  const todayDate      = formatPHDate(new Date().toISOString());

  const totalActualGrams = todayMacros.protein + todayMacros.carbs + todayMacros.fat;
  const macroPercentToday = {
    protein: totalActualGrams > 0 ? (todayMacros.protein / totalActualGrams) * 100 : 0,
    carbs:   totalActualGrams > 0 ? (todayMacros.carbs   / totalActualGrams) * 100 : 0,
    fat:     totalActualGrams > 0 ? (todayMacros.fat     / totalActualGrams) * 100 : 0,
  };

  const goalProtein    = Math.round((0.20 * goal) / 4);
  const goalCarbs      = Math.round((0.50 * goal) / 4);
  const goalFat        = Math.round((0.30 * goal) / 9);
  const totalGoalGrams = goalProtein + goalCarbs + goalFat;
  const macroPercentGoal = {
    protein: totalGoalGrams > 0 ? (goalProtein / totalGoalGrams) * 100 : 33.33,
    carbs:   totalGoalGrams > 0 ? (goalCarbs   / totalGoalGrams) * 100 : 33.33,
    fat:     totalGoalGrams > 0 ? (goalFat     / totalGoalGrams) * 100 : 33.34,
  };

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      <View style={s.topHeader}>
        <AnimatedPressable
          style={[s.backButton, animatedBackStyle]}
          onPressIn={() => (backScale.value = withSpring(0.92))}
          onPressOut={() => (backScale.value = withSpring(1))}
          onPress={() => router.push("/main")}
        >
          <Ionicons name="arrow-back" size={28} color="#10b981" />
        </AnimatedPressable>
        <View style={s.headerTextWrap}>
          <Text style={s.headerSub}>Fitness Dashboard</Text>
          <Text style={s.header}>Your Daily Summary</Text>
        </View>
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Card 1: Today's Progress */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Daily Calories</Text>
          <Text style={s.cardTitle}>Today's Progress</Text>
          <View style={s.dateChip}>
            <View style={s.dateDot} />
            <Text style={s.dateText}>{todayDate}</Text>
          </View>
          <View style={s.calRow}>
            <Text style={s.calConsumed}>
              {todayCalories.toLocaleString()}
              <Text style={s.calGoal}> / {goal.toLocaleString()} kcal</Text>
            </Text>
          </View>
          <View style={s.barTrack}>
            <View
              style={[
                s.barFill,
                { width: `${displayProgress}%` as any, backgroundColor: isOver ? "#ef4444" : "#10b981" },
              ]}
            />
          </View>
          <Text style={[s.barPct, { color: isOver ? "#ef4444" : "#059669" }]}>
            {isOver
              ? `${Math.round(progress)}% — daily goal exceeded`
              : `${Math.round(progress)}% of daily goal`}
          </Text>
        </View>

        {/* Card 2: Today's Macros */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Actual Intake</Text>
          <Text style={s.cardTitle}>Today's Macros</Text>
          {todayCalories > 0 ? (
            <>
              <View style={s.stackedTrack}>
                <View style={[s.stackedSeg, {
                  width: `${macroPercentToday.protein}%` as any,
                  backgroundColor: "#10b981",
                  borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
                }]} />
                <View style={[s.stackedSeg, {
                  width: `${macroPercentToday.carbs}%` as any,
                  backgroundColor: "#4ade80",
                }]} />
                <View style={[s.stackedSeg, {
                  flex: 1, backgroundColor: "#fbbf24",
                  borderTopRightRadius: 10, borderBottomRightRadius: 10,
                }]} />
              </View>
              <View style={s.legend}>
                {[
                  { color: "#10b981", label: "Protein", value: `${todayMacros.protein}g` },
                  { color: "#4ade80", label: "Carbs",   value: `${todayMacros.carbs}g` },
                  { color: "#fbbf24", label: "Fat",     value: `${todayMacros.fat}g` },
                ].map(({ color, label, value }) => (
                  <View key={label} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: color }]} />
                    <Text style={s.legendLabel}>{label}</Text>
                    <Text style={s.legendValue}>{value}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={s.noData}>No calories logged today.</Text>
          )}
        </View>

        {/* Card 3: Ideal Daily Macros */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Macro Goals</Text>
          <Text style={s.cardTitle}>
            Ideal Daily Macros{"\n"}
            <Text style={s.cardTitleSub}>Goal: {goal.toLocaleString()} kcal</Text>
          </Text>
          <View style={s.stackedTrack}>
            <View style={[s.stackedSeg, {
              width: `${macroPercentGoal.protein}%` as any,
              backgroundColor: "#10b981",
              borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
            }]} />
            <View style={[s.stackedSeg, {
              width: `${macroPercentGoal.carbs}%` as any,
              backgroundColor: "#4ade80",
            }]} />
            <View style={[s.stackedSeg, {
              flex: 1, backgroundColor: "#fbbf24",
              borderTopRightRadius: 10, borderBottomRightRadius: 10,
            }]} />
          </View>
          <View style={s.legend}>
            {[
              { color: "#10b981", label: "Protein", pct: "20%", value: `${goalProtein}g` },
              { color: "#4ade80", label: "Carbs",   pct: "50%", value: `${goalCarbs}g` },
              { color: "#fbbf24", label: "Fat",     pct: "30%", value: `${goalFat}g` },
            ].map(({ color, label, pct, value }) => (
              <View key={label} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: color }]} />
                <Text style={s.legendLabel}>
                  {label} <Text style={s.legendPct}>({pct})</Text>
                </Text>
                <Text style={s.legendValue}>{value}</Text>
              </View>
            ))}
          </View>
          <View style={s.divider} />
          <Text style={s.totalLine}>
            Total: {totalGoalGrams}g · protein + carbs + fat
          </Text>
        </View>

        {/* Calorie History */}
        <View style={s.card}>
          <Text style={s.cardLabel}>History</Text>
          <Text style={s.cardTitle}>Daily Calorie Intake</Text>
          {dailyCalories.length > 0 ? (
            dailyCalories.map((entry, index) => (
              <View
                key={index}
                style={[s.historyItem, index === dailyCalories.length - 1 && { borderBottomWidth: 0 }]}
              >
                <Text style={s.historyText}>
                  {formatPHDate(entry.date + "T00:00:00Z")}
                  {"  "}
                  <Text style={s.historyValue}>{entry.calories.toLocaleString()} kcal</Text>
                </Text>
              </View>
            ))
          ) : (
            <Text style={s.noData}>No calorie history available.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f0fdf4" },
  loadingContainer: { flex: 1, backgroundColor: "#f0fdf4", justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#059669", marginTop: 20, fontSize: 16, fontWeight: "700" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 120 },
  topHeader: {
    paddingTop: Platform.OS === "android" ? 50 : 20,
    paddingBottom: 24, paddingHorizontal: 20,
    backgroundColor: "#f0fdf4",
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  backButton: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: "#a7f3d0",
    shadowColor: "#10b981", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 8,
  },
  headerTextWrap: { flex: 1 },
  headerSub: {
    fontSize: 10, fontWeight: "700", letterSpacing: 2.5,
    color: "#34d399", textTransform: "uppercase", marginBottom: 2,
  },
  header: { fontSize: 21, fontWeight: "900", color: "#064e3b", letterSpacing: -0.3 },
  card: {
    backgroundColor: "#ffffff", borderRadius: 28, padding: 28, marginBottom: 18,
    borderWidth: 1.5, borderColor: "#d1fae5",
    shadowColor: "#10b981", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 16,
  },
  cardLabel: {
    fontSize: 10, fontWeight: "700", letterSpacing: 2,
    color: "#34d399", textTransform: "uppercase", marginBottom: 4,
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#065f46", marginBottom: 18, lineHeight: 24 },
  cardTitleSub: { fontSize: 13, fontWeight: "600", color: "#34d399" },
  dateChip: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    gap: 7, backgroundColor: "#ecfdf5",
    borderWidth: 1, borderColor: "#a7f3d0", borderRadius: 20,
    paddingVertical: 5, paddingHorizontal: 12, marginBottom: 18,
  },
  dateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981" },
  dateText: { fontSize: 12, fontWeight: "600", color: "#059669" },
  calRow: { marginBottom: 14 },
  calConsumed: { fontSize: 28, fontWeight: "800", color: "#064e3b", letterSpacing: -0.5 },
  calGoal: { fontSize: 16, fontWeight: "500", color: "#9ca3af" },
  barTrack: {
    height: 24, backgroundColor: "#ecfdf5", borderRadius: 12,
    overflow: "hidden", borderWidth: 1.5, borderColor: "#a7f3d0", marginBottom: 10,
  },
  barFill: { height: "100%", borderRadius: 10 },
  barPct: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  stackedTrack: {
    height: 24, backgroundColor: "#ecfdf5", borderRadius: 12,
    overflow: "hidden", borderWidth: 1.5, borderColor: "#a7f3d0",
    marginBottom: 18, flexDirection: "row",
  },
  stackedSeg: { height: "100%" },
  legend: { gap: 11 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { fontSize: 14, fontWeight: "600", color: "#065f46", flex: 1 },
  legendPct: { fontSize: 12, fontWeight: "500", color: "#6b7280" },
  legendValue: { fontSize: 14, fontWeight: "800", color: "#064e3b" },
  divider: { height: 1, backgroundColor: "#d1fae5", marginVertical: 16 },
  totalLine: { fontSize: 12, fontWeight: "600", color: "#10b981", textAlign: "center", letterSpacing: 0.3 },
  noData: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginTop: 8, fontStyle: "italic" },
  historyItem: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#ecfdf5" },
  historyText: { fontSize: 15, fontWeight: "600", color: "#059669" },
  historyValue: { fontWeight: "800", color: "#065f46" },
});
