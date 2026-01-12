import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to ensure a user profile exists for the current authenticated user.
 * Creates a profile if one doesn't exist (handles edge cases like OAuth signups
 * where the trigger might not have fired).
 */
export const useProfileAutoFix = () => {
  const [isFixing, setIsFixing] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    const ensureProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setProfileReady(false);
        return;
      }

      const userId = session.user.id;

      // Check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error checking profile:', fetchError);
        setProfileReady(false);
        return;
      }

      if (existingProfile) {
        // Profile exists, we're good
        setProfileReady(true);
        return;
      }

      // Profile doesn't exist, create one
      setIsFixing(true);
      console.log('Creating missing profile for user:', userId);

      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          user_id: userId,
          subscribed: false,
          questions_used: 0,
          alpha_activated: false,
        });

      if (insertError) {
        // Check if it's a unique constraint error (profile was created by trigger in the meantime)
        if (insertError.code === '23505') {
          console.log('Profile already exists (race condition handled)');
          setProfileReady(true);
        } else {
          console.error('Error creating profile:', insertError);
          setProfileReady(false);
        }
      } else {
        console.log('Profile created successfully');
        setProfileReady(true);
      }

      setIsFixing(false);
    };

    ensureProfile();

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        ensureProfile();
      } else if (event === 'SIGNED_OUT') {
        setProfileReady(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { isFixing, profileReady };
};
