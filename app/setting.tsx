// Settings

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Text } from "../components/ui/AppText";
import { supabase } from "../lib/supabase";
import { Colors, useTheme } from "../providers/ThemeProvider";

type AppRoute =
  | "/"
  | "/main"
  | "/account"
  | "/updateInfo"
  | "/preferences"
  | "/reminders"
  | "/water"
  | "/sleep"
  | "/bloodPressure"
  | "/help"
  | "/feedback"
  | "/about";

export default function SettingScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    if (loggingOut) return;

    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            setLoggingOut(true);
            try {
              const { error } = await supabase.auth.signOut();
              if (error) {
                Alert.alert("Logout Failed", error.message);
              } else {
                router.replace("/");
              }
            } catch (err: any) {
              Alert.alert("Error", err.message || "Something went wrong");
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const open = (title: string) => {
    const routes: Record<string, AppRoute> = {
      "Account":        "/account",
      "Update Info":    "/updateInfo",
      "Set reminders":  "/reminders",
      "Water":          "/water",
      "Blood Pressure": "/bloodPressure",
      "Help & support": "/help",
      "Give feedback":  "/feedback",
      "Meet the Team":  "/about",
    };

    if (title === "Food Preferences") {
      router.push({ pathname: "/preferences", params: { mode: "edit" } });
      return;
    }

    const route = routes[title];
    if (route) {
      router.push(route);
    } else {
      Alert.alert(title, "Coming soon...");
    }
  };

  const settings: { title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { title: "Account", icon: "person-circle-outline" },
    { title: "Update Info", icon: "information-circle-outline" },
    { title: "Food Preferences", icon: "nutrition-outline" },
    { title: "Set reminders", icon: "notifications-outline" },
    { title: "Water", icon: "water-outline" },
    { title: "Blood Pressure", icon: "pulse-outline" },
    { title: "Help & support", icon: "help-circle-outline" },
    { title: "Give feedback", icon: "chatbubble-ellipses-outline" },
    { title: "Meet the Team", icon: "people-outline" },
  ];

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.fixedHeader}>
        <Pressable
          style={s.backBtn}
          onPress={() => router.replace("/main")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.header}>Settings</Text>
      </View>

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        <View style={s.darkModeRow}>
          <View style={s.darkModeIconWrap}>
            <Ionicons
              name="moon"
              size={22}
              color={colors.onAccent}
            />
          </View>
          <View style={s.darkModeTextWrap}>
            <Text style={s.darkModeTitle}>Dark Mode</Text>
            <Text style={s.darkModeSub}>
              {isDark ? "On — using the dark theme" : "Off — using the light theme"}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={s.list}>
          {settings.map(({ title, icon }, i) => (
            <Pressable
              key={title}
              style={[s.row, i === settings.length - 1 && s.rowLast]}
              onPress={() => open(title)}
            >
              <Ionicons name={icon} size={26} color={colors.textPrimary} />
              <Text style={s.txt}>{title}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[s.logout, loggingOut && { opacity: 0.7 }]}
          onPress={logout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={s.logoutTxt}>Logout</Text>
          )}
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    fixedHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingTop: 56,
      paddingHorizontal: 16,
      backgroundColor: c.background,
      paddingBottom: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    header: {
      fontSize: 32,
      fontWeight: "800",
      color: c.textPrimary,
      textAlign: "left",
      letterSpacing: -0.3,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 40,
    },
    darkModeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 16,
      marginBottom: 24,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    darkModeIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    darkModeTextWrap: { flex: 1 },
    darkModeTitle: { fontSize: 16, fontWeight: "800", color: c.textPrimary },
    darkModeSub: { fontSize: 12.5, fontWeight: "500", color: c.textSecondary, marginTop: 2 },
    list: {
      marginBottom: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    txt: {
      flex: 1,
      fontSize: 16,
      fontWeight: "500",
      color: c.textPrimary,
    },
    logout: {
      backgroundColor: "transparent",
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 24,
      borderWidth: 1.5,
      borderColor: c.textPrimary,
    },
    logoutTxt: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
  });
