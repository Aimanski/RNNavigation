// History

import { supabase } from "../supabase";

export type BodyEntry = {
  id: number;
  createdAt: string;
  weightKg: number;
  heightCm: number;
  bmi: number;
  bmr: number;
  tdee: number;
  goalCalories: number;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* Fetch */
export async function fetchBodyHistory(userId: string, limit = 10): Promise<BodyEntry[]> {
  const { data, error } = await supabase
    .from("body_history")
    .select("id, created_at, weight_kg, height_cm, bmi, bmr, tdee, goal_calories")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data.map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    weightKg: num(row.weight_kg),
    heightCm: num(row.height_cm),
    bmi: num(row.bmi),
    bmr: num(row.bmr),
    tdee: num(row.tdee),
    goalCalories: num(row.goal_calories),
  }));
}

/* Format */
export const trim1 = (v: number): string => String(Math.round(v * 10) / 10);

export const kcal = (v: number): string => `${Math.round(v).toLocaleString("en-US")} kcal`;

export const entryDate = (iso: string): string =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
