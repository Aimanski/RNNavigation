// Dashboard

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../components/ui/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import { cache } from "../lib/cache";
import { getSessionUser } from "../lib/auth/session";
import { supabase } from "../lib/supabase";
import { Colors, useTheme } from "../providers/ThemeProvider";

const MACRO_ICONS: Record<string, string> = {
  Protein: "barbell-outline",
  Carbs: "nutrition-outline",
  Fat: "water-outline",
};

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

type DashboardSnapshot = {
  calorieGoal: number | null;
  dailyCalories: CalorieEntry[];
  todayCalories: number;
  todayMacros: MacroEntry;
};

const DASHBOARD_CACHE_KEY = "dashboard:snapshot";

export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  // Cache
  const cached = cache.get<DashboardSnapshot>(DASHBOARD_CACHE_KEY);
  const [dailyCalories, setDailyCalories] = useState<CalorieEntry[]>(cached?.dailyCalories ?? []);
  const [todayCalories, setTodayCalories] = useState<number>(cached?.todayCalories ?? 0);
  const [todayMacros,   setTodayMacros]   = useState<MacroEntry>(cached?.todayMacros ?? { protein: 0, carbs: 0, fat: 0 });
  const [calorieGoal,   setCalorieGoal]   = useState<number | null>(cached?.calorieGoal ?? null);
  const [loading,       setLoading]       = useState(!cached);

  useEffect(() => {
    let mounted = true;
    let subscription: ReturnType<typeof supabase.channel> | null = null;

    const fetchData = async (userId: string) => {
      try {
        const todayStr = getTodayPHDateString();

        // Parallel
        const [profileRes, foodsRes] = await Promise.all([
          supabase.from("weighApp").select("goal_calories").eq("id", userId).single(),
          supabase
            .from("selected_foods")
            .select("calories, quantity, protein, carbs, fat, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
        ]);

        const { data: profileData, error: profileError } = profileRes;
        const { data, error } = foodsRes;

        if (error) throw error;
        if (!mounted) return;

        const groupedByDate = (data || []).reduce(
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

        const todayData = groupedByDate[todayStr] || { calories: 0, protein: 0, carbs: 0, fat: 0 };
        const snapshot: DashboardSnapshot = {
          calorieGoal: profileError ? null : (profileData?.goal_calories ?? 2000),
          dailyCalories: calorieHistory,
          todayCalories: Math.round(todayData.calories),
          todayMacros: {
            protein: parseFloat(todayData.protein.toFixed(1)),
            carbs:   parseFloat(todayData.carbs.toFixed(1)),
            fat:     parseFloat(todayData.fat.toFixed(1)),
          },
        };

        cache.set(DASHBOARD_CACHE_KEY, snapshot);
        setCalorieGoal(snapshot.calorieGoal);
        setDailyCalories(snapshot.dailyCalories);
        setTodayCalories(snapshot.todayCalories);
        setTodayMacros(snapshot.todayMacros);
      } catch (err: any) {
        console.error("Error fetching data:", err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    (async () => {
      const user = await getSessionUser();
      if (!mounted) return;
      if (!user) { setLoading(false); return; }

      fetchData(user.id);

      // Cleanup
      subscription = supabase
        .channel("selected_foods-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "selected_foods", filter: `user_id=eq.${user.id}` },
          () => {
            if (mounted) fetchData(user.id);
          }
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

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
        <View style={s.headerIconBadge}>
          <Ionicons name="flame" size={22} color={colors.onAccent} />
        </View>
        <View style={s.headerTextWrap}>
          <Text style={s.headerSub}>Fitness Dashboard</Text>
          <Text style={s.header}>Your Daily Summary</Text>
        </View>
        {loading && <ActivityIndicator size="small" color={colors.accent} />}
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation */}
        <Pressable
          style={({ pressed }) => [s.historyBtn, pressed && s.historyBtnPressed]}
          onPress={() => router.push("/history")}
          accessibilityRole="button"
          accessibilityLabel="View your calorie history"
        >
          <View style={s.historyBtnIcon}>
            <Ionicons name="time-outline" size={20} color={colors.accent} />
          </View>
          <Text style={s.historyBtnText}>View your calorie history</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.accent} />
        </Pressable>

        {/* Progress */}
        <View style={s.card}>
          <View style={s.cardLabelRow}>
            <Ionicons name="flame-outline" size={13} color={colors.accentDark} />
            <Text style={s.cardLabel}>Daily Calories</Text>
          </View>
          <Text style={s.cardTitle}>Today&apos;s Progress</Text>
          <View style={s.dateChip}>
            <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
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
                { width: `${displayProgress}%` as any, backgroundColor: isOver ? "#ef4444" : colors.accent },
              ]}
            />
          </View>
          <Text style={[s.barPct, { color: isOver ? "#ef4444" : colors.textSecondary }]}>
            {isOver
              ? `${Math.round(progress)}% — daily goal exceeded`
              : `${Math.round(progress)}% of daily goal`}
          </Text>
        </View>

        {/* Macros */}
        <View style={s.card}>
          <View style={s.cardLabelRow}>
            <Ionicons name="pie-chart-outline" size={13} color={colors.accentDark} />
            <Text style={s.cardLabel}>Actual Intake</Text>
          </View>
          <Text style={s.cardTitle}>Today&apos;s Macros</Text>
          {todayCalories > 0 ? (
            <>
              <View style={s.stackedTrack}>
                <View style={[s.stackedSeg, {
                  width: `${macroPercentToday.protein}%` as any,
                  backgroundColor: colors.accent,
                  borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
                }]} />
                <View style={[s.stackedSeg, {
                  width: `${macroPercentToday.carbs}%` as any,
                  backgroundColor: colors.brown,
                }]} />
                <View style={[s.stackedSeg, {
                  flex: 1, backgroundColor: "#fbbf24",
                  borderTopRightRadius: 10, borderBottomRightRadius: 10,
                }]} />
              </View>
              <View style={s.legend}>
                {[
                  { color: colors.accent, label: "Protein", value: `${todayMacros.protein}g` },
                  { color: colors.brown,  label: "Carbs",   value: `${todayMacros.carbs}g` },
                  { color: "#fbbf24",     label: "Fat",     value: `${todayMacros.fat}g` },
                ].map(({ color, label, value }) => (
                  <View key={label} style={s.legendItem}>
                    <View style={[s.legendIconDot, { backgroundColor: color }]}>
                      <Ionicons name={MACRO_ICONS[label] as any} size={12} color="#ffffff" />
                    </View>
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

        {/* Goals */}
        <View style={s.card}>
          <View style={s.cardLabelRow}>
            <Ionicons name="flag-outline" size={13} color={colors.accentDark} />
            <Text style={s.cardLabel}>Macro Goals</Text>
          </View>
          <Text style={s.cardTitle}>
            Ideal Daily Macros{"\n"}
            <Text style={s.cardTitleSub}>Goal: {goal.toLocaleString()} kcal</Text>
          </Text>
          <View style={s.stackedTrack}>
            <View style={[s.stackedSeg, {
              width: `${macroPercentGoal.protein}%` as any,
              backgroundColor: colors.accent,
              borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
            }]} />
            <View style={[s.stackedSeg, {
              width: `${macroPercentGoal.carbs}%` as any,
              backgroundColor: colors.brown,
            }]} />
            <View style={[s.stackedSeg, {
              flex: 1, backgroundColor: "#fbbf24",
              borderTopRightRadius: 10, borderBottomRightRadius: 10,
            }]} />
          </View>
          <View style={s.legend}>
            {[
              { color: colors.accent, label: "Protein", pct: "20%", value: `${goalProtein}g` },
              { color: colors.brown,  label: "Carbs",   pct: "50%", value: `${goalCarbs}g` },
              { color: "#fbbf24",     label: "Fat",     pct: "30%", value: `${goalFat}g` },
            ].map(({ color, label, pct, value }) => (
              <View key={label} style={s.legendItem}>
                <View style={[s.legendIconDot, { backgroundColor: color }]}>
                  <Ionicons name={MACRO_ICONS[label] as any} size={12} color="#ffffff" />
                </View>
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

        {/* History */}
        <View style={s.card}>
          <View style={s.cardLabelRow}>
            <Ionicons name="time-outline" size={13} color={colors.accentDark} />
            <Text style={s.cardLabel}>History</Text>
          </View>
          <Text style={s.cardTitle}>Daily Calorie Intake</Text>
          {dailyCalories.length > 0 ? (
            dailyCalories.map((entry, index) => (
              <View
                key={index}
                style={[s.historyItem, index === dailyCalories.length - 1 && { borderBottomWidth: 0 }]}
              >
                <Ionicons name="calendar-clear-outline" size={16} color={colors.accentDark} style={s.historyIcon} />
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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 18, paddingBottom: 210 },
    topHeader: {
      paddingTop: 10,
      paddingBottom: 24, paddingHorizontal: 20,
      backgroundColor: c.background,
      flexDirection: "row", alignItems: "center", gap: 14,
    },
    headerIconBadge: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: c.accent, alignItems: "center", justifyContent: "center",
      shadowColor: c.accent, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
    },
    headerTextWrap: { flex: 1 },
    headerSub: {
      fontSize: 10, fontWeight: "700", letterSpacing: 2.5,
      color: c.accentDark, textTransform: "uppercase", marginBottom: 2,
    },
    header: { fontSize: 21, fontWeight: "900", color: c.textPrimary, letterSpacing: -0.3 },
    historyBtn: {
      flexDirection: "row", alignItems: "center", gap: 12,
      backgroundColor: c.surface, borderRadius: 20,
      borderWidth: 1.5, borderColor: c.accent,
      paddingVertical: 12, paddingHorizontal: 14, marginBottom: 18,
    },
    historyBtnPressed: { backgroundColor: c.surfaceAlt },
    historyBtnIcon: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center",
    },
    historyBtnText: { flex: 1, fontSize: 15.5, fontWeight: "800", color: c.accent },
    card: {
      backgroundColor: c.surface, borderRadius: 28, padding: 28, marginBottom: 18,
      borderWidth: 1.5, borderColor: c.border,
    },
    cardLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
    cardLabel: {
      fontSize: 10, fontWeight: "700", letterSpacing: 2,
      color: c.accentDark, textTransform: "uppercase",
    },
    cardTitle: { fontSize: 18, fontWeight: "800", color: c.textPrimary, marginBottom: 18, lineHeight: 24 },
    cardTitleSub: { fontSize: 13, fontWeight: "600", color: c.accentDark },
    dateChip: {
      flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
      gap: 7, backgroundColor: c.surfaceAlt,
      borderWidth: 1, borderColor: c.border, borderRadius: 20,
      paddingVertical: 5, paddingHorizontal: 12, marginBottom: 18,
    },
    dateText: { fontSize: 12, fontWeight: "600", color: c.textSecondary },
    calRow: { marginBottom: 14 },
    calConsumed: { fontSize: 28, fontWeight: "800", color: c.textPrimary, letterSpacing: -0.5 },
    calGoal: { fontSize: 16, fontWeight: "500", color: "#9ca3af" },
    barTrack: {
      height: 24, backgroundColor: c.surfaceAlt, borderRadius: 12,
      overflow: "hidden", borderWidth: 1.5, borderColor: c.border, marginBottom: 10,
    },
    barFill: { height: "100%", borderRadius: 10 },
    barPct: { fontSize: 13, fontWeight: "700", textAlign: "center" },
    stackedTrack: {
      height: 24, backgroundColor: c.surfaceAlt, borderRadius: 12,
      overflow: "hidden", borderWidth: 1.5, borderColor: c.border,
      marginBottom: 18, flexDirection: "row",
    },
    stackedSeg: { height: "100%" },
    legend: { gap: 11 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 10 },
    legendIconDot: {
      width: 22, height: 22, borderRadius: 11,
      alignItems: "center", justifyContent: "center",
    },
    legendLabel: { fontSize: 14, fontWeight: "600", color: c.textPrimary, flex: 1 },
    legendPct: { fontSize: 12, fontWeight: "500", color: "#6b7280" },
    legendValue: { fontSize: 14, fontWeight: "800", color: c.textPrimary },
    divider: { height: 1, backgroundColor: c.border, marginVertical: 16 },
    totalLine: { fontSize: 12, fontWeight: "600", color: c.accent, textAlign: "center", letterSpacing: 0.3 },
    noData: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginTop: 8, fontStyle: "italic" },
    historyItem: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.surfaceAlt,
    },
    historyIcon: { marginTop: 1 },
    historyText: { fontSize: 15, fontWeight: "600", color: c.textSecondary },
    historyValue: { fontWeight: "800", color: c.textPrimary },
  });
