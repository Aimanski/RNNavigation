// app/auth/callback.tsx
//
// Handles TWO completely different redirect types:
//
//  [A] Google OAuth  → weighapp://auth/callback?code=xxxx
//      • exchangeCodeForSession → provider = "google"
//      • Keep session alive → navigate into app
//
//  [B] Email verification → weighapp://auth/callback?token_hash=xxxx&type=signup
//                        OR weighapp://auth/callback?code=xxxx  (PKCE email confirm)
//      • Exchange code → provider = "email"
//      • Sign out → show "✅ Verified" → redirect to login
//
// THE BUG THIS FIXES:
//   A user who first signed up via email (verified), then signs in with Google
//   on the same email. Supabase links the accounts. The Google OAuth redirect
//   comes back with provider="google" but a FRESH email_confirmed_at timestamp
//   (because Supabase just linked them). AuthProvider was treating this fresh
//   timestamp as a "just verified email" and blocking navigation.
//
//   Fix: We determine the flow type from the URL params (`type` param or the
//   provider on the decoded session), NOT from email_confirmed_at timing.

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ensureProfileExists } from "../../lib/ensureProfileExists";
import { navigateAfterLogin } from "../../lib/navigateAfterLogin";
import { supabase } from "../../lib/supabase";

type Status = "loading" | "verified" | "error";

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    type?: string;           // "signup" | "recovery" | "invite" — email flows only
    token_hash?: string;     // older email confirmation style
    error?: string;
    error_description?: string;
  }>();
  const handled = useRef(false);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const handleCallback = async () => {
      if (handled.current) return;
      handled.current = true;

      try {
        // ── Supabase returned an error in the URL ────────────────────────
        if (params.error) {
          throw new Error(params.error_description || params.error);
        }

        const code = params.code;
        const urlType = params.type; // present for email confirmation flows

        // ── Determine flow type BEFORE exchanging the code ───────────────
        //
        // Email confirmation URLs look like:
        //   ?code=xxxx&type=signup
        //   ?token_hash=xxxx&type=signup
        //
        // Google OAuth URLs look like:
        //   ?code=xxxx               (no `type` param)
        //
        // We use the presence of `type` param as the primary signal.
        // This is reliable because Google never sends a `type` param.
        const isEmailFlow = !!urlType || !!params.token_hash;

        if (!code && !params.token_hash) {
          // No code at all — check if session was already set (e.g. implicit flow)
          await new Promise((r) => setTimeout(r, 800));
          const { data: sessionData } = await supabase.auth.getSession();

          if (sessionData.session?.user) {
            const provider = sessionData.session.user.app_metadata?.provider;
            if (provider === "google") {
              // Google implicit flow — navigate into app
              await ensureProfileExists(sessionData.session.user);
              await navigateAfterLogin(sessionData.session.user.id, router);
              return;
            }
            // Email implicit — sign out and go to login
            await ensureProfileExists(sessionData.session.user);
            await supabase.auth.signOut();
            setStatus("verified");
            setTimeout(() => router.replace("/"), 2500);
            return;
          }
          throw new Error("No auth code and no active session.");
        }

        // ── Exchange code for session ────────────────────────────────────
        const { data, error } = await supabase.auth.exchangeCodeForSession(code!);
        if (error) throw error;
        if (!data.session?.user) throw new Error("No user in session after exchange.");

        const user = data.session.user;
        const provider = user.app_metadata?.provider;

        // ── GOOGLE OAUTH ─────────────────────────────────────────────────
        // Condition: provider is google, OR no `type` param in URL
        // This correctly handles the case where a user who already verified
        // their email then signs in with Google — Supabase links accounts,
        // provider stays "google", and we must navigate INTO the app.
        if (provider === "google" || !isEmailFlow) {
          await ensureProfileExists(user);
          await navigateAfterLogin(user.id, router);
          return;
        }

        // ── EMAIL VERIFICATION ───────────────────────────────────────────
        // type=signup/recovery/invite → verify complete → sign out → login
        await ensureProfileExists(user);
        await supabase.auth.signOut();
        setStatus("verified");
        setTimeout(() => router.replace("/"), 2500);

      } catch (err: any) {
        console.error("[callback] error:", err.message);
        setStatus("error");
        setTimeout(() => router.replace("/"), 3000);
      }
    };

    handleCallback();
  }, []);

  // ── UI ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      {status === "loading" && (
        <>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={s.text}>Please wait…</Text>
        </>
      )}

      {status === "verified" && (
        <>
          <Text style={s.emoji}>✅</Text>
          <Text style={s.title}>Email Verified!</Text>
          <Text style={s.text}>
            Your account is ready.{"\n"}Taking you to login…
          </Text>
        </>
      )}

      {status === "error" && (
        <>
          <Text style={s.emoji}>⚠️</Text>
          <Text style={s.title}>Something went wrong</Text>
          <Text style={s.text}>
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
    backgroundColor: "#f8fff9",
    gap: 16,
    paddingHorizontal: 40,
  },
  emoji: { fontSize: 56 },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#065f46",
    textAlign: "center",
  },
  text: {
    fontSize: 16,
    color: "#059669",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 24,
  },
});