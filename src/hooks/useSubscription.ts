import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const FREE_QUESTION_LIMIT = 5;

interface SubscriptionState {
  subscribed: boolean;
  questionsUsed: number;
  questionsRemaining: number | null;
  loading: boolean;
}

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    questionsUsed: 0,
    questionsRemaining: FREE_QUESTION_LIMIT,
    loading: true,
  });

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Check subscription status from Stripe
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.access_token) {
        await supabase.functions.invoke("check-subscription", {
          headers: {
            Authorization: `Bearer ${currentSession.access_token}`,
          },
        });
      }

      // Get profile data
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscribed, questions_used")
        .eq("user_id", session.user.id)
        .single();

      if (profile) {
        setState({
          subscribed: profile.subscribed,
          questionsUsed: profile.questions_used,
          questionsRemaining: profile.subscribed ? null : FREE_QUESTION_LIMIT - profile.questions_used,
          loading: false,
        });
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const incrementUsage = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("increment-usage");
      
      if (error) {
        console.error("Error incrementing usage:", error);
        return false;
      }

      if (!data.allowed) {
        setState((prev) => ({
          ...prev,
          questionsUsed: data.questions_used,
          questionsRemaining: 0,
        }));
        return false;
      }

      setState((prev) => ({
        ...prev,
        questionsUsed: data.questions_used,
        questionsRemaining: data.subscribed ? null : data.questions_remaining,
        subscribed: data.subscribed,
      }));

      return true;
    } catch (error) {
      console.error("Error incrementing usage:", error);
      return false;
    }
  }, []);

  const openCheckout = useCallback(async () => {
    try {
      console.log("Opening checkout...");
      
      // Check if user is authenticated first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Please sign in first to upgrade to Pro");
        return;
      }
      
      console.log("Session found, calling function...");
      
      const response = await supabase.functions.invoke("create-checkout", {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log("Full response:", response);
      
      if (response.error) {
        console.error("Checkout error details:", response.error);
        console.error("Error message:", response.error.message);
        console.error("Error context:", response.error.context);
        alert(`Checkout failed: ${response.error.message || 'Unknown error'}. Check Supabase Edge Function logs for details.`);
        return;
      }
      
      const { data, error } = response;
      
      if (error) {
        console.error("Response error:", error);
        throw error;
      }
      
      if (data?.error) {
        console.error("Server error:", data.error);
        alert(`Server error: ${data.error}`);
        return;
      }
      
      if (data?.url) {
        console.log("Redirecting to:", data.url);
        window.location.href = data.url;
      } else {
        console.error("No checkout URL received:", data);
        alert("No checkout URL received. Check Supabase logs.");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      alert("Unable to open checkout. Please check console and Supabase logs.");
    }
  }, []);

  const openCustomerPortal = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error opening customer portal:", error);
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const canUseFeature = state.subscribed || (state.questionsRemaining !== null && state.questionsRemaining > 0);

  return {
    ...state,
    canUseFeature,
    checkSubscription,
    incrementUsage,
    openCheckout,
    openCustomerPortal,
  };
}
