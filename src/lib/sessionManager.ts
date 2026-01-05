import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SavedSessionData = Record<string, any>;

export interface SaveSessionParams {
  userId: string;
  collectionId: string;
  mode: 'quiz' | 'worksheet' | 'flashcards' | 'notes';
  sessionData: SavedSessionData;
  progressPercentage: number;
  currentIndex?: number;
  totalItems?: number;
  durationSeconds?: number;
  isCompleted?: boolean;
}

/**
 * Save session to database for auto-save functionality
 */
export async function saveSession(params: SaveSessionParams) {
  try {
    const {
      userId,
      collectionId,
      mode,
      sessionData,
      progressPercentage,
      currentIndex = 0,
      totalItems = 0,
      durationSeconds = 0,
      isCompleted = false,
    } = params;

    const { data, error } = await supabase
      .from('saved_sessions')
      .insert({
        user_id: userId,
        collection_id: collectionId,
        mode,
        session_data: sessionData,
        progress_percentage: Math.min(100, Math.max(0, progressPercentage)),
        current_index: currentIndex,
        total_items: totalItems,
        duration_seconds: durationSeconds,
        is_completed: isCompleted,
      } as any)
      .select()
      .single();

    if (error) {
      console.error('Error saving session:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to save session:', error);
    return null;
  }
}

/**
 * Update existing session (for auto-save)
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<SaveSessionParams & { ended_at?: string }>
) {
  try {
    const updateData: any = {};

    if (updates.sessionData) updateData.session_data = updates.sessionData;
    if (updates.progressPercentage !== undefined)
      updateData.progress_percentage = Math.min(100, Math.max(0, updates.progressPercentage));
    if (updates.currentIndex !== undefined) updateData.current_index = updates.currentIndex;
    if (updates.totalItems !== undefined) updateData.total_items = updates.totalItems;
    if (updates.durationSeconds !== undefined)
      updateData.duration_seconds = updates.durationSeconds;
    if (updates.isCompleted !== undefined) updateData.is_completed = updates.isCompleted;
    if (updates.ended_at !== undefined) updateData.ended_at = updates.ended_at;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('saved_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating session:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to update session:', error);
    return null;
  }
}

/**
 * Get incomplete sessions for a user
 */
export async function getIncompleteSessions(
  userId: string,
  collectionId?: string,
  mode?: string
) {
  try {
    let query = supabase
      .from('saved_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('updated_at', { ascending: false });

    if (collectionId) {
      query = query.eq('collection_id', collectionId);
    }

    if (mode) {
      query = query.eq('mode', mode);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching incomplete sessions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch incomplete sessions:', error);
    return [];
  }
}

/**
 * Delete a saved session
 */
export async function deleteSession(sessionId: string) {
  try {
    const { error } = await supabase
      .from('saved_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('Error deleting session:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete session:', error);
    return false;
  }
}

/**
 * Get session by ID
 */
export async function getSessionById(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from('saved_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error('Error fetching session:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch session:', error);
    return null;
  }
}

/**
 * Get total time spent on a collection
 */
export async function getTotalTimeSpent(userId: string, collectionId: string) {
  try {
    const { data, error } = await supabase
      .from('study_sessions')
      .select('duration_seconds')
      .eq('user_id', userId)
      .eq('collection_id', collectionId)
      .not('duration_seconds', 'is', null);

    // If error is about missing column, return 0 (migration not run yet)
    if (error && error.message && error.message.includes('does not exist')) {
      console.warn('⚠️ Database migration not applied: duration_seconds column missing. Run: supabase db push');
      return 0;
    }

    if (error) {
      console.error('Error fetching time spent:', error);
      return 0;
    }

    const totalSeconds = data?.reduce((sum, session) => sum + (session.duration_seconds || 0), 0) || 0;
    return totalSeconds;
  } catch (error) {
    console.error('Failed to fetch time spent:', error);
    return 0;
  }
}

/**
 * Convert seconds to minutes for display
 */
export function secondsToMinutes(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
