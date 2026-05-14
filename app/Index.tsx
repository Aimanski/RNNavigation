// app/index.tsx — Login screen

import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { ensureProfileExists } from "../lib/ensureProfileExists";
import { navigateAfterLogin } from "../lib/navigateAfterLogin";
import { supabase } from "../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export default function HomeScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => backHandler.remove();
  }, []);

  // ─── Check if this email belongs to a Google-only account ─────────────────
  // Since email/password accounts no longer get a weighApp row until AFTER
  // verification, any existing row at login time = Google account.
  // We query for the row existence only — no password column needed.
  const checkIfGoogleUser = async (emailToCheck: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from("weighApp")
        .select("id")
        .eq("email", emailToCheck.trim().toLowerCase())
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  };

  // ─── GOOGLE SIGN-IN ────────────────────────────────────────────────────────
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

      const result = await WebBrowser.openAuthSessionAsync(
        oauthData.url,
        redirectUrl,
        { showInRecents: true }
      );

      if (result.type !== "success" || !result.url) return;

      const returnedUrl = result.url;

      // Strategy A: PKCE
      try {
        const urlObj = new URL(returnedUrl);
        const code = urlObj.searchParams.get("code");
        if (code) {
          const { data: sessionData, error: sessionError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) throw sessionError;
          if (sessionData.session?.user) {
            await ensureProfileExists(sessionData.session.user);
            await navigateAfterLogin(sessionData.session.user.id, router);
            return;
          }
        }
      } catch {
        // fall through
      }

      // Strategy B: Implicit
      const fragment = returnedUrl.split("#")[1];
      if (fragment) {
        const params = new URLSearchParams(fragment);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          if (sessionError) throw sessionError;
          if (sessionData.user) {
            await ensureProfileExists(sessionData.user);
            await navigateAfterLogin(sessionData.user.id, router);
            return;
          }
        }
      }

      // Strategy C: poll session
      await new Promise((r) => setTimeout(r, 500));
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session?.user) {
        await ensureProfileExists(existing.session.user);
        await navigateAfterLogin(existing.session.user.id, router);
        return;
      }

      throw new Error("Could not establish session — please try again.");
    } catch (err: any) {
      Alert.alert("Google Sign-In Failed", err.message || "Something went wrong.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // ─── EMAIL/PASSWORD LOGIN ──────────────────────────────────────────────────
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
              `It looks like "${email.trim()}" was registered using Google.\n\nGoogle accounts don't have a password — please tap "Continue with Google" to log in.`,
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

      if (data.user) {
        // Safety net: if profile row is missing for any reason, create it now
        await ensureProfileExists(data.user);
        await navigateAfterLogin(data.user.id, router);
      }
    } catch (err: any) {
      Alert.alert("Login Failed", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // ─── UI ────────────────────────────────────────────────────────────────────
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView behavior="padding" style={s.container}>
        <View style={s.content}>

          <Text style={s.title}>WeighApp</Text>
          <Text style={s.subtitle}>Your journey to better health starts here</Text>

          <TextInput
            style={s.input}
            placeholder="Email address"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={s.input}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <Pressable
            style={[s.loginBtn, loading && s.loginBtnLoading]}
            onPress={handleLogin}
            disabled={loading || googleLoading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.loginText}>LOGIN</Text>
            )}
          </Pressable>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>or</Text>
            <View style={s.dividerLine} />
          </View>

          <Pressable
            style={[s.googleBtn, googleLoading && s.googleBtnLoading]}
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#065f46" size="small" />
            ) : (
              <View style={s.googleInner}>
                <View style={s.googleIcon}>
                  <Text style={s.googleG}>G</Text>
                </View>
                <Text style={s.googleText}>Continue with Google</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.push("/signup")}
            style={s.signupWrapper}
            disabled={loading || googleLoading}
          >
            <Text style={s.signupText}>
              Don't have an account? <Text style={s.signupBold}>Sign Up</Text>
            </Text>
          </Pressable>

        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fff9", justifyContent: "center" },
  content: { paddingHorizontal: 32, alignItems: "center" },
  title: {
    fontSize: 55,
    fontWeight: "900",
    color: "#065f46",
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#059669",
    textAlign: "center",
    marginBottom: 60,
    lineHeight: 26,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#f0fdf4",
    borderWidth: 2,
    borderColor: "#86efac",
    width: "100%",
    padding: 20,
    borderRadius: 20,
    fontSize: 17,
    color: "#065f46",
    marginBottom: 18,
  },
  loginBtn: {
    backgroundColor: "#10b981",
    width: "100%",
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 12,
  },
  loginBtnLoading: { opacity: 0.7 },
  loginText: { color: "#ffffff", fontSize: 19, fontWeight: "800", letterSpacing: 0.5 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginTop: 28,
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1.5, backgroundColor: "#86efac" },
  dividerLabel: { marginHorizontal: 12, color: "#059669", fontSize: 14, fontWeight: "600" },
  googleBtn: {
    backgroundColor: "#ffffff",
    width: "100%",
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#86efac",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  googleBtnLoading: { opacity: 0.6 },
  googleInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  googleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  googleG: { fontSize: 16, fontWeight: "900", color: "#4285F4" },
  googleText: { fontSize: 17, fontWeight: "700", color: "#065f46" },
  signupWrapper: { marginTop: 36 },
  signupText: { fontSize: 16, color: "#059669", textAlign: "center" },
  signupBold: { fontWeight: "800", color: "#065f46" },
});