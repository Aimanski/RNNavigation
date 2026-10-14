// Planner

import { TasteKey, TastePrefs, tasteScore, tasteTagsFor } from "./tastes";
import { ingredientNames } from "./allergies";

export type Slot = "breakfast" | "lunch" | "dinner" | "snack";

export const SLOTS: { key: Slot; title: string; share: number }[] = [
  { key: "breakfast", title: "Breakfast", share: 0.25 },
  { key: "lunch", title: "Lunch", share: 0.35 },
  { key: "dinner", title: "Dinner", share: 0.3 },
  { key: "snack", title: "Snack", share: 0.1 },
];

export type PlanFood = {
  id: string;
  name: string;
  /* Calories in one serving */
  calories: number;
  /* Weight of one serving, in grams */
  serving_g?: number | null;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: string;
  image_url: string;
  ingredients?: unknown;
};

export type PlanItem = {
  food: PlanFood;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type PlanMeal = { slot: Slot; title: string; items: PlanItem[]; kcal: number };

export type PlanDay = {
  /* Day number, 1 to 7 */
  day: number;
  /* Date as YYYY-MM-DD */
  date: string;
  weekday: string;
  meals: PlanMeal[];
  kcal: number;
};

export type WeekPlan = {
  goal: number;
  weekStart: string;
  days: PlanDay[];
  /* Foods used anywhere in the week */
  foodIds: Set<string>;
};

/* Portions move in quarter servings */
const MIN_UNITS = 2;
const MAX_UNITS = 9;
const SNACK_MAX_UNITS = 6;
const MAX_ITEMS = 5;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PH_TIMEZONE = "Asia/Manila";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/* Dates */
export function weekStartPH(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = parts.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

export const todayPH = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: PH_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

const addDays = (isoDate: string, days: number): string => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
};

/* Random */
const hashString = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Candidate = { food: PlanFood; tags: TasteKey[] };

const servingOf = (food: PlanFood) => (food.serving_g && food.serving_g > 0 ? food.serving_g : 100);
const kcalPerGram = (food: PlanFood) => food.calories / servingOf(food);
const unitOf = (food: PlanFood) => servingOf(food) / 4;
const snap = (food: PlanFood, grams: number) => Math.round(grams / unitOf(food)) * unitOf(food);
const minGramsOf = (food: PlanFood) => unitOf(food) * MIN_UNITS;
const maxGramsOf = (food: PlanFood, slot: Slot) =>
  unitOf(food) * (slot === "snack" ? SNACK_MAX_UNITS : MAX_UNITS);

const makeItem = (food: PlanFood, grams: number): PlanItem => {
  const f = grams / servingOf(food);
  return {
    food,
    grams,
    kcal: Math.round(food.calories * f),
    protein: Math.round(food.protein * f * 10) / 10,
    carbs: Math.round(food.carbs * f * 10) / 10,
    fat: Math.round(food.fat * f * 10) / 10,
  };
};

const itemKcal = (food: PlanFood, grams: number) => kcalPerGram(food) * grams;

function buildMeal(
  slot: Slot,
  target: number,
  pool: Candidate[],
  prefs: TastePrefs,
  usedToday: Set<string>,
  usedWeek: Map<string, number>,
  rng: () => number
): { food: PlanFood; grams: number }[] {
  const ranked = pool
    .map((c) => {
      const repeats = usedWeek.get(c.food.id) ?? 0;
      // Fit
      const tooBig = c.food.calories * (MIN_UNITS / 4) > target * 0.8 ? 4 : 0;
      const watery = kcalPerGram(c.food) < 0.25 ? 2.5 : 0;
      const score =
        tasteScore(c.tags, prefs) - tooBig - watery - repeats * 1.4 - (usedToday.has(c.food.id) ? 50 : 0) + rng() * 1.6;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);

  const wanted = target >= 650 ? 4 : target >= 380 ? 3 : target >= 160 ? 2 : 1;
  const picked = ranked.slice(0, Math.min(wanted, ranked.length));
  if (picked.length === 0) return [];
  const smallest = (c: Candidate) => c.food.calories * (MIN_UNITS / 4);
  while (picked.length > 1 && picked.reduce((sum, c) => sum + smallest(c), 0) > target * 1.05) picked.pop();

  // Shares
  const weights = picked.map((_, i) => (i === 0 ? 0.45 : 0.55 / Math.max(picked.length - 1, 1)));
  const items = picked.map((c, i) => ({
    food: c.food,
    grams: clamp(
      snap(c.food, (weights[i] * target) / kcalPerGram(c.food)),
      minGramsOf(c.food),
      maxGramsOf(c.food, slot)
    ),
  }));

  const total = () => items.reduce((sum, it) => sum + itemKcal(it.food, it.grams), 0);

  // Fit
  for (let pass = 0; pass < 40; pass++) {
    const diff = target - total();
    if (Math.abs(diff) <= target * 0.02) break;
    const movable = items.filter((it) =>
      diff > 0
        ? it.grams + unitOf(it.food) <= maxGramsOf(it.food, slot)
        : it.grams - unitOf(it.food) >= minGramsOf(it.food)
    );
    if (movable.length === 0) {
      // More
      if (diff > 0 && items.length < MAX_ITEMS) {
        const extra = ranked.find((c) => !items.some((it) => it.food.id === c.food.id));
        if (extra) {
          items.push({
            food: extra.food,
            grams: clamp(snap(extra.food, diff / kcalPerGram(extra.food)), minGramsOf(extra.food), maxGramsOf(extra.food, slot)),
          });
          continue;
        }
      }
      break;
    }
    const direction = diff > 0 ? 1 : -1;
    const bigStep = Math.abs(diff) > target * 0.12 ? 2 : 1;
    movable.forEach((it) => {
      it.grams = clamp(it.grams + direction * bigStep * unitOf(it.food), minGramsOf(it.food), maxGramsOf(it.food, slot));
    });
  }
  return items;
}

export type PlanInput = {
  foods: PlanFood[];
  goal: number;
  prefs: TastePrefs;
  /* Foods to leave out, by id (allergens) */
  blocked: Set<string>;
  weekStart: string;
  seed: string;
};

export function generateWeekPlan(input: PlanInput): WeekPlan {
  const { goal, prefs, blocked, weekStart, seed } = input;
  const rng = mulberry32(hashString(`${seed}|${weekStart}|${goal}`));

  const candidates: Candidate[] = input.foods
    .filter((f) => f.calories > 0 && !blocked.has(f.id))
    .map((food) => ({ food, tags: tasteTagsFor([food.name, ...ingredientNames(food.ingredients)]) }));

  const poolFor = (slot: Slot): Candidate[] => {
    const attempts = slot === "snack" ? [["snack", "all"], ["all", "breakfast"]] : [[slot, "all"]];
    for (const types of attempts) {
      const matched = candidates.filter((c) => types.includes(c.food.meal_type));
      if (matched.length >= 2) return matched;
    }
    return candidates;
  };

  const usedWeek = new Map<string, number>();
  const days: PlanDay[] = [];
  const foodIds = new Set<string>();

  for (let d = 0; d < 7; d++) {
    const usedToday = new Set<string>();
    const meals: PlanMeal[] = SLOTS.map(({ key, title, share }) => {
      const built = buildMeal(key, goal * share, poolFor(key), prefs, usedToday, usedWeek, rng);
      built.forEach((it) => {
        usedToday.add(it.food.id);
        usedWeek.set(it.food.id, (usedWeek.get(it.food.id) ?? 0) + 1);
      });
      return { slot: key, title, items: built.map((it) => makeItem(it.food, it.grams)), kcal: 0 };
    });

    // Balance
    const flatItems = () => meals.flatMap((m) => m.items);
    const dayKcal = () => flatItems().reduce((sum, it) => sum + itemKcal(it.food, it.grams), 0);
    const balance = () => {
      for (let pass = 0; pass < 80; pass++) {
        const flat = flatItems();
        if (flat.length === 0) return;
        const diff = goal - dayKcal();
        if (Math.abs(diff) <= goal * 0.015) return;
        const up = diff > 0;
        const movable = flat.filter((it) =>
          up
            ? it.grams + unitOf(it.food) <= maxGramsOf(it.food, "lunch")
            : it.grams - unitOf(it.food) >= minGramsOf(it.food)
        );
        if (movable.length === 0) return;
        const pick = movable[pass % movable.length];
        pick.grams = clamp(
          pick.grams + (up ? 1 : -1) * unitOf(pick.food),
          minGramsOf(pick.food),
          maxGramsOf(pick.food, "lunch")
        );
      }
    };

    for (let attempt = 0; attempt < 8; attempt++) {
      balance();
      if (dayKcal() <= goal * 1.03) break;
      // Drop the food with the largest smallest-portion
      const crowded = meals.filter((m) => m.items.length > 1);
      if (crowded.length === 0) break;
      const candidatesToDrop = crowded.flatMap((m) => m.items.map((it) => ({ m, it })));
      candidatesToDrop.sort(
        (a, b) => b.it.food.calories * (MIN_UNITS / 4) - a.it.food.calories * (MIN_UNITS / 4)
      );
      const victim = candidatesToDrop[0];
      victim.m.items = victim.m.items.filter((it) => it !== victim.it);
    }

    meals.forEach((m) => {
      m.items = m.items.map((it) => makeItem(it.food, it.grams));
      m.kcal = m.items.reduce((sum, it) => sum + it.kcal, 0);
      m.items.forEach((it) => foodIds.add(it.food.id));
    });

    days.push({
      day: d + 1,
      date: addDays(weekStart, d),
      weekday: WEEKDAYS[d],
      meals: meals.filter((m) => m.items.length > 0),
      kcal: meals.reduce((sum, m) => sum + m.kcal, 0),
    });
  }

  return { goal, weekStart, days, foodIds };
}
