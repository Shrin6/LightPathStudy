import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    console.log("[CHECK-SUBSCRIPTION] Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    console.log("[CHECK-SUBSCRIPTION] User authenticated:", user.email);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      console.log("[CHECK-SUBSCRIPTION] No Stripe customer found");
      
      // Update profile to not subscribed
      await supabaseClient
        .from("profiles")
        .update({ subscribed: false, subscription_end: null })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    console.log("[CHECK-SUBSCRIPTION] Found Stripe customer:", customerId);

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    console.log("[CHECK-SUBSCRIPTION] Subscriptions found:", subscriptions.data.length);
    
    const hasActiveSub = subscriptions.data.length > 0;
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      console.log("[CHECK-SUBSCRIPTION] Subscription object:", JSON.stringify({
        id: subscription.id,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        current_period_end_type: typeof subscription.current_period_end,
      }));
      
      try {
        const periodEnd = subscription.current_period_end;
        if (periodEnd && typeof periodEnd === 'number' && periodEnd > 0) {
          const timestamp = periodEnd * 1000;
          const date = new Date(timestamp);
          if (date && !isNaN(date.getTime())) {
            subscriptionEnd = date.toISOString();
            console.log("[CHECK-SUBSCRIPTION] Active subscription found, ends:", subscriptionEnd);
          } else {
            console.log("[CHECK-SUBSCRIPTION] Date validation failed - isNaN:", isNaN(date.getTime()));
          }
        } else {
          console.log("[CHECK-SUBSCRIPTION] Period end validation failed:", { periodEnd, type: typeof periodEnd });
        }
      } catch (dateError) {
        console.error("[CHECK-SUBSCRIPTION] Error parsing subscription end date:", dateError);
      }
    } else {
      console.log("[CHECK-SUBSCRIPTION] No active subscription");
    }

    // Update profile with subscription status
    await supabaseClient
      .from("profiles")
      .update({
        subscribed: hasActiveSub,
        subscription_end: subscriptionEnd,
        stripe_customer_id: customerId,
      })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[CHECK-SUBSCRIPTION] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
