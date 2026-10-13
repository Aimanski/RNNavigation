// Auth

import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import BrandLogo from "../components/brand/BrandLogo";
import { cache } from "../lib/cache";
import { ensureProfileExists } from "../lib/auth/ensureProfileExists";
import { navigateAfterLogin, resetNavigationGuard } from "../lib/auth/navigateAfterLogin";
import { resetTo } from "../lib/navigation";
import { refreshSignupWindowIfUnverified } from "../lib/auth/signupWindow";
import { usePageReady } from "../lib/auth/startup";
import { supabase } from "../lib/supabase";
import { useTheme } from "./ThemeProvider";

interface Props {
  children: React.ReactNode;
}

export function AuthProvider({ children }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const pathname = usePathname();
  const pageReady = usePageReady();
  // Startup
  const [checked, setChecked] = useState(false);
  const [hadSession, setHadSession] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [done, setDone] = useState(false);
  const handledSessionRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Restore
    const recoverSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn("[AuthProvider] getSession error:", error.message);

        if (data.session?.user && mounted) {
          const user = data.session.user;
          handledSessionRef.current = user.id;
          setHadSession(true);

          // Profile
          const readyKey = `profile_ready_${user.id}`;
          const alreadyReady = (await AsyncStorage.getItem(readyKey).catch(() => null)) === "1";
          if (!alreadyReady) {
            await ensureProfileExists(user);
            AsyncStorage.setItem(readyKey, "1").catch(() => {});
            await new Promise((r) => setTimeout(r, 300));
          }
          await navigateAfterLogin(user.id, router);
        }
      } catch (e: any) {
        console.warn("[AuthProvider] recoverSession caught:", e.message);
      } finally {
        if (mounted) setChecked(true);
      }
    };

    recoverSession();

    // Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Lock
      if (!mounted) return;

      if (
        (event === "SIGNED_IN" || event === "USER_UPDATED") &&
        session?.user
      ) {
        // Deduplication
        if (handledSessionRef.current === session.user.id) return;

        handledSessionRef.current = session.user.id;

        // Navigation
        const signedInUser = session.user;
        setTimeout(async () => {
          if (!mounted) return;
          try {
            await ensureProfileExists(signedInUser);
            // Signup
            await refreshSignupWindowIfUnverified(signedInUser.id);
            await new Promise((r) => setTimeout(r, 500));
            await navigateAfterLogin(signedInUser.id, router);
          } catch (e: any) {
            console.warn("[AuthProvider] post-auth navigation error:", e.message);
            resetTo(router, "/survey");
          }
        }, 0);
      }

      if (event === "SIGNED_OUT") {
        handledSessionRef.current = null;
        resetNavigationGuard();
        setHadSession(false);
        // Cache
        cache.clear();
        // Logout
        resetTo(router, "/");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timeout
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  // Splash
  const onDataPage = pathname === "/main" || pathname === "/admin";
  const canHide = timedOut || (checked && (!hadSession || (pathname !== "/" && (!onDataPage || pageReady))));
  useEffect(() => {
    if (canHide) setDone(true);
  }, [canHide]);

  // Rendering
  return (
    <>
      {children}
      {!done && (
        <View style={[styles.loader, { backgroundColor: colors.background }]} pointerEvents="auto">
          <View style={styles.loaderInner}>
            <BrandLogo variant="full" width={160} />
            <ActivityIndicator size="small" color={colors.accent} style={styles.loaderSpinner} />
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  // Layout
  loaderInner: { alignItems: "center" },
  loaderSpinner: { position: "absolute", top: "100%", marginTop: 28 },
});