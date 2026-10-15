// Pressure
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/AppText";
import KeyboardSafeView from "../components/layout/KeyboardSafeView";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { getSessionUser } from "../lib/auth/session";
import { Colors, useTheme } from "../providers/ThemeProvider";

type BPEntry = {
  id: string;
  user_id: string;
  systolic: number;
  diastolic: number;
  pulse?: number | null;
  note?: string | null;
  created_at: string;
  updated_at?: string | null;
};

type BPRemark = {
  category: string;
  color: string;
  suggestion: string;
};

// Remarks
function getBPRemark(systolic: number, diastolic: number): BPRemark {
  if (systolic < 90 || diastolic < 60) {
    return {
      category: "Low Blood Pressure (Hypotension)",
      color: "#6366f1",
      suggestion:
        "Your blood pressure is low. Drink more water and increase your fluid intake throughout the day. Add a little more salt to your meals if your doctor approves. Eat small, frequent meals and avoid standing up too quickly. If you feel dizzy or faint frequently, consult your doctor.",
    };
  } else if (systolic < 120 && diastolic < 80) {
    return {
      category: "Normal",
      color: "#10b981",
      suggestion:
        "Your blood pressure is normal. Keep it up! Maintain a balanced diet rich in fruits and vegetables like pineapple, bananas, and watermelon. Stay hydrated, exercise regularly, and reduce stress to keep your blood pressure in this healthy range.",
    };
  } else if (systolic < 130 && diastolic < 80) {
    return {
      category: "Elevated",
      color: "#eab308",
      suggestion:
        "Your blood pressure is slightly elevated. Cut back on salty and processed foods. Eat more potassium-rich foods like bananas and pineapple. Drink plenty of water, reduce caffeine and alcohol, and aim for at least 30 minutes of moderate exercise daily.",
    };
  } else if (systolic < 140 || diastolic < 90) {
    return {
      category: "High Blood Pressure Stage 1",
      color: "#f97316",
      suggestion:
        "You have Stage 1 hypertension. Limit salt intake significantly and avoid processed foods. Eat heart-healthy foods like pineapple, garlic, and leafy greens. Drink more water, quit smoking if applicable, reduce alcohol, and try to manage stress through relaxation or meditation. Consider consulting your doctor.",
    };
  } else if (systolic < 180 || diastolic < 120) {
    return {
      category: "High Blood Pressure Stage 2",
      color: "#ef4444",
      suggestion:
        "You have Stage 2 hypertension. Please consult your doctor as soon as possible. In the meantime, strictly limit salt and fatty foods. Eat more fruits like pineapple and watermelon that support heart health. Stay well-hydrated and avoid any strenuous physical activity until cleared by a doctor.",
    };
  } else {
    return {
      category: "Hypertensive Crisis: Seek Help Immediately",
      color: "#7f1d1d",
      suggestion:
        "This is a hypertensive crisis. Please seek emergency medical attention immediately. Do not delay. Rest in a calm environment and avoid any physical exertion until help arrives.",
    };
  }
}

