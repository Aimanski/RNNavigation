// app/history.tsx — FRESH GREEN PREMIUM VERSION (same logic, brand new beauty)

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tdee, setTdee] = useState(0);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/Index");
          return;
        }

        const { data: profile } = await supabase
          .from("weighApp")
          .select("tdee")
          .eq("id", user.id)
          .single();

        setTdee(profile?.tdee || 2000);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data, error } = await supabase
          .from("selected_foods")
          .select("created_at, calories")
          .eq("user_id", user.id)
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("created_at", { ascending: false });

        if (error) throw error;

        const grouped: Record<string, number> = {};

        data.forEach((item: any) => {
          const phDate = new Date(new Date(item.created_at).getTime() + 8 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];

          if (!grouped[phDate]) grouped[phDate] = 0;
          grouped[phDate] += item.calories;
        });

        const formatted = Object.keys(grouped)
          .map(date => ({
            date,
            calories: grouped[date],
            isOver: grouped[date] > (profile?.tdee || 2000),
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
      <View style={s.container}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={s.loadingText}>Loading your history...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={28} color="#10b981" />
        </Pressable>
        <Text style={s.title}>Calorie History</Text>
        <View style={{ width: 48 }} />
      </View>

      <Text style={s.subtitle}>Your daily intake • last 30 days</Text>
      <Text style={s.tdee}>Daily Goal: {tdee} kcal</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {history.length === 0 ? (
          <Text style={s.empty}>No food logged in the last 30 days</Text>
        ) : (
          history.map((day, i) => (
            <View
              key={i}
              style={[
                s.dayCard,
                day.isOver && s.dayCardOver,
              ]}
            >
              <View>
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
                  <Text style={s.overText}>
                    +{day.calories - tdee} over
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fff9",
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#065f46",
    letterSpacing: 0.5,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 17,
    color: "#059669",
    marginBottom: 8,
  },
  tdee: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#10b981",
    marginBottom: 24,
  },
  dayCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    padding: 22,
    borderRadius: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: "#ecfdf5",
  },
  dayCardOver: {
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
  },
  dayDate: {
    fontSize: 19,
    fontWeight: "800",
    color: "#065f46",
  },
  dayLabel: {
    fontSize: 14,
    color: "#059669",
    marginTop: 4,
  },
  rightSide: {
    alignItems: "flex-end",
  },
  calories: {
    fontSize: 22,
    fontWeight: "800",
    color: "#065f46",
  },
  overCalories: {
    color: "#dc2626",
  },
  overText: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "600",
    marginTop: 4,
  },
  empty: {
    textAlign: "center",
    marginTop: 80,
    fontSize: 17,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: "#059669",
    fontWeight: "600",
  },
});