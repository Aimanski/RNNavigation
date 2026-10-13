import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const SUPABASE_URL = "https://xeknofdruiseeaiibeep.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhla25vZmRydWlzZWVhaWliZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDU2NjMsImV4cCI6MjA5MDUyMTY2M30.A-4A_RXvrRwed_NevanowKdWjjOTctw6ggwkEhHEPBs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Storage
    storage: typeof window !== "undefined" ? AsyncStorage : undefined,
    autoRefreshToken: true,       // Session
    persistSession: true,         // Session
    // OAuth
    detectSessionInUrl: Platform.OS === "web",
  },
});