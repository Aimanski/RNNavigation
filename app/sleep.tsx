// app/sleep.tsx — Semi-Automatic Sleep Logger
// Tap "I'm Going to Sleep" → records sleep_time in AsyncStorage.
// Tap "I Just Woke Up"    → records wake_time, calculates duration, saves to Supabase.
// A live status card ticks up elapsed time while the user is sleeping.

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────
// AsyncStorage key for persisting active sleep
// ─────────────────────────────────────────────
const SLEEP_START_KEY = "active_sleep_start_iso";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type SleepEntry = {
  id: string;
  sleep_time: string;
  wake_time: string;
  duration_hours: number;
  created_at: string;
};

type SleepRemark = {
  label: string;
  color: string;
  suggestion: string;
};

// ─────────────────────────────────────────────
// Philippines time helpers
// ─────────────────────────────────────────────
const PH_TIMEZONE = "Asia/Manila";

/** Format an ISO string as a readable PH-timezone time, e.g. "10:45 PM" */
const formatPHTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: PH_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

/** Format an ISO string as a readable PH-timezone date, e.g. "Sat, May 3" */
const formatPHDate = (iso: string): string =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: PH_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

// ─────────────────────────────────────────────
// Sleep quality remark
// ─────────────────────────────────────────────
function getSleepRemark(durationHours: number): SleepRemark {
  if (durationHours < 4)
    return {
      label: "Severely sleep deprived",
      color: "#ef4444",
      suggestion:
        "You need a lot more rest. Try to sleep earlier tonight and aim for at least 7–9 hours. Avoid caffeine in the afternoon and keep a consistent bedtime.",
    };
  if (durationHours < 6)
    return {
      label: "Not enough sleep",
      color: "#f97316",
      suggestion:
        "You're getting less than the recommended amount. Try going to bed 30–60 minutes earlier. Limit screen time before bed to improve sleep quality.",
    };
  if (durationHours < 7)
    return {
      label: "Slightly below recommended",
      color: "#eab308",
      suggestion:
        "You're close to the target. Try to squeeze in an extra 30–60 minutes of sleep. A short nap during the day can also help.",
    };
  if (durationHours <= 9)
    return {
      label: "Great sleep!",
      color: "#10b981",
      suggestion:
        "You're getting the recommended 7–9 hours. Keep it up! Maintain a consistent sleep schedule to maximise your rest.",
    };
  return {
    label: "Oversleeping",
    color: "#6366f1",
    suggestion:
      "Sleeping more than 9 hours regularly can sometimes indicate fatigue or poor sleep quality. Try to keep a consistent schedule and consult a doctor if this persists.",
  };
}

