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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_conversations: {
        Row: {
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          risk_level: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          risk_level?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          risk_level?: string | null
        }
        Relationships: []
      }
      compliance_reports: {
        Row: {
          ai_analysis: string | null
          created_at: string | null
          generated_by: string | null
          id: string
          period_end: string
          period_start: string
          report_data: Json | null
          report_type: string
          sent_at: string | null
          summary_text: string | null
          title: string
        }
        Insert: {
          ai_analysis?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          period_end: string
          period_start: string
          report_data?: Json | null
          report_type: string
          sent_at?: string | null
          summary_text?: string | null
          title: string
        }
        Update: {
          ai_analysis?: string | null
          created_at?: string | null
          generated_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          report_data?: Json | null
          report_type?: string
          sent_at?: string | null
          summary_text?: string | null
          title?: string
        }
        Relationships: []
      }
      compliance_scores: {
        Row: {
          avg_delay_days: number | null
          calculated_at: string | null
          created_at: string | null
          id: string
          late_items: number | null
          on_time_items: number | null
          period_end: string
          period_start: string
          period_type: string
          reference_id: string
          reference_name: string | null
          score: number
          score_type: string
          total_items: number | null
        }
        Insert: {
          avg_delay_days?: number | null
          calculated_at?: string | null
          created_at?: string | null
          id?: string
          late_items?: number | null
          on_time_items?: number | null
          period_end: string
          period_start: string
          period_type: string
          reference_id: string
          reference_name?: string | null
          score?: number
          score_type: string
          total_items?: number | null
        }
        Update: {
          avg_delay_days?: number | null
          calculated_at?: string | null
          created_at?: string | null
          id?: string
          late_items?: number | null
          on_time_items?: number | null
          period_end?: string
          period_start?: string
          period_type?: string
          reference_id?: string
          reference_name?: string | null
          score?: number
          score_type?: string
          total_items?: number | null
        }
        Relationships: []
      }
      conversation_logs: {
        Row: {
          bot_response: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          platform: string
          ref_number: string
          user_identifier: string | null
          user_message: string | null
        }
        Insert: {
          bot_response?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          platform: string
          ref_number: string
          user_identifier?: string | null
          user_message?: string | null
        }
        Update: {
          bot_response?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          platform?: string
          ref_number?: string
          user_identifier?: string | null
          user_message?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          manager_user_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          manager_user_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          manager_user_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          key: string
          last_tested_at: string | null
          name: string
          test_result: Json | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          last_tested_at?: string | null
          name: string
          test_result?: Json | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          last_tested_at?: string | null
          name?: string
          test_result?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      item_recipients: {
        Row: {
          created_at: string
          id: string
          item_id: string
          recipient_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          recipient_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_recipients_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_recipients_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      item_status_log: {
        Row: {
          changed_at: string
          changed_by_user_id: string | null
          channel: string | null
          id: string
          item_id: string
          metadata: Json | null
          new_status: string
          old_status: string | null
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by_user_id?: string | null
          channel?: string | null
          id?: string
          item_id: string
          metadata?: Json | null
          new_status: string
          old_status?: string | null
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by_user_id?: string | null
          channel?: string | null
          id?: string
          item_id?: string
          metadata?: Json | null
          new_status?: string
          old_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_status_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          attachment_url: string | null
          category_id: string | null
          created_at: string
          created_by_user_id: string | null
          department_id: string | null
          expiry_date: string
          expiry_time: string | null
          id: string
          is_recurring: boolean
          notes: string | null
          owner_department: string | null
          parent_item_id: string | null
          ref_number: string | null
          reminder_rule_id: string | null
          responsible_person: string | null
          status: Database["public"]["Enums"]["item_status"]
          title: string
          updated_at: string
          workflow_status: Database["public"]["Enums"]["item_workflow_status"]
        }
        Insert: {
          attachment_url?: string | null
          category_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          department_id?: string | null
          expiry_date: string
          expiry_time?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string | null
          owner_department?: string | null
          parent_item_id?: string | null
          ref_number?: string | null
          reminder_rule_id?: string | null
          responsible_person?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          title: string
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["item_workflow_status"]
        }
        Update: {
          attachment_url?: string | null
          category_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          department_id?: string | null
          expiry_date?: string
          expiry_time?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string | null
          owner_department?: string | null
          parent_item_id?: string | null
          ref_number?: string | null
          reminder_rule_id?: string | null
          responsible_person?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          title?: string
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["item_workflow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_reminder_rule_id_fkey"
            columns: ["reminder_rule_id"]
            isOneToOne: false
            referencedRelation: "reminder_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          id: string
          ip_address: string | null
          logged_in_at: string
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          created_at: string
          delay_reason: string | null
          error_message: string | null
          escalated_to_admin_at: string | null
          escalated_to_supervisor_at: string | null
          escalation_status: string | null
          id: string
          item_id: string
          provider_message_id: string | null
          recipient_id: string
          reminder_day: number
          scheduled_for: string
          seen_at: string | null
          seen_by_user_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
        }
        Insert: {
          created_at?: string
          delay_reason?: string | null
          error_message?: string | null
          escalated_to_admin_at?: string | null
          escalated_to_supervisor_at?: string | null
          escalation_status?: string | null
          id?: string
          item_id: string
          provider_message_id?: string | null
          recipient_id: string
          reminder_day: number
          scheduled_for: string
          seen_at?: string | null
          seen_by_user_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
        }
        Update: {
          created_at?: string
          delay_reason?: string | null
          error_message?: string | null
          escalated_to_admin_at?: string | null
          escalated_to_supervisor_at?: string | null
          escalation_status?: string | null
          id?: string
          item_id?: string
          provider_message_id?: string | null
          recipient_id?: string
          reminder_day?: number
          scheduled_for?: string
          seen_at?: string | null
          seen_by_user_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          telegram_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          telegram_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          telegram_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recipients: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          telegram_id: string | null
          whatsapp_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          telegram_id?: string | null
          whatsapp_number: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          telegram_id?: string | null
          whatsapp_number?: string
        }
        Relationships: []
      }
      reminder_rules: {
        Row: {
          created_at: string
          days_before: number[]
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          days_before?: number[]
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          days_before?: number[]
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          id: string
          lockout_duration_minutes: number
          max_login_attempts: number
          password_min_length: number
          require_2fa: boolean
          session_timeout_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          lockout_duration_minutes?: number
          max_login_attempts?: number
          password_min_length?: number
          require_2fa?: boolean
          session_timeout_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          lockout_duration_minutes?: number
          max_login_attempts?: number
          password_min_length?: number
          require_2fa?: boolean
          session_timeout_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          supervisor_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          supervisor_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          supervisor_id?: string
        }
        Relationships: []
      }
      user_department_scopes: {
        Row: {
          can_cross_view_only: boolean
          created_at: string
          department_id: string
          id: string
          scope_type: string
          user_id: string
        }
        Insert: {
          can_cross_view_only?: boolean
          created_at?: string
          department_id: string
          id?: string
          scope_type?: string
          user_id: string
        }
        Update: {
          can_cross_view_only?: boolean
          created_at?: string
          department_id?: string
          id?: string
          scope_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_department_scopes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
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
      can_view_department: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
      get_team_member_ids: {
        Args: { _supervisor_id: string }
        Returns: string[]
      }
      get_user_department_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_higher: { Args: { _user_id: string }; Returns: boolean }
      is_department_manager: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
      is_supervisor_of: {
        Args: { _employee_id: string; _supervisor_id: string }
        Returns: boolean
      }
      is_supervisor_or_higher: { Args: { _user_id: string }; Returns: boolean }
      is_system_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "hr_user" | "system_admin" | "supervisor" | "employee"
      item_status: "active" | "expired" | "archived"
      item_workflow_status:
        | "new"
        | "acknowledged"
        | "in_progress"
        | "done_pending_supervisor"
        | "returned"
        | "escalated_to_manager"
        | "finished"
      notification_status: "pending" | "sent" | "failed" | "skipped"
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
      app_role: ["admin", "hr_user", "system_admin", "supervisor", "employee"],
      item_status: ["active", "expired", "archived"],
      item_workflow_status: [
        "new",
        "acknowledged",
        "in_progress",
        "done_pending_supervisor",
        "returned",
        "escalated_to_manager",
        "finished",
      ],
      notification_status: ["pending", "sent", "failed", "skipped"],
    },
  },
} as const
