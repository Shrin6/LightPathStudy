import { supabase } from "@/integrations/supabase/client";

export type LearningEventType = 
  | "QUIZ_RIGHT" 
  | "QUIZ_WRONG" 
  | "PROOF_GOT_IT" 
  | "PROOF_NOT_SURE" 
  | "PROOF_CHECK_ME"
  | "REPORT";

export interface LearningEventPayload {
  question?: string;
  correctAnswer?: number | string;
  selectedAnswer?: number | string;
  explanation?: string;
  options?: string[];
  lastUserMessage?: string;
  lastTutorAnswer?: string;
  reportReason?: string;
}

export async function insertLearningEvent(
  collectionId: string | null,
  eventType: LearningEventType,
  concept: string | null,
  payload: LearningEventPayload
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !collectionId) return false;

    const { error } = await supabase.from("learning_events").insert({
      user_id: user.id,
      collection_id: collectionId,
      event_type: eventType,
      concept,
      payload: payload as any,
    });

    if (error) {
      console.error("Error inserting learning event:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Error in insertLearningEvent:", e);
    return false;
  }
}
