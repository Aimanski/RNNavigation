// History

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "../components/ui/AppText";
import { supabase } from "../lib/supabase";
import { getSessionUser } from "../lib/auth/session";
import { Colors, useTheme } from "../providers/ThemeProvider";

export default function HistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tdee, setTdee] = useState(0);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const user = await getSessionUser();
        if (!user) {
          router.replace("/");
          return;
        }

        const { data: profile } = await supabase
          .from("weighApp")
          .select("goal_calories, tdee")
          .eq("id", user.id)
          .single();

        // Goal
        const dailyGoal = profile?.goal_calories || profile?.tdee || 2000;
        setTdee(dailyGoal);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data, error } = await supabase
          .from("selected_foods")
          .select("created_at, calories, quantity")
          .eq("user_id", user.id)
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("created_at", { ascending: false });

        if (error) throw error;

        const grouped: Record<string, number> = {};

        (data ?? []).forEach((item: any) => {
          const phDate = new Date(item.created_at).toLocaleDateString("en-CA", {
            timeZone: "Asia/Manila",
          });

          if (!grouped[phDate]) grouped[phDate] = 0;
          grouped[phDate] += (item.calories ?? 0) * (item.quantity ?? 1);
        });

        const formatted = Object.keys(grouped)
          .map(date => ({
            date,
            calories: grouped[date],
            isOver: grouped[date] > dailyGoal,
          }))
          .sort((a, b) => b.date.localeCompare(a.date));

        setHistory(formatted);
      } catch (err: any) {
        Alert.alert("Error", err.message || "Failed to load history");
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [router]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
    };
    return date.toLocaleDateString(undefined, options);
  };

  if (loading) {
    return (
      <View style={[s.safeArea, s.centered]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={s.loadingText}>Loading your history...</Text>
      </View>
    );
  }

  return (
    <View style={s.safeArea}>
      {/* Header */}
      <View style={s.headerContainer}>
        <Text style={s.header}>Calorie History</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {/* Summary */}
        <View style={s.goalCard}>
          <View style={s.goalIcon}>
            <Ionicons name="flame-outline" size={26} color={colors.onAccent} />
          </View>
          <View style={s.goalTextWrap}>
            <Text style={s.goalLabel}>Daily goal</Text>
            <Text style={s.goalValue}>{tdee} kcal</Text>
            <Text style={s.goalHint}>Your daily intake, last 30 days</Text>
          </View>
        </View>

        {history.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyIcon}>
              <Ionicons name="restaurant-outline" size={32} color={colors.accent} />
            </View>
            <Text style={s.emptyTitle}>Nothing logged yet</Text>
            <Text style={s.empty}>No food logged in the last 30 days</Text>
          </View>
        ) : (
          history.map((day, i) => (
            <View
              key={i}
              style={[
                s.dayCard,
                day.isOver && s.dayCardOver,
              ]}
            >
              <View style={s.dayLeft}>
                <Text style={s.dayDate}>{formatDate(day.date)}</Text>
                <Text style={s.dayLabel}>
                  {new Date(day.date).toLocaleDateString(undefined, { weekday: "long" })}
                </Text>
              </View>

              <View style={s.rightSide}>
                <Text style={[s.calories, day.isOver && s.overCalories]}>
                  {day.calories} kcal
                </Text>
                {day.isOver && (
                  <View style={s.overChip}>
                    <Ionicons name="trending-up" size={13} color={OVER_COLOR} />
                    <Text style={s.overText}>
                      +{day.calories - tdee} over
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// Colors
const OVER_COLOR = "#dc2626";

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    centered: { justifyContent: "center", alignItems: "center" },
    pressed: { opacity: 0.7 },

    headerContainer: {
      paddingTop: Platform.OS === "android" ? 50 : 20,
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

    goalCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 18,
      marginBottom: 20,
    },
    goalIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    goalTextWrap: { flex: 1 },
    goalLabel: { fontSize: 13, fontWeight: "700", color: c.textSecondary },
    goalValue: { fontSize: 24, fontWeight: "800", color: c.textPrimary, marginTop: 2 },
    goalHint: { fontSize: 13, fontWeight: "500", color: c.textMuted, marginTop: 2 },

    dayCard: {
      backgroundColor: c.surface,
      padding: 18,
      borderRadius: 22,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    dayCardOver: {
      borderColor: OVER_COLOR,
    },
    dayLeft: { flex: 1 },
    dayDate: {
      fontSize: 17,
      fontWeight: "800",
      color: c.textPrimary,
    },
    dayLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: c.textSecondary,
      marginTop: 4,
    },
    rightSide: {
      alignItems: "flex-end",
    },
    calories: {
      fontSize: 22,
      fontWeight: "800",
      color: c.textPrimary,
    },
    overCalories: {
      color: OVER_COLOR,
    },
    overChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 6,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: OVER_COLOR,
    },
    overText: {
      fontSize: 12,
      color: OVER_COLOR,
      fontWeight: "700",
    },

    emptyWrap: { alignItems: "center", paddingTop: 48, paddingHorizontal: 24 },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: { fontSize: 18, fontWeight: "800", color: c.textPrimary, marginBottom: 6 },
    empty: {
      textAlign: "center",
      fontSize: 15,
      fontWeight: "500",
      color: c.textSecondary,
    },
    loadingText: {
      marginTop: 20,
      fontSize: 18,
      color: c.textSecondary,
      fontWeight: "600",
    },
  });
