// Budget

import { useCallback, useEffect, useState } from "react";
import { cache } from "../cache";
import { getSessionUser } from "../auth/session";
import { supabase } from "../supabase";

export type BudgetPreset = {
  key: string;
  label: string;
  /* Pesos per day, 0 means no limit */
  amount: number;
  hint: string;
  icon: string;
};

export const BUDGET_PRESETS: BudgetPreset[] = [
  { key: "tight", label: "Tight", amount: 250, hint: "Simple, low-cost meals", icon: "leaf-outline" },
  { key: "budget", label: "Budget-friendly", amount: 350, hint: "Everyday Filipino meals", icon: "cart-outline" },
  { key: "comfortable", label: "Comfortable", amount: 500, hint: "More variety and protein", icon: "restaurant-outline" },
  { key: "flexible", label: "Flexible", amount: 800, hint: "Includes salmon, shrimp and more", icon: "sparkles-outline" },
  { key: "none", label: "No limit", amount: 0, hint: "Do not consider the cost", icon: "infinite-outline" },
];

export const MIN_BUDGET = 50;
export const MAX_BUDGET = 5000;

const CACHE_KEY = "budget";

export const formatPeso = (amount: number): string => `₱${Math.round(amount).toLocaleString("en-US")}`;

/* Fetch */
export async function fetchBudget(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("weighApp")
    .select("food_budget")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as { food_budget?: unknown }).food_budget;
  const value = raw === null || raw === undefined ? null : Number(raw);
  const budget = value !== null && Number.isFinite(value) ? value : null;
  cache.set<number | null>(CACHE_KEY, budget);
  return budget;
}

export async function saveBudget(userId: string, amount: number): Promise<void> {
  const clean = Number.isFinite(amount) && amount > 0 ? Math.min(Math.round(amount), MAX_BUDGET) : 0;
  const { error } = await supabase.from("weighApp").update({ food_budget: clean }).eq("id", userId);
  if (error) throw error;
  cache.set<number | null>(CACHE_KEY, clean);
}

/* Refresh */
export function useBudget(): { budget: number | null; loaded: boolean; reload: () => Promise<void> } {
  const [budget, setBudget] = useState<number | null>(cache.get<number | null>(CACHE_KEY) ?? null);
  const [loaded, setLoaded] = useState(cache.get<number | null>(CACHE_KEY) !== undefined);

  const reload = useCallback(async () => {
    try {
      const user = await getSessionUser();
      if (!user) return;
      setBudget(await fetchBudget(user.id));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { budget, loaded, reload };
}
