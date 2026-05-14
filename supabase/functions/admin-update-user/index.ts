// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { user_id, email, password } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const updates = {};
    if (email) updates.email = email;
    if (password && password.length >= 6) updates.password = password;

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: "Nothing to update" }), {
        status: 400,
      });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, updates);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});