// @ts-nocheck
// Admin
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authorization
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !callerData?.user) return json({ error: "You need to be signed in." }, 401);

    const { data: callerProfile } = await supabaseAdmin
      .from("weighApp")
      .select("admin")
      .eq("id", callerData.user.id)
      .maybeSingle();
    if (callerProfile?.admin !== true) return json({ error: "Only admins can delete users." }, 403);

    const { user_id } = await req.json().catch(() => ({}));
    if (!user_id || typeof user_id !== "string") return json({ error: "user_id is required" }, 400);
    if (user_id === callerData.user.id) {
      return json({ error: "You can't delete your own account from the admin panel." }, 400);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (error) return json({ error: error.message }, 500);

    // Cleanup
    await supabaseAdmin.from("weighApp").delete().eq("id", user_id);

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
