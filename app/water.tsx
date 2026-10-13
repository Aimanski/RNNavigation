// Water

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
import Svg, { Circle } from 'react-native-svg';
import { supabase } from "../lib/supabase";
import { getSessionUser } from "../lib/auth/session";
import { Colors, useTheme } from "../providers/ThemeProvider";

// Timezone
const PH_OFFSET_MS = 8 * 60 * 60 * 1000; 

// Constants
const WATER_GOAL_ML = 2500; 
const ADD_AMOUNTS = [250, 500]; 

export default function WaterScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [todayIntake, setTodayIntake] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Timezone
  const getPHDayStartUTC = (): string => {
    const now = new Date();
    const phDayStart = new Date(now.getTime() + PH_OFFSET_MS);
    phDayStart.setUTCHours(0, 0, 0, 0);
    return phDayStart.toISOString(); 
  };
  
  // Fetch
  const fetchData = useCallback(async () => {
    setLoading(true);
    let user;
    try {
      user = await getSessionUser();

      if (!user) {
        router.replace("/");
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

  // Subscription
  useFocusEffect(
    useCallback(() => {
      fetchData(); 

      let subscription: any;
      const setupSubscription = async () => {
        const user = await getSessionUser();
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

  // Logging
  const addWater = async (amount: number) => {
    if (isAdding) return;
    setIsAdding(true);

    try {
      const user = await getSessionUser();
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

  // Reset
  const resetDailyIntake = async () => {
    const user = await getSessionUser();
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

  // Progress
  const progress = Math.min((todayIntake / WATER_GOAL_ML) * 100, 100);
  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const isGoalReached = todayIntake >= WATER_GOAL_ML;

  // Render
  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.headerContainer}>
        <Text style={s.header}>Water Intake</Text>
      </View>

      {/* Scroll */}
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={s.loadingText}>Loading your water data...</Text>
          </View>
        ) : (
          <>
            {/* Progress */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Daily Hydration Goal</Text>
              <View style={s.chartWrapper}>
                <Svg width="200" height="200" viewBox="0 0 200 200">
                  <Circle
                    cx="100"
                    cy="100"
                    r="80"
                    fill="none"
                    stroke={colors.surfaceAlt}
                    strokeWidth="20"
                  />
                  <Circle
                    cx="100"
                    cy="100"
                    r="80"
                    fill="none"
                    stroke={isGoalReached ? colors.accentDark : colors.accent}
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

              <View style={s.statusPill}>
                <Ionicons
                  name={isGoalReached ? "checkmark-circle" : "water"}
                  size={20}
                  color={colors.accent}
                />
                <Text style={s.statusText}>
                  {isGoalReached ? "Goal Reached! Excellent!" : `${WATER_GOAL_ML - todayIntake} ml remaining`}
                </Text>
              </View>

              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${progress}%` }]} />
              </View>
              <Text style={s.percentText}>{Math.round(progress)}% of daily goal</Text>
            </View>

            {/* Shortcuts */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Quick Add</Text>
              <View style={s.buttonGrid}>
                {ADD_AMOUNTS.map((amount) => (
                  <Pressable
                    key={amount}
                    style={({ pressed }) => [s.addButton, pressed && s.pressed]}
                    onPress={() => addWater(amount)}
                    disabled={isAdding}
                  >
                    <Ionicons name="add-circle-outline" size={30} color={colors.accent} />
                    <Text style={s.buttonText}>{amount} ml</Text>
                  </Pressable>
                ))}
                <Pressable
                  style={({ pressed }) => [s.addButton, s.largeButton, pressed && s.pressed]}
                  onPress={() => addWater(1000)}
                  disabled={isAdding}
                >
                  <Ionicons name="add-circle" size={30} color={colors.accent} />
                  <Text style={s.buttonText}>1.0 L</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.addButton, s.resetButton, pressed && s.pressed]}
                  onPress={resetDailyIntake}
                  disabled={isAdding}
                >
                  {isAdding ? (
                    <ActivityIndicator color="#ef4444" size="small" />
                  ) : (
                    <Ionicons name="refresh-circle-outline" size={30} color="#ef4444" />
                  )}
                  <Text style={[s.buttonText, { color: "#ef4444" }]}>Reset</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Styles
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
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

    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 4,
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
      color: c.textSecondary,
      fontWeight: "600",
    },

    card: {
      backgroundColor: c.surface,
      borderRadius: 22,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: c.textPrimary,
      marginBottom: 16,
    },

    chartWrapper: {
      width: 200,
      height: 200,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    progressTextOverlay: {
      position: "absolute",
      alignItems: "center",
    },
    currentIntakeText: {
      fontSize: 48,
      fontWeight: "900",
      color: c.accent,
      lineHeight: 52,
    },
    intakeUnit: {
      fontSize: 18,
      fontWeight: "800",
      color: c.accent,
    },
    goalText: {
      fontSize: 14,
      fontWeight: "600",
      color: c.textSecondary,
      marginTop: 6,
    },

    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    statusText: {
      fontSize: 16,
      fontWeight: "700",
      color: c.textPrimary,
      textAlign: "center",
    },
    barTrack: {
      width: "100%",
      height: 10,
      borderRadius: 5,
      backgroundColor: c.surfaceAlt,
      overflow: "hidden",
    },
    barFill: {
      height: "100%",
      borderRadius: 5,
      backgroundColor: c.accent,
    },
    percentText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textMuted,
      marginTop: 8,
    },

    buttonGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 12,
      width: "100%",
    },
    addButton: {
      backgroundColor: c.background,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      width: "48%",
      minHeight: 88,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    largeButton: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.borderStrong,
    },
    resetButton: {
      backgroundColor: c.background,
      borderColor: "#ef4444",
    },
    buttonText: {
      fontSize: 17,
      fontWeight: "800",
      color: c.textPrimary,
      marginTop: 6,
    },
  });
