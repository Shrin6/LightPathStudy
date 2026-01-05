export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alpha_keys: {
        Row: {
          created_at: string
          id: string
          key: string
          status: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          status?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          status?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          request_count: number | null
          updated_at: string | null
          user_id: string
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          request_count?: number | null
          updated_at?: string | null
          user_id: string
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          request_count?: number | null
          updated_at?: string | null
          user_id?: string
          window_start?: string | null
        }
        Relationships: []
      }
      collections: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          collection_id: string | null
          comment: string | null
          created_at: string
          feature: string
          id: string
          payload: Json
          reason: string
          status: string
          user_id: string
        }
        Insert: {
          collection_id?: string | null
          comment?: string | null
          created_at?: string
          feature: string
          id?: string
          payload?: Json
          reason: string
          status?: string
          user_id: string
        }
        Update: {
          collection_id?: string | null
          comment?: string | null
          created_at?: string
          feature?: string
          id?: string
          payload?: Json
          reason?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          collection_id: string
          created_at: string | null
          embedding: string | null
          file_id: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          collection_id: string
          created_at?: string | null
          embedding?: string | null
          file_id: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          collection_id?: string
          created_at?: string | null
          embedding?: string | null
          file_id?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcards: {
        Row: {
          back: string
          back_color: string | null
          collection_id: string
          created_at: string | null
          front: string
          front_color: string | null
          id: string
          is_custom: boolean | null
          last_reviewed: string | null
          mastery_level: number | null
          user_id: string
        }
        Insert: {
          back: string
          back_color?: string | null
          collection_id: string
          created_at?: string | null
          front: string
          front_color?: string | null
          id?: string
          is_custom?: boolean | null
          last_reviewed?: string | null
          mastery_level?: number | null
          user_id: string
        }
        Update: {
          back?: string
          back_color?: string | null
          collection_id?: string
          created_at?: string | null
          front?: string
          front_color?: string | null
          id?: string
          is_custom?: boolean | null
          last_reviewed?: string | null
          mastery_level?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_events: {
        Row: {
          collection_id: string | null
          concept: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          user_id: string
        }
        Insert: {
          collection_id?: string | null
          concept?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          user_id: string
        }
        Update: {
          collection_id?: string | null
          concept?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_events_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          alpha_activated: boolean
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          questions_used: number
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alpha_activated?: boolean
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          questions_used?: number
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alpha_activated?: boolean
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          questions_used?: number
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_sessions: {
        Row: {
          collection_id: string
          created_at: string | null
          current_index: number | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          is_completed: boolean | null
          mode: string
          progress_percentage: number | null
          session_data: Json
          started_at: string
          total_items: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string | null
          current_index?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_completed?: boolean | null
          mode: string
          progress_percentage?: number | null
          session_data?: Json
          started_at?: string
          total_items?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string | null
          current_index?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_completed?: boolean | null
          mode?: string
          progress_percentage?: number | null
          session_data?: Json
          started_at?: string
          total_items?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_sessions_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          collection_id: string | null
          conversation_history: Json | null
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          mode: string
          started_at: string | null
          time_spent_minutes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          collection_id?: string | null
          conversation_history?: Json | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          mode: string
          started_at?: string | null
          time_spent_minutes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          collection_id?: string | null
          conversation_history?: Json | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          mode?: string
          started_at?: string | null
          time_spent_minutes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_files: {
        Row: {
          collection_id: string
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          parsed_content: string | null
          processing: boolean | null
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          parsed_content?: string | null
          processing?: boolean | null
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          parsed_content?: string | null
          processing?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_files_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_alpha_key: { Args: { submitted_key: string }; Returns: Json }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_max_requests: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: boolean
      }
      increment_questions_used: {
        Args: { p_amount?: number; p_user_id: string }
        Returns: number
      }
      match_document_chunks: {
        Args: {
          match_collection_id: string
          match_count?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          file_id: string
          id: string
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
