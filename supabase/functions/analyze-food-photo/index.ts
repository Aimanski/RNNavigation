// @ts-nocheck
// Scanner

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "gemini-flash-lite-latest";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    isFood: { type: "BOOLEAN" },
    reason: {
      type: "STRING",
      description:
        "If isFood is false, a short explanation of what the image actually shows instead. If isFood is true, a short note on how the estimate was made.",
    },
    name: { type: "STRING", description: "Short name of the food/drink, empty string if isFood is false." },
    estimatedGrams: { type: "NUMBER", description: "Best-guess total weight of the visible portion in grams, 0 if isFood is false." },
    calories: { type: "NUMBER", description: "Total kcal for the visible portion, 0 if isFood is false." },
    protein: { type: "NUMBER", description: "Total protein in grams for the visible portion, 0 if isFood is false." },
    carbs: { type: "NUMBER", description: "Total carbohydrates in grams for the visible portion, 0 if isFood is false." },
    fat: { type: "NUMBER", description: "Total fat in grams for the visible portion, 0 if isFood is false." },
    confidence: { type: "STRING", enum: ["low", "medium", "high"] },
  },
  required: ["isFood", "reason", "name", "estimatedGrams", "calories", "protein", "carbs", "fat", "confidence"],
};

const PROMPT = `You are a careful nutrition estimator built into a food-logging app. Look at the attached photo.

First decide: does this photo show food or a drink meant for human consumption? A barcode, a QR code, a person, an object, an empty plate, packaging with no visible food, etc. all count as NOT food.

If it is NOT food, set isFood to false and briefly say what the image actually shows in "reason". Leave name empty and set all numeric fields to 0.

If it IS food, set isFood to true, give it a short descriptive name, and estimate — based on the visible portion size in the photo, using common serving references (a standard plate, a typical hand size, a standard cup, etc.) — the total weight in grams and the total calories, protein, carbs, and fat for exactly the portion shown (not a generic 100g reference). Rate your own confidence as "low", "medium", or "high" depending on how clearly the food and its portion size are visible. Briefly explain your estimate in "reason".

Respond using only the provided JSON schema.`;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return new Response(JSON.stringify({ error: "Missing base64 'image' in request body." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Model
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: "image/jpeg", data: image } },
              ],
            },
          ],
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
      return new Response(
        JSON.stringify({ error: `Gemini API error (${geminiResponse.status}): ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiResponse.json();

    // Logging
    let callerId: string | null = null;
    let supabaseAdmin: any = null;
    try {
      supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: caller } = await supabaseAdmin.auth.getUser(token);
      callerId = caller?.user?.id ?? null;
    } catch {}
    if (supabaseAdmin) await logUsage(supabaseAdmin, callerId, "food_scan", MODEL, geminiData?.usageMetadata);
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return new Response(JSON.stringify({ error: "Gemini returned no analysis." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parsing
    const result = JSON.parse(text);

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Unexpected error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
