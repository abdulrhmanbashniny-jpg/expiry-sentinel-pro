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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_audit_trail: {
        Row: {
          action_type: string
          agent_key: string
          approval_required: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          input_params: Json | null
          output_result: Json | null
          rejection_reason: string | null
          status: string
          tenant_id: string | null
          tokens_used: number | null
          tool_used: string
          user_id: string
        }
        Insert: {
          action_type: string
          agent_key: string
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_params?: Json | null
          output_result?: Json | null
          rejection_reason?: string | null
          status?: string
          tenant_id?: string | null
          tokens_used?: number | null
          tool_used: string
          user_id: string
        }
        Update: {
          action_type?: string
          agent_key?: string
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_params?: Json | null
          output_result?: Json | null
          rejection_reason?: string | null
          status?: string
          tenant_id?: string | null
          tokens_used?: number | null
          tool_used?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_audit_trail_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback_log: {
        Row: {
          applied_at: string | null
          audit_trail_id: string | null
          correction_type: string
          created_at: string
          id: string
          is_applied: boolean
          original_output: string | null
          tenant_id: string | null
          user_correction: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          audit_trail_id?: string | null
          correction_type?: string
          created_at?: string
          id?: string
          is_applied?: boolean
          original_output?: string | null
          tenant_id?: string | null
          user_correction: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          audit_trail_id?: string | null
          correction_type?: string
          created_at?: string
          id?: string
          is_applied?: boolean
          original_output?: string | null
          tenant_id?: string | null
          user_correction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_log_audit_trail_id_fkey"
            columns: ["audit_trail_id"]
            isOneToOne: false
            referencedRelation: "ai_audit_trail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      ai_risk_predictions: {
        Row: {
          analyzed_at: string | null
          confidence_score: number | null
          created_at: string | null
          entity_id: string
          entity_type: string
          expires_at: string | null
          id: string
          predicted_delay_days: number | null
          recommendations: Json | null
          risk_factors: Json | null
          risk_level: string
          risk_score: number
          tenant_id: string | null
        }
        Insert: {
          analyzed_at?: string | null
          confidence_score?: number | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          expires_at?: string | null
          id?: string
          predicted_delay_days?: number | null
          recommendations?: Json | null
          risk_factors?: Json | null
          risk_level: string
          risk_score: number
          tenant_id?: string | null
        }
        Update: {
          analyzed_at?: string | null
          confidence_score?: number | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          expires_at?: string | null
          id?: string
          predicted_delay_days?: number | null
          recommendations?: Json | null
          risk_factors?: Json | null
          risk_level?: string
          risk_score?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_risk_predictions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tool_definitions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          description_en: string | null
          function_name: string | null
          id: string
          input_schema: Json | null
          is_active: boolean
          risk_level: string
          tool_key: string
          tool_name: string
          tool_name_en: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          description_en?: string | null
          function_name?: string | null
          id?: string
          input_schema?: Json | null
          is_active?: boolean
          risk_level?: string
          tool_key: string
          tool_name: string
          tool_name_en?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          description_en?: string | null
          function_name?: string | null
          id?: string
          input_schema?: Json | null
          is_active?: boolean
          risk_level?: string
          tool_key?: string
          tool_name?: string
          tool_name_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_tool_permissions: {
        Row: {
          can_execute: boolean
          can_read: boolean
          can_write: boolean
          created_at: string
          description: string | null
          granted_by: string | null
          id: string
          is_active: boolean
          max_daily_calls: number | null
          requires_approval: boolean
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          tool_key: string
          tool_name: string
          tool_name_en: string | null
          updated_at: string
        }
        Insert: {
          can_execute?: boolean
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          description?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean
          max_daily_calls?: number | null
          requires_approval?: boolean
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          tool_key: string
          tool_name: string
          tool_name_en?: string | null
          updated_at?: string
        }
        Update: {
          can_execute?: boolean
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          description?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean
          max_daily_calls?: number | null
          requires_approval?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          tool_key?: string
          tool_name?: string
          tool_name_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          tenant_id: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          tenant_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          tenant_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name: string
          risk_level?: string | null
          tenant_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name?: string
          risk_level?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          total_items?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_alerts: {
        Row: {
          alert_date: string
          alert_type: string
          contract_id: string | null
          created_at: string | null
          id: string
          is_sent: boolean | null
          sent_at: string | null
        }
        Insert: {
          alert_date: string
          alert_type: string
          contract_id?: string | null
          created_at?: string | null
          id?: string
          is_sent?: boolean | null
          sent_at?: string | null
        }
        Update: {
          alert_date?: string
          alert_type?: string
          contract_id?: string | null
          created_at?: string | null
          id?: string
          is_sent?: boolean | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_alerts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          attachment_url: string | null
          auto_renewed_at: string | null
          contract_number: string | null
          contract_type: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          department_id: string | null
          end_date: string
          id: string
          metadata: Json | null
          notes: string | null
          party_contact: string | null
          party_name: string
          renewal_period_months: number | null
          renewal_type: string | null
          responsible_user_id: string | null
          start_date: string
          status: string | null
          tenant_id: string | null
          terminated_at: string | null
          termination_reason: string | null
          title: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          attachment_url?: string | null
          auto_renewed_at?: string | null
          contract_number?: string | null
          contract_type?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          department_id?: string | null
          end_date: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          party_contact?: string | null
          party_name: string
          renewal_period_months?: number | null
          renewal_type?: string | null
          responsible_user_id?: string | null
          start_date: string
          status?: string | null
          tenant_id?: string | null
          terminated_at?: string | null
          termination_reason?: string | null
          title: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          attachment_url?: string | null
          auto_renewed_at?: string | null
          contract_number?: string | null
          contract_type?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          department_id?: string | null
          end_date?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          party_contact?: string | null
          party_name?: string
          renewal_period_months?: number | null
          renewal_type?: string | null
          responsible_user_id?: string | null
          start_date?: string
          status?: string | null
          tenant_id?: string | null
          terminated_at?: string | null
          termination_reason?: string | null
          title?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_logs: {
        Row: {
          bot_response: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          platform: string
          ref_number: string
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          user_identifier?: string | null
          user_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          created_at: string | null
          document_hash: string | null
          document_title: string
          document_url: string
          expires_at: string | null
          id: string
          metadata: Json | null
          requester_id: string
          status: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_hash?: string | null
          document_title: string
          document_url: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          requester_id: string
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_hash?: string | null
          document_title?: string
          document_url?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          requester_id?: string
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "dynamic_field_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_log: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string | null
          current_recipient_id: string
          escalated_at: string | null
          escalation_level: number
          escalation_reason: string | null
          id: string
          item_id: string | null
          next_escalation_at: string | null
          notification_id: string | null
          original_recipient_id: string
          previous_recipient_id: string | null
          resolution_notes: string | null
          sent_at: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string | null
          current_recipient_id: string
          escalated_at?: string | null
          escalation_level?: number
          escalation_reason?: string | null
          id?: string
          item_id?: string | null
          next_escalation_at?: string | null
          notification_id?: string | null
          original_recipient_id: string
          previous_recipient_id?: string | null
          resolution_notes?: string | null
          sent_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string | null
          current_recipient_id?: string
          escalated_at?: string | null
          escalation_level?: number
          escalation_reason?: string | null
          id?: string
          item_id?: string | null
          next_escalation_at?: string | null
          notification_id?: string | null
          original_recipient_id?: string
          previous_recipient_id?: string | null
          resolution_notes?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notification_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_rules: {
        Row: {
          created_at: string | null
          delay_hours: number
          escalation_level: number
          id: string
          is_active: boolean | null
          message_template: string | null
          notification_channels: string[] | null
          recipient_role: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delay_hours?: number
          escalation_level: number
          id?: string
          is_active?: boolean | null
          message_template?: string | null
          notification_channels?: string[] | null
          recipient_role: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delay_hours?: number
          escalation_level?: number
          id?: string
          is_active?: boolean | null
          message_template?: string | null
          notification_channels?: string[] | null
          recipient_role?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "evaluation_cycles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "evaluations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_toggles: {
        Row: {
          config: Json | null
          created_at: string | null
          description: string | null
          feature_key: string
          feature_name: string
          feature_name_en: string | null
          id: string
          is_enabled: boolean | null
          min_role: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          feature_key: string
          feature_name: string
          feature_name_en?: string | null
          id?: string
          is_enabled?: boolean | null
          min_role?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          feature_key?: string
          feature_name?: string
          feature_name_en?: string | null
          id?: string
          is_enabled?: boolean | null
          min_role?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_toggles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      in_app_notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          notification_type: string | null
          priority: string | null
          read_at: string | null
          source_channel: string | null
          tenant_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          notification_type?: string | null
          priority?: string | null
          read_at?: string | null
          source_channel?: string | null
          tenant_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          notification_type?: string | null
          priority?: string | null
          read_at?: string | null
          source_channel?: string | null
          tenant_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "in_app_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          completed_by_user_id: string | null
          completion_attachment_url: string | null
          completion_date: string | null
          completion_description: string | null
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
          tenant_id: string | null
          title: string
          updated_at: string
          workflow_status: Database["public"]["Enums"]["item_workflow_status"]
        }
        Insert: {
          attachment_url?: string | null
          category_id?: string | null
          completed_by_user_id?: string | null
          completion_attachment_url?: string | null
          completion_date?: string | null
          completion_description?: string | null
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
          tenant_id?: string | null
          title: string
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["item_workflow_status"]
        }
        Update: {
          attachment_url?: string | null
          category_id?: string | null
          completed_by_user_id?: string | null
          completion_attachment_url?: string | null
          completion_date?: string | null
          completion_description?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: string | null
          created_at: string
          delay_reason: string | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          escalated_to_admin_at: string | null
          escalated_to_supervisor_at: string | null
          escalation_status: string | null
          id: string
          item_id: string
          message_preview: string | null
          provider_message_id: string | null
          recipient_id: string
          reminder_day: number
          rule_id: string | null
          scheduled_for: string
          seen_at: string | null
          seen_by_user_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template_id: string | null
          tenant_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          delay_reason?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          escalated_to_admin_at?: string | null
          escalated_to_supervisor_at?: string | null
          escalation_status?: string | null
          id?: string
          item_id: string
          message_preview?: string | null
          provider_message_id?: string | null
          recipient_id: string
          reminder_day: number
          rule_id?: string | null
          scheduled_for: string
          seen_at?: string | null
          seen_by_user_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          delay_reason?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          escalated_to_admin_at?: string | null
          escalated_to_supervisor_at?: string | null
          escalation_status?: string | null
          id?: string
          item_id?: string
          message_preview?: string | null
          provider_message_id?: string | null
          recipient_id?: string
          reminder_day?: number
          rule_id?: string | null
          scheduled_for?: string
          seen_at?: string | null
          seen_by_user_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template_id?: string | null
          tenant_id?: string | null
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
          {
            foreignKeyName: "notification_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "reminder_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      organizational_hierarchy: {
        Row: {
          created_at: string | null
          department_id: string | null
          director_id: string | null
          employee_id: string
          id: string
          manager_id: string | null
          supervisor_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          director_id?: string | null
          employee_id: string
          id?: string
          manager_id?: string | null
          supervisor_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          director_id?: string | null
          employee_id?: string
          id?: string
          manager_id?: string | null
          supervisor_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizational_hierarchy_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizational_hierarchy_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          receives_notifications: boolean | null
          telegram_user_id: string | null
          tenant_id: string | null
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
          receives_notifications?: boolean | null
          telegram_user_id?: string | null
          tenant_id?: string | null
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
          receives_notifications?: boolean | null
          telegram_user_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
          whatsapp_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          telegram_id?: string | null
          tenant_id?: string | null
          whatsapp_number: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          telegram_id?: string | null
          tenant_id?: string | null
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_rules: {
        Row: {
          channels: string[] | null
          created_at: string
          days_before: number[]
          description: string | null
          id: string
          is_active: boolean
          name: string
          priority: number | null
          target_entity_type: string
          target_field: string
          template_id: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          channels?: string[] | null
          created_at?: string
          days_before?: number[]
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: number | null
          target_entity_type?: string
          target_field?: string
          template_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          channels?: string[] | null
          created_at?: string
          days_before?: number[]
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: number | null
          target_entity_type?: string
          target_field?: string
          template_id?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      service_requests: {
        Row: {
          approved_at: string | null
          approver_id: string | null
          attachment_url: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          employee_id: string
          id: string
          metadata: Json | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          rejected_at: string | null
          rejection_reason: string | null
          request_number: string | null
          request_type: string
          result_attachment_url: string | null
          status: Database["public"]["Enums"]["service_request_status"] | null
          tenant_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approver_id?: string | null
          attachment_url?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          employee_id: string
          id?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          rejected_at?: string | null
          rejection_reason?: string | null
          request_number?: string | null
          request_type: string
          result_attachment_url?: string | null
          status?: Database["public"]["Enums"]["service_request_status"] | null
          tenant_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approver_id?: string | null
          attachment_url?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          employee_id?: string
          id?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          rejected_at?: string | null
          rejection_reason?: string | null
          request_number?: string | null
          request_type?: string
          result_attachment_url?: string | null
          status?: Database["public"]["Enums"]["service_request_status"] | null
          tenant_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      signature_requests: {
        Row: {
          created_at: string | null
          document_id: string | null
          id: string
          ip_address: string | null
          rejection_reason: string | null
          reminded_at: string | null
          sign_order: number | null
          signature_data: string | null
          signed_at: string | null
          signer_email: string | null
          signer_id: string
          signer_name: string | null
          status: Database["public"]["Enums"]["signature_status"] | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          id?: string
          ip_address?: string | null
          rejection_reason?: string | null
          reminded_at?: string | null
          sign_order?: number | null
          signature_data?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_id: string
          signer_name?: string | null
          status?: Database["public"]["Enums"]["signature_status"] | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          id?: string
          ip_address?: string | null
          rejection_reason?: string | null
          reminded_at?: string | null
          sign_order?: number | null
          signature_data?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_id?: string
          signer_name?: string | null
          status?: Database["public"]["Enums"]["signature_status"] | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          attachment_url: string | null
          category: string
          closed_at: string | null
          created_at: string | null
          department_id: string | null
          description: string | null
          first_response_at: string | null
          id: string
          metadata: Json | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          requester_id: string
          resolved_at: string | null
          satisfaction_comment: string | null
          satisfaction_rating: number | null
          sla_deadline: string | null
          sla_hours: number | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          tenant_id: string | null
          ticket_number: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          attachment_url?: string | null
          category: string
          closed_at?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          first_response_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          requester_id: string
          resolved_at?: string | null
          satisfaction_comment?: string | null
          satisfaction_rating?: number | null
          sla_deadline?: string | null
          sla_hours?: number | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          tenant_id?: string | null
          ticket_number?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          attachment_url?: string | null
          category?: string
          closed_at?: string | null
          created_at?: string | null
          department_id?: string | null
          description?: string | null
          first_response_at?: string | null
          id?: string
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          requester_id?: string
          resolved_at?: string | null
          satisfaction_comment?: string | null
          satisfaction_rating?: number | null
          sla_deadline?: string | null
          sla_hours?: number | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          tenant_id?: string | null
          ticket_number?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          supervisor_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          supervisor_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          supervisor_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_integrations: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          integration_key: string
          is_active: boolean | null
          last_tested_at: string | null
          tenant_id: string
          test_result: Json | null
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          integration_key: string
          is_active?: boolean | null
          last_tested_at?: string | null
          tenant_id: string
          test_result?: Json | null
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          integration_key?: string
          is_active?: boolean | null
          last_tested_at?: string | null
          tenant_id?: string
          test_result?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_notification_settings: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          email_from_address: string | null
          email_from_name: string | null
          email_provider: string | null
          id: string
          in_app_enabled: boolean | null
          telegram_enabled: boolean | null
          tenant_id: string
          updated_at: string | null
          whatsapp_enabled: boolean | null
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          email_from_address?: string | null
          email_from_name?: string | null
          email_provider?: string | null
          id?: string
          in_app_enabled?: boolean | null
          telegram_enabled?: boolean | null
          tenant_id: string
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          email_from_address?: string | null
          email_from_name?: string | null
          email_provider?: string | null
          id?: string
          in_app_enabled?: boolean | null
          telegram_enabled?: boolean | null
          tenant_id?: string
          updated_at?: string | null
          whatsapp_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_notification_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          allow_public_registration: boolean | null
          created_at: string
          id: string
          invitation_validity_days: number | null
          require_email_verification: boolean | null
          tenant_id: string
          updated_at: string
          who_can_invite: string[] | null
        }
        Insert: {
          allow_public_registration?: boolean | null
          created_at?: string
          id?: string
          invitation_validity_days?: number | null
          require_email_verification?: boolean | null
          tenant_id: string
          updated_at?: string
          who_can_invite?: string[] | null
        }
        Update: {
          allow_public_registration?: boolean | null
          created_at?: string
          id?: string
          invitation_validity_days?: number | null
          require_email_verification?: boolean | null
          tenant_id?: string
          updated_at?: string
          who_can_invite?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_usage_stats: {
        Row: {
          ai_calls: number | null
          created_at: string
          id: string
          items_count: number | null
          notifications_sent: number | null
          period_end: string
          period_start: string
          storage_used_mb: number | null
          tenant_id: string
          users_count: number | null
        }
        Insert: {
          ai_calls?: number | null
          created_at?: string
          id?: string
          items_count?: number | null
          notifications_sent?: number | null
          period_end: string
          period_start: string
          storage_used_mb?: number | null
          tenant_id: string
          users_count?: number | null
        }
        Update: {
          ai_calls?: number | null
          created_at?: string
          id?: string
          items_count?: number | null
          notifications_sent?: number | null
          period_end?: string
          period_start?: string
          storage_used_mb?: number | null
          tenant_id?: string
          users_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_usage_stats_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          code: string
          created_at: string
          domain: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          max_items: number | null
          max_users: number | null
          name: string
          name_en: string | null
          settings: Json | null
          subscription_plan: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_items?: number | null
          max_users?: number | null
          name: string
          name_en?: string | null
          settings?: Json | null
          subscription_plan?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_items?: number | null
          max_users?: number | null
          name?: string
          name_en?: string | null
          settings?: Json | null
          subscription_plan?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ticket_replies: {
        Row: {
          attachment_url: string | null
          created_at: string | null
          id: string
          is_internal: boolean | null
          message: string
          ticket_id: string | null
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          message: string
          ticket_id?: string | null
          user_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          message?: string
          ticket_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
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
      user_invitations: {
        Row: {
          accepted_at: string | null
          activated_at: string | null
          created_at: string
          department_id: string | null
          email: string
          employee_number: string | null
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string
          last_resent_at: string | null
          phone: string | null
          resent_count: number | null
          role: string
          status: string | null
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          activated_at?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          employee_number?: string | null
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by: string
          last_resent_at?: string | null
          phone?: string | null
          resent_count?: number | null
          role?: string
          status?: string | null
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          activated_at?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          employee_number?: string | null
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string
          last_resent_at?: string | null
          phone?: string | null
          resent_count?: number | null
          role?: string
          status?: string | null
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      acknowledge_escalation: {
        Args: { p_escalation_id: string }
        Returns: boolean
      }
      activate_invitation: { Args: { p_token: string }; Returns: boolean }
      can_view_department: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
      check_ai_daily_limit: {
        Args: { _tool_key: string; _user_id: string }
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
      get_current_tenant_id: { Args: never; Returns: string }
      get_invitation_by_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          employee_number: string
          expires_at: string
          full_name: string
          id: string
          phone: string
          role: string
          status: string
          tenant_id: string
        }[]
      }
      get_next_escalation_recipient: {
        Args: {
          p_current_level: number
          p_employee_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      get_team_member_ids: {
        Args: { _supervisor_id: string }
        Returns: string[]
      }
      get_tenant_by_code: {
        Args: { p_code: string }
        Returns: {
          code: string
          id: string
          is_active: boolean
          logo_url: string
          name: string
          name_en: string
        }[]
      }
      get_user_department_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_ai_permission: {
        Args: { _action_type: string; _tool_key: string; _user_id: string }
        Returns: boolean
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
      is_feature_enabled: { Args: { _feature_key: string }; Returns: boolean }
      is_item_recipient: {
        Args: { item_uuid: string; user_uuid: string }
        Returns: boolean
      }
      is_only_recipient_not_creator: {
        Args: { item_id: string; user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { user_uuid: string }; Returns: boolean }
      is_supervisor_of: {
        Args: { _employee_id: string; _supervisor_id: string }
        Returns: boolean
      }
      is_supervisor_or_higher: { Args: { _user_id: string }; Returns: boolean }
      is_system_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_admin: { Args: { _tenant_id: string }; Returns: boolean }
      is_user_in_tenant: { Args: { _tenant_id: string }; Returns: boolean }
      resolve_escalation: {
        Args: { p_escalation_id: string; p_notes?: string }
        Returns: boolean
      }
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
          tenant_id: string | null
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
      validate_user_tenant:
        | {
            Args: { p_company_code: string; p_email: string }
            Returns: {
              is_platform_admin: boolean
              tenant_code: string
              tenant_id: string
              tenant_name: string
              user_id: string
            }[]
          }
        | {
            Args: { p_email: string; p_tenant_id: string }
            Returns: {
              is_valid: boolean
              profile_id: string
              user_id: string
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
      service_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "processing"
        | "completed"
      signature_status: "pending" | "signed" | "rejected" | "expired"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "pending" | "resolved" | "closed"
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
      service_request_status: [
        "pending",
        "approved",
        "rejected",
        "processing",
        "completed",
      ],
      signature_status: ["pending", "signed", "rejected", "expired"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "pending", "resolved", "closed"],
    },
  },
} as const
