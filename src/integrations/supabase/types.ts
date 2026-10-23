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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          current_outfit_id: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_outfit_id?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_outfit_id?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_current_outfit_id_fkey"
            columns: ["current_outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          action: string
          colors: string[]
          created_at: string
          id: string
          item_ids: string[]
          outfit_id: string | null
          slot: string | null
          user_id: string
        }
        Insert: {
          action: string
          colors?: string[]
          created_at?: string
          id?: string
          item_ids?: string[]
          outfit_id?: string | null
          slot?: string | null
          user_id: string
        }
        Update: {
          action?: string
          colors?: string[]
          created_at?: string
          id?: string
          item_ids?: string[]
          outfit_id?: string | null
          slot?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          mode: string | null
          outfit_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          mode?: string | null
          outfit_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          mode?: string | null
          outfit_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_items: {
        Row: {
          item_id: string
          outfit_id: string
          slot: string
          user_id: string
        }
        Insert: {
          item_id: string
          outfit_id: string
          slot: string
          user_id: string
        }
        Update: {
          item_id?: string
          outfit_id?: string
          slot?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfit_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "wardrobe_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfit_items_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      outfits: {
        Row: {
          created_at: string
          explanation: string
          id: string
          mood: string | null
          occasion: string
          parent_outfit_id: string | null
          piece_count: number
          score: number
          signature: string
          source: string
          status: string
          user_id: string
          weather: Json | null
          worn_at: string | null
        }
        Insert: {
          created_at?: string
          explanation?: string
          id?: string
          mood?: string | null
          occasion: string
          parent_outfit_id?: string | null
          piece_count?: number
          score?: number
          signature: string
          source?: string
          status?: string
          user_id: string
          weather?: Json | null
          worn_at?: string | null
        }
        Update: {
          created_at?: string
          explanation?: string
          id?: string
          mood?: string | null
          occasion?: string
          parent_outfit_id?: string | null
          piece_count?: number
          score?: number
          signature?: string
          source?: string
          status?: string
          user_id?: string
          weather?: Json | null
          worn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outfits_parent_outfit_id_fkey"
            columns: ["parent_outfit_id"]
            isOneToOne: false
            referencedRelation: "outfits"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avoided_colors: string[]
          comfort_notes: string | null
          created_at: string
          display_name: string | null
          favorite_colors: string[]
          id: string
          onboarded: boolean
          preferred_fits: string[]
          preferred_styles: string[]
          sizes: Json
          typical_occasions: string[]
          updated_at: string
          weather_city: string | null
          weather_enabled: boolean
        }
        Insert: {
          avoided_colors?: string[]
          comfort_notes?: string | null
          created_at?: string
          display_name?: string | null
          favorite_colors?: string[]
          id: string
          onboarded?: boolean
          preferred_fits?: string[]
          preferred_styles?: string[]
          sizes?: Json
          typical_occasions?: string[]
          updated_at?: string
          weather_city?: string | null
          weather_enabled?: boolean
        }
        Update: {
          avoided_colors?: string[]
          comfort_notes?: string | null
          created_at?: string
          display_name?: string | null
          favorite_colors?: string[]
          id?: string
          onboarded?: boolean
          preferred_fits?: string[]
          preferred_styles?: string[]
          sizes?: Json
          typical_occasions?: string[]
          updated_at?: string
          weather_city?: string | null
          weather_enabled?: boolean
        }
        Relationships: []
      }
      tryon_looks: {
        Row: {
          created_at: string
          description: string
          garment_path: string | null
          id: string
          occasion: string | null
          parent_id: string | null
          person_path: string
          reported: boolean
          result_path: string
          saved: boolean
          styling: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          garment_path?: string | null
          id?: string
          occasion?: string | null
          parent_id?: string | null
          person_path: string
          reported?: boolean
          result_path: string
          saved?: boolean
          styling?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          garment_path?: string | null
          id?: string
          occasion?: string | null
          parent_id?: string | null
          person_path?: string
          reported?: boolean
          result_path?: string
          saved?: boolean
          styling?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tryon_looks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tryon_looks"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_models: {
        Row: {
          consent_at: string | null
          onboarding_done: boolean
          photo_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_at?: string | null
          onboarding_done?: boolean
          photo_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_at?: string | null
          onboarding_done?: boolean
          photo_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wardrobe_items: {
        Row: {
          ai_colors: Json
          ai_outfit_suggestions: Json
          brand: string | null
          category: string
          created_at: string
          fit: string | null
          id: string
          image_path: string | null
          is_sample: boolean
          main_color: string | null
          name: string
          notes: string | null
          pattern: string | null
          sample_key: string | null
          seasons: string[]
          secondary_colors: string[]
          style: string | null
          subcategory: string | null
          user_id: string
        }
        Insert: {
          ai_colors?: Json
          ai_outfit_suggestions?: Json
          brand?: string | null
          category: string
          created_at?: string
          fit?: string | null
          id?: string
          image_path?: string | null
          is_sample?: boolean
          main_color?: string | null
          name: string
          notes?: string | null
          pattern?: string | null
          sample_key?: string | null
          seasons?: string[]
          secondary_colors?: string[]
          style?: string | null
          subcategory?: string | null
          user_id: string
        }
        Update: {
          ai_colors?: Json
          ai_outfit_suggestions?: Json
          brand?: string | null
          category?: string
          created_at?: string
          fit?: string | null
          id?: string
          image_path?: string | null
          is_sample?: boolean
          main_color?: string | null
          name?: string
          notes?: string | null
          pattern?: string | null
          sample_key?: string | null
          seasons?: string[]
          secondary_colors?: string[]
          style?: string | null
          subcategory?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
