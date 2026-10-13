// Allergies

import { useCallback, useEffect, useState } from "react";
import { cache } from "../cache";
import { getSessionUser } from "../auth/session";
import { supabase } from "../supabase";

export type AllergenOption = {
  /* Allergies */
  label: string;
  emoji: string;
  /* Keywords */
  keywords: string[];
  /* Exclusions */
  exclude?: string[];
};

// Allergens
export const ALLERGEN_OPTIONS: AllergenOption[] = [
  { label: "Salt", emoji: "🧂", keywords: ["salt", "sodium", "asin"] },
  { label: "Chicken", emoji: "🍗", keywords: ["chicken", "manok", "poultry"] },
  { label: "Pork", emoji: "🥓", keywords: ["pork", "bacon", "ham", "lechon", "baboy", "chicharon"] },
  { label: "Beef", emoji: "🥩", keywords: ["beef", "steak", "baka", "corned beef"] },
  { label: "Egg", emoji: "🥚", keywords: ["egg", "eggs", "itlog", "mayonnaise", "mayo"] },
  {
    label: "Milk & Dairy",
    emoji: "🥛",
    keywords: ["milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "whey", "dairy", "gatas", "creamer"],
    exclude: [
      "peanut butter", "almond butter", "cashew butter", "nut butter", "seed butter", "cocoa butter",
      "cacao butter", "shea butter", "apple butter", "coconut milk", "coconut cream", "almond milk",
      "soy milk", "soya milk", "oat milk", "rice milk", "cashew milk", "cream of tartar",
    ],
  },
  {
    label: "Fish",
    emoji: "🐟",
    keywords: ["fish", "tuna", "salmon", "tilapia", "bangus", "galunggong", "sardine", "sardines", "anchovy", "anchovies", "patis", "dilis", "tinapa"],
  },
  {
    label: "Shellfish",
    emoji: "🦐",
    keywords: ["shrimp", "prawn", "crab", "lobster", "shellfish", "hipon", "alimango", "squid", "pusit", "mussel", "mussels", "tahong", "oyster", "clam", "clams"],
  },
  { label: "Peanuts", emoji: "🥜", keywords: ["peanut", "peanuts", "mani"] },
  {
    label: "Tree Nuts",
    emoji: "🌰",
    keywords: ["almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pistachio", "pistachios", "hazelnut", "hazelnuts", "pecan", "pecans", "tree nut", "tree nuts"],
  },
  {
    label: "Soy",
    emoji: "🫘",
    keywords: ["soy", "soya", "soybean", "soybeans", "tofu", "tokwa", "toyo", "soy sauce", "miso"],
  },
  {
    label: "Wheat & Gluten",
    emoji: "🌾",
    keywords: ["wheat", "flour", "bread", "gluten", "pasta", "noodle", "noodles", "spaghetti", "macaroni", "pancit", "breadcrumbs", "cracker", "crackers"],
  },
  { label: "Sesame", emoji: "🌱", keywords: ["sesame", "tahini", "linga"] },
  { label: "Garlic", emoji: "🧄", keywords: ["garlic", "bawang"] },
  { label: "Onion", emoji: "🧅", keywords: ["onion", "onions", "sibuyas", "shallot", "shallots", "scallion"] },
  { label: "Mushroom", emoji: "🍄", keywords: ["mushroom", "mushrooms", "kabute"] },
  { label: "Tomato", emoji: "🍅", keywords: ["tomato", "tomatoes", "kamatis", "ketchup"] },
  { label: "Corn", emoji: "🌽", keywords: ["corn", "mais", "cornstarch"] },
  { label: "Chocolate", emoji: "🍫", keywords: ["chocolate", "cocoa", "cacao"] },
  { label: "Sugar", emoji: "🍬", keywords: ["sugar", "asukal", "syrup", "honey"] },
];

const CACHE_KEY = "allergies";

/* Normalization */
export const normalizeAllergen = (value: string): string => {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* Matching */
const containsWord = (text: string, keyword: string): boolean =>
  new RegExp(`(^|[^a-z])${escapeRegex(keyword)}(s|es)?($|[^a-z])`, "i").test(text);

const presetFor = (allergy: string): AllergenOption | undefined =>
  ALLERGEN_OPTIONS.find((o) => o.label.toLowerCase() === allergy.toLowerCase());

/* Matching */
export function findAllergens(allergies: string[], texts: (string | null | undefined)[]): string[] {
  if (allergies.length === 0) return [];
  const haystack = texts.filter((t): t is string => !!t).map((t) => t.toLowerCase());
  if (haystack.length === 0) return [];
  return allergies.filter((allergy) => {
    const preset = presetFor(allergy);
    const keywords = preset ? preset.keywords : [allergy.toLowerCase()];
    const exclude = preset?.exclude ?? [];
    return haystack.some((text) => {
      // Exclusions
      const cleaned = exclude.reduce((acc, phrase) => acc.split(phrase).join(" "), text);
      return keywords.some((keyword) => containsWord(cleaned, keyword));
    });
  });
}

/* Ingredients */
export function ingredientNames(ingredients: unknown): string[] {
  if (!Array.isArray(ingredients)) return [];
  return ingredients
    .map((item) => (item && typeof item === "object" ? (item as { name?: unknown }).name : null))
    .filter((name): name is string => typeof name === "string" && name.length > 0);
}

/* Fetch */
export async function fetchAllergies(userId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("weighApp")
    .select("allergies")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const value = (data as { allergies?: unknown }).allergies;
  const list = Array.isArray(value) ? (value as string[]) : null;
  // Cache
  cache.set<string[]>(CACHE_KEY, list ?? []);
  return list;
}

export async function saveAllergies(userId: string, allergies: string[]): Promise<void> {
  const { error } = await supabase.from("weighApp").update({ allergies }).eq("id", userId);
  if (error) throw error;
  cache.set<string[]>(CACHE_KEY, allergies);
}

/* Refresh */
export function useAllergies(): { allergies: string[]; loaded: boolean } {
  const [allergies, setAllergies] = useState<string[]>(cache.get<string[]>(CACHE_KEY) ?? []);
  const [loaded, setLoaded] = useState(cache.get<string[]>(CACHE_KEY) !== undefined);

  const load = useCallback(async () => {
    try {
      const user = await getSessionUser();
      if (!user) return;
      const saved = await fetchAllergies(user.id);
      const next = saved ?? [];
      cache.set<string[]>(CACHE_KEY, next);
      setAllergies(next);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { allergies, loaded };
}
