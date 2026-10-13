// Callback

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "../../components/ui/AppText";
import { ensureProfileExists } from "../../lib/auth/ensureProfileExists";
import { navigateAfterLogin } from "../../lib/auth/navigateAfterLogin";
import { refreshSignupWindowIfUnverified } from "../../lib/auth/signupWindow";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../providers/ThemeProvider";

type Status = "loading" | "error";

// Verification
const VERIFICATION_WINDOW_MS = 2 * 60 * 1000;

export default function AuthCallback() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    code?: string;
    type?: string;           // Params
    token_hash?: string;     // Confirmation
    purpose?: string;        // Verification
    error?: string;
    error_description?: string;
  }>();
  const handled = useRef(false);
  const [status, setStatus] = useState<Status>("loading");
  // Cleanup
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    // Navigation
    const clearScreenStack = () => {
      if (router.canDismiss()) router.dismissAll();
    };

    const handleCallback = async () => {
      if (handled.current) return;
      handled.current = true;

      // Session
      const completeSignIn = async (user: any) => {
        await ensureProfileExists(user);

        if (params.purpose === "verify") {
          // Expiry
          const { data: profile } = await supabase
            .from("weighApp")
            .select("signup_started_at, email_code_verified")
            .eq("id", user.id)
            .maybeSingle();

          const startedAt = profile?.signup_started_at
            ? new Date(profile.signup_started_at).getTime()
            : 0;
          const abandoned =
            !profile?.email_code_verified && Date.now() - startedAt > VERIFICATION_WINDOW_MS;

          if (abandoned) {
            await supabase.auth.signOut();
            throw new Error(
              "This verification link expired. Please sign in with Google again."
            );
          }

          await supabase.from("weighApp").update({ email_code_verified: true }).eq("id", user.id);
        } else {
          // Window
          await refreshSignupWindowIfUnverified(user.id);
        }

        if (params.purpose === "verify") {
          // Navigation
          clearScreenStack();
          await navigateAfterLogin(user.id, router);
          return;
        }

        // Redirect
        timers.current.push(
          setTimeout(() => {
            clearScreenStack();
            navigateAfterLogin(user.id, router);
          }, 6000)
        );
      };

      try {
        // Errors
        if (params.error) {
          throw new Error(params.error_description || params.error);
        }

        const code = params.code;

        if (!code && !params.token_hash) {
          // Implicit
          const sessionUser = await new Promise<any>((resolve) => {
            let settled = false;
            const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
              if (settled || !session?.user) return;
              settled = true;
              sub.subscription.unsubscribe();
              resolve(session.user);
            });
            setTimeout(async () => {
              if (settled) return;
              settled = true;
              sub.subscription.unsubscribe();
              const { data: fallback } = await supabase.auth.getSession();
              resolve(fallback.session?.user ?? null);
            }, 4000);
          });

          if (sessionUser) {
            await completeSignIn(sessionUser);
            return;
          }
          throw new Error("No auth code and no active session.");
        }

        // Exchange
        const { data, error } = await supabase.auth.exchangeCodeForSession(code!);
        if (error) throw error;
        if (!data.session?.user) throw new Error("No user in session after exchange.");

        await completeSignIn(data.session.user);

      } catch (err: any) {
        console.warn("[callback] error:", err.message);

        // Retry
        try {
          const { data: existing } = await supabase.auth.getSession();
          const existingUser = existing.session?.user;
          if (existingUser) {
            timers.current.push(
              setTimeout(() => {
                // Fallback
                navigateAfterLogin(existingUser.id, router);
              }, 6000)
            );
            return;
          }
        } catch {
          // Fallback
        }

        setStatus("error");
        timers.current.push(
          setTimeout(() => {
            clearScreenStack();
            router.replace("/");
          }, 3000)
        );
      }
    };

    handleCallback();
  }, [params.code, params.error, params.error_description, params.token_hash, params.type, params.purpose, router]);

  // Layout
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {status === "loading" && (
        <>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[s.text, { color: colors.textSecondary }]}>Please wait…</Text>
        </>
      )}

      {status === "error" && (
        <>
          <Text style={s.emoji}>⚠️</Text>
          <Text style={[s.title, { color: colors.textPrimary }]}>Something went wrong</Text>
          <Text style={[s.text, { color: colors.textSecondary }]}>
            Taking you back to login…
          </Text>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    gap: 16,
    paddingHorizontal: 40,
  },
  emoji: { fontSize: 56 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#000000",
    textAlign: "center",
  },
  text: {
    fontSize: 16,
    color: "#4D4D4D",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 24,
  },
});
