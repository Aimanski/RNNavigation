// app/account.tsx — FINAL PREMIUM & FULLY RESPONSIVE VERSION 🌿✨

import { Ionicons } from "@expo/vector-icons"; // <-- NEW IMPORT
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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

export default function AccountScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Animation shared values
  const saveScale = useSharedValue(1);
  const passwordScale = useSharedValue(1);
  const backScale = useSharedValue(1);

  const animatedSaveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));
  const animatedPasswordStyle = useAnimatedStyle(() => ({
    transform: [{ scale: passwordScale.value }],
  }));
  const animatedBackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("weighApp")
        .select("username, email")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setUsername(data.username || "");
      setEmail(data.email || user.email || "");
    } catch (error: any) {
      Alert.alert("Error loading profile", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    if (!username.trim()) {
      Alert.alert("Validation", "Username cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const updates = {
        username: username.trim(),
        email: email.trim(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("weighApp")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      if (email.trim() !== user.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: email.trim(),
        });
        if (authError) {
          Alert.alert(
            "Email Update",
            "Profile saved, but email update failed (check inbox): " + authError.message
          );
        }
      }

      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert("Save failed", error.message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) {
      return Alert.alert("Error", "Passwords do not match");
    }
    if (newPassword.length < 6) {
      return Alert.alert("Error", "Password must be at least 6 characters");
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (authError) throw authError;

      Alert.alert("Success", "Password changed successfully!", [
        {
          text: "OK",
          onPress: () => {
            setNewPassword("");
            setConfirmPassword("");
            setShowPasswordSection(false);
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert("Password Update Failed", error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#4ade80" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      {/* Premium Header with Floating Back Button */}
      <View style={s.topHeader}>
        <AnimatedPressable
          style={[s.backButton, animatedBackStyle]}
          onPressIn={() => (backScale.value = withSpring(0.92))}
          onPressOut={() => (backScale.value = withSpring(1))}
          onPress={() => router.back()}
        >
          {/* UPDATED TO USE IONICONS */}
          <Ionicons name="arrow-back" size={32} color="#10b981" /> 
        </AnimatedPressable>

        <Text style={s.header}>Account Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.card, { width: width - 48 }]}>
          {/* Username */}
          <Text style={s.label}>Username</Text>
          <TextInput
            style={s.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
          />

          {/* Email */}
          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Change Password Toggle */}
          <Pressable
            style={s.sectionToggle}
            onPress={() => setShowPasswordSection(!showPasswordSection)}
          >
            <Text style={s.sectionTitle}>
              Change Password {showPasswordSection ? "▲" : "▼"}
            </Text>
          </Pressable>

          {/* Password Fields */}
          {showPasswordSection && (
            <>
              <Text style={s.label}>New Password</Text>
              <TextInput
                style={s.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
              />

              <Text style={s.label}>Confirm Password</Text>
              <TextInput
                style={s.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
              />

              <AnimatedPressable
                style={[
                  s.actionButton,
                  s.passwordButton,
                  saving && s.disabledButton,
                  animatedPasswordStyle,
                ]}
                onPressIn={() => (passwordScale.value = withSpring(0.95))}
                onPressOut={() => (passwordScale.value = withSpring(1))}
                onPress={changePassword}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.actionText}>Update Password</Text>
                )}
              </AnimatedPressable>
            </>
          )}

          {/* Save Button */}
          <AnimatedPressable
            style={[
              s.actionButton,
              s.saveButton,
              saving && s.disabledButton,
              animatedSaveStyle,
            ]}
            onPressIn={() => (saveScale.value = withSpring(0.95))}
            onPressOut={() => (saveScale.value = withSpring(1))}
            onPress={saveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.actionText}>Save Changes</Text>
            )}
          </AnimatedPressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────
// STYLES – BEAUTIFUL, RESPONSIVE & PREMIUM
// ──────────────────────────────────────────────
const s = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fff9",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f8fff9",
    justifyContent: "center",
    alignItems: "center",
  },
  topHeader: {
    // ADJUSTED PADDING
    paddingTop: Platform.OS === "android" ? 50 : 20, 
    paddingBottom: 36,
    paddingHorizontal: 24,
    backgroundColor: "#f8fff9",
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  backButton: {
    // UPDATED STYLE TO MATCH MEALPLAN.TSX
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
    // border and margin removed for cleaner look
  },
  // backArrow style removed
  header: {
    fontSize: 25,
    fontWeight: "900",
    color: "#064e3b",
    flex: 1,
    textAlign: "center",
    marginRight: 64, // balance back button
    letterSpacing: 0.6,
    marginTop: 6,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 120,
    alignItems: "center",
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 32,
    padding: 34,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 32,
    elevation: 22,
    borderWidth: 2,
    borderColor: "#d1fae5",
    alignSelf: "center",
    maxWidth: 540,
    width: "100%",
  },
  label: {
    color: "#059669",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#f0fdf4",
    borderWidth: 2.5,
    borderColor: "#86efac",
    color: "#065f46",
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderRadius: 18,
    fontSize: 16.5,
    marginBottom: 24,
    fontWeight: "600",
  },
  sectionToggle: {
    backgroundColor: "#ecfdf5",
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: "center",
    marginVertical: 20,
    borderWidth: 2.5,
    borderColor: "#86efac",
  },
  sectionTitle: {
    color: "#059669",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  actionButton: {
    paddingVertical: 20,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 12,
  },
  saveButton: {
    backgroundColor: "#10b981",
  },
  passwordButton: {
    backgroundColor: "#059669",
  },
  disabledButton: {
    opacity: 0.7,
  },
  actionText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 0.8,
  },
});