// app/reminders.tsx

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

const PH_TIMEZONE = "Asia/Manila";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
} as any);

type Reminder = {
  id: string;
  name: string;
  time: string;
  enabled: boolean;
  user_id: string;
};

export default function RemindersScreen() {
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  // FIX: store userId in state so fetchReminders doesn't need router in deps
  const [userId, setUserId] = useState<string | null>(null);

  // FIX: useCallback so fetchReminders is stable and can be called from multiple places
  const fetchReminders = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", uid)
        .order("time", { ascending: true });

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        setReminders(data || []);
        await scheduleAllNotifications(data || []);
      }
    } catch (err: any) {
      console.error("fetchReminders error:", err.message);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await Notifications.requestPermissionsAsync();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      setUserId(user.id);
      await fetchReminders(user.id);
      setLoading(false);
    };
    init();
  }, [fetchReminders]);

  const saveReminder = async () => {
    if (!name.trim()) return Alert.alert("Error", "Reminder name is required");
    if (!userId) return;

    const phHours = selectedTime.getHours();
    const phMinutes = selectedTime.getMinutes();

    const todayInPH = toZonedTime(new Date(), PH_TIMEZONE);
    const utcTime = new Date(Date.UTC(
      todayInPH.getFullYear(),
      todayInPH.getMonth(),
      todayInPH.getDate(),
      phHours - 8,
      phMinutes,
      0
    ));

    const payload = {
      user_id: userId,
      name: name.trim(),
      time: utcTime.toISOString(),
      enabled: true,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase
        .from("reminders")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", userId));
    } else {
      ({ error } = await supabase.from("reminders").insert(payload));
    }

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setModalVisible(false);
      resetForm();
      fetchReminders(userId);
    }
  };

  const toggleReminder = async (id: string, enabled: boolean) => {
    if (!userId) return;
    const { error } = await supabase
      .from("reminders")
      .update({ enabled })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) Alert.alert("Error", error.message);
    else fetchReminders(userId);
  };

  const deleteReminder = async (id: string) => {
    if (!userId) return;
    Alert.alert("Delete Reminder", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("reminders")
            .delete()
            .eq("id", id)
            .eq("user_id", userId!);

          if (error) Alert.alert("Error", error.message);
          else fetchReminders(userId!);
        },
      },
    ]);
  };

  const scheduleAllNotifications = async (reminders: Reminder[]) => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const r of reminders) {
      if (!r.enabled) continue;

      const utcTime = new Date(r.time);
      const trigger = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Reminder",
          body: r.name,
          sound: true,
        },
        trigger: {
          hour: trigger.getHours(),
          minute: trigger.getMinutes(),
          repeats: true,
        } as Notifications.NotificationTriggerInput,
      });
    }
  };

  const resetForm = () => {
    setName("");
    setSelectedTime(new Date());
    setEditingId(null);
  };

  const editReminder = (reminder: Reminder) => {
    setName(reminder.name);
    setSelectedTime(new Date(new Date(reminder.time).getTime() + 8 * 60 * 60 * 1000));
    setEditingId(reminder.id);
    setModalVisible(true);
  };

  const formatPHTime = (utcIso: string) => {
    const utcDate = new Date(utcIso);
    return format(new Date(utcDate.getTime() + 8 * 60 * 60 * 1000), "h:mm a");
  };

  if (loading) {
    return (
      <View style={s.container}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={s.loadingText}>Loading reminders...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Pressable onPress={() => router.back()} style={s.backBtn}>
        <Ionicons name="arrow-back" size={32} color="#10b981" />
      </Pressable>

      <Text style={s.header}>Reminders</Text>

      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.time}>{formatPHTime(item.time)}</Text>
            </View>
            <View style={s.actions}>
              <Pressable onPress={() => toggleReminder(item.id, !item.enabled)}>
                <Ionicons
                  name={item.enabled ? "notifications" : "notifications-off"}
                  size={26}
                  color={item.enabled ? "#10b981" : "#94a3b8"}
                />
              </Pressable>
              <Pressable onPress={() => editReminder(item)} style={{ marginLeft: 20 }}>
                <Ionicons name="pencil" size={24} color="#fbbf24" />
              </Pressable>
              <Pressable onPress={() => deleteReminder(item.id)} style={{ marginLeft: 20 }}>
                <Ionicons name="trash" size={24} color="#f87171" />
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>No reminders yet</Text>}
      />

      <Pressable style={s.addBtn} onPress={() => { resetForm(); setModalVisible(true); }}>
        <Ionicons name="add" size={36} color="#fff" />
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{editingId ? "Edit" : "New"} Reminder</Text>
            <TextInput
              style={s.input}
              placeholder="Reminder name (e.g., Take meds)"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
            />
            <Pressable style={s.timeBtn} onPress={() => setShowPicker(true)}>
              <Text style={s.timeTxt}>{format(selectedTime, "h:mm a")}</Text>
            </Pressable>
            {showPicker && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display="spinner"
                onChange={(_, d) => {
                  setShowPicker(Platform.OS === "ios");
                  if (d) setSelectedTime(d);
                }}
              />
            )}
            <View style={s.btnRow}>
              <Pressable style={s.cancel} onPress={() => setModalVisible(false)}>
                <Text style={s.btnTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={s.save} onPress={saveReminder}>
                <Text style={s.saveTxt}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fff9", paddingTop: 60 },
  backBtn: {
    position: "absolute", top: 60, left: 20, zIndex: 10,
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#10b981", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 10,
  },
  header: {
    fontSize: 34, fontWeight: "900", color: "#065f46",
    textAlign: "center", marginBottom: 30,
  },
  card: {
    backgroundColor: "#fff", marginHorizontal: 20, marginVertical: 8,
    padding: 20, borderRadius: 24,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    shadowColor: "#10b981", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16, shadowRadius: 20, elevation: 12,
    borderWidth: 1.5, borderColor: "#ecfdf5",
  },
  name: { fontSize: 19, fontWeight: "700", color: "#065f46" },
  time: { fontSize: 16, color: "#10b981", marginTop: 4, fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center" },
  empty: {
    textAlign: "center", color: "#94a3b8",
    fontSize: 18, marginTop: 100, fontStyle: "italic",
  },
  loadingText: { marginTop: 20, fontSize: 18, color: "#059669", fontWeight: "600" },
  addBtn: {
    position: "absolute", bottom: 40, alignSelf: "center",
    backgroundColor: "#10b981", width: 70, height: 70, borderRadius: 35,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
  },
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center", alignItems: "center",
  },
  modal: {
    width: "90%", backgroundColor: "#fff", borderRadius: 28, padding: 28,
    shadowColor: "#10b981", shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22, shadowRadius: 28, elevation: 20,
  },
  modalTitle: {
    fontSize: 26, fontWeight: "800", color: "#065f46",
    textAlign: "center", marginBottom: 24,
  },
  input: {
    backgroundColor: "#f0fdf4", borderWidth: 2, borderColor: "#86efac",
    borderRadius: 20, padding: 18, fontSize: 17, color: "#065f46", marginBottom: 20,
  },
  timeBtn: {
    backgroundColor: "#f0fdf4", borderWidth: 2, borderColor: "#86efac",
    borderRadius: 20, padding: 20, alignItems: "center", marginBottom: 20,
  },
  timeTxt: { fontSize: 28, fontWeight: "700", color: "#065f46" },
  btnRow: { flexDirection: "row", gap: 16 },
  cancel: {
    flex: 1, backgroundColor: "#e5e7eb", paddingVertical: 16,
    borderRadius: 20, alignItems: "center",
  },
  save: {
    flex: 1, backgroundColor: "#10b981", paddingVertical: 16,
    borderRadius: 20, alignItems: "center",
  },
  btnTxt: { fontSize: 18, fontWeight: "700", color: "#374151" },
  saveTxt: { fontSize: 18, fontWeight: "800", color: "#fff" },
});
