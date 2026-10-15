// Account

import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/AppText";
import KeyboardSafeView from "../components/layout/KeyboardSafeView";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { base64ToArrayBuffer } from "../lib/base64";
import { fetchAvatarUrl } from "../lib/avatar";
import { goBackOr } from "../lib/navigation";
import { supabase } from "../lib/supabase";
import { getSessionUser } from "../lib/auth/session";
import { Colors, useTheme } from "../providers/ThemeProvider";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AccountScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Animation
  const saveScale = useSharedValue(1);
  const passwordScale = useSharedValue(1);

  const animatedSaveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));
  const animatedPasswordStyle = useAnimatedStyle(() => ({
    transform: [{ scale: passwordScale.value }],
  }));

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const user = await getSessionUser();
      if (!user) throw new Error("No user found");

      const { data, error } = await supabase
        .from("weighApp")
        .select("username, email")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setUsername(data.username || "");
      setEmail(data.email || user.email || "");
      setAvatarUrl(await fetchAvatarUrl(user));
    } catch (error: any) {
      Alert.alert("Error loading profile", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function changeAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to change your profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      const user = await getSessionUser();
      if (!user) throw new Error("Not authenticated");

      // Bytes come from the picker or the file itself, never from a Blob
      const asset = result.assets[0];
      let bytes: ArrayBuffer;
      if (asset.base64) {
        bytes = base64ToArrayBuffer(asset.base64);
      } else {
        const photo = await fetch(asset.uri);
        bytes = await photo.arrayBuffer();
      }
      if (bytes.byteLength === 0) throw new Error("The photo could not be read. Please pick another one.");
      const path = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache
      const freshUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("weighApp")
        .update({ avatar_url: freshUrl })
        .eq("id", user.id);
      if (updateError) throw updateError;

      setAvatarUrl(freshUrl);
    } catch (error: any) {
      Alert.alert("Couldn't update photo", error.message);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function saveProfile() {
    if (!username.trim()) {
      Alert.alert("Validation", "Username cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const user = await getSessionUser();
      if (!user) throw new Error("Not authenticated");

      const updates = {
        username: username.trim(),
        email: email.trim(),
        updated_at: new Date().toISOString(),
      };

      if (email.trim() !== user.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: email.trim(),
        });
        if (authError) {
          Alert.alert(
            "Email Update",
            "Profile saved, but email update failed (check inbox): " + authError.message
          );
          return;
        }
      }

      const { error } = await supabase
        .from("weighApp")
        .update(updates)
        .eq("id", user.id);

      if (error) throw error;

      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => goBackOr(router, "/setting") },
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
      const user = await getSessionUser();
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
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right"]}>
      <View style={s.headerContainer}>
        <Text style={s.header}>Account Settings</Text>

      </View>

      <KeyboardSafeView
        style={s.flex}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[s.card, { width: width - 40 }]}>
            {/* Avatar */}
            <View style={s.avatarSection}>
              <Pressable
                style={({ pressed }) => [s.avatarWrap, pressed && s.pressed]}
                onPress={changeAvatar}
                disabled={uploadingAvatar}
              >
                <View style={s.avatarCircle}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
                  ) : (
                    <Ionicons name="person" size={40} color={colors.onAccent} />
                  )}
                </View>
                <View style={s.avatarEditBadge}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color={colors.onAccent} />
                  ) : (
                    <Ionicons name="camera" size={16} color={colors.onAccent} />
                  )}
                </View>
              </Pressable>
              <Text style={s.avatarHint}>Tap to change photo</Text>
            </View>

            {/* Username */}
            <Text style={s.label}>Username</Text>
            <View style={[s.inputWrap, focused === "username" && s.inputFocused]}>
              <Ionicons
                name="person-outline"
                size={20}
                color={focused === "username" ? colors.accent : colors.textMuted}
              />
              <TextInput
                style={s.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                onFocus={() => setFocused("username")}
                onBlur={() => setFocused(null)}
              />
            </View>

            {/* Email */}
            <Text style={s.label}>Email</Text>
            <View style={[s.inputWrap, focused === "email" && s.inputFocused]}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={focused === "email" ? colors.accent : colors.textMuted}
              />
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
              />
            </View>

            {/* Password */}
            <Pressable
              style={({ pressed }) => [s.sectionToggle, pressed && s.pressed]}
              onPress={() => setShowPasswordSection(!showPasswordSection)}
              accessibilityRole="button"
            >
              <Ionicons name="lock-closed-outline" size={20} color={colors.accent} />
              <Text style={s.sectionTitle}>Change Password</Text>
              <Ionicons
                name={showPasswordSection ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>

            {/* Password */}
            {showPasswordSection && (
              <>
                <Text style={s.label}>New Password</Text>
                <View style={[s.inputWrap, focused === "newPassword" && s.inputFocused]}>
                  <Ionicons
                    name="key-outline"
                    size={20}
                    color={focused === "newPassword" ? colors.accent : colors.textMuted}
                  />
                  <TextInput
                    style={s.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    onFocus={() => setFocused("newPassword")}
                    onBlur={() => setFocused(null)}
                  />
                </View>

                <Text style={s.label}>Confirm Password</Text>
                <View style={[s.inputWrap, focused === "confirmPassword" && s.inputFocused]}>
                  <Ionicons
                    name="key-outline"
                    size={20}
                    color={focused === "confirmPassword" ? colors.accent : colors.textMuted}
                  />
                  <TextInput
                    style={s.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    onFocus={() => setFocused("confirmPassword")}
                    onBlur={() => setFocused(null)}
                  />
                </View>

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
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={18} color={colors.accent} />
                      <Text style={[s.actionText, s.passwordText]}>Update Password</Text>
                    </>
                  )}
                </AnimatedPressable>
              </>
            )}

            {/* Save */}
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
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={colors.onAccent} />
                  <Text style={s.actionText}>Save Changes</Text>
                </>
              )}
            </AnimatedPressable>
          </View>
        </ScrollView>
      </KeyboardSafeView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.background },
    loadingContainer: {
      flex: 1,
      backgroundColor: c.background,
      justifyContent: "center",
      alignItems: "center",
    },
    flex: { flex: 1 },
    pressed: { opacity: 0.7 },

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

    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 60,
      alignItems: "center",
      flexGrow: 1,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1.5,
      borderColor: c.border,
      alignSelf: "center",
      maxWidth: 540,
      width: "100%",
    },

    avatarSection: { alignItems: "center", marginBottom: 22 },
    avatarWrap: {
      width: 88,
      height: 88,
    },
    avatarCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImg: { width: 88, height: 88 },
    avatarEditBadge: {
      position: "absolute",
      bottom: -4,
      right: -4,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.accentDark,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: c.surface,
    },
    avatarHint: {
      marginTop: 10,
      fontSize: 13,
      fontWeight: "700",
      color: c.accent,
    },

    label: {
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: "800",
      marginBottom: 10,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      marginBottom: 18,
    },
    inputFocused: { borderColor: c.accent },
    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 16,
      fontWeight: "600",
      color: c.textPrimary,
    },

    sectionToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: c.surfaceAlt,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      marginBottom: 18,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    sectionTitle: {
      color: c.textPrimary,
      fontSize: 15,
      fontWeight: "800",
    },

    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 17,
      borderRadius: 16,
      marginTop: 4,
    },
    saveButton: { backgroundColor: c.accent },
    passwordButton: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: c.accent,
      marginBottom: 14,
    },
    disabledButton: { opacity: 0.7 },
    actionText: {
      color: c.onAccent,
      fontWeight: "800",
      fontSize: 17,
    },
    passwordText: { color: c.accent },
  });
