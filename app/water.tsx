// app/water.tsx — WATER INTAKE TRACKER SCREEN (FIXED HEADER VERSION)

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle } from 'react-native-svg';
import { supabase } from "../lib/supabase";

// ────────────────────────────────
// Philippines Time Helpers (UTC+8)
// ────────────────────────────────
const PH_OFFSET_MS = 8 * 60 * 60 * 1000; 

// ────────────────────────────────
// Constants
// ────────────────────────────────
const WATER_GOAL_ML = 2500; 
const ADD_AMOUNTS = [250, 500]; 

export default function WaterScreen() {
  const router = useRouter();
  const [todayIntake, setTodayIntake] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Helper: Get UTC timestamp for 00:00:00 PH time today
  const getPHDayStartUTC = (): string => {
    const now = new Date();
    const phDayStart = new Date(now.getTime() + PH_OFFSET_MS);
    phDayStart.setUTCHours(0, 0, 0, 0);
    return phDayStart.toISOString(); 
  };
  
  // 1. Fetch daily water intake
  const fetchData = useCallback(async () => {
    setLoading(true);
    let user;
    try {
      const authResponse = await supabase.auth.getUser();
      user = authResponse.data.user;

      if (!user) {
        router.replace("/index");
        return;
      }
      
      const todayPH = new Date(new Date().getTime() + PH_OFFSET_MS).toISOString();

      const { data, error } = await supabase.rpc('get_daily_water_intake', { 
        user_id_param: user.id, 
        today_date_param: todayPH 
      });

      if (error) {
        if (error.code === '42883') {
           Alert.alert("Setup Error", "The 'get_daily_water_intake' SQL function is missing. Please run the script in your Supabase editor.");
        }
        throw error; 
      }

      const total = data || 0; 
      setTodayIntake(total);

    } catch (err: any) {
      console.error("Error fetching water intake:", err.message);
      if (err.code !== '42883') {
          Alert.alert("Error", "Failed to load water intake data.");
      }
      setTodayIntake(0);
    } finally {
      setLoading(false);
    }
  }, [router]); 

  // 2. Focus effect + real-time subscription
  useFocusEffect(
    useCallback(() => {
      fetchData(); 

      let subscription: any;
      const setupSubscription = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; 

        subscription = supabase
          .channel("water-changes")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "water_intake",
              filter: `user_id=eq.${user.id}`, 
            },
            () => fetchData()
          )
          .subscribe();
      }

      setupSubscription();
      
      return () => {
        if (subscription) {
          supabase.removeChannel(subscription);
        }
      };
      
    }, [fetchData]) 
  );

  // 3. Add water
  const addWater = async (amount: number) => {
    if (isAdding) return;
    setIsAdding(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("water_intake").insert({
        user_id: user.id,
        amount_ml: amount,
        created_at: new Date().toISOString(), 
      });

      if (error) throw error;

      setTodayIntake(prev => prev + amount);

    } catch (err: any) {
      console.error("Error adding water:", err.message);
      Alert.alert("Error", "Failed to log water intake.");
    } finally {
      setIsAdding(false);
    }
  };

  // 4. Reset daily intake
  const resetDailyIntake = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    Alert.alert(
      "Confirm Reset",
      "Are you sure you want to delete ALL water intake entries for today?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            setIsAdding(true);

            try {
              const phDayStartUTC = getPHDayStartUTC();
              
              const { error } = await supabase
                .from("water_intake")
                .delete()
                .eq("user_id", user.id)
                .gte("created_at", phDayStartUTC); 

              if (error) {
                console.error("Supabase delete error:", error);
                if (error.code === '42501') { 
                    Alert.alert("Permission Denied", "Check that your 'water_intake' table has an RLS policy for DELETE enabled.");
                } else {
                    throw error;
                }
              }

              setTodayIntake(0);
              fetchData(); 
              Alert.alert("Success", "Daily water intake has been reset.");
              
            } catch (err: any) {
              console.error("Error resetting water:", err.message);
              Alert.alert("Error", "Failed to reset daily water intake.");
            } finally {
              setIsAdding(false);
            }
          },
        },
      ]
    );
  };

  // 5. Progress calculation
  const progress = Math.min((todayIntake / WATER_GOAL_ML) * 100, 100);
  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const isGoalReached = todayIntake >= WATER_GOAL_ML;

  // ────────────────────────────────
  // RENDER
  // ────────────────────────────────
  return (
    <View style={s.container}>
      {/* FIXED HEADER - Stays on top */}
      <View style={s.fixedHeader}>
        <Pressable onPress={() => router.back()} style={s.backButton}>
          <Ionicons name="arrow-back" size={32} color="#10b981" />
        </Pressable>
        <Text style={s.header}>WATER INTAKE</Text>
      </View>

      {/* SCROLLABLE CONTENT */}
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={s.loadingText}>Loading your water data...</Text>
          </View>
        ) : (
          <>
            {/* Progress Section */}
            <View style={s.progressContainer}>
              <Text style={s.progressTitle}>Daily Hydration Goal</Text>
              <View style={s.chartWrapper}>
                <Svg width="200" height="200" viewBox="0 0 200 200">
                  <Circle
                    cx="100"
                    cy="100"
                    r="80"
                    fill="none"
                    stroke="#ecfdf5"
                    strokeWidth="20"
                  />
                  <Circle
                    cx="100"
                    cy="100"
                    r="80"
                    fill="none"
                    stroke={isGoalReached ? "#34d399" : "#3b82f6"}
                    strokeWidth="20"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform="rotate(-90 100 100)"
                  />
                </Svg>
                <View style={s.progressTextOverlay}>
                  <Text style={s.currentIntakeText}>{Math.round(todayIntake)}</Text>
                  <Text style={s.intakeUnit}>ml</Text>
                  <Text style={s.goalText}>of {WATER_GOAL_ML} ml</Text>
                </View>
              </View>

              <Text style={[s.statusText, { color: isGoalReached ? "#059669" : "#3b82f6" }]}>
                {isGoalReached ? "Goal Reached! Excellent!" : `${WATER_GOAL_ML - todayIntake} ml remaining`}
              </Text>
            </View>

            {/* Quick Add Buttons */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Quick Add</Text>
              <View style={s.buttonGrid}>
                {ADD_AMOUNTS.map((amount) => (
                  <Pressable
                    key={amount}
                    style={({ pressed }) => [s.addButton, pressed && s.pressed]}
                    onPress={() => addWater(amount)}
                    disabled={isAdding}
                  >
                    <Ionicons name="add-circle-outline" size={30} color="#3b82f6" />
                    <Text style={s.buttonText}>{amount} ml</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={({ pressed }) => [s.addButton, s.largeButton, pressed && s.pressed]}
                  onPress={() => addWater(1000)}
                  disabled={isAdding}
                >
                  <Ionicons name="add-circle" size={30} color="#3b82f6" />
                  <Text style={s.buttonText}>1.0 L</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.addButton, s.resetButton, pressed && s.pressed]}
                  onPress={resetDailyIntake}
                  disabled={isAdding}
                >
                  {isAdding ? (
                    <ActivityIndicator color="#f87171" size="small" />
                  ) : (
                    <Ionicons name="refresh-circle-outline" size={30} color="#f87171" />
                  )}
                  <Text style={[s.buttonText, { color: "#f87171" }]}>Reset</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ height: 60 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ────────────────────────────────
// Styles
// ────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fff9",
  },
  fixedHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#f8fff9",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(16, 185, 129, 0.1)",
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 20,
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
  header: {
    fontSize: 25,
    fontWeight: "800",
    color: "#065f46",
    textAlign: "center",
    marginTop: 20,
  },
  scrollView: {
    flex: 1,
    marginTop: 140, // Space for fixed header (safe area + back button + padding)
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 100,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: "#059669",
    fontWeight: "600",
  },
  section: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
    borderWidth: 1.5,
    borderColor: "#ecfdf5",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#065f46",
    marginBottom: 20,
  },
  progressContainer: {
    alignItems: "center",
    marginBottom: 32,
    paddingTop: 16,
  },
  progressTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#065f46",
    marginBottom: 20,
  },
  chartWrapper: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  progressTextOverlay: {
    position: "absolute",
    alignItems: "center",
  },
  currentIntakeText: {
    fontSize: 48,
    fontWeight: "900",
    color: "#3b82f6",
    lineHeight: 52,
  },
  intakeUnit: {
    fontSize: 20,
    fontWeight: "800",
    color: "#3b82f6",
  },
  goalText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#059669",
    marginTop: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    gap: 16,
    width: "100%",
  },
  addButton: {
    backgroundColor: "#f0fdf4",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "45%",
    borderWidth: 2,
    borderColor: "#bfdbfe",
  },
  largeButton: {
    backgroundColor: "#e0f2fe",
    borderColor: "#93c5fd",
  },
  resetButton: {
    backgroundColor: "#fef2f2",
    borderColor: "#fca5a5",
    width: "45%",
    minHeight: 80,
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3b82f6",
    marginTop: 8,
  },
  pressed: {
    opacity: 0.8,
  },
});