// Energy

export type GoalKey = "lose" | "maintain" | "gain";

export const ACTIVITY_MULTIPLIERS = [1.2, 1.375, 1.55, 1.725, 1.9] as const;
export const GOAL_OFFSET: Record<GoalKey, number> = { lose: -500, maintain: 0, gain: 500 };

export function calcBmi(weightKg: number, heightCm: number): number {
  return parseFloat((weightKg / ((heightCm / 100) * (heightCm / 100))).toFixed(1));
}

/* Metabolism */
export function calcBmr(gender: string | null | undefined, weightKg: number, heightCm: number, age: number): number | null {
  const g = (gender ?? "").trim().toLowerCase();
  const offset = g === "male" ? 5 : g === "female" ? -161 : null;
  if (offset === null) return null;
  return parseFloat((10 * weightKg + 6.25 * heightCm - 5 * age + offset).toFixed(2));
}

/* Activity */
export function activityMultiplierFrom(tdee: number, bmr: number): number {
  const ratio = tdee / bmr;
  return ACTIVITY_MULTIPLIERS.reduce((best, m) => (Math.abs(m - ratio) < Math.abs(best - ratio) ? m : best));
}

/* Goal */
export function goalFrom(goalCalories: number, tdee: number): GoalKey {
  const diff = goalCalories - tdee;
  if (diff <= -250) return "lose";
  if (diff >= 250) return "gain";
  return "maintain";
}

/* Recommendation */
export function recommendedGoalForBmi(bmi: number): GoalKey {
  if (bmi < 18.5) return "gain";
  if (bmi < 25) return "maintain";
  return "lose";
}

export const GOAL_LABEL: Record<GoalKey, string> = {
  lose: "Lose Weight",
  maintain: "Maintain Weight",
  gain: "Gain Weight",
};

export type Energy = { bmi: number; bmr: number; tdee: number; goalCalories: number; goal: GoalKey; multiplier: number };

/* Recalculation */
export function recalc(
  input: { gender: string | null | undefined; age: number; heightCm: number; weightKg: number },
  saved: { bmr: number | null; tdee: number | null; goalCalories: number | null }
): Energy | null {
  const bmi = calcBmi(input.weightKg, input.heightCm);
  const bmr = calcBmr(input.gender, input.weightKg, input.heightCm, input.age);
  if (bmr === null || !saved.bmr || saved.bmr <= 0 || !saved.tdee || saved.tdee <= 0) return null;

  const multiplier = activityMultiplierFrom(saved.tdee, saved.bmr);
  const goal = saved.goalCalories && saved.goalCalories > 0 ? goalFrom(saved.goalCalories, saved.tdee) : "maintain";
  const tdee = Math.round(bmr * multiplier);
  return { bmi, bmr, tdee, goal, multiplier, goalCalories: tdee + GOAL_OFFSET[goal] };
}
