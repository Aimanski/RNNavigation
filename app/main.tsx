// Home

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Text } from "../components/ui/AppText";
import { markPageReady } from "../lib/auth/startup";
import { Calendar } from "react-native-calendars";
import { fontFamilyFor } from "../lib/typography";
import Svg, { Circle } from "react-native-svg";
import TutorialModal from "../components/ui/TutorialModal";
import { cache } from "../lib/cache";
import { getSessionUser } from "../lib/auth/session";
import { supabase } from "../lib/supabase";
import { Colors, useTheme } from "../providers/ThemeProvider";

type IconName = keyof typeof Ionicons.glyphMap;

// Timezone
const PH_TIMEZONE = "Asia/Manila";
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

const getPHDateString = (date: Date | string): string => {
  const d = new Date(date);
  const year  = d.toLocaleString("en-US", { timeZone: PH_TIMEZONE, year: "numeric" });
  const month = d.toLocaleString("en-US", { timeZone: PH_TIMEZONE, month: "2-digit" });
  const day   = d.toLocaleString("en-US", { timeZone: PH_TIMEZONE, day: "2-digit" });
  return `${year}-${month}-${day}`;
};

// Water
const WATER_GOAL_ML = 2500;

const STATS_CACHE_KEY = "home:stats";

// Macros
const PROTEIN_COLOR = "#ef4444";
const CARBS_COLOR = "#3b82f6";
const FAT_COLOR = "#f59e0b";
const OVER_COLOR = "#ef4444";

// Labels
const getSleepLabel = (hours: number): { label: string; color: string } => {
  if (hours < 4) return { label: "Severely sleep deprived", color: "#ef4444" };
  if (hours < 6) return { label: "Not enough sleep", color: "#f97316" };
  if (hours < 7) return { label: "Slightly below recommended", color: "#eab308" };
  if (hours <= 9) return { label: "Great sleep!", color: "#0B6FDB" };
  return { label: "Oversleeping", color: "#6366f1" };
};

const getBPLabel = (systolic: number, diastolic: number): { label: string; color: string } => {
  if (systolic < 90 || diastolic < 60) return { label: "Low", color: "#6366f1" };
  if (systolic < 120 && diastolic < 80) return { label: "Normal", color: "#10b981" };
  if (systolic < 130 && diastolic < 80) return { label: "Elevated", color: "#eab308" };
  if (systolic < 140 || diastolic < 90) return { label: "High (Stage 1)", color: "#f97316" };
  if (systolic < 180 || diastolic < 120) return { label: "High (Stage 2)", color: "#ef4444" };
  return { label: "Crisis: seek help", color: "#7f1d1d" };
};

