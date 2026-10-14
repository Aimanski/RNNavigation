// Login

import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Text } from "../components/ui/AppText";
import KeyboardSafeView from "../components/layout/KeyboardSafeView";
import AuthField from "../components/ui/AuthField";
import BrandLogo from "../components/brand/BrandLogo";
import GoogleButton from "../components/ui/GoogleButton";
import { supabase } from "../lib/supabase";
import { Colors, useTheme } from "../providers/ThemeProvider";

WebBrowser.maybeCompleteAuthSession();

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Lookup
  const checkIfGoogleUser = async (emailToCheck: string): Promise<boolean> => {
    try {
      // Database
      const { data } = await supabase.rpc("email_is_registered", { p_email: emailToCheck.trim() });
      return data === true;
    } catch {
      return false;
    }
  };

  // Google
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: "weighapp",
        path: "auth/callback",
      });

      // Redirect
      if (Platform.OS === "web") {
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectUrl,
            queryParams: { prompt: "select_account" },
          },
        });
        if (oauthError) throw oauthError;
        // Redirect
        return;
      }

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
      Alert.alert("Google Sign-In Failed", err.message || "Something went wrong.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // Password
  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert("Oops!", "Please fill in both fields.");
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const msg = error.message.toLowerCase();

        if (
          msg.includes("invalid login credentials") ||
          msg.includes("invalid credentials") ||
          (msg.includes("credentials") && !msg.includes("email not confirmed"))
        ) {
          const isGoogleUser = await checkIfGoogleUser(email);
          if (isGoogleUser) {
            Alert.alert(
              "Try Google Sign-In 🔑",
              `It looks like "${email.trim()}" was registered using Google.\n\nGoogle accounts don't have a password. Please tap "Continue with Google" to log in.`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Continue with Google", onPress: handleGoogleSignIn },
              ]
            );
          } else {
            Alert.alert(
              "Login Failed",
              "Incorrect email or password. Please double-check and try again.\n\nIf you signed up with Google, use the \"Continue with Google\" button instead."
            );
          }
          return;
        }

        if (msg.includes("email not confirmed")) {
          Alert.alert(
            "Email Not Verified",
            "Please check your inbox and tap the verification link we sent you before logging in.\n\nCheck your spam folder too!",
            [{ text: "OK" }]
          );
          return;
        }

        if (msg.includes("rate limit") || msg.includes("too many")) {
          Alert.alert(
            "Too Many Attempts ⏳",
            "Too many login attempts. Please wait a few minutes and try again.",
            [{ text: "Got it" }]
          );
          return;
        }

        Alert.alert("Login Failed", error.message);
        return;
      }

      // Auth
    } catch (err: any) {
      Alert.alert("Login Failed", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Interface
  const busy = loading || googleLoading;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardSafeView behavior="padding" style={s.container}>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandLogo variant="full" width={240} style={s.logo} />
          <Text style={s.subtitle}>Your journey to better health starts here</Text>

          <AuthField
            icon="mail-outline"
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          <AuthField
            icon="lock-closed-outline"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secure
          />

          <Pressable
            style={({ pressed }) => [s.loginBtn, (loading || pressed) && s.loginBtnLoading]}
            onPress={handleLogin}
            disabled={busy}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={colors.onAccent} size="small" />
            ) : (
              <Text style={s.loginText}>Log in</Text>
            )}
          </Pressable>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>or</Text>
            <View style={s.dividerLine} />
          </View>

          <GoogleButton
            onPress={handleGoogleSignIn}
            loading={googleLoading}
            disabled={loading}
          />

          <Pressable
            onPress={() => router.push("/signup")}
            style={s.signupWrapper}
            disabled={busy}
          >
            <Text style={s.signupText}>
              Don&apos;t have an account? <Text style={s.signupBold}>Sign Up</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardSafeView>
    </TouchableWithoutFeedback>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 28,
      paddingVertical: 48,
      alignItems: "center",
    },
    logo: { marginBottom: 6 },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: "center",
      marginBottom: 36,
      lineHeight: 22,
      fontWeight: "500",
    },
    loginBtn: {
      backgroundColor: c.accent,
      width: "100%",
      height: 56,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 6,
    },
    loginBtnLoading: { opacity: 0.7 },
    loginText: { color: c.onAccent, fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      marginTop: 24,
      marginBottom: 20,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
    dividerLabel: { marginHorizontal: 12, color: c.textMuted, fontSize: 14, fontWeight: "600" },
    signupWrapper: { marginTop: 28, paddingVertical: 6 },
    signupText: { fontSize: 15, color: c.textSecondary, textAlign: "center" },
    signupBold: { fontWeight: "800", color: c.accent },
  });
