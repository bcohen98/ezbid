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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      company_profiles: {
        Row: {
          brand_color: string | null
          city: string | null
          company_name: string | null
          created_at: string
          default_deposit_percentage: number | null
          default_disclosures: string | null
          default_payment_terms: string | null
          default_warranty: string | null
          email: string | null
          id: string
          insurance_info: string | null
          license_numbers: string[] | null
          logo_url: string | null
          owner_name: string | null
          phone: string | null
          state: string | null
          street_address: string | null
          trade_type: Database["public"]["Enums"]["trade_type"] | null
          updated_at: string
          user_id: string
          website: string | null
          zip: string | null
        }
        Insert: {
          brand_color?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          default_deposit_percentage?: number | null
          default_disclosures?: string | null
          default_payment_terms?: string | null
          default_warranty?: string | null
          email?: string | null
          id?: string
          insurance_info?: string | null
          license_numbers?: string[] | null
          logo_url?: string | null
          owner_name?: string | null
          phone?: string | null
          state?: string | null
          street_address?: string | null
          trade_type?: Database["public"]["Enums"]["trade_type"] | null
          updated_at?: string
          user_id: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          brand_color?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          default_deposit_percentage?: number | null
          default_disclosures?: string | null
          default_payment_terms?: string | null
          default_warranty?: string | null
          email?: string | null
          id?: string
          insurance_info?: string | null
          license_numbers?: string[] | null
          logo_url?: string | null
          owner_name?: string | null
          phone?: string | null
          state?: string | null
          street_address?: string | null
          trade_type?: Database["public"]["Enums"]["trade_type"] | null
          updated_at?: string
          user_id?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      proposal_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          proposal_id: string
          quantity: number
          sort_order: number
          subtotal: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          proposal_id: string
          quantity?: number
          sort_order?: number
          subtotal?: number
          unit?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          proposal_id?: string
          quantity?: number
          sort_order?: number
          subtotal?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_line_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          accepted_payment_methods: string[] | null
          balance_due: number | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          client_signature_url: string | null
          client_signed_at: string | null
          created_at: string
          delivery_method: string | null
          deposit_amount: number | null
          deposit_mode: Database["public"]["Enums"]["deposit_mode"] | null
          deposit_value: number | null
          disclosures: string | null
          enhanced_job_description: string | null
          enhanced_scope_of_work: string | null
          estimated_duration: string | null
          estimated_start_date: string | null
          id: string
          job_description: string | null
          job_site_city: string | null
          job_site_state: string | null
          job_site_street: string | null
          job_site_zip: string | null
          materials_excluded: string | null
          materials_included: string | null
          payment_terms: string | null
          pdf_url: string | null
          proposal_date: string | null
          proposal_number: number
          scope_of_work: string | null
          special_conditions: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          template: Database["public"]["Enums"]["proposal_template"]
          title: string | null
          total: number | null
          updated_at: string
          user_id: string
          valid_until: string | null
          warranty_terms: string | null
        }
        Insert: {
          accepted_payment_methods?: string[] | null
          balance_due?: number | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_signature_url?: string | null
          client_signed_at?: string | null
          created_at?: string
          delivery_method?: string | null
          deposit_amount?: number | null
          deposit_mode?: Database["public"]["Enums"]["deposit_mode"] | null
          deposit_value?: number | null
          disclosures?: string | null
          enhanced_job_description?: string | null
          enhanced_scope_of_work?: string | null
          estimated_duration?: string | null
          estimated_start_date?: string | null
          id?: string
          job_description?: string | null
          job_site_city?: string | null
          job_site_state?: string | null
          job_site_street?: string | null
          job_site_zip?: string | null
          materials_excluded?: string | null
          materials_included?: string | null
          payment_terms?: string | null
          pdf_url?: string | null
          proposal_date?: string | null
          proposal_number: number
          scope_of_work?: string | null
          special_conditions?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          template?: Database["public"]["Enums"]["proposal_template"]
          title?: string | null
          total?: number | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
          warranty_terms?: string | null
        }
        Update: {
          accepted_payment_methods?: string[] | null
          balance_due?: number | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_signature_url?: string | null
          client_signed_at?: string | null
          created_at?: string
          delivery_method?: string | null
          deposit_amount?: number | null
          deposit_mode?: Database["public"]["Enums"]["deposit_mode"] | null
          deposit_value?: number | null
          disclosures?: string | null
          enhanced_job_description?: string | null
          enhanced_scope_of_work?: string | null
          estimated_duration?: string | null
          estimated_start_date?: string | null
          id?: string
          job_description?: string | null
          job_site_city?: string | null
          job_site_state?: string | null
          job_site_street?: string | null
          job_site_zip?: string | null
          materials_excluded?: string | null
          materials_included?: string | null
          payment_terms?: string | null
          pdf_url?: string | null
          proposal_date?: string | null
          proposal_number?: number
          scope_of_work?: string | null
          special_conditions?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          template?: Database["public"]["Enums"]["proposal_template"]
          title?: string | null
          total?: number | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
          warranty_terms?: string | null
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          proposals_used: number
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          proposals_used?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          proposals_used?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_next_proposal_number: { Args: { p_user_id: string }; Returns: number }
    }
    Enums: {
      deposit_mode: "percentage" | "flat"
      proposal_status: "draft" | "sent" | "signed" | "expired"
      proposal_template: "classic" | "modern" | "minimal" | "bold" | "executive"
      trade_type:
        | "general_contractor"
        | "roofing"
        | "plumbing"
        | "hvac"
        | "electrical"
        | "landscaping"
        | "painting"
        | "flooring"
        | "other"
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
      deposit_mode: ["percentage", "flat"],
      proposal_status: ["draft", "sent", "signed", "expired"],
      proposal_template: ["classic", "modern", "minimal", "bold", "executive"],
      trade_type: [
        "general_contractor",
        "roofing",
        "plumbing",
        "hvac",
        "electrical",
        "landscaping",
        "painting",
        "flooring",
        "other",
      ],
    },
  },
} as const
