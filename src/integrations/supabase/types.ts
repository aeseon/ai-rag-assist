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
      analysis_issues: {
        Row: {
          analysis_result_id: string | null
          category: string
          created_at: string | null
          description: string
          id: string
          location: string | null
          regulation: string | null
          regulation_highlight: string | null
          severity: string
          submission_highlight: string | null
          suggestion: string | null
          title: string
        }
        Insert: {
          analysis_result_id?: string | null
          category: string
          created_at?: string | null
          description: string
          id?: string
          location?: string | null
          regulation?: string | null
          regulation_highlight?: string | null
          severity: string
          submission_highlight?: string | null
          suggestion?: string | null
          title: string
        }
        Update: {
          analysis_result_id?: string | null
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          location?: string | null
          regulation?: string | null
          regulation_highlight?: string | null
          severity?: string
          submission_highlight?: string | null
          suggestion?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_issues_analysis_result_id_fkey"
            columns: ["analysis_result_id"]
            isOneToOne: false
            referencedRelation: "analysis_results"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_results: {
        Row: {
          created_at: string | null
          id: string
          overall_status: string
          submission_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          overall_status: string
          submission_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          overall_status?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_results_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      regulation_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          regulation_id: string | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          regulation_id?: string | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          regulation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulation_chunks_regulation_id_fkey"
            columns: ["regulation_id"]
            isOneToOne: false
            referencedRelation: "regulations"
            referencedColumns: ["id"]
          },
        ]
      }
      regulations: {
        Row: {
          category: string
          created_at: string
          description: string | null
          effective_date: string | null
          file_path: string
          file_size: number | null
          id: string
          status: string | null
          title: string
          updated_at: string
          uploaded_by: string
          version: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          effective_date?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          status?: string | null
          title: string
          updated_at?: string
          uploaded_by: string
          version?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          effective_date?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          status?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string
          version?: string | null
        }
        Relationships: []
      }
      submission_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          submission_id: string | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          submission_id?: string | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submission_chunks_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          created_at: string | null
          file_path: string
          file_size: number
          id: string
          status: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_path: string
          file_size: number
          id?: string
          status?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_path?: string
          file_size?: number
          id?: string
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      search_similar_regulations: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          regulation_id: string
          similarity: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "reviewer" | "user"
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
    Enums: {
      app_role: ["admin", "reviewer", "user"],
    },
  },
} as const
