// Signup

import { supabase } from "../supabase";

export async function refreshSignupWindowIfUnverified(userId) {
  const { data } = await supabase
    .from("weighApp")
    .select("email_code_verified")
    .eq("id", userId)
    .maybeSingle();

  if (data && !data.email_code_verified) {
    await supabase
      .from("weighApp")
      .update({ signup_started_at: new Date().toISOString() })
      .eq("id", userId);
  }
}