const formatHours = (hours: number): string => {
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

type Stats = {
  username: string;
  goal: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foodsLogged: number;
  waterMl: number | null;
  sleepHours: number | null;
  bp: { systolic: number; diastolic: number } | null;
};

const EMPTY_STATS: Stats = {
  username: "",
  goal: 2000,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  foodsLogged: 0,
  waterMl: null,
  sleepHours: null,
  bp: null,
};

// Tile
function StatTile({
  icon,
  iconColor,
  label,
  value,
  sub,
  subColor,
  progress,
  onPress,
  s,
  colors,
}: {
  icon: IconName;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
  subColor?: string;
  progress?: number;
  onPress: () => void;
  s: ReturnType<typeof makeStyles>;
  colors: Colors;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.tile, pressed && s.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. ${sub}`}
    >
      <View style={s.tileTop}>
        <View style={[s.tileIcon, { backgroundColor: iconColor + "22" }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileValue} numberOfLines={1}>
        {value}
      </Text>
      {progress != null && (
        <View style={s.tileTrack}>
          <View style={[s.tileFill, { width: `${progress}%`, backgroundColor: iconColor }]} />
        </View>
      )}
      <Text style={[s.tileSub, subColor ? { color: subColor } : null]} numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
  );
}

export default function MainScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  // Dots shrink on narrow screens so all seven fit in the card
  const dotSize = Math.max(22, Math.min(34, Math.floor((Math.min(windowWidth, 640) - 84) / 7)));
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [streak, setStreak] = useState(0);
  const [markedDateStrings, setMarkedDateStrings] = useState<string[]>([]);
  const [showTutorial, setShowTutorial] = useState<boolean | null>(null);
  // Cache
  const [stats, setStats] = useState<Stats>(() => cache.get<Stats>(STATS_CACHE_KEY) ?? EMPTY_STATS);
  const [statsLoaded, setStatsLoaded] = useState(() => cache.get<Stats>(STATS_CACHE_KEY) !== undefined);
  // Loading
  const [streakLoaded, setStreakLoaded] = useState(false);

  const markedDates = useMemo(() => {
    const marked: Record<string, any> = {};
    for (const dateStr of markedDateStrings) {
      marked[dateStr] = {
        selected: true,
        selectedColor: colors.accent,
        selectedTextColor: colors.onAccent,
      };
    }
    return marked;
  }, [markedDateStrings, colors]);

  // Navigation
  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = await getSessionUser();

        if (!user) {
          router.replace("/");
          return;
        }

        const { data, error } = await supabase
          .from("weighApp")
          .select("streak, last_sign_in, tutorial_completed")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        const tutorialDone = data?.tutorial_completed === true;
        setShowTutorial(!tutorialDone);

        // Provisioning
        if (!data) {
          const todayStr = new Date().toISOString().split("T")[0];
          await supabase.from("weighApp").upsert(
            {
              id: user.id,
              streak: 1,
              last_sign_in: new Date().toISOString(),
              tutorial_completed: false,
            },
            { onConflict: "id", ignoreDuplicates: true }
          );
          setStreak(1);
          setMarkedDateStrings([todayStr]);
          return;
        }

        // Streak
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let newStreak = data.streak ?? 0;

        if (data.last_sign_in) {
          const l = new Date(data.last_sign_in);
          l.setHours(0, 0, 0, 0);
          if (l.getTime() === today.getTime()) {
            newStreak = data.streak;
          } else if (l.getTime() === yesterday.getTime()) {
            newStreak = (data.streak ?? 0) + 1;
          } else {
            newStreak = 1;
          }
        } else {
          newStreak = 1;
        }

        await supabase
          .from("weighApp")
          .update({ streak: newStreak, last_sign_in: new Date().toISOString() })
          .eq("id", user.id);

        setStreak(newStreak);

        const dateStrings: string[] = [];
        for (let i = 0; i < newStreak; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dateStrings.push(d.toISOString().split("T")[0]);
        }
        setMarkedDateStrings(dateStrings);
      } catch (err) {
        console.error("Main screen error:", err);
        setShowTutorial(false);
      } finally {
        setStreakLoaded(true);
      }
    };

    fetchData();
    // Dependencies
  }, []);

  // Splash
  useEffect(() => {
    if (statsLoaded && streakLoaded) markPageReady();
  }, [statsLoaded, streakLoaded]);

  // Focus
  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadStats = async () => {
        try {
          const user = await getSessionUser();
          if (!user) return;
          const uid = user.id;
          const todayStr = getPHDateString(new Date());

          // Window
          const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();

          const [profileRes, foodsRes, waterRes, sleepRes, bpRes] = await Promise.all([
            supabase.from("weighApp").select("username, goal_calories").eq("id", uid).maybeSingle(),
            supabase
              .from("selected_foods")
              .select("calories, quantity, protein, carbs, fat, created_at")
              .eq("user_id", uid)
              .gte("created_at", since),
            supabase.rpc("get_daily_water_intake", {
              user_id_param: uid,
              today_date_param: new Date(Date.now() + PH_OFFSET_MS).toISOString(),
            }),
            supabase
              .from("sleep_logs")
              .select("duration_hours, created_at")
              .eq("user_id", uid)
              .order("created_at", { ascending: false })
              .limit(1),
            supabase
              .from("blood_pressure_logs")
              .select("systolic, diastolic, created_at")
              .eq("user_id", uid)
              .order("created_at", { ascending: false })
              .limit(1),
          ]);

          let calories = 0;
          let protein = 0;
          let carbs = 0;
          let fat = 0;
          let foodsLogged = 0;
          (foodsRes.data || []).forEach((item: any) => {
            if (getPHDateString(item.created_at) !== todayStr) return;
            const qty = item.quantity ?? 1;
            calories += (item.calories ?? 0) * qty;
            protein  += (item.protein  ?? 0) * qty;
            carbs    += (item.carbs    ?? 0) * qty;
            fat      += (item.fat      ?? 0) * qty;
            foodsLogged += 1;
          });

          const goalRaw = profileRes.data?.goal_calories;
          const latestSleep = sleepRes.data?.[0];
          const latestBP = bpRes.data?.[0];

          const next: Stats = {
            username: profileRes.data?.username || "",
            goal: goalRaw > 0 ? goalRaw : 2000,
            calories: Math.round(calories),
            protein: Math.round(protein),
            carbs: Math.round(carbs),
            fat: Math.round(fat),
            foodsLogged,
            waterMl: waterRes.error ? null : Number(waterRes.data) || 0,
            sleepHours: latestSleep ? Number(latestSleep.duration_hours) : null,
            bp: latestBP
              ? { systolic: latestBP.systolic, diastolic: latestBP.diastolic }
              : null,
          };
          cache.set(STATS_CACHE_KEY, next);
          if (!active) return;
          setStats(next);
        } catch (err) {
          console.error("Home progress error:", err);
        } finally {
          if (active) setStatsLoaded(true);
        }
      };

      loadStats();
      return () => {
        active = false;
      };
    }, [])
  );

  // Display
  const firstName = stats.username.trim().split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning," : hour < 18 ? "Good afternoon," : "Good evening,";
  const dateLabel = new Date().toLocaleDateString("en-US", {
    timeZone: PH_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Week
  const week = useMemo(() => {
    const marked = new Set(markedDateStrings);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().split("T")[0];
      return {
        key,
        label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
        done: marked.has(key),
        today: i === 6,
      };
    });
  }, [markedDateStrings]);

  const calorieProgress = Math.min((stats.calories / stats.goal) * 100, 100);
  const isOver = stats.calories > stats.goal;
  const remaining = stats.goal - stats.calories;
  const ringColor = isOver ? OVER_COLOR : colors.accent;

  const RING_R = 52;
  const ringCirc = 2 * Math.PI * RING_R;
  const ringOffset = ringCirc - (calorieProgress / 100) * ringCirc;

  const goalProtein = Math.round((0.2 * stats.goal) / 4);
  const goalCarbs = Math.round((0.5 * stats.goal) / 4);
  const goalFat = Math.round((0.3 * stats.goal) / 9);
  const macros = [
    { key: "Protein", value: stats.protein, goal: goalProtein, color: PROTEIN_COLOR },
    { key: "Carbs", value: stats.carbs, goal: goalCarbs, color: CARBS_COLOR },
    { key: "Fat", value: stats.fat, goal: goalFat, color: FAT_COLOR },
  ];

  const waterPct =
    stats.waterMl == null ? 0 : Math.min((stats.waterMl / WATER_GOAL_ML) * 100, 100);
  const sleepInfo = stats.sleepHours != null ? getSleepLabel(stats.sleepHours) : null;
  const bpInfo = stats.bp ? getBPLabel(stats.bp.systolic, stats.bp.diastolic) : null;
  const dash = "–";

  return (
    <>
      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={s.greetRow}>
          <View style={s.greetTextWrap}>
            <Text style={s.greetSmall}>{greeting}</Text>
            <Text style={s.greetName} numberOfLines={1}>
              {firstName}
            </Text>
          </View>
          <View style={s.dateChip}>
            <Ionicons name="calendar-outline" size={15} color={colors.accent} />
            <Text style={s.dateText}>{dateLabel}</Text>
          </View>
        </View>

        {/* Streak */}
        <View style={s.card}>
          <View style={s.streakTop}>
            <View style={s.flameWrap}>
              <Ionicons name="flame" size={30} color="#f59e0b" />
            </View>
            <View style={s.streakTextWrap}>
              <Text style={s.streakNumber}>
                {streak}
                <Text style={s.streakUnit}> day streak</Text>
              </Text>
              <Text style={s.streakMotivation}>
                {streak === 0 ? "Start today!" : streak >= 7 ? "You're on fire!" : "Keep going!"}
              </Text>
            </View>
          </View>

          <View style={s.weekRow}>
            {week.map((day) => (
              <View key={day.key} style={s.dayCol}>
                <View
                  style={[
                    s.dayDot,
                    { width: dotSize, height: dotSize },
                    day.done && s.dayDotDone,
                    day.today && !day.done && s.dayDotToday,
                  ]}
                >
                  {day.done && <Ionicons name="checkmark" size={16} color={colors.onAccent} />}
                </View>
                <Text style={[s.dayLabel, day.today && s.dayLabelToday]}>{day.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Progress */}
        <Pressable
          style={({ pressed }) => [s.card, pressed && s.pressed]}
          onPress={() => router.replace("/dashboard")}
          accessibilityRole="button"
          accessibilityLabel="Today's progress. Open details"
        >
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Today&apos;s progress</Text>
            <View style={s.linkRow}>
              <Text style={s.linkText}>Details</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.accent} />
            </View>
          </View>

          <View style={s.progressRow}>
            <View style={s.ringWrap}>
              <Svg width="124" height="124" viewBox="0 0 124 124">
                <Circle
                  cx="62"
                  cy="62"
                  r={RING_R}
                  fill="none"
                  stroke={colors.surfaceAlt}
                  strokeWidth="12"
                />
                <Circle
                  cx="62"
                  cy="62"
                  r={RING_R}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="12"
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 62 62)"
                />
              </Svg>
              <View style={s.ringCenter}>
                <Text style={s.ringValue}>{statsLoaded ? stats.calories.toLocaleString() : dash}</Text>
                <Text style={s.ringSub}>of {stats.goal.toLocaleString()} kcal</Text>
              </View>
            </View>

            <View style={s.macroList}>
              {macros.map((m) => {
                const pct = m.goal > 0 ? Math.min((m.value / m.goal) * 100, 100) : 0;
                return (
                  <View key={m.key} style={s.macroRow}>
                    <View style={s.macroHead}>
                      <Text style={s.macroName}>{m.key}</Text>
                      <Text style={s.macroValue}>
                        {statsLoaded ? m.value : dash}
                        <Text style={s.macroGoal}> / {m.goal}g</Text>
                      </Text>
                    </View>
                    <View style={s.macroTrack}>
                      <View style={[s.macroFill, { width: `${pct}%`, backgroundColor: m.color }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={s.statusPill}>
            <Ionicons
              name={isOver ? "alert-circle-outline" : "flame-outline"}
              size={16}
              color={isOver ? OVER_COLOR : colors.accent}
            />
            <Text style={[s.statusText, isOver && { color: OVER_COLOR }]}>
              {!statsLoaded
                ? "Loading your day…"
                : stats.calories === 0
                  ? "Nothing logged yet. Add your first meal"
                  : isOver
                    ? `${Math.abs(remaining).toLocaleString()} kcal over your goal`
                    : `${remaining.toLocaleString()} kcal left today`}
            </Text>
          </View>
        </Pressable>

        {/* Stats */}
        <Text style={s.sectionTitle}>Your day</Text>
        <View style={s.tileGrid}>
          <StatTile
            s={s}
            colors={colors}
            icon="water"
            iconColor="#0ea5e9"
            label="Water"
            value={stats.waterMl == null ? dash : `${stats.waterMl.toLocaleString()} ml`}
            sub={`Goal ${WATER_GOAL_ML.toLocaleString()} ml`}
            progress={stats.waterMl == null ? 0 : waterPct}
            onPress={() => router.push("/water")}
          />
          <StatTile
            s={s}
            colors={colors}
            icon="moon"
            iconColor="#6366f1"
            label="Last sleep"
            value={stats.sleepHours != null ? formatHours(stats.sleepHours) : dash}
            sub={sleepInfo ? sleepInfo.label : statsLoaded ? "No sleep logged yet" : " "}
            subColor={sleepInfo?.color}
            onPress={() => router.replace("/sleep")}
          />
          <StatTile
            s={s}
            colors={colors}
            icon="restaurant"
            iconColor={colors.accent}
            label="Foods logged"
            value={statsLoaded ? String(stats.foodsLogged) : dash}
            sub="Today"
            onPress={() => router.replace("/mealplan")}
          />
          <StatTile
            s={s}
            colors={colors}
            icon="pulse"
            iconColor="#ef4444"
            label="Blood pressure"
            value={stats.bp ? `${stats.bp.systolic}/${stats.bp.diastolic}` : dash}
            sub={bpInfo ? bpInfo.label : statsLoaded ? "No readings yet" : " "}
            subColor={bpInfo?.color}
            onPress={() => router.push("/bloodPressure")}
          />
        </View>

        {/* Calendar */}
        <Text style={s.sectionTitle}>Streak calendar</Text>
        <View style={s.calendarWrapper}>
          <Calendar
            markedDates={markedDates}
            theme={{
              backgroundColor: "transparent",
              calendarBackground: colors.surface,
              textSectionTitleColor: colors.textPrimary,
              selectedDayBackgroundColor: colors.accent,
              selectedDayTextColor: colors.onAccent,
              todayTextColor: colors.accent,
              todayBackgroundColor: colors.surfaceAlt,
              dayTextColor: colors.textPrimary,
              textDisabledColor: "#94a3b8",
              monthTextColor: colors.textPrimary,
              indicatorColor: colors.accent,
              arrowColor: colors.accent,
              textDayFontFamily: fontFamilyFor("600"),
              textMonthFontFamily: fontFamilyFor("800"),
              textDayHeaderFontFamily: fontFamilyFor("700"),
              textDayFontWeight: "normal",
              textMonthFontWeight: "normal",
              textDayHeaderFontWeight: "normal",
            }}
            hideExtraDays
            disableMonthChange
            firstDay={1}
            style={s.calendar}
          />
        </View>
      </ScrollView>

      {showTutorial !== null && (
        <TutorialModal
          visible={showTutorial === true}
          onDismiss={() => setShowTutorial(false)}
          onViewMealPlan={() => router.push("/myplan")}
        />
      )}
    </>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    scrollView: { flex: 1, backgroundColor: c.background },
    contentContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 210 },
    pressed: { opacity: 0.85 },

    // Styles
    greetRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    greetTextWrap: { flex: 1, paddingRight: 12 },
    greetSmall: { fontSize: 15, fontWeight: "600", color: c.textSecondary },
    greetName: { fontSize: 30, fontWeight: "900", color: c.textPrimary, marginTop: 2 },
    dateChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.surfaceAlt,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    dateText: { fontSize: 13, fontWeight: "700", color: c.accent },

    // Cards
    card: {
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 20,
      marginBottom: 16,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    cardTitle: { fontSize: 17, fontWeight: "800", color: c.textPrimary },
    linkRow: { flexDirection: "row", alignItems: "center", gap: 2 },
    linkText: { fontSize: 13, fontWeight: "700", color: c.accent },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: c.textPrimary,
      marginTop: 4,
      marginBottom: 12,
    },

    // Streak
    streakTop: { flexDirection: "row", alignItems: "center", gap: 14 },
    flameWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#f59e0b22",
      alignItems: "center",
      justifyContent: "center",
    },
    streakTextWrap: { flex: 1 },
    streakNumber: { fontSize: 32, fontWeight: "900", color: c.accent },
    streakUnit: { fontSize: 17, fontWeight: "700", color: c.textPrimary },
    streakMotivation: { fontSize: 14, fontWeight: "600", color: c.textSecondary, marginTop: 2 },
    weekRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 18,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    dayCol: { flex: 1, alignItems: "center", gap: 6 },
    dayDot: {
      borderRadius: 999,
      backgroundColor: c.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    dayDotDone: { backgroundColor: c.accent },
    dayDotToday: { borderWidth: 2, borderColor: c.accent },
    dayLabel: { fontSize: 12, fontWeight: "700", color: c.textMuted },
    dayLabelToday: { color: c.accent },

    // Progress
    progressRow: { flexDirection: "row", alignItems: "center", gap: 18 },
    ringWrap: { width: 124, height: 124, alignItems: "center", justifyContent: "center" },
    ringCenter: { position: "absolute", alignItems: "center" },
    ringValue: { fontSize: 24, fontWeight: "900", color: c.textPrimary },
    ringSub: { fontSize: 11, fontWeight: "600", color: c.textSecondary, marginTop: 1 },
    macroList: { flex: 1, gap: 12 },
    macroRow: { gap: 5 },
    macroHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    macroName: { fontSize: 13, fontWeight: "800", color: c.textPrimary },
    macroValue: { fontSize: 13, fontWeight: "800", color: c.textPrimary },
    macroGoal: { fontSize: 11.5, fontWeight: "600", color: c.textMuted },
    macroTrack: { height: 7, borderRadius: 4, backgroundColor: c.surfaceAlt, overflow: "hidden" },
    macroFill: { height: "100%", borderRadius: 4 },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surfaceAlt,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginTop: 18,
    },
    statusText: { flex: 1, fontSize: 13.5, fontWeight: "700", color: c.textPrimary },

    // Tiles
    tileGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12, marginBottom: 20 },
    tile: {
      width: "48%",
      backgroundColor: c.surface,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 14,
    },
    tileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    tileIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    tileLabel: { fontSize: 12.5, fontWeight: "700", color: c.textSecondary, marginTop: 12 },
    tileValue: { fontSize: 22, fontWeight: "900", color: c.textPrimary, marginTop: 2 },
    tileTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.surfaceAlt,
      overflow: "hidden",
      marginTop: 8,
    },
    tileFill: { height: "100%", borderRadius: 3 },
    tileSub: { fontSize: 12, fontWeight: "600", color: c.textMuted, marginTop: 6 },

    // Calendar
    calendarWrapper: {
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    calendar: { borderRadius: 24 },
  });
