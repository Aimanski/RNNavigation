// Signup

import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Text } from "../components/ui/AppText";
import AuthField from "../components/ui/AuthField";
import BrandLogo from "../components/brand/BrandLogo";
import GoogleButton from "../components/ui/GoogleButton";
import { supabase } from "../lib/supabase";
import { goBackOr } from "../lib/navigation";
import { Colors, useTheme } from "../providers/ThemeProvider";

WebBrowser.maybeCompleteAuthSession();

// Helpers

const isRateLimitError = (message: string): boolean => {
  const msg = message.toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("too many") ||
    msg.includes("email rate") ||
    msg.includes("for security purposes") ||
    msg.includes("seconds")
  );
};

// Component

export default function SignUpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Google
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: "weighapp",
        path: "auth/callback",
      });

      const { data: oauthData, error: oauthError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectUrl,
            queryParams: { prompt: "select_account" },
            skipBrowserRedirect: true,
          },
        });

      if (oauthError) throw oauthError;
      if (!oauthData.url) throw new Error("No OAuth URL returned from Supabase");

      // Browser
      const result = await WebBrowser.openAuthSessionAsync(oauthData.url, redirectUrl);

      if (result.type !== "success" || !result.url) return;

      const returnedUrl = result.url;

      // Session

      // PKCE
      try {
        const urlObj = new URL(returnedUrl);
        const code = urlObj.searchParams.get("code");
        if (code) {
          const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) throw sessionError;
          return;
        }
      } catch {
        // Fallback
      }

      // Implicit
      const fragment = returnedUrl.split("#")[1];
      if (fragment) {
        const params = new URLSearchParams(fragment);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          return;
        }
      }

      // Polling
      await new Promise((r) => setTimeout(r, 500));
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session?.user) {
        return;
      }

      throw new Error("Could not establish session. Please try again.");
    } catch (err: any) {
      Alert.alert(
        "Google Sign-In Failed",
        err.message || "Something went wrong. Please try again."
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  // Signup
  const handleEmailSignUp = async () => {
    if (!username.trim()) return Alert.alert("Missing Username", "Please enter a username.");
    if (!email.trim()) return Alert.alert("Missing Email", "Please enter your email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return Alert.alert("Invalid Email", "Please enter a valid email address.");
    if (!password) return Alert.alert("Missing Password", "Please enter a password.");
    if (password.length < 6)
      return Alert.alert("Password Too Short", "Your password must be at least 6 characters long.");

    setEmailLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            // Metadata
            pending_username: username.trim(),
          },
        },
      });

      if (error) {
        const msg = error.message || "";

        if (isRateLimitError(msg)) {
          Alert.alert(
            "Too Many Attempts ⏳",
            "Supabase limits how often verification emails can be sent. Please wait 5–10 minutes before trying again.",
            [{ text: "Got it" }]
          );
          return;
        }

        if (
          msg.toLowerCase().includes("already registered") ||
          msg.toLowerCase().includes("user already exists") ||
          msg.toLowerCase().includes("email address is already")
        ) {
          await handleEmailAlreadyExists(email.trim());
          return;
        }

        throw error;
      }

      // Duplicate
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        await handleEmailAlreadyExists(email.trim());
        return;
      }

      if (!data.user) throw new Error("No user returned after signup.");

      // Session
      if (data.session) {
        await supabase.auth.signOut();
        await handleEmailAlreadyExists(email.trim());
        return;
      }

      // Profile

      router.replace({ pathname: "/verifyEmail", params: { email: email.trim() } });
    } catch (e: any) {
      const msg = e.message || "";
      if (isRateLimitError(msg)) {
        Alert.alert(
          "Too Many Attempts ⏳",
          "Please wait 5–10 minutes before requesting another verification email.",
          [{ text: "Got it" }]
        );
      } else {
        Alert.alert("Sign Up Failed", msg || "Something went wrong. Please try again.");
      }
    } finally {
      setEmailLoading(false);
    }
  };

  // Conflict
  const handleEmailAlreadyExists = async (emailAddr: string) => {
    // Registration
    const { data: isRegistered } = await supabase.rpc("email_is_registered", { p_email: emailAddr });

    if (isRegistered === true) {
      Alert.alert(
        "Already Registered with Google 🔑",
        `"${emailAddr}" is linked to a Google account.\n\nPlease tap "Continue with Google" to log in instead.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Use Google",
            onPress: () => {
              setShowEmailForm(false);
              handleGoogleSignIn();
            },
          },
        ]
      );
    } else {
      Alert.alert(
        "Account Already Exists",
        `An account with "${emailAddr}" already exists.\n\nWould you like to log in instead?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Log In", onPress: () => router.replace("/") },
        ]
      );
    }
  };

  // Layout
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        style={s.container}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandLogo variant="full" width={240} style={s.logo} />
          <Text style={s.subtitle}>Create your account and start your journey</Text>

          <GoogleButton
            onPress={handleGoogleSignIn}
            loading={googleLoading}
            disabled={emailLoading}
          />

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>or</Text>
            <View style={s.dividerLine} />
          </View>

          {!showEmailForm ? (
            <Pressable
              style={({ pressed }) => [s.emailToggleBtn, pressed && s.pressed]}
              onPress={() => setShowEmailForm(true)}
              disabled={googleLoading}
              accessibilityRole="button"
            >
              <Ionicons name="mail-outline" size={20} color={colors.accent} />
              <Text style={s.emailToggleText}>Sign up with email</Text>
            </Pressable>
          ) : (
            <View style={s.emailForm}>
              <AuthField
                icon="person-outline"
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                editable={!emailLoading}
              />
              <AuthField
                icon="mail-outline"
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                editable={!emailLoading}
              />
              <AuthField
                icon="lock-closed-outline"
                placeholder="Password (min. 6 characters)"
                value={password}
                onChangeText={setPassword}
                secure
                editable={!emailLoading}
              />

              <View style={s.hintRow}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                <Text style={s.hint}>
                  If you see a rate limit error, wait 5–10 minutes and try again.
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  s.emailSignupBtn,
                  (emailLoading || pressed) && s.btnLoading,
                ]}
                onPress={handleEmailSignUp}
                disabled={emailLoading || googleLoading}
                accessibilityRole="button"
              >
                {emailLoading ? (
                  <ActivityIndicator color={colors.onAccent} size="small" />
                ) : (
                  <Text style={s.emailSignupText}>Create account</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setShowEmailForm(false)}
                style={s.hideEmailBtn}
              >
                <Text style={s.hideEmailText}>Hide email form</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={() => goBackOr(router, "/")}
            style={s.loginWrapper}
            disabled={googleLoading || emailLoading}
          >
            <Text style={s.loginText}>
              Already have an account?{" "}
              <Text style={s.loginBold}>Log In</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    pressed: { opacity: 0.8 },
    scroll: {
      paddingHorizontal: 28,
      paddingVertical: 48,
      alignItems: "center",
      flexGrow: 1,
      justifyContent: "center",
    },
    logo: { marginBottom: 6 },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: "center",
      marginBottom: 32,
      lineHeight: 22,
      fontWeight: "500",
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      marginVertical: 22,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
    dividerLabel: {
      marginHorizontal: 12,
      color: c.textMuted,
      fontSize: 14,
      fontWeight: "600",
    },
    emailToggleBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      width: "100%",
      height: 56,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.accent,
      backgroundColor: c.surfaceAlt,
    },
    emailToggleText: { color: c.accent, fontSize: 16, fontWeight: "800" },
    emailForm: { width: "100%" },
    hintRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 16,
      paddingHorizontal: 2,
    },
    hint: { flex: 1, fontSize: 13, color: c.textMuted, lineHeight: 18 },
    emailSignupBtn: {
      backgroundColor: c.accent,
      width: "100%",
      height: 56,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    emailSignupText: { color: c.onAccent, fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
    hideEmailBtn: { paddingVertical: 12, alignItems: "center", marginTop: 6 },
    hideEmailText: { color: c.textMuted, fontSize: 14, fontWeight: "600" },
    btnLoading: { opacity: 0.7 },
    loginWrapper: { marginTop: 24, paddingVertical: 6 },
    loginText: { fontSize: 15, color: c.textSecondary, textAlign: "center" },
    loginBold: { fontWeight: "800", color: c.accent },
  });
