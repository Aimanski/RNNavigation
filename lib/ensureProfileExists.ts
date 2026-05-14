// lib/ensureProfileExists.ts
//
// Called after ANY successful session establishment.
// Uses upsert so it is always safe to call multiple times.

import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export const ensureProfileExists = async (user: User): Promise<void> => {
  // Username priority:
  // 1. pending_username stored in metadata at email signup time
  // 2. Google display name
  // 3. email local part as fallback
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
    },
    {
      onConflict: "id",
      ignoreDuplicates: false,
    }
  );

  if (error) {
    console.warn("[ensureProfileExists] upsert error:", error.message);
  }
};