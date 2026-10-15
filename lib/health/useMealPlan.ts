// Planning

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cache } from "../cache";
import { Food, loadPlanInputs, MEALS_CACHE_KEY, MealSnapshot, PlanInputs } from "./mealData";
import { generateWeekPlan, PlanFood, todayPH, weekStartPH } from "./mealPlan";
import { useBudget } from "./budget";
import { hasAnyTaste, useTastes } from "./tastes";

/* Plan */
export function useMealPlan({ foods, goal, warnings, userId }: PlanInputs) {
  const { tastes, reload: reloadTastesOnly } = useTastes();
  const { budget, reload: reloadBudget } = useBudget();
  const reloadTastes = useCallback(async () => {
    await Promise.all([reloadTastesOnly(), reloadBudget()]);
  }, [reloadTastesOnly, reloadBudget]);
  const weekStart = useMemo(() => weekStartPH(), []);
  const today = todayPH();
  const [shuffle, setShuffle] = useState(0);
  const [selectedDay, setSelectedDay] = useState(-1);

  useEffect(() => {
    AsyncStorage.getItem(`mealplan:shuffle:${weekStart}`)
      .then((value) => {
        if (value) setShuffle(parseInt(value, 10) || 0);
      })
      .catch(() => {});
  }, [weekStart]);

  const onShuffle = useCallback(() => {
    const next = shuffle + 1;
    setShuffle(next);
    AsyncStorage.setItem(`mealplan:shuffle:${weekStart}`, String(next)).catch(() => {});
  }, [shuffle, weekStart]);

  const catalog = useMemo(() => foods.filter((f) => !f.user_id), [foods]);

  const plan = useMemo(() => {
    if (!goal || catalog.length === 0) return null;
    const result = generateWeekPlan({
      foods: catalog as PlanFood[],
      goal,
      prefs: tastes ?? {},
      budget,
      blocked: new Set(Object.keys(warnings)),
      weekStart,
      seed: `${userId ?? "guest"}:${shuffle}`,
    });
    return result.foodIds.size > 0 ? result : null;
  }, [catalog, goal, tastes, budget, warnings, weekStart, userId, shuffle]);

  const todayIndex = plan ? plan.days.findIndex((d) => d.date === today) : -1;
  const activeDay = selectedDay >= 0 ? selectedDay : Math.max(todayIndex, 0);

  return {
    plan,
    today,
    todayIndex,
    activeDay,
    setSelectedDay,
    onShuffle,
    hasTastes: hasAnyTaste(tastes),
    budget: budget && budget > 0 ? budget : null,
    budgetSet: budget !== null,
    reloadTastes,
  };
}

/* Inputs */
export function usePlanInputs(): PlanInputs & { loading: boolean; refresh: () => Promise<void> } {
  const cached = cache.get<MealSnapshot>(MEALS_CACHE_KEY);
  const [inputs, setInputs] = useState<PlanInputs>({
    foods: (cached?.foods ?? []) as Food[],
    userId: cached?.userId ?? null,
    goal: cached?.goalCalories ?? null,
    warnings: cached?.warnings ?? {},
  });
  const [loading, setLoading] = useState(!cached);

  const refresh = useCallback(async () => {
    try {
      const next = await loadPlanInputs();
      if (next) setInputs(next);
    } catch {
      // Offline
    } finally {
      setLoading(false);
    }
  }, []);

  return { ...inputs, loading, refresh };
}
