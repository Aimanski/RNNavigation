// Tastes

import { useCallback, useEffect, useState } from "react";
import { cache } from "../cache";
import { getSessionUser } from "../auth/session";
import { supabase } from "../supabase";

export type TasteKey = "salty" | "sweet" | "spicy" | "savory" | "sour" | "creamy" | "rice" | "veggies";
export type TasteChoice = "love" | "okay" | "avoid";
export type TastePrefs = Partial<Record<TasteKey, TasteChoice>>;

export type TasteQuestion = {
  key: TasteKey;
  question: string;
  hint: string;
  emoji: string;
  /* Keywords */
  keywords: string[];
};

export const TASTE_QUESTIONS: TasteQuestion[] = [
  {
    key: "salty",
    question: "Do you prefer salty food?",
    hint: "Like adobo, tuna or cheesy dishes",
    emoji: "🧂",
    keywords: ["soy sauce", "toyo", "fish sauce", "patis", "bacon", "ham", "cheese", "tuna", "sardine", "dilis", "tinapa", "adobo", "anchovy", "salt", "asin", "corned beef", "longganisa", "tocino"],
  },
  {
    key: "sweet",
    question: "Do you prefer sweet food?",
    hint: "Like banana, apple, honey or teriyaki",
    emoji: "🍯",
    keywords: ["banana", "saba", "apple", "honey", "sugar", "syrup", "mango", "pineapple", "teriyaki", "cinnamon", "sweet potato", "camote", "oats with milk", "dates", "raisin", "berry", "berries"],
  },
  {
    key: "spicy",
    question: "Do you prefer spicy food?",
    hint: "Like curry, chili or peppery dishes",
    emoji: "🌶️",
    keywords: ["chili", "chilli", "sili", "siling", "curry", "pepper", "peppercorn", "cayenne", "paprika", "spicy", "hot sauce", "sriracha", "ginger"],
  },
  {
    key: "savory",
    question: "Do you prefer savory, meaty food?",
    hint: "Like grilled chicken, beef or eggs",
    emoji: "🍖",
    keywords: ["chicken", "beef", "pork", "egg", "eggs", "tuna", "fish", "grilled", "stir fry", "stir-fry", "fried", "adobo", "steak", "bangus", "tilapia", "turkey", "meat"],
  },
  {
    key: "sour",
    question: "Do you prefer sour or tangy food?",
    hint: "Like vinegar, calamansi or tomato",
    emoji: "🍋",
    keywords: ["vinegar", "suka", "lemon", "calamansi", "lime", "tomato", "kamatis", "tamarind", "sampalok", "sinigang", "yogurt", "pickle", "pickled", "adobo"],
  },
  {
    key: "creamy",
    question: "Do you prefer creamy food?",
    hint: "Like milk, cheese, oats or peanut butter",
    emoji: "🥛",
    keywords: ["milk", "cheese", "cream", "creamy", "yogurt", "yoghurt", "butter", "coconut", "gata", "oats", "oatmeal", "mayonnaise", "mayo", "custard", "peanut butter"],
  },
  {
    key: "rice",
    question: "Do you like rice meals?",
    hint: "Meals served with or cooked in rice",
    emoji: "🍚",
    keywords: ["rice", "kanin", "sinangag", "congee", "lugaw", "arroz"],
  },
  {
    key: "veggies",
    question: "Do you like vegetables?",
    hint: "Like carrots, greens, squash or potatoes",
    emoji: "🥦",
    keywords: ["vegetable", "vegetables", "veggie", "veggies", "carrot", "broccoli", "cabbage", "spinach", "lettuce", "cucumber", "potato", "kangkong", "sitaw", "okra", "pechay", "squash", "kalabasa", "eggplant", "talong", "bell pepper", "celery", "ampalaya", "beans", "peas", "corn"],
  },
];

export const CHOICE_LABEL: Record<TasteChoice, string> = {
  love: "Love it",
  okay: "It's okay",
  avoid: "Not for me",
};

const CACHE_KEY = "tastes";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const containsWord = (text: string, keyword: string): boolean =>
  new RegExp(`(^|[^a-z])${escapeRegex(keyword)}(s|es)?($|[^a-z])`, "i").test(text);

/* Matching */
export function tasteTagsFor(texts: (string | null | undefined)[]): TasteKey[] {
  const haystack = texts.filter((t): t is string => !!t).map((t) => t.toLowerCase());
  if (haystack.length === 0) return [];
  return TASTE_QUESTIONS.filter((q) =>
    haystack.some((text) => q.keywords.some((keyword) => containsWord(text, keyword)))
  ).map((q) => q.key);
}

/* Scoring */
export function tasteScore(tags: TasteKey[], prefs: TastePrefs): number {
  let score = 0;
  for (const tag of tags) {
    const choice = prefs[tag];
    if (choice === "love") score += 2;
    else if (choice === "avoid") score -= 3;
  }
  return score;
}

export const hasAnyTaste = (prefs: TastePrefs | null | undefined): boolean =>
  !!prefs && TASTE_QUESTIONS.some((q) => !!prefs[q.key]);

const sanitize = (value: unknown): TastePrefs | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const out: TastePrefs = {};
  for (const q of TASTE_QUESTIONS) {
    const choice = raw[q.key];
    if (choice === "love" || choice === "okay" || choice === "avoid") out[q.key] = choice;
  }
  return out;
};

/* Fetch */
export async function fetchTastes(userId: string): Promise<TastePrefs | null> {
  const { data, error } = await supabase
    .from("weighApp")
    .select("taste_preferences")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const prefs = sanitize((data as { taste_preferences?: unknown }).taste_preferences);
  cache.set<TastePrefs | null>(CACHE_KEY, prefs);
  return prefs;
}

export async function saveTastes(userId: string, prefs: TastePrefs): Promise<void> {
  const clean = sanitize(prefs) ?? {};
  const { error } = await supabase.from("weighApp").update({ taste_preferences: clean }).eq("id", userId);
  if (error) throw error;
  cache.set<TastePrefs | null>(CACHE_KEY, clean);
}

/* Refresh */
export function useTastes(): { tastes: TastePrefs | null; loaded: boolean; reload: () => Promise<void> } {
  const [tastes, setTastes] = useState<TastePrefs | null>(cache.get<TastePrefs | null>(CACHE_KEY) ?? null);
  const [loaded, setLoaded] = useState(cache.get<TastePrefs | null>(CACHE_KEY) !== undefined);

  const reload = useCallback(async () => {
    try {
      const user = await getSessionUser();
      if (!user) return;
      setTastes(await fetchTastes(user.id));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { tastes, loaded, reload };
}
