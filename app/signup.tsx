// app/signup.tsx

import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignUpScreen() {
  const router = useRouter();

  const [googleLoading, setGoogleLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // ─── GOOGLE SIGN-IN ──────────────────────────────────────────────────────────
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
      Alert.alert(
        "Google Sign-In Failed",
        err.message || "Something went wrong. Please try again."
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  // ─── EMAIL SIGN-UP ───────────────────────────────────────────────────────────
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
          emailRedirectTo: "weighapp://auth/callback",
          data: {
            // Persisted in auth.users.raw_user_meta_data.
            // ensureProfileExists reads this after verification to populate
            // the weighApp row — no early insert needed.
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

      // ── Soft conflict: identities === [] means email already taken ────────
      // Supabase returns no error but the signUp was a no-op.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        await handleEmailAlreadyExists(email.trim());
        return;
      }

      if (!data.user) throw new Error("No user returned after signup.");

      // ── DO NOT insert into weighApp here ─────────────────────────────────
      // The user hasn't verified yet — no valid session exists.
      // ensureProfileExists runs after verification via AuthProvider's
      // onAuthStateChange listener, using pending_username from metadata.

      Alert.alert(
        "Check Your Email 📬",
        `We sent a verification link to:\n\n${email.trim()}\n\nOpen the link on this device and the app will open automatically. Check your spam folder if you don't see it.`,
        [{ text: "OK", onPress: () => router.replace("/") }]
      );
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

  // ── Conflict handler: called when identities=[] or Supabase says email taken
  const handleEmailAlreadyExists = async (emailAddr: string) => {
    // A row in weighApp at this point means Google signup (because email/password
    // accounts no longer insert a row before verification).
    const { data: profile } = await supabase
      .from("weighApp")
      .select("id")
      .eq("email", emailAddr.toLowerCase())
      .maybeSingle();

    if (profile) {
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

  // ─── UI ────────────────────────────────────────────────────────────────────
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
          <Text style={s.title}>WeighApp</Text>
          <Text style={s.subtitle}>Create your account and start your journey</Text>

          <Pressable
            style={[s.googleBtn, googleLoading && s.btnLoading]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading || emailLoading}
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

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>or</Text>
            <View style={s.dividerLine} />
          </View>

          {!showEmailForm ? (
            <Pressable
              style={s.emailToggleBtn}
              onPress={() => setShowEmailForm(true)}
              disabled={googleLoading}
            >
              <Text style={s.emailToggleText}>Sign up with Email instead</Text>
            </Pressable>
          ) : (
            <View style={s.emailForm}>
              <TextInput
                style={s.input}
                placeholder="Username"
                placeholderTextColor="#94a3b8"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!emailLoading}
              />
              <TextInput
                style={s.input}
                placeholder="Email address"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!emailLoading}
              />
              <TextInput
                style={s.input}
                placeholder="Password (min. 6 characters)"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!emailLoading}
              />

              <Text style={s.hint}>
                💡 Tip: If you see a rate limit error, wait 5–10 minutes and try again.
              </Text>

              <Pressable
                style={[s.emailSignupBtn, emailLoading && s.btnLoading]}
                onPress={handleEmailSignUp}
                disabled={emailLoading || googleLoading}
              >
                {emailLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.emailSignupText}>CREATE ACCOUNT</Text>
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
            onPress={() => router.back()}
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fff9" },
  scroll: {
    paddingHorizontal: 32,
    paddingVertical: 60,
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
  },
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
    marginBottom: 50,
    lineHeight: 26,
    fontWeight: "500",
  },
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
    marginBottom: 24,
  },
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
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1.5, backgroundColor: "#86efac" },
  dividerLabel: {
    marginHorizontal: 12,
    color: "#059669",
    fontSize: 14,
    fontWeight: "600",
  },
  emailToggleBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#86efac",
    borderStyle: "dashed",
    marginBottom: 8,
  },
  emailToggleText: {
    color: "#059669",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  emailForm: { width: "100%" },
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
  hint: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  emailSignupBtn: {
    backgroundColor: "#10b981",
    width: "100%",
    paddingVertical: 20,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 12,
  },
  emailSignupText: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  hideEmailBtn: { paddingVertical: 12, alignItems: "center", marginTop: 4 },
  hideEmailText: { color: "#94a3b8", fontSize: 14, fontWeight: "500" },
  btnLoading: { opacity: 0.6 },
  loginWrapper: { marginTop: 44 },
  loginText: { fontSize: 16, color: "#059669", textAlign: "center" },
  loginBold: { fontWeight: "800", color: "#065f46" },
});