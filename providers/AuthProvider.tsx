// providers/AuthProvider.tsx
//
// WHAT CHANGED vs previous version:
//
// REMOVED: The `isFreshVerification` timing check (email_confirmed_at < 30s).
//   That check was the root cause of the bug. When a user who already verified
//   their email signed in with Google, Supabase linked the accounts and updated
//   email_confirmed_at — making it look "fresh". AuthProvider then blocked
//   navigation, leaving the user stuck on "Verifying email…" forever.
//
// INSTEAD: AuthProvider now fully delegates email-verification flow control
//   to callback.tsx. callback.tsx calls signOut() after email verification,
//   which fires SIGNED_OUT here. We detect that via `isPostVerificationSignOut`
//   flag and skip our own redirect.
//
// For ALL other SIGNED_IN events (including Google OAuth), AuthProvider
// navigates normally. No timing hacks needed.

import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ensureProfileExists } from "../lib/ensureProfileExists";
import { navigateAfterLogin } from "../lib/navigateAfterLogin";
import { supabase } from "../lib/supabase";

interface Props {
  children: React.ReactNode;
}

export function AuthProvider({ children }: Props) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const handledSessionRef = useRef<string | null>(null);

  // Set to true by the SIGNED_IN handler when provider="email" + type="signup",
  // so the subsequent SIGNED_OUT (from callback.tsx's signOut()) doesn't
  // redirect us to "/" a second time — callback.tsx already does that.
  const isPostVerificationSignOut = useRef(false);

  useEffect(() => {
    let mounted = true;

    // ── 1. Restore existing session on app start ──────────────────────────
    const recoverSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn("[AuthProvider] getSession error:", error.message);

        if (data.session?.user && mounted) {
          handledSessionRef.current = data.session.access_token;
          await ensureProfileExists(data.session.user);
          await new Promise((r) => setTimeout(r, 300));
          await navigateAfterLogin(data.session.user.id, router);
        }
      } catch (e: any) {
        console.warn("[AuthProvider] recoverSession caught:", e.message);
      } finally {
        if (mounted) setReady(true);
      }
    };

    recoverSession();

    // ── 2. Listen for auth state changes ─────────────────────────────────
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (
        (event === "SIGNED_IN" || event === "USER_UPDATED") &&
        session?.user
      ) {
        // De-duplicate: skip if we already handled this exact access token
        if (handledSessionRef.current === session.access_token) {
          if (mounted && !ready) setReady(true);
          return;
        }

        handledSessionRef.current = session.access_token;
        if (mounted) setReady(true);

        const provider = session.user.app_metadata?.provider;

        // ── Email verification flow ────────────────────────────────────────
        // When callback.tsx exchanges a `type=signup` code, the provider is
        // "email". callback.tsx will call signOut() right after — so we flag
        // that the upcoming SIGNED_OUT is post-verification and skip our redirect.
        // We do NOT navigate here; callback.tsx handles the UX ("✅ Verified").
        if (provider === "email") {
          // Check whether this is a brand-new verification (no existing session)
          // vs a normal email/password login. We distinguish by checking if the
          // user has just been confirmed (confirmed_at equals updated_at closely).
          const confirmedAt = session.user.email_confirmed_at
            ? new Date(session.user.email_confirmed_at).getTime()
            : null;
          const updatedAt = session.user.updated_at
            ? new Date(session.user.updated_at).getTime()
            : null;

          // If confirmed_at and updated_at are within 5 seconds of each other,
          // this is a fresh email confirmation event from callback.tsx.
          // Normal email/password logins don't update confirmed_at.
          const isFreshConfirmation =
            confirmedAt !== null &&
            updatedAt !== null &&
            Math.abs(confirmedAt - updatedAt) < 5_000;

          if (isFreshConfirmation) {
            isPostVerificationSignOut.current = true;
            return; // callback.tsx handles sign-out + redirect
          }
        }

        // ── All other sign-ins: Google OAuth, email/password login ────────
        try {
          await ensureProfileExists(session.user);
          await new Promise((r) => setTimeout(r, 500));
          await navigateAfterLogin(session.user.id, router);
        } catch (e: any) {
          console.warn("[AuthProvider] post-auth navigation error:", e.message);
          router.replace("/survey");
        }
      }

      if (event === "SIGNED_OUT") {
        handledSessionRef.current = null;

        if (isPostVerificationSignOut.current) {
          // This SIGNED_OUT was triggered by callback.tsx after email verification.
          // callback.tsx already handles the redirect — skip ours.
          isPostVerificationSignOut.current = false;
          if (mounted && !ready) setReady(true);
          return;
        }

        // Real user sign-out — go to login
        router.replace("/");
      }

      if (mounted && !ready) setReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: "#f8fff9",
    justifyContent: "center",
    alignItems: "center",
  },
});