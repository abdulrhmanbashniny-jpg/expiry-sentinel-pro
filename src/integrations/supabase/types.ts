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
      ai_agent_configs: {
        Row: {
          agent_key: string
          allowed_tools: string[] | null
          config: Json | null
          created_at: string | null
          data_access_scope: string[] | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          priority: number | null
          system_prompt: string | null
          updated_at: string | null
        }
        Insert: {
          agent_key: string
          allowed_tools?: string[] | null
          config?: Json | null
          created_at?: string | null
          data_access_scope?: string[] | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          priority?: number | null
          system_prompt?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_key?: string
          allowed_tools?: string[] | null
          config?: Json | null
          created_at?: string | null
          data_access_scope?: string[] | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          priority?: number | null
          system_prompt?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_prompts: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          prompt_key: string
          prompt_text: string
          system_memory: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          prompt_key: string
          prompt_text: string
          system_memory?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          prompt_key?: string
          prompt_text?: string
          system_memory?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      ai_provider_settings: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          is_active: boolean
          is_fallback: boolean
          is_primary: boolean
          last_reset_at: string | null
          priority: number
          provider_name: string
          updated_at: string
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_fallback?: boolean
          is_primary?: boolean
          last_reset_at?: string | null
          priority?: number
          provider_name: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_fallback?: boolean
          is_primary?: boolean
          last_reset_at?: string | null
          priority?: number
          provider_name?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          input_tokens: number | null
          output_tokens: number | null
          prompt_key: string | null
          provider_name: string
          response_time_ms: number | null
          success: boolean
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          prompt_key?: string | null
          provider_name: string
          response_time_ms?: number | null
          success?: boolean
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          prompt_key?: string | null
          provider_name?: string
          response_time_ms?: number | null
          success?: boolean
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          items_failed: number | null
          items_processed: number | null
          items_success: number | null
          job_type: string
          metadata: Json | null
          results: Json | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          items_success?: number | null
          job_type: string
          metadata?: Json | null
          results?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          items_failed?: number | null
          items_processed?: number | null
          items_success?: number | null
          job_type?: string
          metadata?: Json | null
          results?: Json | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          code: string | null
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          name: string
          risk_level: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name: string
          risk_level?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name?: string
          risk_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
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
      delegation_audit_log: {
        Row: {
          action: string
          created_at: string
          delegation_id: string
          details: Json | null
          id: string
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          delegation_id: string
          details?: Json | null
          id?: string
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          delegation_id?: string
          details?: Json | null
          id?: string
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegation_audit_log_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "delegations"
            referencedColumns: ["id"]
          },
        ]
      }
      delegations: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          delegate_id: string
          delegator_id: string
          from_datetime: string
          id: string
          reason: string | null
          rejected_at: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["delegation_status"]
          to_datetime: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          delegate_id: string
          delegator_id: string
          from_datetime: string
          id?: string
          reason?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["delegation_status"]
          to_datetime: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          delegate_id?: string
          delegator_id?: string
          from_datetime?: string
          id?: string
          reason?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["delegation_status"]
          to_datetime?: string
          updated_at?: string
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
      dynamic_field_definitions: {
        Row: {
          category_id: string | null
          created_at: string
          department_id: string | null
          field_key: string
          field_label: string
          field_options: Json | null
          field_type: string
          id: string
          is_required: boolean
          sort_order: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          department_id?: string | null
          field_key: string
          field_label: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_required?: boolean
          sort_order?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          department_id?: string | null
          field_key?: string
          field_label?: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "dynamic_field_definitions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dynamic_field_definitions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_answers: {
        Row: {
          choice_value: string | null
          created_at: string
          evaluation_id: string
          id: string
          numeric_value: number | null
          question_id: string
          score: number | null
          text_value: string | null
          updated_at: string
        }
        Insert: {
          choice_value?: string | null
          created_at?: string
          evaluation_id: string
          id?: string
          numeric_value?: number | null
          question_id: string
          score?: number | null
          text_value?: string | null
          updated_at?: string
        }
        Update: {
          choice_value?: string | null
          created_at?: string
          evaluation_id?: string
          id?: string
          numeric_value?: number | null
          question_id?: string
          score?: number | null
          text_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_answers_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "kpi_template_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_appeals: {
        Row: {
          appeal_text: string
          created_at: string
          deadline: string
          evaluatee_id: string
          id: string
          published_result_id: string
          responded_at: string | null
          responded_by: string | null
          response_text: string | null
          status: string
        }
        Insert: {
          appeal_text: string
          created_at?: string
          deadline: string
          evaluatee_id: string
          id?: string
          published_result_id: string
          responded_at?: string | null
          responded_by?: string | null
          response_text?: string | null
          status?: string
        }
        Update: {
          appeal_text?: string
          created_at?: string
          deadline?: string
          evaluatee_id?: string
          id?: string
          published_result_id?: string
          responded_at?: string | null
          responded_by?: string | null
          response_text?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_appeals_published_result_id_fkey"
            columns: ["published_result_id"]
            isOneToOne: false
            referencedRelation: "published_results"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          evaluation_id: string
          id: string
          new_status: string | null
          old_status: string | null
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          evaluation_id: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          evaluation_id?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_audit_log_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_cycles: {
        Row: {
          allow_360: boolean
          allow_self_assessment: boolean
          created_at: string
          created_by: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          start_date: string
          template_id: string
          updated_at: string
        }
        Insert: {
          allow_360?: boolean
          allow_self_assessment?: boolean
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          start_date: string
          template_id: string
          updated_at?: string
        }
        Update: {
          allow_360?: boolean
          allow_self_assessment?: boolean
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          start_date?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_cycles_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "kpi_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_revisions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          changes_summary: string | null
          created_at: string
          created_by: string
          evaluation_id: string
          id: string
          is_approved: boolean
          original_ai_summary: string | null
          original_score: number | null
          reason: string
          revised_ai_summary: string | null
          revised_score: number | null
          revision_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          changes_summary?: string | null
          created_at?: string
          created_by: string
          evaluation_id: string
          id?: string
          is_approved?: boolean
          original_ai_summary?: string | null
          original_score?: number | null
          reason: string
          revised_ai_summary?: string | null
          revised_score?: number | null
          revision_number?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          changes_summary?: string | null
          created_at?: string
          created_by?: string
          evaluation_id?: string
          id?: string
          is_approved?: boolean
          original_ai_summary?: string | null
          original_score?: number | null
          reason?: string
          revised_ai_summary?: string | null
          revised_score?: number | null
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_revisions_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          ai_analyzed_at: string | null
          ai_recommendations: string | null
          ai_risks: string | null
          ai_summary: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          current_revision: number | null
          cycle_id: string
          evaluatee_id: string
          evaluation_type: Database["public"]["Enums"]["evaluation_type"]
          evaluator_id: string
          id: string
          is_proxy: boolean
          proxy_by: string | null
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["evaluation_status"]
          submitted_at: string | null
          total_score: number | null
          updated_at: string
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_recommendations?: string | null
          ai_risks?: string | null
          ai_summary?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_revision?: number | null
          cycle_id: string
          evaluatee_id: string
          evaluation_type: Database["public"]["Enums"]["evaluation_type"]
          evaluator_id: string
          id?: string
          is_proxy?: boolean
          proxy_by?: string | null
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["evaluation_status"]
          submitted_at?: string | null
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_recommendations?: string | null
          ai_risks?: string | null
          ai_summary?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_revision?: number | null
          cycle_id?: string
          evaluatee_id?: string
          evaluation_type?: Database["public"]["Enums"]["evaluation_type"]
          evaluator_id?: string
          id?: string
          is_proxy?: boolean
          proxy_by?: string | null
          published_at?: string | null
          published_by?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["evaluation_status"]
          submitted_at?: string | null
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "evaluation_cycles"
            referencedColumns: ["id"]
          },
        ]
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
      item_deadlines: {
        Row: {
          created_at: string
          deadline_label: string
          deadline_type: string
          due_date: string
          id: string
          item_id: string
          last_reminder_sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline_label: string
          deadline_type: string
          due_date: string
          id?: string
          item_id: string
          last_reminder_sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline_label?: string
          deadline_type?: string
          due_date?: string
          id?: string
          item_id?: string
          last_reminder_sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_deadlines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
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
          dynamic_fields: Json | null
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
          dynamic_fields?: Json | null
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
          dynamic_fields?: Json | null
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
      kpi_template_axes: {
        Row: {
          created_at: string
          id: string
          name: string
          name_en: string | null
          sort_order: number
          template_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_en?: string | null
          sort_order?: number
          template_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_en?: string | null
          sort_order?: number
          template_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_template_axes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "kpi_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_template_questions: {
        Row: {
          answer_type: Database["public"]["Enums"]["question_answer_type"]
          axis_id: string
          choices: Json | null
          created_at: string
          id: string
          max_value: number | null
          min_value: number | null
          question_text: string
          question_text_en: string | null
          sort_order: number
          weight: number
        }
        Insert: {
          answer_type?: Database["public"]["Enums"]["question_answer_type"]
          axis_id: string
          choices?: Json | null
          created_at?: string
          id?: string
          max_value?: number | null
          min_value?: number | null
          question_text: string
          question_text_en?: string | null
          sort_order?: number
          weight?: number
        }
        Update: {
          answer_type?: Database["public"]["Enums"]["question_answer_type"]
          axis_id?: string
          choices?: Json | null
          created_at?: string
          id?: string
          max_value?: number | null
          min_value?: number | null
          question_text?: string
          question_text_en?: string | null
          sort_order?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_template_questions_axis_id_fkey"
            columns: ["axis_id"]
            isOneToOne: false
            referencedRelation: "kpi_template_axes"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          description_en: string | null
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          period_type: Database["public"]["Enums"]["evaluation_period_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          period_type?: Database["public"]["Enums"]["evaluation_period_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          period_type?: Database["public"]["Enums"]["evaluation_period_type"]
          updated_at?: string
        }
        Relationships: []
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
      message_templates: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          description: string | null
          dynamic_field_keys: string[] | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          name_en: string | null
          optional_fields: string[] | null
          placeholders: Json | null
          required_fields: string[] | null
          template_text: string
          updated_at: string
          version: number
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          dynamic_field_keys?: string[] | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          name_en?: string | null
          optional_fields?: string[] | null
          placeholders?: Json | null
          required_fields?: string[] | null
          template_text: string
          updated_at?: string
          version?: number
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          dynamic_field_keys?: string[] | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          name_en?: string | null
          optional_fields?: string[] | null
          placeholders?: Json | null
          required_fields?: string[] | null
          template_text?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string | null
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
          channel?: string | null
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
          channel?: string | null
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
      password_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          performed_by: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          performed_by?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          performed_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_metadata: {
        Row: {
          category: string
          config: Json | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          key: string
          name: string
          name_en: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          category: string
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          name: string
          name_en?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          category?: string
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          name?: string
          name_en?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string | null
          allow_telegram: boolean | null
          allow_whatsapp: boolean | null
          created_at: string
          direct_manager: string | null
          email: string | null
          employee_number: string | null
          full_name: string | null
          hire_date: string | null
          id: string
          job_title: string | null
          must_change_password: boolean
          national_id: string | null
          phone: string | null
          telegram_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string | null
          allow_telegram?: boolean | null
          allow_whatsapp?: boolean | null
          created_at?: string
          direct_manager?: string | null
          email?: string | null
          employee_number?: string | null
          full_name?: string | null
          hire_date?: string | null
          id?: string
          job_title?: string | null
          must_change_password?: boolean
          national_id?: string | null
          phone?: string | null
          telegram_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string | null
          allow_telegram?: boolean | null
          allow_whatsapp?: boolean | null
          created_at?: string
          direct_manager?: string | null
          email?: string | null
          employee_number?: string | null
          full_name?: string | null
          hire_date?: string | null
          id?: string
          job_title?: string | null
          must_change_password?: boolean
          national_id?: string | null
          phone?: string | null
          telegram_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      published_results: {
        Row: {
          ai_summary: string | null
          cycle_id: string
          evaluatee_id: string
          evaluation_id: string
          final_score: number
          id: string
          published_at: string
          published_by: string
          revision_number: number
        }
        Insert: {
          ai_summary?: string | null
          cycle_id: string
          evaluatee_id: string
          evaluation_id: string
          final_score: number
          id?: string
          published_at?: string
          published_by: string
          revision_number?: number
        }
        Update: {
          ai_summary?: string | null
          cycle_id?: string
          evaluatee_id?: string
          evaluation_id?: string
          final_score?: number
          id?: string
          published_at?: string
          published_by?: string
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "published_results_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "evaluation_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_results_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          channel: string
          count: number | null
          date: string
          id: string
          last_sent_at: string | null
          recipient_id: string | null
        }
        Insert: {
          channel: string
          count?: number | null
          date?: string
          id?: string
          last_sent_at?: string | null
          recipient_id?: string | null
        }
        Update: {
          channel?: string
          count?: number | null
          date?: string
          id?: string
          last_sent_at?: string | null
          recipient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_limits_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
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
      user_import_logs: {
        Row: {
          created_at: string
          error_details: Json | null
          failure_count: number
          file_name: string
          id: string
          imported_by: string
          success_count: number
          total_rows: number
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          failure_count?: number
          file_name: string
          id?: string
          imported_by: string
          success_count?: number
          total_rows?: number
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          failure_count?: number
          file_name?: string
          id?: string
          imported_by?: string
          success_count?: number
          total_rows?: number
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
      aggregated_evaluation_results: {
        Row: {
          avg_score: number | null
          cycle_id: string | null
          evaluatee_id: string | null
          evaluation_type: Database["public"]["Enums"]["evaluation_type"] | null
          evaluator_count: number | null
          max_score: number | null
          min_score: number | null
          score_stddev: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "evaluation_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_view_department: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
      check_template_usage: {
        Args: { p_template_id: string }
        Returns: {
          cycle_count: number
          cycle_names: string[]
        }[]
      }
      close_expired_evaluation_cycles: {
        Args: never
        Returns: {
          closed_cycles_count: number
          cycle_details: Json
          updated_evaluations_count: number
        }[]
      }
      generate_360_assignments: {
        Args: { p_cycle_id: string }
        Returns: {
          created_count: number
          skipped_count: number
        }[]
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
      is_cycle_open_for_evaluation: {
        Args: { p_cycle_id: string }
        Returns: boolean
      }
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
      submit_evaluation_with_score: {
        Args: { p_evaluation_id: string }
        Returns: {
          ai_analyzed_at: string | null
          ai_recommendations: string | null
          ai_risks: string | null
          ai_summary: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          current_revision: number | null
          cycle_id: string
          evaluatee_id: string
          evaluation_type: Database["public"]["Enums"]["evaluation_type"]
          evaluator_id: string
          id: string
          is_proxy: boolean
          proxy_by: string | null
          published_at: string | null
          published_by: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["evaluation_status"]
          submitted_at: string | null
          total_score: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "evaluations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sync_missing_users: {
        Args: never
        Returns: {
          synced_count: number
          synced_users: string[]
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "hr_user" | "system_admin" | "supervisor" | "employee"
      delegation_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "active"
        | "completed"
        | "cancelled"
      evaluation_period_type: "annual" | "semi_annual" | "quarterly" | "monthly"
      evaluation_status:
        | "draft"
        | "in_progress"
        | "submitted"
        | "reviewed"
        | "completed"
        | "under_review"
        | "approved"
        | "published"
        | "appealed"
        | "closed"
        | "not_submitted"
      evaluation_type:
        | "supervisor_to_employee"
        | "manager_to_supervisor"
        | "admin_to_manager"
        | "self_assessment"
        | "peer_360"
        | "self"
        | "employee_to_supervisor"
        | "supervisor_to_manager"
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
      question_answer_type: "numeric" | "choice" | "text"
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
      delegation_status: [
        "pending",
        "accepted",
        "rejected",
        "active",
        "completed",
        "cancelled",
      ],
      evaluation_period_type: ["annual", "semi_annual", "quarterly", "monthly"],
      evaluation_status: [
        "draft",
        "in_progress",
        "submitted",
        "reviewed",
        "completed",
        "under_review",
        "approved",
        "published",
        "appealed",
        "closed",
        "not_submitted",
      ],
      evaluation_type: [
        "supervisor_to_employee",
        "manager_to_supervisor",
        "admin_to_manager",
        "self_assessment",
        "peer_360",
        "self",
        "employee_to_supervisor",
        "supervisor_to_manager",
      ],
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
      question_answer_type: ["numeric", "choice", "text"],
    },
  },
} as const
