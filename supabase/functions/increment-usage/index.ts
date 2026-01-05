import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_QUESTION_LIMIT = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    console.log("[INCREMENT-USAGE] Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    console.log("[INCREMENT-USAGE] User:", user.id);

    // Get current profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("questions_used, subscribed")
      .eq("user_id", user.id)
      .single();

    if (profileError) throw new Error(`Profile error: ${profileError.message}`);

    // If subscribed, allow unlimited
    if (profile.subscribed) {
      console.log("[INCREMENT-USAGE] User is subscribed, unlimited access");
      return new Response(JSON.stringify({
        allowed: true,
        questions_used: profile.questions_used,
        questions_remaining: null,
        subscribed: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check limit
    if (profile.questions_used >= FREE_QUESTION_LIMIT) {
      console.log("[INCREMENT-USAGE] User at limit:", profile.questions_used);
      return new Response(JSON.stringify({
        allowed: false,
        questions_used: profile.questions_used,
        questions_remaining: 0,
        subscribed: false,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Use atomic increment function to prevent race conditions
    const { data: result, error: incrementError } = await supabaseClient
      .rpc("increment_questions_used", { p_user_id: user.id })
      .single();

    if (incrementError) {
      throw new Error(`Failed to increment usage: ${incrementError.message}`);
    }

    const newCount = result || profile.questions_used + 1;
    console.log("[INCREMENT-USAGE] Incremented to:", newCount);

    return new Response(JSON.stringify({
      allowed: true,
      questions_used: newCount,
      questions_remaining: Math.max(0, FREE_QUESTION_LIMIT - newCount),
      subscribed: false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[INCREMENT-USAGE] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
