// @ts-nocheck
// Autofill

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "gemini-flash-lite-latest";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Logging
async function logUsage(admin: any, userId: string | null, feature: string, model: string, usage: any) {
  try {
    await admin.from("ai_usage").insert({
      user_id: userId,
      feature,
      model,
      prompt_tokens: usage?.promptTokenCount ?? 0,
      output_tokens: usage?.candidatesTokenCount ?? 0,
      total_tokens: usage?.totalTokenCount ?? 0,
    });
  } catch {}
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    isFood: { type: "BOOLEAN" },
    reason: {
      type: "STRING",
      description:
        "If isFood is false, a short explanation of why this isn't a food or drink. If isFood is true, a short note on how the figures were estimated.",
    },
    name: { type: "STRING", description: "Clean display name of the food, empty string if isFood is false." },
    caloriesPer100g: { type: "NUMBER", description: "kcal per 100 g, 0 if isFood is false." },
    proteinPer100g: { type: "NUMBER", description: "Protein in grams per 100 g, 0 if isFood is false." },
    carbsPer100g: { type: "NUMBER", description: "Carbohydrates in grams per 100 g, 0 if isFood is false." },
    fatPer100g: { type: "NUMBER", description: "Fat in grams per 100 g, 0 if isFood is false." },
    ingredients: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Ingredients the food is typically made from, empty if isFood is false.",
    },
    confidence: { type: "STRING", enum: ["low", "medium", "high"] },
  },
  required: [
    "isFood", "reason", "name", "caloriesPer100g", "proteinPer100g",
    "carbsPer100g", "fatPer100g", "ingredients", "confidence",
  ],
};

const buildPrompt = (foodName: string) => `You are a careful nutrition database built into a food-logging app used mainly in the Philippines.

The food to describe is: "${foodName}"

First decide: is this a food or drink meant for human consumption? If not, set isFood to false, explain briefly in "reason", leave name and ingredients empty and set every number to 0.

If it is food:
- "name": a clean, properly capitalised display name (fix spelling, keep it short).
- Nutrition: give typical values PER 100 GRAMS of the food as normally prepared and eaten (for a cooked dish, the cooked dish — not the raw ingredients). Use realistic figures from standard food composition data; calories should be consistent with the macros (about 4 kcal per gram of protein and carbohydrate, 9 per gram of fat).
- "ingredients": list what this food is typically made from, most significant first, between 3 and 12 items, each a short plain English name (e.g. "Chicken thigh", "Soy sauce", "Cane vinegar", "Garlic", "Bay leaf", "Black pepper"). Include sauces, seasonings, cooking oil and salt, and anything that commonly causes allergies (milk, egg, peanuts, tree nuts, soy, wheat, fish, shellfish, sesame) when it is normally part of the dish. No quantities, no brand names, no duplicates.
- "confidence": "high" for well-known foods with standard recipes, "medium" for dishes with common variations, "low" if you are unsure what the food is.
- "reason": one short sentence on the basis of the estimate.

Respond using only the provided JSON schema.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GEMINI_API_KEY is not configured." }, 500);

    // Authorization
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "You need to be signed in." }, 401);

    const { data: profile } = await supabaseAdmin
      .from("weighApp")
      .select("admin")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile?.admin) return json({ error: "Only admins can use AI auto-fill." }, 403);

    // Input
    const body = await req.json().catch(() => ({}));
    const foodName = typeof body?.name === "string" ? body.name.trim() : "";
    if (!foodName) return json({ error: "Missing food 'name' in request body." }, 400);
    if (foodName.length > 80) return json({ error: "Food name is too long." }, 400);

    // Model
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(foodName) }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return json({ error: `Gemini API error (${geminiResponse.status}): ${errText}` }, 502);
    }

    const geminiData = await geminiResponse.json();
    await logUsage(supabaseAdmin, userData.user.id, "food_autofill", MODEL, geminiData?.usageMetadata);
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return json({ error: "Gemini returned no result." }, 502);

    // Parsing
    return json({ result: JSON.parse(text) });
  } catch (err: any) {
    return json({ error: err.message || "Unexpected error." }, 500);
  }
});