/** Convert milliseconds to "Xh Ym" string */
function msToDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─────────────────────────────────────────────
// Animated Pressable helper
// ─────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SpringButton({
  onPress,
  style,
  children,
}: {
  onPress: () => void;
  style: any;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      style={[style, anim]}
      onPressIn={() => (scale.value = withSpring(0.96))}
      onPressOut={() => (scale.value = withSpring(1))}
      onPress={onPress}
    >
      {children}
    </AnimatedPressable>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────
export default function SleepScreen() {
  const router = useRouter();

  // ISO string of when the user tapped "I'm Going to Sleep", or null
  const [activeSleepISO, setActiveSleepISO] = useState<string | null>(null);

  // Live elapsed text while sleeping ("3h 12m")
  const [elapsed, setElapsed] = useState("");

  const [history, setHistory] = useState<SleepEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Success modal
  const [remarkVisible, setRemarkVisible] = useState(false);
  const [currentRemark, setCurrentRemark] = useState<SleepRemark | null>(null);
  const [currentDuration, setCurrentDuration] = useState("");

  // Cancel-confirm modal (for when user wants to cancel an active sleep)
  const [cancelVisible, setCancelVisible] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── On mount: restore any in-progress sleep & fetch history ──
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(SLEEP_START_KEY);
      if (stored) {
        setActiveSleepISO(stored);
        startElapsedTimer(stored);
      }
      fetchSleepHistory();
    })();
    return () => stopElapsedTimer();
  }, []);

  // ── Live timer ──
  const startElapsedTimer = (startISO: string) => {
    stopElapsedTimer();
    const tick = () => {
      const ms = Date.now() - new Date(startISO).getTime();
      setElapsed(msToDuration(ms));
    };
    tick();
    timerRef.current = setInterval(tick, 30_000); // update every 30 s
  };

  const stopElapsedTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ── Fetch history from Supabase ──
  const fetchSleepHistory = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("sleep_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error("fetchSleepHistory:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Tap: I'm Going to Sleep ──
  const handleGoToSleep = async () => {
    if (activeSleepISO) {
      // Already sleeping — shouldn't reach here, but guard anyway
      Alert.alert("Already sleeping!", "You already started a sleep session.");
      return;
    }
    const now = new Date().toISOString();
    await AsyncStorage.setItem(SLEEP_START_KEY, now);
    setActiveSleepISO(now);
    startElapsedTimer(now);
  };

  // ── Tap: I Just Woke Up ──
  const handleWakeUp = async () => {
    if (!activeSleepISO) return;

    const wakeISO = new Date().toISOString();
    const diffMs = new Date(wakeISO).getTime() - new Date(activeSleepISO).getTime();

    if (diffMs <= 0) {
      Alert.alert("Time error", "Wake time must be after sleep time.");
      return;
    }

    const durationHours = diffMs / 3_600_000;

    if (durationHours > 24) {
      Alert.alert(
        "Long sleep detected",
        "The recorded duration is over 24 hours. Did you forget to cancel a previous session?",
        [
          { text: "Cancel session", style: "destructive", onPress: cancelSleep },
          { text: "Save anyway", onPress: () => saveSleep(activeSleepISO, wakeISO, durationHours) },
        ]
      );
      return;
    }

    await saveSleep(activeSleepISO, wakeISO, durationHours);
  };

  const saveSleep = async (
    sleepISO: string,
    wakeISO: string,
    durationHours: number
  ) => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("sleep_logs").insert({
        user_id: user.id,
        sleep_time: sleepISO,
        wake_time: wakeISO,
        duration_hours: parseFloat(durationHours.toFixed(2)),
      });

      if (error) throw error;

      // Clear active session
      await AsyncStorage.removeItem(SLEEP_START_KEY);
      stopElapsedTimer();
      setActiveSleepISO(null);
      setElapsed("");

      // Show success modal
      const durationStr = msToDuration(durationHours * 3_600_000);
      const remark = getSleepRemark(durationHours);
      setCurrentDuration(durationStr);
      setCurrentRemark(remark);
      setRemarkVisible(true);

      fetchSleepHistory();
    } catch (err: any) {
      Alert.alert("Error saving sleep", err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Cancel active sleep without saving ──
  const cancelSleep = async () => {
    await AsyncStorage.removeItem(SLEEP_START_KEY);
    stopElapsedTimer();
    setActiveSleepISO(null);
    setElapsed("");
    setCancelVisible(false);
  };

  // ─────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────

  /** Status card shown while user is sleeping */
  const renderStatusCard = () => {
    if (!activeSleepISO) return null;
    return (
      <View style={s.statusCard}>
        <View style={s.statusLeft}>
          <View style={s.pulseRing}>
            <View style={s.pulseDot} />
          </View>
          <View style={s.statusTextWrap}>
            <Text style={s.statusTitle}>Currently Sleeping</Text>
            <Text style={s.statusSince}>
              Since {formatPHTime(activeSleepISO)}
            </Text>
          </View>
        </View>
        <View style={s.statusRight}>
          <Text style={s.statusElapsed}>{elapsed}</Text>
          <Pressable onPress={() => setCancelVisible(true)} hitSlop={12}>
            <Text style={s.cancelLink}>cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  /** History list item */
  const renderItem = ({ item }: { item: SleepEntry }) => {
    const remark = getSleepRemark(item.duration_hours);
    const durationStr = msToDuration(item.duration_hours * 3_600_000);
    return (
      <View style={s.historyCard}>
        <View style={s.historyCardHeader}>
          <Text style={s.historyDate}>{formatPHDate(item.created_at)}</Text>
          <Text style={s.historyDuration}>{durationStr}</Text>
        </View>

        <View style={s.historyTimes}>
          <View style={s.historyTimeBlock}>
            <Ionicons name="moon-outline" size={16} color="#6ee7b7" />
            <Text style={s.historyTimeLabel}>Sleep</Text>
            <Text style={s.historyTimeValue}>
              {formatPHTime(item.sleep_time)}
            </Text>
          </View>
          <View style={s.historyTimeSep} />
          <View style={s.historyTimeBlock}>
            <Ionicons name="sunny-outline" size={16} color="#fbbf24" />
            <Text style={s.historyTimeLabel}>Wake</Text>
            <Text style={s.historyTimeValue}>
              {formatPHTime(item.wake_time)}
            </Text>
          </View>
        </View>

        <View
          style={[
            s.remarkBadge,
            {
              backgroundColor: remark.color + "1a",
              borderColor: remark.color + "66",
            },
          ]}
        >
          <View style={[s.remarkDot, { backgroundColor: remark.color }]} />
          <Text style={[s.remarkBadgeText, { color: remark.color }]}>
            {remark.label}
          </Text>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={s.loadingText}>Loading your sleep data…</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>

      {/* ── Top header ── */}
      <View style={s.topHeader}>
        <SpringButton style={s.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#10b981" />
        </SpringButton>
        <View style={s.headerTextWrap}>
          <Text style={s.headerSub}>Wellness Tracker</Text>
          <Text style={s.header}>Sleep Logger</Text>
        </View>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          <Text style={s.emptyText}>No sleep logged yet.</Text>
        }
        ListHeaderComponent={
          <>
            {/* ── Live status card ── */}
            {renderStatusCard()}

            {/* ── Main action area ── */}
            <View style={s.actionArea}>
              {activeSleepISO ? (
                /* ── WAKE UP button (primary action when sleeping) ── */
                <>
                  <Text style={s.actionHint}>Tap when you wake up</Text>
                  <SpringButton
                    style={s.wakeBtn}
                    onPress={saving ? () => {} : handleWakeUp}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons
                          name="sunny"
                          size={32}
                          color="#fff"
                          style={s.actionIcon}
                        />
                        <Text style={s.wakeBtnTxt}>I Just Woke Up</Text>
                        <Text style={s.actionSub}>
                          Records wake time & saves entry
                        </Text>
                      </>
                    )}
                  </SpringButton>
                </>
              ) : (
                /* ── SLEEP button (primary action when awake) ── */
                <>
                  <Text style={s.actionHint}>Tap when you're ready to sleep</Text>
                  <SpringButton style={s.sleepBtn} onPress={handleGoToSleep}>
                    <Ionicons
                      name="moon"
                      size={32}
                      color="#fff"
                      style={s.actionIcon}
                    />
                    <Text style={s.sleepBtnTxt}>I'm Going to Sleep</Text>
                    <Text style={s.actionSub}>Records current time as sleep start</Text>
                  </SpringButton>
                </>
              )}
            </View>

            {/* ── History section header ── */}
            {history.length > 0 && (
              <View style={s.historySectionHeader}>
                <Text style={s.historyTitle}>Recent Sleep Logs</Text>
                <Text style={s.historyCount}>{history.length} entries</Text>
              </View>
            )}
          </>
        }
      />

      {/* ── Success Remark Modal ── */}
      <Modal visible={remarkVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View
              style={[
                s.modalIconWrap,
                {
                  backgroundColor:
                    (currentRemark?.color ?? "#10b981") + "22",
                },
              ]}
            >
              <Ionicons
                name="moon"
                size={40}
                color={currentRemark?.color ?? "#10b981"}
              />
            </View>

            <Text style={s.modalTitle}>Sleep Logged!</Text>
            <Text style={s.remarkDuration}>{currentDuration}</Text>

            <View
              style={[
                s.remarkBadge,
                {
                  backgroundColor:
                    (currentRemark?.color ?? "#10b981") + "1a",
                  borderColor:
                    (currentRemark?.color ?? "#10b981") + "66",
                  marginBottom: 20,
                },
              ]}
            >
              <View
                style={[
                  s.remarkDot,
                  { backgroundColor: currentRemark?.color ?? "#10b981" },
                ]}
              />
              <Text
                style={[
                  s.remarkBadgeText,
                  { color: currentRemark?.color ?? "#10b981" },
                ]}
              >
                {currentRemark?.label}
              </Text>
            </View>

            <Text style={s.suggestionTitle}>Suggestion</Text>
            <Text style={s.suggestionText}>{currentRemark?.suggestion}</Text>

            <SpringButton
              style={[s.confirmBtn, { marginTop: 24, alignSelf: "stretch" }]}
              onPress={() => setRemarkVisible(false)}
            >
              <Text style={s.confirmTxt}>Got it!</Text>
            </SpringButton>
          </View>
        </View>
      </Modal>

      {/* ── Cancel Sleep Confirmation Modal ── */}
      <Modal visible={cancelVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={[s.modalIconWrap, { backgroundColor: "#fef3c7" }]}>
              <Ionicons name="trash-outline" size={36} color="#f59e0b" />
            </View>
            <Text style={[s.modalTitle, { color: "#92400e" }]}>
              Cancel Sleep Session?
            </Text>
            <Text style={s.suggestionText}>
              This will discard the current sleep session without saving. Are
              you sure?
            </Text>
            <View style={s.cancelModalBtns}>
              <Pressable
                style={s.cancelModalKeep}
                onPress={() => setCancelVisible(false)}
              >
                <Text style={s.cancelModalKeepTxt}>Keep sleeping</Text>
              </Pressable>
              <Pressable style={s.cancelModalDiscard} onPress={cancelSleep}>
                <Text style={s.cancelModalDiscardTxt}>Discard</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Styles — Premium Emerald Green
// ─────────────────────────────────────────────
const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f0fdf4" },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f0fdf4",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#059669",
    fontWeight: "600",
  },

  // ── Header ──
  topHeader: {
    paddingTop: Platform.OS === "android" ? 48 : 18,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#f0fdf4",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#a7f3d0",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  headerTextWrap: { flex: 1 },
  headerSub: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.5,
    color: "#34d399",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  header: {
    fontSize: 22,
    fontWeight: "900",
    color: "#064e3b",
    letterSpacing: -0.3,
  },

  // ── List container ──
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 100,
  },

  // ── Status card (shown while sleeping) ──
  statusCard: {
    backgroundColor: "#064e3b",
    borderRadius: 24,
    padding: 20,
    marginTop: 4,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#064e3b",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 16,
  },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  pulseRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#10b98133",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#10b98166",
  },
  pulseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#34d399",
  },
  statusTextWrap: { flex: 1 },
  statusTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6ee7b7",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  statusSince: { fontSize: 17, fontWeight: "800", color: "#ffffff" },
  statusRight: { alignItems: "flex-end", gap: 4 },
  statusElapsed: {
    fontSize: 22,
    fontWeight: "900",
    color: "#34d399",
    letterSpacing: -0.5,
  },
  cancelLink: {
    fontSize: 12,
    color: "#6ee7b7",
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  // ── Action area ──
  actionArea: { marginBottom: 32 },
  actionHint: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: 0.3,
  },

  // ── Sleep button (dark navy-green, moon feel) ──
  sleepBtn: {
    backgroundColor: "#064e3b",
    borderRadius: 28,
    paddingVertical: 26,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#064e3b",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 18,
  },
  sleepBtnTxt: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.2,
    marginTop: 4,
  },

  // ── Wake button (vibrant emerald, sunrise feel) ──
  wakeBtn: {
    backgroundColor: "#10b981",
    borderRadius: 28,
    paddingVertical: 26,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 18,
  },
  wakeBtnTxt: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.2,
    marginTop: 4,
  },

  actionIcon: { marginBottom: 2 },
  actionSub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
  },

  // ── History ──
  historySectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 16,
    marginTop: 8,
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#065f46",
  },
  historyCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#34d399",
  },
  historyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "#d1fae5",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
  },
  historyCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 14,
  },
  historyDate: { fontSize: 16, fontWeight: "700", color: "#065f46" },
  historyDuration: {
    fontSize: 22,
    fontWeight: "900",
    color: "#10b981",
  },
  historyTimes: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  historyTimeBlock: { flex: 1, alignItems: "center", gap: 4 },
  historyTimeSep: {
    width: 1,
    height: 36,
    backgroundColor: "#d1fae5",
    marginHorizontal: 12,
  },
  historyTimeLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  historyTimeValue: { fontSize: 20, fontWeight: "800", color: "#065f46" },

  // ── Remark badge ──
  remarkBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    gap: 6,
  },
  remarkDot: { width: 8, height: 8, borderRadius: 4 },
  remarkBadgeText: { fontSize: 13, fontWeight: "700" },

  emptyText: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 16,
    marginTop: 60,
    fontStyle: "italic",
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    width: "90%",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 20,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#065f46",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  remarkDuration: {
    fontSize: 38,
    fontWeight: "900",
    color: "#064e3b",
    letterSpacing: -1,
    marginBottom: 16,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#059669",
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: "400",
    color: "#374151",
    lineHeight: 22,
    textAlign: "left",
    alignSelf: "stretch",
  },
  confirmBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  confirmTxt: { fontSize: 17, fontWeight: "800", color: "#fff" },

  // ── Cancel modal buttons ──
  cancelModalBtns: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    alignSelf: "stretch",
  },
  cancelModalKeep: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1.5,
    borderColor: "#a7f3d0",
  },
  cancelModalKeepTxt: { fontSize: 15, fontWeight: "700", color: "#065f46" },
  cancelModalDiscard: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderWidth: 1.5,
    borderColor: "#fecaca",
  },
  cancelModalDiscardTxt: { fontSize: 15, fontWeight: "700", color: "#dc2626" },
});