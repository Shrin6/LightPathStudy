import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const FREE_QUESTION_LIMIT = 20;

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
      await supabase.functions.invoke("check-subscription");

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
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
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
