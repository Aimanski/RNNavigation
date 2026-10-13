// Avatar

import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export async function fetchAvatarUrl(user: User): Promise<string | null> {
  const { data } = await supabase
    .from("weighApp")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const googlePhoto: string | undefined =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  return data?.avatar_url || googlePhoto || null;
}
