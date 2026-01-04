import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Auto-fix hook that detects and repairs common profile issues:
 * - Missing profile row
 * - Missing subscription data
 * - Corrupted profile fields
 */
export function useProfileAutoFix() {
  const hasRun = useRef(false);

  useEffect(() => {
    // Only run once per session
    if (hasRun.current) return;
    hasRun.current = true;

    const checkAndFixProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const userId = session.user.id;
        console.log('[AUTO-FIX] Checking profile for user:', userId);

        // Try to get profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        // Issue 1: Profile doesn't exist
        if (!profile || profileError?.code === 'PGRST116') {
          console.log('[AUTO-FIX] Profile missing, creating...');
          
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: crypto.randomUUID(),
              user_id: userId,
              subscribed: false,
              questions_used: 0,
              alpha_activated: false,
            })
            .select()
            .single();

          if (createError) {
            console.error('[AUTO-FIX] Failed to create profile:', createError);
            return;
          }

          console.log('[AUTO-FIX] Profile created:', newProfile);
          return;
        }

        // Issue 2: Check for data integrity issues
        const needsUpdate: Record<string, any> = {};

        // Ensure questions_used is a valid number
        if (typeof profile.questions_used !== 'number' || profile.questions_used < 0) {
          needsUpdate.questions_used = 0;
          console.log('[AUTO-FIX] Fixed questions_used');
        }

        // Ensure subscribed is a boolean
        if (typeof profile.subscribed !== 'boolean') {
          needsUpdate.subscribed = false;
          console.log('[AUTO-FIX] Fixed subscribed field');
        }

        // If subscribed but no end date, set it to 1 month from now
        if (profile.subscribed && !profile.subscription_end) {
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 1);
          needsUpdate.subscription_end = endDate.toISOString();
          console.log('[AUTO-FIX] Added missing subscription_end date');
        }

        // If subscription ended, update subscribed status
        if (profile.subscription_end && new Date(profile.subscription_end) < new Date()) {
          needsUpdate.subscribed = false;
          needsUpdate.subscription_end = null;
          console.log('[AUTO-FIX] Expired subscription detected, updated status');
        }

        // Apply fixes if needed
        if (Object.keys(needsUpdate).length > 0) {
          console.log('[AUTO-FIX] Applying updates:', needsUpdate);
          
          const { error: updateError } = await supabase
            .from('profiles')
            .update(needsUpdate)
            .eq('user_id', userId);

          if (updateError) {
            console.error('[AUTO-FIX] Failed to update profile:', updateError);
          } else {
            console.log('[AUTO-FIX] Profile fixed successfully');
          }
        } else {
          console.log('[AUTO-FIX] Profile is healthy, no fixes needed');
        }

      } catch (error) {
        console.error('[AUTO-FIX] Unexpected error:', error);
      }
    };

    // Run check after a short delay to allow other auth checks to complete
    const timer = setTimeout(checkAndFixProfile, 1000);
    return () => clearTimeout(timer);
  }, []);
}
