// Reminders

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/AppText";
import KeyboardSafeView from "../components/layout/KeyboardSafeView";
import { supabase } from "../lib/supabase";
import { getSessionUser } from "../lib/auth/session";
import { Colors, useTheme } from "../providers/ThemeProvider";

// Timezone
const REF_YEAR = 2000;
const REF_MONTH = 0;
const REF_DATE = 1;

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const mode = notification.request.content.data?.mode;
    const quiet = mode === "vibrate" || mode === "silent";
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: !quiet,
      shouldSetBadge: false,
    };
  },
});

// Alert styles
type AlertMode = "ringtone" | "vibrate" | "notification" | "silent";
type IconName = keyof typeof Ionicons.glyphMap;

const DEFAULT_MODE: AlertMode = "ringtone";
const ALERT_MODES: { key: AlertMode; label: string; icon: IconName; hint: string }[] = [
  { key: "ringtone", label: "Ringtone", icon: "musical-notes", hint: "Plays the WeighApp tone and vibrates." },
  { key: "vibrate", label: "Vibrate", icon: "phone-portrait-outline", hint: "Vibrates with no sound." },
  { key: "notification", label: "Notification", icon: "notifications-outline", hint: "Uses your phone's normal notification sound." },
  { key: "silent", label: "Silent", icon: "volume-mute-outline", hint: "Shows quietly with no sound or vibration." },
];

const modeInfo = (mode: string | null | undefined) =>
  ALERT_MODES.find((m) => m.key === mode) ?? ALERT_MODES[0];

// Android sets sound and vibration per channel, so each style gets its own
const MODE_CHANNEL: Record<AlertMode, string> = {
  ringtone: "reminders_tone",
  vibrate: "reminders_vibrate",
  notification: "reminders_notification",
  silent: "reminders_silent",
};
// Earlier channels, removed once everything is rescheduled
const OLD_CHANNEL_IDS = ["reminders", "reminders_ringtone"];
const RINGTONE_FILE = "reminder_tone.m4a";

