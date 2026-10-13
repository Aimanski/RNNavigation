// Profile

import { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";

export const ensureProfileExists = async (user: User): Promise<void> => {
  // Username
  const pendingUsername: string | undefined = user.user_metadata?.pending_username;
  const googleName: string | undefined =
    user.user_metadata?.full_name || user.user_metadata?.name;
  const fallbackName = user.email?.split("@")[0] ?? "User";

  const username = (pendingUsername || googleName || fallbackName).trim();

  const { error } = await supabase.from("weighApp").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      username,
      // Verification
      email_code_verified: false,
      // Signup
      signup_started_at: new Date().toISOString(),
    },
    {
      onConflict: "id",
      ignoreDuplicates: true,
    }
  );

  if (error) {
    console.warn("[ensureProfileExists] upsert error:", error.message);
  }
};
