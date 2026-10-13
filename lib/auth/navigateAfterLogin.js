// Routing

import { resetTo } from "../navigation";
import { supabase } from "../supabase";

// Timeout
const VERIFICATION_WINDOW_MS = 2 * 60 * 1000;

// Guard
const inFlight = new Map();
const DEDUPE_MS = 4000;

/* Reset */
export function resetNavigationGuard() {
  inFlight.clear();
}

export function navigateAfterLogin(userId, router) {
  const existing = inFlight.get(userId);
  if (existing && Date.now() - existing.startedAt < DEDUPE_MS) return existing.promise;
  const promise = navigateAfterLoginOnce(userId, router);
  inFlight.set(userId, { startedAt: Date.now(), promise });
  return promise;
}

async function navigateAfterLoginOnce(userId, router) {
  try {
    const baseColumns =
      "age, height_cm, weight_kg, gender, bmr, tdee, goal_calories, admin, email, email_code_verified, signup_started_at";
    let { data, error } = await supabase
      .from("weighApp")
      .select(`${baseColumns}, allergies`)
      .eq("id", userId)
      .maybeSingle();

    // Fallback
    if (error) {
      ({ data } = await supabase
        .from("weighApp")
        .select(baseColumns)
        .eq("id", userId)
        .maybeSingle());
    }

    if (!data) { resetTo(router, "/survey"); return; }

    // Verification
    if (!data.email_code_verified) {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      const isGoogleAccount =
        user?.app_metadata?.provider === "google" ||
        (user?.identities || []).some((i) => i.provider === "google");

      // Abandoned
      if (isGoogleAccount) {
        const startedAt = data.signup_started_at ? new Date(data.signup_started_at).getTime() : 0;
        const abandoned = Date.now() - startedAt > VERIFICATION_WINDOW_MS;
        if (abandoned) {
          await supabase.auth.signOut();
          resetTo(router, "/");
          return;
        }
      }

      resetTo(router, {
        pathname: "/verifyEmail",
        params: {
          email: data.email ?? "",
          mode: isGoogleAccount ? "link" : "signup",
        },
      });
      return;
    }

    if (data.admin === true) { resetTo(router, "/admin"); return; }
    if (!data.age || !data.height_cm || !data.weight_kg) { resetTo(router, "/survey"); return; }
    if (!data.gender || !data.bmr) { resetTo(router, "/gender"); return; }
    if (!data.tdee || data.tdee <= 0) { resetTo(router, "/activity"); return; }
    if (!data.goal_calories || data.goal_calories <= 0) { resetTo(router, "/recommend"); return; }
    // Preferences
    if (data.allergies === null) { resetTo(router, "/preferences"); return; }
    resetTo(router, "/main");

  } catch (err) {
    console.error("Navigation error:", err);
    resetTo(router, "/survey");
  }
}
