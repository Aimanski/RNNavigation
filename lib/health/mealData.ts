// Meals

import { fetchAllergies, findAllergens, ingredientNames } from "./allergies";
import { PlanItem } from "./mealPlan";
import { getSessionUser } from "../auth/session";
import { supabase } from "../supabase";

export type Food = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: string;
  image_url: string;
  // Serving
  serving_g?: number | null;
  price_php?: number | null;
  ingredients?: unknown;
  // Ownership
  user_id?: string | null;
  created_at?: string;
};

export type MealSnapshot = {
  foods: Food[];
  userId: string;
  goalCalories: number | null;
  total: number;
  // Allergens
  warnings: Record<string, string[]>;
};

export const MEALS_CACHE_KEY = "meals:snapshot";

// Columns
const FOOD_COLUMNS = "id, name, calories, protein, carbs, fat, meal_type, image_url, created_at";

// Fallback
const COLUMN_SETS = [
  `${FOOD_COLUMNS}, ingredients, serving_g, price_php, user_id`,
  `${FOOD_COLUMNS}, ingredients, serving_g, user_id`,
  `${FOOD_COLUMNS}, ingredients, user_id`,
  FOOD_COLUMNS,
];

export const fetchFoods = async () => {
  let last: { data: Food[] | null; error: { message?: string } | null } = { data: null, error: null };
  for (const columns of COLUMN_SETS) {
    const res = await supabase.from("foods").select(columns).order("name", { ascending: true });
    last = { data: res.data as unknown as Food[] | null, error: res.error };
    if (!res.error) return last;
  }
  return last;
};

export type PlanInputs = {
  foods: Food[];
  userId: string | null;
  goal: number | null;
  warnings: Record<string, string[]>;
};

/* Inputs */
export async function loadPlanInputs(): Promise<PlanInputs | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const [foodsRes, profileRes, allergies] = await Promise.all([
    fetchFoods(),
    supabase.from("weighApp").select("goal_calories").eq("id", user.id).maybeSingle(),
    fetchAllergies(user.id),
  ]);
  if (foodsRes.error) throw new Error(foodsRes.error.message || "Failed to load foods");
  const foods = foodsRes.data || [];
  const warnings: Record<string, string[]> = {};
  if (allergies && allergies.length > 0) {
    foods.forEach((food) => {
      const hits = findAllergens(allergies, [food.name, ...ingredientNames(food.ingredients)]);
      if (hits.length > 0) warnings[food.id] = hits;
    });
  }
  const goal = profileRes.data && profileRes.data.goal_calories > 0 ? profileRes.data.goal_calories : null;
  return { foods, userId: user.id, goal, warnings };
}

/* Detail */
export function planItemParams(item: PlanItem) {
  const { food } = item;
  const serving = food.serving_g && food.serving_g > 0 ? food.serving_g : 100;
  return {
    name: food.name,
    calories: food.calories.toString(),
    protein: (food.protein || 0).toFixed(1),
    carbs: (food.carbs || 0).toFixed(1),
    fat: (food.fat || 0).toFixed(1),
    servings: String(item.grams / serving),
    portion: `${item.grams} g`,
    items: JSON.stringify([
      {
        id: food.id,
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        desc: `${food.calories} kcal`,
        image_url: food.image_url,
      },
    ]),
  };
}