async function ensureNotificationSetup(): Promise<boolean> {
  if (Platform.OS === "android") {
    const { AndroidImportance } = Notifications;
    await Promise.all([
      Notifications.setNotificationChannelAsync(MODE_CHANNEL.ringtone, {
        name: "Reminders: ringtone",
        importance: AndroidImportance.HIGH,
        sound: RINGTONE_FILE,
        enableVibrate: true,
        vibrationPattern: [0, 250, 250, 250],
      }),
      Notifications.setNotificationChannelAsync(MODE_CHANNEL.vibrate, {
        name: "Reminders: vibrate",
        importance: AndroidImportance.HIGH,
        sound: null,
        enableVibrate: true,
        vibrationPattern: [0, 400, 250, 400],
      }),
      Notifications.setNotificationChannelAsync(MODE_CHANNEL.notification, {
        name: "Reminders: notification",
        importance: AndroidImportance.HIGH,
        sound: "default",
        enableVibrate: false,
      }),
      Notifications.setNotificationChannelAsync(MODE_CHANNEL.silent, {
        name: "Reminders: silent",
        importance: AndroidImportance.DEFAULT,
        sound: null,
        enableVibrate: false,
      }),
    ]);
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

type Reminder = {
  id: string;
  name: string;
  time: string;
  enabled: boolean;
  user_id: string;
  alert_mode?: AlertMode;
};

export default function RemindersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [alertMode, setAlertMode] = useState<AlertMode>(DEFAULT_MODE);
  // State
  const [userId, setUserId] = useState<string | null>(null);

  // Fetching
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
      const allowed = await ensureNotificationSetup();
      if (!allowed) {
        Alert.alert(
          "Notifications are off",
          "Reminders can't alert you until notifications are allowed for WeighApp.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }

      const user = await getSessionUser();
      if (!user) {
        router.replace("/");
        return;
      }
      setUserId(user.id);
      await fetchReminders(user.id);
      setLoading(false);
    };
    init();
  }, [fetchReminders, router]);

  const saveReminder = async () => {
    if (!name.trim()) return Alert.alert("Error", "Reminder name is required");
    if (!userId) return;

    // Timezone
    const stored = new Date(Date.UTC(
      REF_YEAR,
      REF_MONTH,
      REF_DATE,
      selectedTime.getHours(),
      selectedTime.getMinutes(),
      0
    ));

    const payload = {
      user_id: userId,
      name: name.trim(),
      time: stored.toISOString(),
      enabled: true,
      alert_mode: alertMode,
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

      // Timezone
      const stored = new Date(r.time);

      // Scheduling
      const mode = modeInfo(r.alert_mode).key;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Reminder",
          body: r.name,
          sound: mode === "ringtone" ? RINGTONE_FILE : mode === "notification",
          data: { mode },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: stored.getUTCHours(),
          minute: stored.getUTCMinutes(),
          channelId: MODE_CHANNEL[mode],
        },
      });
    }

    // Everything now uses the new channels, so the old one can go
    if (Platform.OS === "android") {
      OLD_CHANNEL_IDS.forEach((id) => Notifications.deleteNotificationChannelAsync(id).catch(() => {}));
    }
  };

  const resetForm = () => {
    setName("");
    setSelectedTime(new Date());
    setAlertMode(DEFAULT_MODE);
    setEditingId(null);
  };

  const editReminder = (reminder: Reminder) => {
    setName(reminder.name);
    const stored = new Date(reminder.time);
    // Picker
    const local = new Date();
    local.setHours(stored.getUTCHours(), stored.getUTCMinutes(), 0, 0);
    setSelectedTime(local);
    setAlertMode(modeInfo(reminder.alert_mode).key);
    setEditingId(reminder.id);
    setModalVisible(true);
  };

  const formatReminderTime = (isoString: string) => {
    const stored = new Date(isoString);
    return format(
      new Date(REF_YEAR, REF_MONTH, REF_DATE, stored.getUTCHours(), stored.getUTCMinutes()),
      "h:mm a"
    );
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={s.loadingText}>Loading reminders...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.headerContainer}>
        <Text style={s.header}>Reminders</Text>
      </View>

      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardInfo}>
              <Text style={[s.time, !item.enabled && s.timeOff]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {formatReminderTime(item.time)}
              </Text>
              <Text style={s.name} numberOfLines={2}>{item.name}</Text>
              <View style={s.cardMode}>
                <Ionicons name={modeInfo(item.alert_mode).icon} size={14} color={colors.textMuted} />
                <Text style={s.cardModeText}>{modeInfo(item.alert_mode).label}</Text>
              </View>
            </View>
            <View style={s.actions}>
              <Pressable
                onPress={() => toggleReminder(item.id, !item.enabled)}
                style={({ pressed }) => [
                  s.iconBtn,
                  item.enabled && s.iconBtnOn,
                  pressed && s.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={item.enabled ? "Turn reminder off" : "Turn reminder on"}
              >
                <Ionicons
                  name={item.enabled ? "notifications" : "notifications-off"}
                  size={22}
                  color={item.enabled ? colors.onAccent : colors.textMuted}
                />
              </Pressable>
              <Pressable
                onPress={() => editReminder(item)}
                style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Edit reminder"
              >
                <Ionicons name="pencil" size={20} color="#f59e0b" />
              </Pressable>
              <Pressable
                onPress={() => deleteReminder(item.id)}
                style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Delete reminder"
              >
                <Ionicons name="trash" size={20} color="#ef4444" />
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={s.emptyCard}>
            <View style={s.emptyIcon}>
              <Ionicons name="alarm-outline" size={34} color={colors.accent} />
            </View>
            <Text style={s.emptyTitle}>No reminders yet</Text>
            <Text style={s.emptyText}>
              Tap the + button to add your first daily reminder.
            </Text>
          </View>
        }
      />

      <Pressable
        style={({ pressed }) => [s.addBtn, pressed && s.pressed]}
        onPress={() => { resetForm(); setModalVisible(true); }}
        accessibilityRole="button"
        accessibilityLabel="Add reminder"
      >
        <Ionicons name="add" size={34} color={colors.onAccent} />
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardSafeView style={s.overlay}>
          <View style={s.modal}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.modalTitle}>{editingId ? "Edit" : "New"} Reminder</Text>
              <Text style={s.fieldLabel}>Name</Text>
              <TextInput
                style={[s.input, nameFocused && s.inputFocused]}
                placeholder="Reminder name (e.g., Take meds)"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
              <Text style={s.fieldLabel}>Time</Text>
              <Pressable
                style={({ pressed }) => [s.timeBtn, pressed && s.pressed]}
                onPress={() => setShowPicker(true)}
              >
                <Ionicons name="time-outline" size={24} color={colors.accent} />
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
              <Text style={s.fieldLabel}>Alert style</Text>
              <View style={s.modeGrid}>
                {ALERT_MODES.map((m) => {
                  const on = alertMode === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      style={({ pressed }) => [s.modeBtn, on && s.modeBtnOn, pressed && s.pressed]}
                      onPress={() => setAlertMode(m.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={m.label}
                    >
                      <Ionicons name={m.icon} size={19} color={on ? colors.onAccent : colors.textSecondary} />
                      <Text style={[s.modeText, on && s.modeTextOn]} numberOfLines={1}>{m.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.modeHint}>{modeInfo(alertMode).hint}</Text>
              <View style={s.btnRow}>
                <Pressable
                  style={({ pressed }) => [s.cancel, pressed && s.pressed]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={s.btnTxt}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.save, pressed && s.pressed]}
                  onPress={saveReminder}
                >
                  <Text style={s.saveTxt}>Save</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardSafeView>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered: {
      flex: 1,
      backgroundColor: c.background,
      justifyContent: "center",
      alignItems: "center",
    },
    pressed: { opacity: 0.7 },

    headerContainer: {
      paddingTop: 12,
      paddingBottom: 16,
      paddingHorizontal: 20,
      backgroundColor: c.background,
      flexDirection: "row",
      alignItems: "center",
    },
    backBtn: {
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

    listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 140 },

    card: {
      backgroundColor: c.surface,
      marginBottom: 12,
      paddingVertical: 16,
      paddingLeft: 20,
      paddingRight: 12,
      borderRadius: 22,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: c.border,
    },
    cardInfo: { flex: 1, paddingRight: 8 },
    time: { fontSize: 28, fontWeight: "800", color: c.accent },
    timeOff: { color: c.textMuted },
    name: {
      fontSize: 15,
      fontWeight: "600",
      color: c.textSecondary,
      marginTop: 2,
    },
    cardMode: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
    cardModeText: { fontSize: 12.5, fontWeight: "700", color: c.textMuted },
    actions: { flexDirection: "row", alignItems: "center", gap: 6 },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
    },
    iconBtnOn: { backgroundColor: c.accent },

    emptyCard: {
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 32,
      marginTop: 24,
      gap: 8,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.surfaceAlt,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 18, fontWeight: "800", color: c.textPrimary },
    emptyText: {
      fontSize: 14.5,
      lineHeight: 21,
      color: c.textSecondary,
      textAlign: "center",
    },

    loadingText: {
      marginTop: 20,
      fontSize: 18,
      color: c.textSecondary,
      fontWeight: "600",
    },
    addBtn: {
      position: "absolute",
      bottom: 40,
      alignSelf: "center",
      backgroundColor: c.accent,
      width: 68,
      height: 68,
      borderRadius: 34,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: c.accentDark,
    },

    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    modal: {
      width: "90%",
      maxWidth: 420,
      backgroundColor: c.surface,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.border,
      padding: 24,
      maxHeight: "92%",
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: c.textPrimary,
      textAlign: "center",
      marginBottom: 20,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textSecondary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      height: 52,
      fontSize: 16,
      color: c.textPrimary,
      marginBottom: 18,
    },
    inputFocused: { borderColor: c.accent },
    timeBtn: {
      flexDirection: "row",
      gap: 10,
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      height: 60,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 20,
    },
    timeTxt: { fontSize: 26, fontWeight: "800", color: c.textPrimary },
    modeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
    modeBtn: {
      width: "48%",
      flexGrow: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    modeBtnOn: { backgroundColor: c.accent, borderColor: c.accent },
    modeText: { fontSize: 14.5, fontWeight: "800", color: c.textSecondary },
    modeTextOn: { color: c.onAccent },
    modeHint: { fontSize: 12.5, fontWeight: "600", color: c.textMuted, marginBottom: 18, minHeight: 18 },
    btnRow: { flexDirection: "row", gap: 12, marginTop: 4 },
    cancel: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
    },
    save: {
      flex: 1,
      backgroundColor: c.accent,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: "center",
    },
    btnTxt: { fontSize: 17, fontWeight: "800", color: c.textPrimary },
    saveTxt: { fontSize: 17, fontWeight: "800", color: c.onAccent },
  });