export default function BloodPressureScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<BPEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentNote, setCurrentNote] = useState("");
  const [currentEntryId, setCurrentEntryId] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [remarkVisible, setRemarkVisible] = useState(false);
  const [currentRemark, setCurrentRemark] = useState<BPRemark | null>(null);
  const [loggedSystolic, setLoggedSystolic] = useState(0);
  const [loggedDiastolic, setLoggedDiastolic] = useState(0);
  const [focused, setFocused] = useState<string | null>(null);

  // Auth
  useEffect(() => {
    const getUser = async () => {
      const user = await getSessionUser();
      if (!user) {
        Alert.alert("Not Authenticated", "Please log in to use this feature.");
        router.replace("/");
        return;
      }
      setCurrentUserId(user.id);
    };
    getUser();
  }, []);

  // History
  const fetchHistory = async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("blood_pressure_logs")
        .select("*")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHistory(data as BPEntry[]);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Refresh
  useEffect(() => {
    if (currentUserId) {
      fetchHistory();
    }
  }, [currentUserId]);

  const logEntry = async () => {
    if (!currentUserId) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }

    const s = parseInt(systolic);
    const d = parseInt(diastolic);
    const p = pulse ? parseInt(pulse) : null;

    if (isNaN(s) || isNaN(d) || s <= 0 || d <= 0) {
      Alert.alert("Invalid Input", "Please enter valid Systolic and Diastolic values.");
      return;
    }

    try {
      const { error } = await supabase
        .from("blood_pressure_logs")
        .insert([
          {
            user_id: currentUserId,
            systolic: s,
            diastolic: d,
            pulse: p || null,
            note: note || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Reset
      setSystolic("");
      setDiastolic("");
      setPulse("");
      setNote("");
      Keyboard.dismiss();

      fetchHistory();

      // Remarks
      const remark = getBPRemark(s, d);
      setLoggedSystolic(s);
      setLoggedDiastolic(d);
      setCurrentRemark(remark);
      setRemarkVisible(true);
    } catch (error: any) {
      Alert.alert("Error logging entry", error.message || "Unknown error");
    }
  };

  const openNoteModal = (id: string, existingNote: string = "") => {
    setCurrentEntryId(id);
    setCurrentNote(existingNote || "");
    setShowNoteModal(true);
  };

  const saveNote = async () => {
    if (!currentEntryId) return;

    try {
      const { error } = await supabase
        .from("blood_pressure_logs")
        .update({
          note: currentNote || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentEntryId);

      if (error) throw error;

      setShowNoteModal(false);
      fetchHistory();
    } catch (error: any) {
      Alert.alert("Error saving note", error.message);
    }
  };

  const deleteEntry = (id: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("blood_pressure_logs")
                .delete()
                .eq("id", id);

              if (error) throw error;
              fetchHistory();
            } catch (error: any) {
              Alert.alert("Error deleting entry", error.message);
            }
          },
        },
      ]
    );
  };


  const renderItem = ({ item }: { item: BPEntry }) => {
    const remark = getBPRemark(item.systolic, item.diastolic);
    return (
      <View style={[s.historyItem, { borderLeftColor: remark.color }]}>
        <View style={s.historyHeader}>
          <View style={s.dateWrap}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <Text style={s.date}>
              {format(new Date(item.created_at), "MMM d, yyyy h:mm a")}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [s.deleteButton, pressed && s.pressed]}
            onPress={() => deleteEntry(item.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Delete reading"
          >
            <Ionicons name="trash-outline" size={20} color="#f87171" />
          </Pressable>
        </View>

        <View style={s.readingRow}>
          <View style={s.readingMain}>
            <Text style={s.readingValue}>
              {item.systolic}/{item.diastolic}
            </Text>
            <Text style={s.readingUnit}>mmHg</Text>
          </View>
          {item.pulse != null && (
            <View style={s.pulseChip}>
              <Ionicons name="pulse-outline" size={16} color={colors.accent} />
              <Text style={s.pulseText}>{item.pulse} bpm</Text>
            </View>
          )}
        </View>

        {/* Badge */}
        <View style={[s.remarkBadge, { backgroundColor: remark.color + "22", borderColor: remark.color }]}>
          <Text style={[s.remarkBadgeText, { color: remark.color }]}>{remark.category}</Text>
        </View>

        <Pressable
          onPress={() => openNoteModal(item.id, item.note || "")}
          style={({ pressed }) => [s.noteButton, pressed && s.pressed]}
        >
          <Ionicons name="create-outline" size={16} color={colors.textMuted} />
          <Text style={[s.noteText, !item.note && s.noteTextEmpty]} numberOfLines={3}>
            {item.note ? `Note: ${item.note}` : "Tap to add/edit note..."}
          </Text>
        </Pressable>
      </View>
    );
  };

  if (!currentUserId) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={s.loadingText}>Loading user...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const latest = history.length > 0 ? history[0] : null;
  const latestRemark = latest ? getBPRemark(latest.systolic, latest.diastolic) : null;

  const listHeader = (
    <View>
      {/* Input */}
      <View style={s.inputCard}>
        <Text style={s.inputTitle}>Log New Reading</Text>

        <View style={s.inputRow}>
          <View style={s.inputWrapper}>
            <Text style={s.inputLabel}>Systolic</Text>
            <TextInput
              style={[s.input, focused === "systolic" && s.inputFocused]}
              value={systolic}
              onChangeText={setSystolic}
              onFocus={() => setFocused("systolic")}
              onBlur={() => setFocused(null)}
              placeholder="120"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            <Text style={s.inputUnit}>mmHg</Text>
          </View>

          <View style={s.inputWrapper}>
            <Text style={s.inputLabel}>Diastolic</Text>
            <TextInput
              style={[s.input, focused === "diastolic" && s.inputFocused]}
              value={diastolic}
              onChangeText={setDiastolic}
              onFocus={() => setFocused("diastolic")}
              onBlur={() => setFocused(null)}
              placeholder="80"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            <Text style={s.inputUnit}>mmHg</Text>
          </View>

          <View style={s.inputWrapper}>
            <Text style={s.inputLabel}>Pulse</Text>
            <TextInput
              style={[s.input, focused === "pulse" && s.inputFocused]}
              value={pulse}
              onChangeText={setPulse}
              onFocus={() => setFocused("pulse")}
              onBlur={() => setFocused(null)}
              placeholder="75"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            <Text style={s.inputUnit}>bpm (optional)</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [s.logButton, pressed && s.pressed]}
          onPress={logEntry}
          accessibilityRole="button"
        >
          <Ionicons name="heart" size={18} color={colors.onAccent} />
          <Text style={s.logButtonText}>Log Reading</Text>
        </Pressable>
      </View>

      {/* Status */}
      {latest && latestRemark && (
        <View style={s.statusCard}>
          <Text style={s.statusLabel}>Latest reading</Text>
          <View style={s.statusRow}>
            <Text style={s.statusValue}>
              {latest.systolic}/{latest.diastolic}
              <Text style={s.statusUnit}> mmHg</Text>
            </Text>
            <View
              style={[
                s.statusChip,
                { backgroundColor: latestRemark.color + "22", borderColor: latestRemark.color },
              ]}
            >
              <View style={[s.statusDot, { backgroundColor: latestRemark.color }]} />
              <Text style={[s.statusChipText, { color: latestRemark.color }]} numberOfLines={2}>
                {latestRemark.category}
              </Text>
            </View>
          </View>
        </View>
      )}

      <Text style={s.historyTitle}>Recent Readings</Text>
      {loading && (
        <View style={s.listLoading}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      {/* Header */}
      <View style={s.headerContainer}>
        <Text style={s.header}>Blood Pressure Log</Text>
      </View>

      <KeyboardSafeView
        style={s.flex}
        behavior="padding"
      >
        <FlatList
          data={loading ? [] : history}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={s.listContent}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            loading ? null : (
              <View style={s.emptyWrap}>
                <View style={s.emptyIcon}>
                  <Ionicons name="heart-outline" size={32} color={colors.accent} />
                </View>
                <Text style={s.emptyText}>No blood pressure readings logged yet.</Text>
              </View>
            )
          }
        />
      </KeyboardSafeView>

      {/* Notes */}
      <Modal
        visible={showNoteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNoteModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowNoteModal(false)}>
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.noteModal}>
                <Text style={s.modalTitle}>Edit Note</Text>
                <TextInput
                  style={[s.input, s.modalInput, focused === "note" && s.inputFocused]}
                  value={currentNote}
                  onChangeText={setCurrentNote}
                  onFocus={() => setFocused("note")}
                  onBlur={() => setFocused(null)}
                  placeholder="Enter your note here"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  multiline
                />
                <View style={s.modalButtons}>
                  <Pressable
                    style={({ pressed }) => [s.actionButton, s.cancelButton, pressed && s.pressed]}
                    onPress={() => setShowNoteModal(false)}
                  >
                    <Text style={[s.actionText, { color: "#f87171" }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [s.actionButton, s.saveButton, pressed && s.pressed]}
                    onPress={saveNote}
                  >
                    <Text style={[s.actionText, { color: colors.onAccent }]}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Remarks */}
      <Modal
        visible={remarkVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRemarkVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.remarkModal}>
            <Ionicons name="heart" size={48} color={currentRemark?.color ?? colors.accent} style={{ marginBottom: 12 }} />
            <Text style={s.remarkModalTitle}>Reading Logged!</Text>
            <Text style={s.remarkReading}>
              {loggedSystolic}/{loggedDiastolic} mmHg
            </Text>

            <View style={[s.remarkBadge, { backgroundColor: (currentRemark?.color ?? colors.accent) + "22", borderColor: currentRemark?.color ?? colors.accent, marginBottom: 16, alignSelf: "center" }]}>
              <Text style={[s.remarkBadgeText, { color: currentRemark?.color ?? colors.accent }]}>
                {currentRemark?.category}
              </Text>
            </View>

            <Text style={s.suggestionTitle}>Suggestion</Text>
            <Text style={s.suggestionText}>{currentRemark?.suggestion}</Text>

            <Pressable
              style={({ pressed }) => [s.actionButton, s.saveButton, { marginTop: 24, alignSelf: "stretch" }, pressed && s.pressed]}
              onPress={() => setRemarkVisible(false)}
            >
              <Text style={[s.actionText, { color: colors.onAccent }]}>Got it!</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Styles
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    pressed: { opacity: 0.7 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    loadingText: { marginTop: 16, color: c.textPrimary },
    listLoading: { paddingVertical: 32, alignItems: "center", justifyContent: "center" },

    headerContainer: {
      paddingTop: 12,
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

    listContent: { paddingHorizontal: 20, paddingBottom: 60 },

    inputCard: {
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 18,
      marginBottom: 16,
    },
    inputTitle: { fontSize: 18, fontWeight: "800", color: c.textPrimary, marginBottom: 16 },
    inputRow: { flexDirection: "row", gap: 10 },
    inputWrapper: { flex: 1 },
    inputLabel: { color: c.textPrimary, fontSize: 14, fontWeight: "800", marginBottom: 8, textAlign: "center" },
    inputUnit: { color: c.textMuted, fontSize: 12, fontWeight: "600", marginTop: 6, textAlign: "center" },
    input: {
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.border,
      color: c.textPrimary,
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderRadius: 14,
      fontSize: 20,
      fontWeight: "700",
      textAlign: "center",
    },
    inputFocused: { borderColor: c.accent },
    logButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: c.accent,
      paddingVertical: 16,
      borderRadius: 16,
      marginTop: 20,
    },
    logButtonText: { color: c.onAccent, fontWeight: "800", fontSize: 17 },

    statusCard: {
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 18,
      marginBottom: 20,
    },
    statusLabel: { fontSize: 13, fontWeight: "700", color: c.textSecondary, marginBottom: 8 },
    statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", rowGap: 10 },
    statusValue: { fontSize: 30, fontWeight: "800", color: c.textPrimary },
    statusUnit: { fontSize: 14, fontWeight: "600", color: c.textMuted },
    statusChip: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 150,
      minWidth: 150,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1.5,
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusChipText: { flex: 1, fontSize: 13, fontWeight: "800" },

    historyTitle: { fontSize: 18, fontWeight: "800", color: c.textPrimary, marginBottom: 12, marginLeft: 4 },

    historyItem: {
      backgroundColor: c.surface,
      borderRadius: 22,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      borderLeftWidth: 6,
    },
    historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    dateWrap: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
    date: { color: c.textSecondary, fontSize: 13, fontWeight: "700", flexShrink: 1 },
    deleteButton: { padding: 4 },
    readingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    readingMain: { flexDirection: "row", alignItems: "baseline", gap: 6 },
    readingValue: { color: c.textPrimary, fontSize: 28, fontWeight: "800" },
    readingUnit: { color: c.textMuted, fontSize: 13, fontWeight: "600" },
    pulseChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 999,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    pulseText: { color: c.textPrimary, fontSize: 13, fontWeight: "700" },
    remarkBadge: {
      borderWidth: 1.5,
      borderRadius: 12,
      paddingVertical: 6,
      paddingHorizontal: 14,
      alignSelf: "flex-start",
      marginTop: 10,
    },
    remarkBadgeText: { fontSize: 13, fontWeight: "700" },
    noteButton: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingVertical: 4 },
    noteText: { flex: 1, color: c.textPrimary, fontSize: 14, fontWeight: "500" },
    noteTextEmpty: { color: c.textMuted, fontStyle: "italic" },

    emptyWrap: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    emptyText: { textAlign: "center", color: c.textSecondary, fontSize: 15, fontWeight: "600" },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
    noteModal: {
      backgroundColor: c.surface,
      width: "88%",
      borderRadius: 22,
      padding: 22,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    remarkModal: {
      backgroundColor: c.surface,
      width: "90%",
      borderRadius: 22,
      padding: 24,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: c.border,
    },
    remarkModalTitle: { fontSize: 24, fontWeight: "800", color: c.textPrimary, marginBottom: 8 },
    remarkReading: { fontSize: 34, fontWeight: "800", color: c.textPrimary, marginBottom: 16 },
    suggestionTitle: { fontSize: 16, fontWeight: "800", color: c.textSecondary, alignSelf: "flex-start", marginBottom: 8 },
    suggestionText: { fontSize: 15, fontWeight: "500", color: c.textPrimary, lineHeight: 22, textAlign: "left" },
    modalTitle: { fontSize: 20, fontWeight: "800", color: c.textPrimary, marginBottom: 16, textAlign: "center" },
    modalInput: { marginBottom: 20, minHeight: 100, textAlignVertical: "top", textAlign: "left", fontSize: 16, fontWeight: "500", paddingHorizontal: 14 },
    modalButtons: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    actionButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
    },
    cancelButton: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: "#f87171" },
    saveButton: { backgroundColor: c.accent },
    actionText: { fontWeight: "800", fontSize: 16 },
  });
