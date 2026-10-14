// Verification

import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Text, TextInput } from "../components/ui/AppText";
import { ensureProfileExists } from "../lib/auth/ensureProfileExists";
import { navigateAfterLogin } from "../lib/auth/navigateAfterLogin";
import { resetTo } from "../lib/navigation";
import { supabase } from "../lib/supabase";
import { Colors, useTheme } from "../providers/ThemeProvider";

const CODE_LENGTH = 8;
const RESEND_COOLDOWN_SECONDS = 30;
const LINK_REDIRECT_TO = "weighapp://auth/callback?purpose=verify";

// Expiry
const VERIFICATION_WINDOW_MS = 2 * 60 * 1000;

const formatMMSS = (totalSeconds: number) => {
  const mm = Math.floor(totalSeconds / 60);
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

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

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams<{ email?: string; mode?: string }>();
  const email = (params.email || "").trim();
  const isLinkMode = params.mode === "link";

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sendingInitialLink, setSendingInitialLink] = useState(isLinkMode);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const initialSendStarted = useRef(false);

  // Countdown
  const [windowStartedAt, setWindowStartedAt] = useState<number | null>(
    isLinkMode ? null : Date.now()
  );
  const [now, setNow] = useState(Date.now());
  const expiredHandled = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isLinkMode) return;
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setWindowStartedAt(Date.now());
        return;
      }
      const { data: profile } = await supabase
        .from("weighApp")
        .select("signup_started_at")
        .eq("id", authData.user.id)
        .maybeSingle();
      setWindowStartedAt(
        profile?.signup_started_at ? new Date(profile.signup_started_at).getTime() : Date.now()
      );
    })();
  }, [isLinkMode]);

  const secondsLeft =
    windowStartedAt == null
      ? null
      : Math.max(0, Math.ceil((windowStartedAt + VERIFICATION_WINDOW_MS - now) / 1000));
  const expired = secondsLeft === 0;

  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  useEffect(() => {
    if (!expired || expiredHandled.current) return;
    expiredHandled.current = true;
    (async () => {
      // Auth
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { data: profile } = await supabase
          .from("weighApp")
          .select("email_code_verified")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (profile?.email_code_verified) {
          // Focus
          if (isFocusedRef.current) await navigateAfterLogin(authData.user.id, router);
          return;
        }
      }

      await supabase.auth.signOut();
      Alert.alert(
        "Signup Session Expired",
        isLinkMode
          ? "You took too long to verify with Google. Please sign in with Google again to continue."
          : "You took too long to verify. Please sign up again.",
        [{ text: "OK", onPress: () => router.replace(isLinkMode ? "/" : "/signup") }]
      );
    })();
  }, [expired, isLinkMode, router]);

  useEffect(() => {
    if (!email) {
      Alert.alert("Missing Email", "Please sign up again.", [
        { text: "OK", onPress: () => router.replace("/signup") },
      ]);
    }
  }, [email, router]);

  // Link
  useEffect(() => {
    if (!isLinkMode || !email || initialSendStarted.current) return;
    initialSendStarted.current = true;

    (async () => {
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false, emailRedirectTo: LINK_REDIRECT_TO },
        });
        if (error) throw error;
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } catch (err: any) {
        Alert.alert(
          "Couldn't Send Link",
          err.message || "Failed to send a verification link. Please try resending."
        );
      } finally {
        setSendingInitialLink(false);
      }
    })();
  }, [isLinkMode, email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const focusInput = (index: number) => {
    if (index >= 0 && index < CODE_LENGTH) inputRefs.current[index]?.focus();
  };

  const handleDigitChange = (text: string, index: number) => {
    // Paste
    const cleaned = text.replace(/[^0-9]/g, "");
    if (cleaned.length > 1) {
      const next = Array(CODE_LENGTH).fill("");
      for (let i = 0; i < CODE_LENGTH && i < cleaned.length; i++) next[i] = cleaned[i];
      setDigits(next);
      const lastFilled = Math.min(cleaned.length, CODE_LENGTH) - 1;
      focusInput(lastFilled === CODE_LENGTH - 1 ? lastFilled : lastFilled + 1);
      return;
    }

    setDigits((prev) => {
      const next = [...prev];
      next[index] = cleaned;
      return next;
    });

    if (cleaned && index < CODE_LENGTH - 1) focusInput(index + 1);
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      focusInput(index - 1);
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
    }
  };

  const code = digits.join("");

  // Verify
  const handleVerify = async () => {
    if (expired) return;
    if (code.length !== CODE_LENGTH) {
      Alert.alert("Enter the full code", `Please enter all ${CODE_LENGTH} digits.`);
      return;
    }
    if (!email) return;

    Keyboard.dismiss();
    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "signup",
      });

      if (error) throw error;
      if (!data.user) throw new Error("Verification succeeded but no user was returned.");

      await ensureProfileExists(data.user);
      await supabase
        .from("weighApp")
        .update({ email_code_verified: true })
        .eq("id", data.user.id);
      await navigateAfterLogin(data.user.id, router);
    } catch (err: any) {
      const msg = err.message || "Invalid or expired code. Please try again.";
      Alert.alert("Verification Failed", msg);
      setDigits(Array(CODE_LENGTH).fill(""));
      focusInput(0);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email || cooldown > 0 || expired) return;
    setResending(true);
    try {
      const { error } = isLinkMode
        ? await supabase.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: false, emailRedirectTo: LINK_REDIRECT_TO },
          })
        : await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setCooldown(RESEND_COOLDOWN_SECONDS);
      Alert.alert(
        isLinkMode ? "Link Sent" : "Code Sent",
        isLinkMode
          ? `A new verification link was sent to:\n\n${email}`
          : `A new ${CODE_LENGTH}-digit code was sent to:\n\n${email}`
      );
    } catch (err: any) {
      const msg = err.message || "Failed to resend.";
      if (isRateLimitError(msg)) {
        Alert.alert(
          "Too Many Attempts ⏳",
          "Please wait a few minutes before requesting another one."
        );
      } else {
        Alert.alert("Resend Failed", msg);
      }
    } finally {
      setResending(false);
    }
  };

  // Fallback
  const handleCheckAgain = async () => {
    if (expired) return;
    setChecking(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        Alert.alert("Not Verified Yet", "Open the link we emailed you, then try again here.");
        return;
      }
      await navigateAfterLogin(data.user.id, router);
    } finally {
      setChecking(false);
    }
  };

  const timerChip =
    secondsLeft != null ? (
      <View style={[s.timerChip, expired && s.timerChipExpired]}>
        <Ionicons
          name={expired ? "alert-circle-outline" : "time-outline"}
          size={16}
          color={expired ? "#DC2626" : colors.textSecondary}
        />
        <Text style={[s.timerText, expired && s.timerTextExpired]}>
          {expired
            ? isLinkMode
              ? "This link has expired. Please sign in again."
              : "This code has expired. Please sign up again."
            : isLinkMode
              ? `Verify within ${formatMMSS(secondsLeft)} or you'll need to sign in again`
              : `Verify within ${formatMMSS(secondsLeft)} or you'll need to sign up again`}
        </Text>
      </View>
    ) : null;

  if (sendingInitialLink) {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={s.sendingText}>Sending your verification link…</Text>
      </View>
    );
  }

  if (isLinkMode) {
    return (
      <View style={s.container}>
        <View style={s.content}>
          <View style={s.iconWrap}>
            <Ionicons name="mail-open-outline" size={38} color={colors.accent} />
          </View>
          <Text style={s.title}>Verify Your Email</Text>
          <Text style={s.subtitle}>
            We sent a verification link to{"\n"}
            <Text style={s.emailText}>{email || "your email"}</Text>
            {"\n\n"}Open it on this device to continue. This screen will
            move on automatically once you do.
          </Text>

          {timerChip}

          <Pressable
            style={({ pressed }) => [
              s.verifyBtn,
              (checking || expired) && s.btnDisabled,
              pressed && s.pressed,
            ]}
            onPress={handleCheckAgain}
            disabled={checking || expired}
            accessibilityRole="button"
          >
            {checking ? (
              <ActivityIndicator color={colors.onAccent} size="small" />
            ) : (
              <Text style={s.verifyText}>{"I've verified, continue"}</Text>
            )}
          </Pressable>

          <Pressable
            style={s.resendBtn}
            onPress={handleResend}
            disabled={resending || cooldown > 0 || expired}
          >
            {resending ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={[s.resendText, cooldown > 0 && s.resendTextDisabled]}>
                {cooldown > 0 ? `Resend link in ${cooldown}s` : "Didn't get it? Resend"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={async () => {
              await supabase.auth.signOut();
              resetTo(router, "/");
            }}
            style={s.backWrapper}
          >
            <Text style={s.backText}>Use a different account</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView behavior="padding" style={s.container}>
        <View style={s.content}>
          <View style={s.iconWrap}>
            <Ionicons name="mail-open-outline" size={38} color={colors.accent} />
          </View>
          <Text style={s.title}>Verify Your Email</Text>
          <Text style={s.subtitle}>
            We sent a {CODE_LENGTH}-digit code to{"\n"}
            <Text style={s.emailText}>{email || "your email"}</Text>
          </Text>

          {timerChip}

          <View style={s.codeRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                style={[s.codeBox, d && s.codeBoxFilled]}
                value={d}
                onChangeText={(t) => handleDigitChange(t, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH} // Paste
                textAlign="center"
                editable={!verifying && !expired}
                autoFocus={i === 0}
                selectionColor={colors.accent}
              />
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              s.verifyBtn,
              (verifying || code.length !== CODE_LENGTH || expired) && s.btnDisabled,
              pressed && s.pressed,
            ]}
            onPress={handleVerify}
            disabled={verifying || code.length !== CODE_LENGTH || expired}
            accessibilityRole="button"
          >
            {verifying ? (
              <ActivityIndicator color={colors.onAccent} size="small" />
            ) : (
              <Text style={s.verifyText}>Verify</Text>
            )}
          </Pressable>

          <Pressable
            style={s.resendBtn}
            onPress={handleResend}
            disabled={resending || cooldown > 0 || expired}
          >
            {resending ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={[s.resendText, cooldown > 0 && s.resendTextDisabled]}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get a code? Resend"}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.replace("/signup")} style={s.backWrapper}>
            <Text style={s.backText}>Wrong email? Start over</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, justifyContent: "center" },
    pressed: { opacity: 0.8 },
    centered: { alignItems: "center", gap: 16 },
    sendingText: { fontSize: 15, color: c.textSecondary, fontWeight: "600" },
    content: { paddingHorizontal: 24, alignItems: "center" },
    iconWrap: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 22,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: c.textPrimary,
      letterSpacing: 0.3,
      marginBottom: 10,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: "center",
      marginBottom: 20,
      lineHeight: 22,
      fontWeight: "500",
    },
    emailText: { fontWeight: "800", color: c.textPrimary },
    timerChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surfaceAlt,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 26,
    },
    timerChipExpired: { backgroundColor: "#DC262618" },
    timerText: {
      flexShrink: 1,
      fontSize: 13,
      color: c.textSecondary,
      fontWeight: "600",
    },
    timerTextExpired: { color: "#DC2626" },
    codeRow: {
      flexDirection: "row",
      justifyContent: "center",
      width: "100%",
      marginBottom: 28,
      gap: 6,
    },
    codeBox: {
      flex: 1,
      maxWidth: 44,
      height: 52,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 12,
      fontSize: 20,
      fontWeight: "800",
      color: c.textPrimary,
      backgroundColor: c.surface,
      padding: 0,
      textAlignVertical: "center",
      includeFontPadding: false,
    },
    codeBoxFilled: { borderColor: c.accent, backgroundColor: c.surfaceAlt },
    verifyBtn: {
      backgroundColor: c.accent,
      width: "100%",
      height: 56,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    btnDisabled: { opacity: 0.45 },
    verifyText: { color: c.onAccent, fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
    resendBtn: { marginTop: 22, paddingVertical: 8 },
    resendText: { fontSize: 15, fontWeight: "700", color: c.accent },
    resendTextDisabled: { color: c.textMuted },
    backWrapper: { marginTop: 18, paddingVertical: 6 },
    backText: { fontSize: 14, color: c.textSecondary, fontWeight: "600" },
  });
