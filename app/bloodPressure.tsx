// app/bloodPressure.tsx — With BP remarks and suggestions after logging
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

// Returns BP category, color, and suggestion based on systolic/diastolic values
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
      category: "Hypertensive Crisis — Seek Help Immediately",
      color: "#7f1d1d",
      suggestion:
        "This is a hypertensive crisis. Please seek emergency medical attention immediately. Do not delay. Rest in a calm environment and avoid any physical exertion until help arrives.",
    };
  }
}

// Returns the BP badge color for history list items
function getBPColor(systolic: number, diastolic: number): string {
  return getBPRemark(systolic, diastolic).color;
}

export default function BloodPressureScreen() {
  const router = useRouter();

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

  // Animation values
  const backScale = useSharedValue(1);
  const logScale = useSharedValue(1);

  const animatedBackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  const animatedLogStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logScale.value }],
  }));

  // Fetch current authenticated user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Not Authenticated", "Please log in to use this feature.");
        router.replace("/");
        return;
      }
      setCurrentUserId(user.id);
    };
    getUser();
  }, []);

  // Fetch history only when user is confirmed
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

  // Re-fetch when user is loaded
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

      // Reset form
      setSystolic("");
      setDiastolic("");
      setPulse("");
      setNote("");
      Keyboard.dismiss();

      fetchHistory();

      // Show remark modal
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
          <Text style={s.date}>
            {format(new Date(item.created_at), "MMM d, yyyy h:mm a")}
          </Text>
          <Pressable style={s.deleteButton} onPress={() => deleteEntry(item.id)}>
            <Ionicons name="close-circle-outline" size={24} color="#f87171" />
          </Pressable>
        </View>

        <View style={s.readings}>
          <Text style={s.readingText}>
            <Text style={s.readingLabel}>Systolic:</Text> {item.systolic} mmHg
          </Text>
          <Text style={s.readingText}>
            <Text style={s.readingLabel}>Diastolic:</Text> {item.diastolic} mmHg
          </Text>
        </View>

        {item.pulse != null && (
          <Text style={s.pulse}>Pulse: {item.pulse} bpm</Text>
        )}

        {/* Remark badge on history card */}
        <View style={[s.remarkBadge, { backgroundColor: remark.color + "22", borderColor: remark.color }]}>
          <Text style={[s.remarkBadgeText, { color: remark.color }]}>{remark.category}</Text>
        </View>

        <Pressable
          onPress={() => openNoteModal(item.id, item.note || "")}
          style={s.noteButton}
        >
          <Text style={s.noteText}>
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
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={{ marginTop: 16, color: "#065f46" }}>Loading user...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      {/* Header */}
      <View style={s.headerContainer}>
        <AnimatedPressable
          style={[s.backButton, animatedBackStyle]}
          onPressIn={() => (backScale.value = withSpring(0.92))}
          onPressOut={() => (backScale.value = withSpring(1))}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={32} color="#10b981" />
        </AnimatedPressable>
        <Text style={s.header}>Blood Pressure Log</Text>
        <View style={{ width: 48 }} />
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={s.container}>
          {/* Input Card */}
          <View style={s.inputCard}>
            <Text style={s.inputTitle}>Log New Reading</Text>

            <View style={s.inputRow}>
              <View style={s.inputWrapper}>
                <Text style={s.inputLabel}>Systolic</Text>
                <TextInput
                  style={s.input}
                  value={systolic}
                  onChangeText={setSystolic}
                  placeholder="e.g. 120"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
              </View>

              <View style={s.inputWrapper}>
                <Text style={s.inputLabel}>Diastolic</Text>
                <TextInput
                  style={s.input}
                  value={diastolic}
                  onChangeText={setDiastolic}
                  placeholder="e.g. 80"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={s.inputWrapperFull}>
              <Text style={s.inputLabel}>Pulse (optional)</Text>
              <TextInput
                style={s.input}
                value={pulse}
                onChangeText={setPulse}
                placeholder="e.g. 75"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />
            </View>

            <AnimatedPressable
              style={[s.logButton, animatedLogStyle]}
              onPressIn={() => (logScale.value = withSpring(0.95))}
              onPressOut={() => (logScale.value = withSpring(1))}
              onPress={logEntry}
            >
              <Text style={s.logButtonText}>Log Reading</Text>
            </AnimatedPressable>
          </View>

          {/* History */}
          <Text style={s.historyTitle}>Recent Readings</Text>
          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="large" color="#10b981" />
            </View>
          ) : (
            <FlatList
              data={history}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.listContent}
              ListEmptyComponent={() => (
                <Text style={s.emptyText}>No blood pressure readings logged yet.</Text>
              )}
            />
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Note Modal */}
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
                  style={[s.input, s.modalInput]}
                  value={currentNote}
                  onChangeText={setCurrentNote}
                  placeholder="Enter your note here"
                  placeholderTextColor="#94a3b8"
                  autoFocus
                  multiline
                />
                <View style={s.modalButtons}>
                  <Pressable
                    style={[s.actionButton, s.cancelButton]}
                    onPress={() => setShowNoteModal(false)}
                  >
                    <Text style={[s.actionText, { color: "#f87171" }]}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[s.actionButton, s.saveButton]} onPress={saveNote}>
                    <Text style={[s.actionText, { color: "#ffffff" }]}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* BP Remark Modal */}
      <Modal
        visible={remarkVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRemarkVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.remarkModal}>
            <Ionicons name="heart" size={48} color={currentRemark?.color ?? "#10b981"} style={{ marginBottom: 12 }} />
            <Text style={s.remarkModalTitle}>Reading Logged!</Text>
            <Text style={s.remarkReading}>
              {loggedSystolic}/{loggedDiastolic} mmHg
            </Text>

            <View style={[s.remarkBadge, { backgroundColor: (currentRemark?.color ?? "#10b981") + "22", borderColor: currentRemark?.color ?? "#10b981", marginBottom: 16, alignSelf: "center" }]}>
              <Text style={[s.remarkBadgeText, { color: currentRemark?.color ?? "#10b981" }]}>
                {currentRemark?.category}
              </Text>
            </View>

            <Text style={s.suggestionTitle}>Suggestion</Text>
            <Text style={s.suggestionText}>{currentRemark?.suggestion}</Text>

            <Pressable
              style={[s.actionButton, s.saveButton, { marginTop: 24, alignSelf: "stretch" }]}
              onPress={() => setRemarkVisible(false)}
            >
              <Text style={[s.actionText, { color: "#fff" }]}>Got it!</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// STYLES
