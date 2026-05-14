// lib/navigateAfterLogin.js
// Single source of truth for post-login routing.
// Called ONLY from AuthProvider — individual screens must NOT call this.

import { supabase } from "./supabase";

export async function navigateAfterLogin(userId, router) {
  try {
    const { data } = await supabase
      .from("weighApp")
      .select("age, height_cm, weight_kg, gender, bmr, tdee, goal_calories, admin")
      .eq("id", userId)
      .maybeSingle();

    if (!data) { router.replace("/survey"); return; }
    if (data.admin === true) { router.replace("/admin"); return; }
    if (!data.age || !data.height_cm || !data.weight_kg) { router.replace("/survey"); return; }
    if (!data.gender || !data.bmr) { router.replace("/gender"); return; }
    if (!data.tdee || data.tdee <= 0) { router.replace("/activity"); return; }
    if (!data.goal_calories || data.goal_calories <= 0) { router.replace("/recommend"); return; }
    router.replace("/main");

  } catch (err) {
    console.error("Navigation error:", err);
    router.replace("/survey");
  }
}
