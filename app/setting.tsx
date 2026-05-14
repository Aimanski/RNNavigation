// app/setting.tsx — FIXED: Prevent back navigation after logout

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
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

type AppRoute =
  | "/"
  | "/main"
  | "/account"
  | "/updateInfo"
  | "/reminders"
  | "/water"
  | "/sleep"
  | "/bloodPressure"
  | "/help"
  | "/feedback"
  | "/about";

export default function SettingScreen() {
  const router = useRouter();
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
      "About us":       "/about",
    };

    const route = routes[title];
    if (route) {
      router.push(route);
    } else {
      Alert.alert(title, "Coming soon...");
    }
  };

  const settings = [
    "Account",
    "Update Info",
    "Set reminders",
    "Water",
    "Blood Pressure",
    "Help & support",
    "Give feedback",
    "About us",
  ];

  return (
    <View style={s.container}>
      {/* Fixed Header */}
      <View style={s.fixedHeader}>
        <Pressable onPress={() => router.push("/main" as AppRoute)} style={s.backButton}>
          <Ionicons name="arrow-back" size={28} color="#10b981" />
        </Pressable>
        <Text style={s.header}>Settings</Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        <View style={s.grid}>
          {settings.map((title, i) => (
            <Pressable key={i} style={s.item} onPress={() => open(title)}>
              <View style={s.box}>
                <Text style={s.txt}>{title}</Text>
                <View style={s.arrow}>
                  <Ionicons name="chevron-forward" size={24} color="#10b981" />
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[s.logout, loggingOut && { opacity: 0.7 }]}
          onPress={logout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.logoutTxt}>Logout</Text>
          )}
        </Pressable>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fff9",
  },
  fixedHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    backgroundColor: "#f8fff9",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(16, 185, 129, 0.08)",
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    fontSize: 34,
    fontWeight: "800",
    color: "#065f46",
    textAlign: "center",
    marginTop: 16,
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  item: {
    width: "48%",
    marginBottom: 20,
  },
  box: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    height: 140,
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 25,
    elevation: 15,
    borderWidth: 1,
    borderColor: "#ecfdf5",
  },
  txt: {
    fontSize: 13,
    fontWeight: "700",
    color: "#065f46",
    textAlign: "center",
  },
  arrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ecfdf5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#86efac",
  },
  logout: {
    backgroundColor: "#10b981",
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 12,
  },
  logoutTxt: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});