const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fff9" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerContainer: {
    paddingTop: Platform.OS === "android" ? 50 : 20,
    paddingBottom: 30,
    paddingHorizontal: 24,
    backgroundColor: "#f8fff9",
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    marginRight: 16,
  },
  header: {
    fontSize: 23,
    fontWeight: "900",
    color: "#064e3b",
    flex: 1,
    textAlign: "center",
    letterSpacing: 0.6,
  },
  container: { flex: 1, paddingHorizontal: 20, backgroundColor: "#f8fff9" },
  inputCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 30,
    marginBottom: 24,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 20,
    borderWidth: 2,
    borderColor: "#d1fae5",
  },
  inputTitle: { fontSize: 24, fontWeight: "800", color: "#065f46", textAlign: "center", marginBottom: 24 },
  inputRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  inputWrapper: { flex: 1, marginRight: 12 },
  inputWrapperFull: { marginBottom: 16 },
  inputLabel: { color: "#059669", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  input: {
    backgroundColor: "#f0fdf4",
    borderWidth: 2.5,
    borderColor: "#86efac",
    color: "#065f46",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    fontSize: 18,
    fontWeight: "600",
  },
  logButton: {
    backgroundColor: "#10b981",
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  logButtonText: { color: "#ffffff", fontWeight: "800", fontSize: 19, letterSpacing: 0.5 },
  historyTitle: { fontSize: 22, fontWeight: "800", color: "#065f46", marginBottom: 16, marginLeft: 4 },
  listContent: { paddingBottom: 100 },
  historyItem: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 6,
    borderLeftColor: "#34d399",
  },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  date: { color: "#059669", fontSize: 15, fontWeight: "700" },
  deleteButton: { padding: 4 },
  readings: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#ecfdf5",
    paddingBottom: 8,
    marginBottom: 8,
  },
  readingText: { color: "#065f46", fontSize: 18, fontWeight: "800" },
  readingLabel: { color: "#10b981", fontWeight: "600", fontSize: 15 },
  pulse: { color: "#10b981", marginTop: 8, fontWeight: "700" },
  remarkBadge: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  remarkBadgeText: { fontSize: 13, fontWeight: "700" },
  noteButton: { marginTop: 10, paddingVertical: 4 },
  noteText: { color: "#065f46", fontStyle: "italic", fontWeight: "500" },
  emptyText: { textAlign: "center", color: "#94a3b8", fontSize: 17, marginTop: 60, fontWeight: "500" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  noteModal: {
    backgroundColor: "#ffffff",
    width: "88%",
    borderRadius: 24,
    padding: 28,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 15,
    borderWidth: 1,
    borderColor: "#ecfdf5",
  },
  remarkModal: {
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
  remarkModalTitle: { fontSize: 26, fontWeight: "800", color: "#065f46", marginBottom: 8 },
  remarkReading: { fontSize: 36, fontWeight: "900", color: "#065f46", marginBottom: 16 },
  suggestionTitle: { fontSize: 18, fontWeight: "800", color: "#059669", alignSelf: "flex-start", marginBottom: 8 },
  suggestionText: { fontSize: 15, fontWeight: "500", color: "#374151", lineHeight: 22, textAlign: "left" },
  modalTitle: { fontSize: 22, fontWeight: "800", color: "#065f46", marginBottom: 20, textAlign: "center" },
  modalInput: { marginBottom: 24, minHeight: 100, textAlignVertical: "top" },
  modalButtons: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  cancelButton: { backgroundColor: "#fef2f2", borderWidth: 1.5, borderColor: "#f87171" },
  saveButton: { backgroundColor: "#10b981" },
  actionText: { fontWeight: "700", fontSize: 16 },
});