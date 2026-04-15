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
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agenda_medica: {
        Row: {
          created_at: string | null
          data_hora: string
          duracao_minutos: number | null
          google_event_id: string | null
          id: string
          observacoes: string | null
          office_id: string
          paciente_id: string | null
          status: string | null
          sync_error: string | null
          sync_last_at: string | null
          sync_status: string | null
          tipo_consulta: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_hora: string
          duracao_minutos?: number | null
          google_event_id?: string | null
          id?: string
          observacoes?: string | null
          office_id: string
          paciente_id?: string | null
          status?: string | null
          sync_error?: string | null
          sync_last_at?: string | null
          sync_status?: string | null
          tipo_consulta?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_hora?: string
          duracao_minutos?: number | null
          google_event_id?: string | null
          id?: string
          observacoes?: string | null
          office_id?: string
          paciente_id?: string | null
          status?: string | null
          sync_error?: string | null
          sync_last_at?: string | null
          sync_status?: string | null
          tipo_consulta?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_medica_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_medica_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_profiles: {
        Row: {
          allowed_actions_json: Json | null
          allowed_knowledge_sources_json: Json | null
          business_hours_json: Json | null
          channel: string
          created_at: string | null
          default_flow_id: string | null
          fallback_message: string | null
          fallback_node_id: string | null
          goal: string | null
          handoff_policy: string | null
          id: string
          is_active: boolean | null
          name: string
          office_id: string
          role: string | null
          rules_json: Json | null
          system_prompt: string | null
          tone: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_actions_json?: Json | null
          allowed_knowledge_sources_json?: Json | null
          business_hours_json?: Json | null
          channel?: string
          created_at?: string | null
          default_flow_id?: string | null
          fallback_message?: string | null
          fallback_node_id?: string | null
          goal?: string | null
          handoff_policy?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          office_id: string
          role?: string | null
          rules_json?: Json | null
          system_prompt?: string | null
          tone?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_actions_json?: Json | null
          allowed_knowledge_sources_json?: Json | null
          business_hours_json?: Json | null
          channel?: string
          created_at?: string | null
          default_flow_id?: string | null
          fallback_message?: string | null
          fallback_node_id?: string | null
          goal?: string | null
          handoff_policy?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          office_id?: string
          role?: string | null
          rules_json?: Json | null
          system_prompt?: string | null
          tone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_profiles_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_configs: {
        Row: {
          context_type: string | null
          created_at: string | null
          description: string | null
          extra_instructions: string | null
          friendly_name: string
          id: string
          is_active: boolean | null
          max_tokens: number | null
          metadata: Json | null
          mode: string | null
          model: string
          office_id: string | null
          pipeline_stage: string | null
          provider: string
          slug: string
          system_prompt: string
          temperature: number | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          context_type?: string | null
          created_at?: string | null
          description?: string | null
          extra_instructions?: string | null
          friendly_name: string
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          metadata?: Json | null
          mode?: string | null
          model: string
          office_id?: string | null
          pipeline_stage?: string | null
          provider?: string
          slug: string
          system_prompt: string
          temperature?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          context_type?: string | null
          created_at?: string | null
          description?: string | null
          extra_instructions?: string | null
          friendly_name?: string
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          metadata?: Json | null
          mode?: string | null
          model?: string
          office_id?: string | null
          pipeline_stage?: string | null
          provider?: string
          slug?: string
          system_prompt?: string
          temperature?: number | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_configs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_config: {
        Row: {
          api_key: string | null
          created_at: string | null
          id: string
          office_id: string
          prompt_case_decoder: string | null
          prompt_clinical_analysis: string | null
          prompt_iridology: string | null
          provider: string
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          created_at?: string | null
          id?: string
          office_id: string
          prompt_case_decoder?: string | null
          prompt_clinical_analysis?: string | null
          prompt_iridology?: string | null
          provider?: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          created_at?: string | null
          id?: string
          office_id?: string
          prompt_case_decoder?: string | null
          prompt_clinical_analysis?: string | null
          prompt_iridology?: string | null
          provider?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_config_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_error_rules: {
        Row: {
          active: boolean
          created_at: string
          created_from_validation_log_id: string | null
          id: string
          office_id: string | null
          rule_description: string
          rule_key: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_from_validation_log_id?: string | null
          id?: string
          office_id?: string | null
          rule_description: string
          rule_key: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_from_validation_log_id?: string | null
          id?: string
          office_id?: string | null
          rule_description?: string
          rule_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_error_rules_created_from_validation_log_id_fkey"
            columns: ["created_from_validation_log_id"]
            isOneToOne: false
            referencedRelation: "ai_validation_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_error_rules_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_pricing: {
        Row: {
          created_at: string | null
          id: string
          input_1k_usd: number
          is_active: boolean | null
          model_name: string
          output_1k_usd: number
          provider: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_1k_usd: number
          is_active?: boolean | null
          model_name: string
          output_1k_usd: number
          provider: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          input_1k_usd?: number
          is_active?: boolean | null
          model_name?: string
          output_1k_usd?: number
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string | null
          id: string
          input_tokens: number | null
          job_id: string | null
          metadata: Json | null
          model: string
          office_id: string
          output_tokens: number | null
          pipeline_stage: string
          session_id: string | null
          total_cost_usd: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          job_id?: string | null
          metadata?: Json | null
          model: string
          office_id: string
          output_tokens?: number | null
          pipeline_stage: string
          session_id?: string | null
          total_cost_usd: number
        }
        Update: {
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          job_id?: string | null
          metadata?: Json | null
          model?: string
          office_id?: string
          output_tokens?: number | null
          pipeline_stage?: string
          session_id?: string | null
          total_cost_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "session_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_validation_logs: {
        Row: {
          created_at: string
          draft_version: string
          final_version: string | null
          id: string
          issues_detected: Json | null
          office_id: string
          piece_type: string
          refinement_attempts: number | null
          request_id: string | null
          validation_passed: boolean
          validation_scores: Json
        }
        Insert: {
          created_at?: string
          draft_version: string
          final_version?: string | null
          id?: string
          issues_detected?: Json | null
          office_id: string
          piece_type: string
          refinement_attempts?: number | null
          request_id?: string | null
          validation_passed?: boolean
          validation_scores?: Json
        }
        Update: {
          created_at?: string
          draft_version?: string
          final_version?: string | null
          id?: string
          issues_detected?: Json | null
          office_id?: string
          piece_type?: string
          refinement_attempts?: number | null
          request_id?: string | null
          validation_passed?: boolean
          validation_scores?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_validation_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_customers: {
        Row: {
          asaas_customer_id: string
          client_id: string | null
          created_at: string | null
          id: string
          office_id: string
          updated_at: string | null
        }
        Insert: {
          asaas_customer_id: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          office_id: string
          updated_at?: string | null
        }
        Update: {
          asaas_customer_id?: string
          client_id?: string | null
          created_at?: string | null
          id?: string
          office_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_signatures"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "asaas_customers_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_payments: {
        Row: {
          asaas_payment_id: string
          billing_type: string
          boleto_url: string | null
          case_id: string | null
          client_id: string | null
          created_at: string | null
          customer_local_id: string | null
          description: string | null
          due_date: string
          id: string
          invoice_url: string | null
          office_id: string
          pix_payload: string | null
          pix_qr_code_base64: string | null
          status: string
          updated_at: string | null
          value: number
        }
        Insert: {
          asaas_payment_id: string
          billing_type: string
          boleto_url?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          customer_local_id?: string | null
          description?: string | null
          due_date: string
          id?: string
          invoice_url?: string | null
          office_id: string
          pix_payload?: string | null
          pix_qr_code_base64?: string | null
          status: string
          updated_at?: string | null
          value: number
        }
        Update: {
          asaas_payment_id?: string
          billing_type?: string
          boleto_url?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          customer_local_id?: string | null
          description?: string | null
          due_date?: string
          id?: string
          invoice_url?: string | null
          office_id?: string
          pix_payload?: string | null
          pix_qr_code_base64?: string | null
          status?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "asaas_payments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_signatures"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "asaas_payments_customer_local_id_fkey"
            columns: ["customer_local_id"]
            isOneToOne: false
            referencedRelation: "asaas_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_payments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_memory: {
        Row: {
          id: string
          key: string | null
          office_id: string | null
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          id?: string
          key?: string | null
          office_id?: string | null
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          id?: string
          key?: string | null
          office_id?: string | null
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      assistant_suggestions: {
        Row: {
          action_payload: Json | null
          action_type: string | null
          category: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          expires_at: string
          id: string
          is_dismissed: boolean
          is_executed: boolean
          office_id: string
          priority: string
          title: string
          updated_at: string
        }
        Insert: {
          action_payload?: Json | null
          action_type?: string | null
          category?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string
          id?: string
          is_dismissed?: boolean
          is_executed?: boolean
          office_id: string
          priority?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_payload?: Json | null
          action_type?: string | null
          category?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string
          id?: string
          is_dismissed?: boolean
          is_executed?: boolean
          office_id?: string
          priority?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_events_legacy: {
        Row: {
          action: string | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          office_id: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          office_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          office_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log_legacy__table: {
        Row: {
          created_at: string | null
          id: number
          new_data: Json | null
          office_id: string | null
          old_data: Json | null
          operation: string | null
          row_pk: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: never
          new_data?: Json | null
          office_id?: string | null
          old_data?: Json | null
          operation?: string | null
          row_pk?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: never
          new_data?: Json | null
          office_id?: string | null
          old_data?: Json | null
          operation?: string | null
          row_pk?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string | null
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          delegated_by: string | null
          details: Json | null
          entity: string | null
          entity_id: string | null
          execution_context: string | null
          id: string
          metadata: Json | null
          model_version: string | null
          office_id: string | null
          output_level:
            | Database["public"]["Enums"]["output_validation_level"]
            | null
          reasoning_log: Json | null
          record_id: string | null
          system_prompt_version: string | null
          table_name: string | null
          trigger_source: string | null
        }
        Insert: {
          action?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          delegated_by?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          execution_context?: string | null
          id?: string
          metadata?: Json | null
          model_version?: string | null
          office_id?: string | null
          output_level?:
            | Database["public"]["Enums"]["output_validation_level"]
            | null
          reasoning_log?: Json | null
          record_id?: string | null
          system_prompt_version?: string | null
          table_name?: string | null
          trigger_source?: string | null
        }
        Update: {
          action?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          delegated_by?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          execution_context?: string | null
          id?: string
          metadata?: Json | null
          model_version?: string | null
          office_id?: string | null
          output_level?:
            | Database["public"]["Enums"]["output_validation_level"]
            | null
          reasoning_log?: Json | null
          record_id?: string | null
          system_prompt_version?: string | null
          table_name?: string | null
          trigger_source?: string | null
        }
        Relationships: []
      }
      audit_snapshots: {
        Row: {
          created_at: string | null
          created_by: string | null
          hash: string | null
          id: string
          meta: Json | null
          office_id: string | null
          report_md: string | null
          risk: Json | null
          source: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          hash?: string | null
          id?: string
          meta?: Json | null
          office_id?: string | null
          report_md?: string | null
          risk?: Json | null
          source?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          hash?: string | null
          id?: string
          meta?: Json | null
          office_id?: string | null
          report_md?: string | null
          risk?: Json | null
          source?: string | null
          status?: string | null
        }
        Relationships: []
      }
      automation_flow_edges: {
        Row: {
          condition_json: Json | null
          created_at: string | null
          flow_id: string
          id: string
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          condition_json?: Json | null
          created_at?: string | null
          flow_id: string
          id?: string
          source_node_id: string
          target_node_id: string
        }
        Update: {
          condition_json?: Json | null
          created_at?: string | null
          flow_id?: string
          id?: string
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_flow_edges_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_flow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "automation_flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_flow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "automation_flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_flow_nodes: {
        Row: {
          config_json: Json | null
          created_at: string | null
          flow_id: string
          id: string
          label: string | null
          node_type: string
          position_x: number | null
          position_y: number | null
        }
        Insert: {
          config_json?: Json | null
          created_at?: string | null
          flow_id: string
          id?: string
          label?: string | null
          node_type: string
          position_x?: number | null
          position_y?: number | null
        }
        Update: {
          config_json?: Json | null
          created_at?: string | null
          flow_id?: string
          id?: string
          label?: string | null
          node_type?: string
          position_x?: number | null
          position_y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_flow_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_flows: {
        Row: {
          channel: string
          created_at: string | null
          entry_trigger: string | null
          id: string
          is_active: boolean | null
          name: string
          office_id: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          channel?: string
          created_at?: string | null
          entry_trigger?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          office_id: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          entry_trigger?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          office_id?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_flows_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_configs: {
        Row: {
          asaas_account_id: string | null
          asaas_api_key_encrypted: string | null
          asaas_webhook_secret: string | null
          created_at: string
          enabled: boolean
          encryption_iv: string | null
          environment: string
          id: string
          office_id: string
          updated_at: string
        }
        Insert: {
          asaas_account_id?: string | null
          asaas_api_key_encrypted?: string | null
          asaas_webhook_secret?: string | null
          created_at?: string
          enabled?: boolean
          encryption_iv?: string | null
          environment?: string
          id?: string
          office_id: string
          updated_at?: string
        }
        Update: {
          asaas_account_id?: string | null
          asaas_api_key_encrypted?: string | null
          asaas_webhook_secret?: string | null
          created_at?: string
          enabled?: boolean
          encryption_iv?: string | null
          environment?: string
          id?: string
          office_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_configs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      case_cnj_snapshots: {
        Row: {
          case_id: string | null
          cnj_digits: string | null
          created_by: string | null
          fetched_at: string | null
          id: string
          provider: string | null
          response: Json | null
          tribunal_alias: string | null
        }
        Insert: {
          case_id?: string | null
          cnj_digits?: string | null
          created_by?: string | null
          fetched_at?: string | null
          id?: string
          provider?: string | null
          response?: Json | null
          tribunal_alias?: string | null
        }
        Update: {
          case_id?: string | null
          cnj_digits?: string | null
          created_by?: string | null
          fetched_at?: string | null
          id?: string
          provider?: string | null
          response?: Json | null
          tribunal_alias?: string | null
        }
        Relationships: []
      }
      case_deadlines: {
        Row: {
          case_id: string | null
          created_at: string | null
          created_by: string | null
          days: number | null
          description: string | null
          due_date: string | null
          id: string
          kind: string | null
          notes: string | null
          office_id: string | null
          priority: string | null
          start_date: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string | null
          created_by?: string | null
          days?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          kind?: string | null
          notes?: string | null
          office_id?: string | null
          priority?: string | null
          start_date?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string | null
          created_by?: string | null
          days?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          kind?: string | null
          notes?: string | null
          office_id?: string | null
          priority?: string | null
          start_date?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      case_event_segments: {
        Row: {
          case_id: string | null
          confidence: string | null
          created_at: string | null
          document_nature: string | null
          event_date: string | null
          event_id: string | null
          excerpt: string | null
          id: string
          label: string | null
          office_id: string | null
          raw_description: string | null
          seq: number | null
          tjto_code: string | null
        }
        Insert: {
          case_id?: string | null
          confidence?: string | null
          created_at?: string | null
          document_nature?: string | null
          event_date?: string | null
          event_id?: string | null
          excerpt?: string | null
          id?: string
          label?: string | null
          office_id?: string | null
          raw_description?: string | null
          seq?: number | null
          tjto_code?: string | null
        }
        Update: {
          case_id?: string | null
          confidence?: string | null
          created_at?: string | null
          document_nature?: string | null
          event_date?: string | null
          event_id?: string | null
          excerpt?: string | null
          id?: string
          label?: string | null
          office_id?: string | null
          raw_description?: string | null
          seq?: number | null
          tjto_code?: string | null
        }
        Relationships: []
      }
      case_events: {
        Row: {
          case_id: string | null
          created_at: string | null
          created_by: string | null
          event_type: string | null
          id: string
          payload: Json | null
          source: string | null
          title: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string | null
          created_by?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          source?: string | null
          title?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string | null
          created_by?: string | null
          event_type?: string | null
          id?: string
          payload?: Json | null
          source?: string | null
          title?: string | null
        }
        Relationships: []
      }
      case_expenses: {
        Row: {
          amount: number | null
          case_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          kind: string | null
          office_id: string | null
          paid: boolean | null
          paid_at: string | null
          receipt_url: string | null
        }
        Insert: {
          amount?: number | null
          case_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string | null
          office_id?: string | null
          paid?: boolean | null
          paid_at?: string | null
          receipt_url?: string | null
        }
        Update: {
          amount?: number | null
          case_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string | null
          office_id?: string | null
          paid?: boolean | null
          paid_at?: string | null
          receipt_url?: string | null
        }
        Relationships: []
      }
      case_permissions: {
        Row: {
          case_id: string | null
          created_at: string | null
          id: string
          role: string | null
          user_id: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      case_tasks: {
        Row: {
          case_id: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          is_required: boolean | null
          sort_order: number | null
          stage: string | null
          status: string | null
          template_id: string | null
          title: string | null
        }
        Insert: {
          case_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          sort_order?: number | null
          stage?: string | null
          status?: string | null
          template_id?: string | null
          title?: string | null
        }
        Update: {
          case_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          sort_order?: number | null
          stage?: string | null
          status?: string | null
          template_id?: string | null
          title?: string | null
        }
        Relationships: []
      }
      cases: {
        Row: {
          area: string | null
          client_id: string | null
          cnj_number: string | null
          cnj_validated_at: string | null
          comarca: string | null
          court_name: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          id: string
          identified_docs: Json | null
          internal_id: string | null
          judicialized_at: string | null
          lawyer_name: string | null
          nija_full_analysis: Json | null
          nija_full_last_run_at: string | null
          nija_phase: string | null
          oab_number: string | null
          office_id: string | null
          opponent_doc: string | null
          opponent_name: string | null
          side: Database["public"]["Enums"]["case_side"] | null
          stage: string | null
          state_id: string | null
          status: string | null
          subject_id: string | null
          subtype: string | null
          summary: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          client_id?: string | null
          cnj_number?: string | null
          cnj_validated_at?: string | null
          comarca?: string | null
          court_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          id?: string
          identified_docs?: Json | null
          internal_id?: string | null
          judicialized_at?: string | null
          lawyer_name?: string | null
          nija_full_analysis?: Json | null
          nija_full_last_run_at?: string | null
          nija_phase?: string | null
          oab_number?: string | null
          office_id?: string | null
          opponent_doc?: string | null
          opponent_name?: string | null
          side?: Database["public"]["Enums"]["case_side"] | null
          stage?: string | null
          state_id?: string | null
          status?: string | null
          subject_id?: string | null
          subtype?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          client_id?: string | null
          cnj_number?: string | null
          cnj_validated_at?: string | null
          comarca?: string | null
          court_name?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          id?: string
          identified_docs?: Json | null
          internal_id?: string | null
          judicialized_at?: string | null
          lawyer_name?: string | null
          nija_full_analysis?: Json | null
          nija_full_last_run_at?: string | null
          nija_phase?: string | null
          oab_number?: string | null
          office_id?: string | null
          opponent_doc?: string | null
          opponent_name?: string | null
          side?: Database["public"]["Enums"]["case_side"] | null
          stage?: string | null
          state_id?: string | null
          status?: string | null
          subject_id?: string | null
          subtype?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_ai_logs: {
        Row: {
          case_id: string | null
          created_at: string | null
          id: string
          message: string | null
          model: string | null
          office_id: string | null
          response: string | null
          tokens: number | null
          user_id: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          model?: string | null
          office_id?: string | null
          response?: string | null
          tokens?: number | null
          user_id?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          model?: string | null
          office_id?: string | null
          response?: string | null
          tokens?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          role: string | null
          thread_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string | null
          thread_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string | null
          thread_id?: string | null
        }
        Relationships: []
      }
      chat_threads: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string | null
          id: string
          office_id: string | null
          route: string | null
          scope: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          office_id?: string | null
          route?: string | null
          scope?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          office_id?: string | null
          route?: string | null
          scope?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_assigned_lawyers: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          member_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          member_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          member_id?: string | null
        }
        Relationships: []
      }
      client_contract_terms: {
        Row: {
          chave_pix: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          data_primeira_parcela: string | null
          datas_parcelas: Json | null
          forma_pagamento: string | null
          id: string
          metodo_pagamento: string | null
          numero_parcelas: number | null
          office_id: string | null
          percentual_honorarios: number | null
          tipo_remuneracao: string | null
          updated_at: string | null
          valor_entrada: number | null
          valor_fixo_honorarios: number | null
          valor_parcela: number | null
        }
        Insert: {
          chave_pix?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_primeira_parcela?: string | null
          datas_parcelas?: Json | null
          forma_pagamento?: string | null
          id?: string
          metodo_pagamento?: string | null
          numero_parcelas?: number | null
          office_id?: string | null
          percentual_honorarios?: number | null
          tipo_remuneracao?: string | null
          updated_at?: string | null
          valor_entrada?: number | null
          valor_fixo_honorarios?: number | null
          valor_parcela?: number | null
        }
        Update: {
          chave_pix?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_primeira_parcela?: string | null
          datas_parcelas?: Json | null
          forma_pagamento?: string | null
          id?: string
          metodo_pagamento?: string | null
          numero_parcelas?: number | null
          office_id?: string | null
          percentual_honorarios?: number | null
          tipo_remuneracao?: string | null
          updated_at?: string | null
          valor_entrada?: number | null
          valor_fixo_honorarios?: number | null
          valor_parcela?: number | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address_line: string | null
          ai_extracted: boolean | null
          all_lawyers_assigned: boolean | null
          cep: string | null
          city: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          display_id: string | null
          email: string | null
          full_name: string | null
          id: string
          lgpd_consent: boolean | null
          lgpd_consent_at: string | null
          marital_status: string | null
          nationality: string | null
          notes: string | null
          office_id: string | null
          person_type: Database["public"]["Enums"]["person_type"] | null
          phone: string | null
          profession: string | null
          representative_cpf: string | null
          representative_marital_status: string | null
          representative_name: string | null
          representative_nationality: string | null
          representative_profession: string | null
          representative_rg: string | null
          representative_rg_issuer: string | null
          rg: string | null
          rg_issuer: string | null
          source: string | null
          state: string | null
          status: string | null
          trade_name: string | null
          updated_at: string | null
        }
        Insert: {
          address_line?: string | null
          ai_extracted?: boolean | null
          all_lawyers_assigned?: boolean | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          display_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          lgpd_consent?: boolean | null
          lgpd_consent_at?: string | null
          marital_status?: string | null
          nationality?: string | null
          notes?: string | null
          office_id?: string | null
          person_type?: Database["public"]["Enums"]["person_type"] | null
          phone?: string | null
          profession?: string | null
          representative_cpf?: string | null
          representative_marital_status?: string | null
          representative_name?: string | null
          representative_nationality?: string | null
          representative_profession?: string | null
          representative_rg?: string | null
          representative_rg_issuer?: string | null
          rg?: string | null
          rg_issuer?: string | null
          source?: string | null
          state?: string | null
          status?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line?: string | null
          ai_extracted?: boolean | null
          all_lawyers_assigned?: boolean | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          display_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          lgpd_consent?: boolean | null
          lgpd_consent_at?: string | null
          marital_status?: string | null
          nationality?: string | null
          notes?: string | null
          office_id?: string | null
          person_type?: Database["public"]["Enums"]["person_type"] | null
          phone?: string | null
          profession?: string | null
          representative_cpf?: string | null
          representative_marital_status?: string | null
          representative_name?: string | null
          representative_nationality?: string | null
          representative_profession?: string | null
          representative_rg?: string | null
          representative_rg_issuer?: string | null
          rg?: string | null
          rg_issuer?: string | null
          source?: string | null
          state?: string | null
          status?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      delegacias: {
        Row: {
          cidade: string
          created_at: string
          endereco: string | null
          estado: string
          id: string
          nome: string
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          cidade: string
          created_at?: string
          endereco?: string | null
          estado: string
          id?: string
          nome: string
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          cidade?: string
          created_at?: string
          endereco?: string | null
          estado?: string
          id?: string
          nome?: string
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_events: {
        Row: {
          actor_user_id: string | null
          case_id: string | null
          created_at: string | null
          document_id: string | null
          event_type: string | null
          id: string
          message: string | null
          metadata: Json | null
          office_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          case_id?: string | null
          created_at?: string | null
          document_id?: string | null
          event_type?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          office_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          case_id?: string | null
          created_at?: string | null
          document_id?: string | null
          event_type?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          office_id?: string | null
        }
        Relationships: []
      }
      document_render_jobs: {
        Row: {
          case_id: string | null
          created_at: string | null
          error: string | null
          format: string | null
          generated_document_id: string | null
          id: string
          office_id: string | null
          payload: Json | null
          status: string | null
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string | null
          error?: string | null
          format?: string | null
          generated_document_id?: string | null
          id?: string
          office_id?: string | null
          payload?: Json | null
          status?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string | null
          error?: string | null
          format?: string | null
          generated_document_id?: string | null
          id?: string
          office_id?: string | null
          payload?: Json | null
          status?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      document_sign_requests: {
        Row: {
          created_at: string | null
          created_by: string | null
          document_id: string | null
          id: string
          office_id: string | null
          provider: string | null
          provider_payload: Json | null
          signed_file_path: string | null
          status: string | null
          updated_at: string | null
          zapsign_doc_token: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          document_id?: string | null
          id?: string
          office_id?: string | null
          provider?: string | null
          provider_payload?: Json | null
          signed_file_path?: string | null
          status?: string | null
          updated_at?: string | null
          zapsign_doc_token?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          document_id?: string | null
          id?: string
          office_id?: string | null
          provider?: string | null
          provider_payload?: Json | null
          signed_file_path?: string | null
          status?: string | null
          updated_at?: string | null
          zapsign_doc_token?: string | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          category: string | null
          code: string | null
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string | null
          office_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string | null
          office_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string | null
          office_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      document_type_permissions: {
        Row: {
          can_delete: boolean | null
          can_download: boolean | null
          can_upload: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          office_id: string | null
          role: string | null
          type_id: string | null
        }
        Insert: {
          can_delete?: boolean | null
          can_download?: boolean | null
          can_upload?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          office_id?: string | null
          role?: string | null
          type_id?: string | null
        }
        Update: {
          can_delete?: boolean | null
          can_download?: boolean | null
          can_upload?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          office_id?: string | null
          role?: string | null
          type_id?: string | null
        }
        Relationships: []
      }
      document_types: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string | null
          office_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          office_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          office_id?: string | null
        }
        Relationships: []
      }
      document_versions: {
        Row: {
          action: string | null
          created_at: string | null
          created_by: string | null
          document_id: string | null
          id: string
          office_id: string | null
          snapshot: Json | null
          version_no: number | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          created_by?: string | null
          document_id?: string | null
          id?: string
          office_id?: string | null
          snapshot?: Json | null
          version_no?: number | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          created_by?: string | null
          document_id?: string | null
          id?: string
          office_id?: string | null
          snapshot?: Json | null
          version_no?: number | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          case_id: string | null
          client_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          extracted_coverage_ratio: number | null
          extracted_pages_total: number | null
          extracted_pages_with_text: number | null
          extracted_text: string | null
          extracted_text_chars: number | null
          extraction_method: string | null
          extraction_report: Json | null
          extraction_updated_at: string | null
          file_size: number | null
          filename: string | null
          id: string
          is_image_pdf: boolean | null
          is_locked: boolean | null
          kind: Database["public"]["Enums"]["doc_kind"] | null
          locked_at: string | null
          locked_by: string | null
          metadata: Json | null
          mime_type: string | null
          office_id: string | null
          reading_status: string | null
          signed_at: string | null
          signed_by: string | null
          status: string | null
          storage_bucket: string | null
          storage_path: string | null
          type_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          extracted_coverage_ratio?: number | null
          extracted_pages_total?: number | null
          extracted_pages_with_text?: number | null
          extracted_text?: string | null
          extracted_text_chars?: number | null
          extraction_method?: string | null
          extraction_report?: Json | null
          extraction_updated_at?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          is_image_pdf?: boolean | null
          is_locked?: boolean | null
          kind?: Database["public"]["Enums"]["doc_kind"] | null
          locked_at?: string | null
          locked_by?: string | null
          metadata?: Json | null
          mime_type?: string | null
          office_id?: string | null
          reading_status?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          type_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          extracted_coverage_ratio?: number | null
          extracted_pages_total?: number | null
          extracted_pages_with_text?: number | null
          extracted_text?: string | null
          extracted_text_chars?: number | null
          extraction_method?: string | null
          extraction_report?: Json | null
          extraction_updated_at?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          is_image_pdf?: boolean | null
          is_locked?: boolean | null
          kind?: Database["public"]["Enums"]["doc_kind"] | null
          locked_at?: string | null
          locked_by?: string | null
          metadata?: Json | null
          mime_type?: string | null
          office_id?: string | null
          reading_status?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          type_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      dynamic_variables: {
        Row: {
          context_type: Database["public"]["Enums"]["variable_context"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_required: boolean | null
          label: string
          name: string
          source_field: string | null
          source_table: string | null
          source_type: Database["public"]["Enums"]["variable_source"]
          updated_at: string
        }
        Insert: {
          context_type?: Database["public"]["Enums"]["variable_context"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          label: string
          name: string
          source_field?: string | null
          source_table?: string | null
          source_type?: Database["public"]["Enums"]["variable_source"]
          updated_at?: string
        }
        Update: {
          context_type?: Database["public"]["Enums"]["variable_context"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          label?: string
          name?: string
          source_field?: string | null
          source_table?: string | null
          source_type?: Database["public"]["Enums"]["variable_source"]
          updated_at?: string
        }
        Relationships: []
      }
      e_signatures: {
        Row: {
          case_id: string | null
          client_id: string | null
          generated_document_id: string | null
          id: string
          ip: string | null
          metadata: Json | null
          office_id: string | null
          signature_base64: string | null
          signature_status: string | null
          signed_at: string | null
          signed_hash: string | null
          signer_doc: string | null
          signer_email: string | null
          signer_name: string | null
          signer_phone: string | null
          signer_type: string | null
          user_agent: string | null
          zapsign_doc_token: string | null
          zapsign_signer_token: string | null
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          generated_document_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          office_id?: string | null
          signature_base64?: string | null
          signature_status?: string | null
          signed_at?: string | null
          signed_hash?: string | null
          signer_doc?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          signer_type?: string | null
          user_agent?: string | null
          zapsign_doc_token?: string | null
          zapsign_signer_token?: string | null
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          generated_document_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          office_id?: string | null
          signature_base64?: string | null
          signature_status?: string | null
          signed_at?: string | null
          signed_hash?: string | null
          signer_doc?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          signer_type?: string | null
          user_agent?: string | null
          zapsign_doc_token?: string | null
          zapsign_signer_token?: string | null
        }
        Relationships: []
      }
      execution_audit_logs: {
        Row: {
          action: string | null
          actor_id: string | null
          created_at: string
          error_detail: string | null
          execution_context: string | null
          function_name: string | null
          id: string
          metadata: Json | null
          office_id: string | null
          result: string | null
          trace_id: string | null
        }
        Insert: {
          action?: string | null
          actor_id?: string | null
          created_at?: string
          error_detail?: string | null
          execution_context?: string | null
          function_name?: string | null
          id?: string
          metadata?: Json | null
          office_id?: string | null
          result?: string | null
          trace_id?: string | null
        }
        Update: {
          action?: string | null
          actor_id?: string | null
          created_at?: string
          error_detail?: string | null
          execution_context?: string | null
          function_name?: string | null
          id?: string
          metadata?: Json | null
          office_id?: string | null
          result?: string | null
          trace_id?: string | null
        }
        Relationships: []
      }
      execution_context_log: {
        Row: {
          action: string | null
          actor_id: string | null
          actor_role: string | null
          created_at: string
          delegated_by: string | null
          execution_context: string
          function_name: string
          id: string
          office_id: string | null
          trace_id: string
          trigger_source: string
        }
        Insert: {
          action?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          delegated_by?: string | null
          execution_context: string
          function_name: string
          id?: string
          office_id?: string | null
          trace_id: string
          trigger_source: string
        }
        Update: {
          action?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          delegated_by?: string | null
          execution_context?: string
          function_name?: string
          id?: string
          office_id?: string | null
          trace_id?: string
          trigger_source?: string
        }
        Relationships: []
      }
      flow_run_steps: {
        Row: {
          executed_at: string | null
          id: string
          input_data: Json | null
          node_id: string
          node_label: string | null
          node_type: string | null
          output_data: Json | null
          run_id: string | null
        }
        Insert: {
          executed_at?: string | null
          id?: string
          input_data?: Json | null
          node_id: string
          node_label?: string | null
          node_type?: string | null
          output_data?: Json | null
          run_id?: string | null
        }
        Update: {
          executed_at?: string | null
          id?: string
          input_data?: Json | null
          node_id?: string
          node_label?: string | null
          node_type?: string | null
          output_data?: Json | null
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "flow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_runs: {
        Row: {
          agent_id: string | null
          channel: string | null
          finished_at: string | null
          id: string
          metadata: Json | null
          office_id: string | null
          started_at: string | null
          status: string | null
          trigger_type: string | null
          version_id: string | null
        }
        Insert: {
          agent_id?: string | null
          channel?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          office_id?: string | null
          started_at?: string | null
          status?: string | null
          trigger_type?: string | null
          version_id?: string | null
        }
        Update: {
          agent_id?: string | null
          channel?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          office_id?: string | null
          started_at?: string | null
          status?: string | null
          trigger_type?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_runs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_runs_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "flow_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_versions: {
        Row: {
          created_at: string | null
          definition_json: Json
          flow_id: string | null
          id: string
          office_id: string | null
          status: string | null
          updated_at: string | null
          version_number: number
        }
        Insert: {
          created_at?: string | null
          definition_json: Json
          flow_id?: string | null
          id?: string
          office_id?: string | null
          status?: string | null
          updated_at?: string | null
          version_number: number
        }
        Update: {
          created_at?: string | null
          definition_json?: Json
          flow_id?: string | null
          id?: string
          office_id?: string | null
          status?: string | null
          updated_at?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "flow_versions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_versions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      frontend_audit_snapshots: {
        Row: {
          created_at: string | null
          created_by: string | null
          hash: string | null
          id: string
          manifest: Json | null
          menu: Json | null
          office_id: string | null
          routes: Json | null
          workflows: Json | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          hash?: string | null
          id?: string
          manifest?: Json | null
          menu?: Json | null
          office_id?: string | null
          routes?: Json | null
          workflows?: Json | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          hash?: string | null
          id?: string
          manifest?: Json | null
          menu?: Json | null
          office_id?: string | null
          routes?: Json | null
          workflows?: Json | null
        }
        Relationships: []
      }
      generated_docs: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string | null
          data_used: Json | null
          file_path: string | null
          generated_by: string | null
          id: string
          mime_type: string | null
          office_id: string | null
          source_template_id: string | null
          template_id: string | null
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_used?: Json | null
          file_path?: string | null
          generated_by?: string | null
          id?: string
          mime_type?: string | null
          office_id?: string | null
          source_template_id?: string | null
          template_id?: string | null
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_used?: Json | null
          file_path?: string | null
          generated_by?: string | null
          id?: string
          mime_type?: string | null
          office_id?: string | null
          source_template_id?: string | null
          template_id?: string | null
        }
        Relationships: []
      }
      generated_docs_legacy: {
        Row: {
          case_id: string | null
          client_id: string | null
          content: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          document_id: string | null
          file_path: string | null
          filename: string | null
          id: string
          kind: Database["public"]["Enums"]["doc_kind"] | null
          metadata: Json | null
          mime_type: string | null
          office_id: string | null
          source_template_id: string | null
          status: string | null
          title: string | null
          version: number | null
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          document_id?: string | null
          file_path?: string | null
          filename?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["doc_kind"] | null
          metadata?: Json | null
          mime_type?: string | null
          office_id?: string | null
          source_template_id?: string | null
          status?: string | null
          title?: string | null
          version?: number | null
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          document_id?: string | null
          file_path?: string | null
          filename?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["doc_kind"] | null
          metadata?: Json | null
          mime_type?: string | null
          office_id?: string | null
          source_template_id?: string | null
          status?: string | null
          title?: string | null
          version?: number | null
        }
        Relationships: []
      }
      generated_documents: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string | null
          data_used: Json | null
          file_path: string | null
          generated_by: string | null
          id: string
          mime_type: string | null
          office_id: string | null
          source_template_id: string | null
          template_id: string | null
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_used?: Json | null
          file_path?: string | null
          generated_by?: string | null
          id?: string
          mime_type?: string | null
          office_id?: string | null
          source_template_id?: string | null
          template_id?: string | null
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_used?: Json | null
          file_path?: string | null
          generated_by?: string | null
          id?: string
          mime_type?: string | null
          office_id?: string | null
          source_template_id?: string | null
          template_id?: string | null
        }
        Relationships: []
      }
      governance_reports: {
        Row: {
          block_conclusion: Json
          block_correlation: Json
          block_findings: Json
          block_identification: Json
          block_limitations: Json
          block_material: Json
          block_method: Json
          case_id: string | null
          created_at: string | null
          id: string
          is_signed: boolean | null
          metadata: Json | null
          office_id: string | null
          output_level: Database["public"]["Enums"]["output_validation_level"]
          patient_id: string | null
          report_type: string
          signed_at: string | null
          signed_by: string | null
        }
        Insert: {
          block_conclusion: Json
          block_correlation: Json
          block_findings: Json
          block_identification: Json
          block_limitations: Json
          block_material: Json
          block_method: Json
          case_id?: string | null
          created_at?: string | null
          id?: string
          is_signed?: boolean | null
          metadata?: Json | null
          office_id?: string | null
          output_level: Database["public"]["Enums"]["output_validation_level"]
          patient_id?: string | null
          report_type: string
          signed_at?: string | null
          signed_by?: string | null
        }
        Update: {
          block_conclusion?: Json
          block_correlation?: Json
          block_findings?: Json
          block_identification?: Json
          block_limitations?: Json
          block_material?: Json
          block_method?: Json
          case_id?: string | null
          created_at?: string | null
          id?: string
          is_signed?: boolean | null
          metadata?: Json | null
          office_id?: string | null
          output_level?: Database["public"]["Enums"]["output_validation_level"]
          patient_id?: string | null
          report_type?: string
          signed_at?: string | null
          signed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "governance_reports_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_reports_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeping_runs: {
        Row: {
          deleted_counts: Json
          dry_run: boolean
          duration_ms: number | null
          errors: Json
          id: string
          ran_at: string
          triggered_by: string
        }
        Insert: {
          deleted_counts?: Json
          dry_run?: boolean
          duration_ms?: number | null
          errors?: Json
          id?: string
          ran_at?: string
          triggered_by?: string
        }
        Update: {
          deleted_counts?: Json
          dry_run?: boolean
          duration_ms?: number | null
          errors?: Json
          id?: string
          ran_at?: string
          triggered_by?: string
        }
        Relationships: []
      }
      integration_jobs: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          kind: string | null
          office_id: string | null
          payload: Json | null
          provider: string | null
          result: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id?: string
          kind?: string | null
          office_id?: string | null
          payload?: Json | null
          provider?: string | null
          result?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          kind?: string | null
          office_id?: string | null
          payload?: Json | null
          provider?: string | null
          result?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      iris_analyses: {
        Row: {
          ai_response: Json | null
          analysis_type: string | null
          anamnesis_questions: Json | null
          clinical_data: string | null
          clinical_data_structured: Json | null
          created_at: string | null
          created_by: string | null
          critical_alerts: Json | null
          findings: Json | null
          id: string
          left_image_id: string | null
          office_id: string
          patient_id: string
          right_image_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ai_response?: Json | null
          analysis_type?: string | null
          anamnesis_questions?: Json | null
          clinical_data?: string | null
          clinical_data_structured?: Json | null
          created_at?: string | null
          created_by?: string | null
          critical_alerts?: Json | null
          findings?: Json | null
          id?: string
          left_image_id?: string | null
          office_id: string
          patient_id: string
          right_image_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_response?: Json | null
          analysis_type?: string | null
          anamnesis_questions?: Json | null
          clinical_data?: string | null
          clinical_data_structured?: Json | null
          created_at?: string | null
          created_by?: string | null
          critical_alerts?: Json | null
          findings?: Json | null
          id?: string
          left_image_id?: string | null
          office_id?: string
          patient_id?: string
          right_image_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iris_analyses_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iris_analyses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      job_failure_classifications: {
        Row: {
          description: string | null
          error_pattern: string
          failure_class: string
          is_retryable: boolean
        }
        Insert: {
          description?: string | null
          error_pattern: string
          failure_class: string
          is_retryable: boolean
        }
        Update: {
          description?: string | null
          error_pattern?: string
          failure_class?: string
          is_retryable?: boolean
        }
        Relationships: []
      }
      kit_generation_jobs: {
        Row: {
          attempts: number | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          error_code: string | null
          error_message: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          office_id: string | null
          requested_codes: string | null
          requested_codes_key: string | null
          status: string | null
          step: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          office_id?: string | null
          requested_codes?: string | null
          requested_codes_key?: string | null
          status?: string | null
          step?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          office_id?: string | null
          requested_codes?: string | null
          requested_codes_key?: string | null
          status?: string | null
          step?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          area: string | null
          case_id: string | null
          client_id: string | null
          config_fallback_used: boolean | null
          config_resolver_id: string | null
          config_resolver_source: string | null
          config_resolver_version: number | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          office_id: string | null
          parent_id: string | null
          tags: string[] | null
          title: string
          type: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          area?: string | null
          case_id?: string | null
          client_id?: string | null
          config_fallback_used?: boolean | null
          config_resolver_id?: string | null
          config_resolver_source?: string | null
          config_resolver_version?: number | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          office_id?: string | null
          parent_id?: string | null
          tags?: string[] | null
          title: string
          type?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          area?: string | null
          case_id?: string | null
          client_id?: string | null
          config_fallback_used?: boolean | null
          config_resolver_id?: string | null
          config_resolver_source?: string | null
          config_resolver_version?: number | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          office_id?: string | null
          parent_id?: string | null
          tags?: string[] | null
          title?: string
          type?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_signatures"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "legal_documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_documents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_precedent_jobs: {
        Row: {
          created_at: string | null
          finished_at: string | null
          id: string
          job_type: string | null
          last_error: string | null
          payload: Json | null
          source_id: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string | null
          last_error?: string | null
          payload?: Json | null
          source_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string | null
          last_error?: string | null
          payload?: Json | null
          source_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      legal_precedent_sources: {
        Row: {
          check_interval_hours: number | null
          court: string | null
          created_at: string | null
          enabled: boolean | null
          id: string
          kind: Database["public"]["Enums"]["precedent_kind"] | null
          last_check_error: string | null
          last_check_http_status: number | null
          last_checked_at: string | null
          last_run_at: string | null
          source_kind:
            | Database["public"]["Enums"]["precedent_source_kind"]
            | null
          source_url: string | null
          updated_at: string | null
        }
        Insert: {
          check_interval_hours?: number | null
          court?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          kind?: Database["public"]["Enums"]["precedent_kind"] | null
          last_check_error?: string | null
          last_check_http_status?: number | null
          last_checked_at?: string | null
          last_run_at?: string | null
          source_kind?:
            | Database["public"]["Enums"]["precedent_source_kind"]
            | null
          source_url?: string | null
          updated_at?: string | null
        }
        Update: {
          check_interval_hours?: number | null
          court?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          kind?: Database["public"]["Enums"]["precedent_kind"] | null
          last_check_error?: string | null
          last_check_http_status?: number | null
          last_checked_at?: string | null
          last_run_at?: string | null
          source_kind?:
            | Database["public"]["Enums"]["precedent_source_kind"]
            | null
          source_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      legal_precedent_suggestions: {
        Row: {
          case_id: string | null
          court: string | null
          created_at: string | null
          id: string
          kind: Database["public"]["Enums"]["precedent_kind"] | null
          number: string | null
          office_id: string | null
          rationale: string | null
          source_url: string | null
          suggested_by: string | null
          text_full: string | null
          title: string | null
          year: number | null
        }
        Insert: {
          case_id?: string | null
          court?: string | null
          created_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["precedent_kind"] | null
          number?: string | null
          office_id?: string | null
          rationale?: string | null
          source_url?: string | null
          suggested_by?: string | null
          text_full?: string | null
          title?: string | null
          year?: number | null
        }
        Update: {
          case_id?: string | null
          court?: string | null
          created_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["precedent_kind"] | null
          number?: string | null
          office_id?: string | null
          rationale?: string | null
          source_url?: string | null
          suggested_by?: string | null
          text_full?: string | null
          title?: string | null
          year?: number | null
        }
        Relationships: []
      }
      legal_precedent_versions: {
        Row: {
          captured_at: string | null
          checksum_text: string | null
          id: string
          precedent_id: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["precedent_status"] | null
          text_snapshot: string | null
        }
        Insert: {
          captured_at?: string | null
          checksum_text?: string | null
          id?: string
          precedent_id?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["precedent_status"] | null
          text_snapshot?: string | null
        }
        Update: {
          captured_at?: string | null
          checksum_text?: string | null
          id?: string
          precedent_id?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["precedent_status"] | null
          text_snapshot?: string | null
        }
        Relationships: []
      }
      legal_precedents: {
        Row: {
          area: string | null
          ativo: boolean | null
          court: string | null
          created_at: string | null
          created_by: string | null
          ementa: string | null
          id: string
          importance: number | null
          is_binding: boolean | null
          is_curated: boolean | null
          kind: string | null
          link: string | null
          link_oficial: string | null
          numero: string | null
          office_id: string | null
          official_text: string | null
          palavras_chave: string | null
          ref_code: string | null
          search_tsv: string | null
          source: string | null
          status: string | null
          summary: string | null
          tags: string | null
          thesis: string | null
          tipo: string | null
          title: string | null
          titulo: string | null
          tribunal: string | null
          updated_at: string | null
        }
        Insert: {
          area?: string | null
          ativo?: boolean | null
          court?: string | null
          created_at?: string | null
          created_by?: string | null
          ementa?: string | null
          id?: string
          importance?: number | null
          is_binding?: boolean | null
          is_curated?: boolean | null
          kind?: string | null
          link?: string | null
          link_oficial?: string | null
          numero?: string | null
          office_id?: string | null
          official_text?: string | null
          palavras_chave?: string | null
          ref_code?: string | null
          search_tsv?: string | null
          source?: string | null
          status?: string | null
          summary?: string | null
          tags?: string | null
          thesis?: string | null
          tipo?: string | null
          title?: string | null
          titulo?: string | null
          tribunal?: string | null
          updated_at?: string | null
        }
        Update: {
          area?: string | null
          ativo?: boolean | null
          court?: string | null
          created_at?: string | null
          created_by?: string | null
          ementa?: string | null
          id?: string
          importance?: number | null
          is_binding?: boolean | null
          is_curated?: boolean | null
          kind?: string | null
          link?: string | null
          link_oficial?: string | null
          numero?: string | null
          office_id?: string | null
          official_text?: string | null
          palavras_chave?: string | null
          ref_code?: string | null
          search_tsv?: string | null
          source?: string | null
          status?: string | null
          summary?: string | null
          tags?: string | null
          thesis?: string | null
          tipo?: string | null
          title?: string | null
          titulo?: string | null
          tribunal?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      legal_session_outputs: {
        Row: {
          citations_json: Json | null
          context_hash: string | null
          context_version: number | null
          context_version_id: string | null
          contradictions_json: Json | null
          created_at: string | null
          document_supported_facts_json: Json | null
          document_type: string | null
          dossier_snapshot: Json | null
          draft_document: string | null
          evidence_gaps_json: Json | null
          generation_timestamp: string | null
          id: string
          model_used: string | null
          oral_claims_json: Json | null
          output_hash: string | null
          parent_output_id: string | null
          reprocess_reason: string | null
          reprocessed_at: string | null
          reprocessed_by: string | null
          session_id: string
          snapshot_id: string | null
          status: string | null
          summary: string | null
          transcription_id: string | null
        }
        Insert: {
          citations_json?: Json | null
          context_hash?: string | null
          context_version?: number | null
          context_version_id?: string | null
          contradictions_json?: Json | null
          created_at?: string | null
          document_supported_facts_json?: Json | null
          document_type?: string | null
          dossier_snapshot?: Json | null
          draft_document?: string | null
          evidence_gaps_json?: Json | null
          generation_timestamp?: string | null
          id?: string
          model_used?: string | null
          oral_claims_json?: Json | null
          output_hash?: string | null
          parent_output_id?: string | null
          reprocess_reason?: string | null
          reprocessed_at?: string | null
          reprocessed_by?: string | null
          session_id: string
          snapshot_id?: string | null
          status?: string | null
          summary?: string | null
          transcription_id?: string | null
        }
        Update: {
          citations_json?: Json | null
          context_hash?: string | null
          context_version?: number | null
          context_version_id?: string | null
          contradictions_json?: Json | null
          created_at?: string | null
          document_supported_facts_json?: Json | null
          document_type?: string | null
          dossier_snapshot?: Json | null
          draft_document?: string | null
          evidence_gaps_json?: Json | null
          generation_timestamp?: string | null
          id?: string
          model_used?: string | null
          oral_claims_json?: Json | null
          output_hash?: string | null
          parent_output_id?: string | null
          reprocess_reason?: string | null
          reprocessed_at?: string | null
          reprocessed_by?: string | null
          session_id?: string
          snapshot_id?: string | null
          status?: string | null
          summary?: string | null
          transcription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_session_outputs_context_version_id_fkey"
            columns: ["context_version_id"]
            isOneToOne: false
            referencedRelation: "session_context_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_session_outputs_parent_output_id_fkey"
            columns: ["parent_output_id"]
            isOneToOne: false
            referencedRelation: "legal_session_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_session_outputs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_session_outputs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_session_outputs_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "session_processing_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_session_outputs_transcription_id_fkey"
            columns: ["transcription_id"]
            isOneToOne: false
            referencedRelation: "session_transcriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      lexos_case_notifications: {
        Row: {
          body: string | null
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          is_read: boolean
          office_id: string
          title: string
        }
        Insert: {
          body?: string | null
          case_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          office_id: string
          title: string
        }
        Update: {
          body?: string | null
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          office_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lexos_case_notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_notifications_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      lexos_case_state_history: {
        Row: {
          case_id: string
          changed_at: string
          changed_by: string | null
          from_state_id: string | null
          id: string
          note: string | null
          office_id: string
          to_state_id: string
        }
        Insert: {
          case_id: string
          changed_at?: string
          changed_by?: string | null
          from_state_id?: string | null
          id?: string
          note?: string | null
          office_id: string
          to_state_id: string
        }
        Update: {
          case_id?: string
          changed_at?: string
          changed_by?: string | null
          from_state_id?: string | null
          id?: string
          note?: string | null
          office_id?: string
          to_state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lexos_case_state_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_state_history_from_state_id_fkey"
            columns: ["from_state_id"]
            isOneToOne: false
            referencedRelation: "lexos_case_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_state_history_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_state_history_to_state_id_fkey"
            columns: ["to_state_id"]
            isOneToOne: false
            referencedRelation: "lexos_case_states"
            referencedColumns: ["id"]
          },
        ]
      }
      lexos_case_states: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_terminal: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_terminal?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_terminal?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      medical_governance_alerts: {
        Row: {
          created_at: string | null
          id: string
          incident_id: string | null
          is_read: boolean | null
          message: string
          office_id: string | null
          severity: Database["public"]["Enums"]["governance_severity"]
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          incident_id?: string | null
          is_read?: boolean | null
          message: string
          office_id?: string | null
          severity: Database["public"]["Enums"]["governance_severity"]
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          incident_id?: string | null
          is_read?: boolean | null
          message?: string
          office_id?: string | null
          severity?: Database["public"]["Enums"]["governance_severity"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_governance_alerts_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "medical_governance_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_governance_alerts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_governance_incidents: {
        Row: {
          auto_action_details: Json | null
          created_at: string | null
          description: string | null
          evidence: Json | null
          first_seen_at: string | null
          id: string
          incident_category: Database["public"]["Enums"]["governance_incident_category"]
          integrity_hash: string | null
          last_seen_at: string | null
          occurrence_count: number | null
          office_id: string | null
          output_level:
            | Database["public"]["Enums"]["output_validation_level"]
            | null
          policy_version_id: string | null
          severity: Database["public"]["Enums"]["governance_severity"]
          status: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          auto_action_details?: Json | null
          created_at?: string | null
          description?: string | null
          evidence?: Json | null
          first_seen_at?: string | null
          id?: string
          incident_category: Database["public"]["Enums"]["governance_incident_category"]
          integrity_hash?: string | null
          last_seen_at?: string | null
          occurrence_count?: number | null
          office_id?: string | null
          output_level?:
            | Database["public"]["Enums"]["output_validation_level"]
            | null
          policy_version_id?: string | null
          severity: Database["public"]["Enums"]["governance_severity"]
          status?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          auto_action_details?: Json | null
          created_at?: string | null
          description?: string | null
          evidence?: Json | null
          first_seen_at?: string | null
          id?: string
          incident_category?: Database["public"]["Enums"]["governance_incident_category"]
          integrity_hash?: string | null
          last_seen_at?: string | null
          occurrence_count?: number | null
          office_id?: string | null
          output_level?:
            | Database["public"]["Enums"]["output_validation_level"]
            | null
          policy_version_id?: string | null
          severity?: Database["public"]["Enums"]["governance_severity"]
          status?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_governance_incidents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_governance_incidents_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "medical_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_policy_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          policy_definition: Json
          version_tag: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          policy_definition: Json
          version_tag: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          policy_definition?: Json
          version_tag?: string
        }
        Relationships: []
      }
      medical_review_logs: {
        Row: {
          action_performed: string
          completed_at: string | null
          content_hash_at_review: string
          created_at: string | null
          id: string
          metadata: Json | null
          output_id: string
          review_duration_seconds: number | null
          reviewer_id: string
          reviewer_notes: string | null
          session_id: string
          snapshot_id: string | null
          started_at: string
        }
        Insert: {
          action_performed: string
          completed_at?: string | null
          content_hash_at_review: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          output_id: string
          review_duration_seconds?: number | null
          reviewer_id: string
          reviewer_notes?: string | null
          session_id: string
          snapshot_id?: string | null
          started_at?: string
        }
        Update: {
          action_performed?: string
          completed_at?: string | null
          content_hash_at_review?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          output_id?: string
          review_duration_seconds?: number | null
          reviewer_id?: string
          reviewer_notes?: string | null
          session_id?: string
          snapshot_id?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_review_logs_output_id_fkey"
            columns: ["output_id"]
            isOneToOne: false
            referencedRelation: "medical_session_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_review_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_review_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_review_logs_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "session_processing_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_risk_states: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          applied_reason: string | null
          cooldown_until: string | null
          expires_at: string | null
          id: string
          lifted_at: string | null
          risk_level: string | null
          risk_score: number | null
          scope_id: string
          scope_type: string
          temporary_restrictions: Json | null
          updated_at: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          applied_reason?: string | null
          cooldown_until?: string | null
          expires_at?: string | null
          id?: string
          lifted_at?: string | null
          risk_level?: string | null
          risk_score?: number | null
          scope_id: string
          scope_type: string
          temporary_restrictions?: Json | null
          updated_at?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          applied_reason?: string | null
          cooldown_until?: string | null
          expires_at?: string | null
          id?: string
          lifted_at?: string | null
          risk_level?: string | null
          risk_score?: number | null
          scope_id?: string
          scope_type?: string
          temporary_restrictions?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      medical_session_outputs: {
        Row: {
          certification_hash: string | null
          certified_at: string | null
          certified_by: string | null
          clinical_findings_json: Json | null
          clinical_snapshot: Json | null
          content_hash: string | null
          context_hash: string | null
          context_version: number | null
          context_version_id: string | null
          created_at: string | null
          generation_timestamp: string | null
          id: string
          is_finalized: boolean | null
          is_superseded: boolean
          language_safety_version: string | null
          missing_data_json: Json | null
          model_used: string | null
          output_hash: string | null
          parent_output_id: string | null
          pre_diagnosis: string | null
          pre_laud_draft: string | null
          pre_report_draft: string | null
          professional_tag_snapshot: string | null
          reprocess_reason: string | null
          reprocessed_at: string | null
          reprocessed_by: string | null
          review_duration_seconds: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_id: string
          snapshot_id: string | null
          status: Database["public"]["Enums"]["medical_output_status"]
          structured_summary: string | null
          superseded_at: string | null
          superseded_reason: string | null
          transcription_id: string | null
          version_number: number | null
        }
        Insert: {
          certification_hash?: string | null
          certified_at?: string | null
          certified_by?: string | null
          clinical_findings_json?: Json | null
          clinical_snapshot?: Json | null
          content_hash?: string | null
          context_hash?: string | null
          context_version?: number | null
          context_version_id?: string | null
          created_at?: string | null
          generation_timestamp?: string | null
          id?: string
          is_finalized?: boolean | null
          is_superseded?: boolean
          language_safety_version?: string | null
          missing_data_json?: Json | null
          model_used?: string | null
          output_hash?: string | null
          parent_output_id?: string | null
          pre_diagnosis?: string | null
          pre_laud_draft?: string | null
          pre_report_draft?: string | null
          professional_tag_snapshot?: string | null
          reprocess_reason?: string | null
          reprocessed_at?: string | null
          reprocessed_by?: string | null
          review_duration_seconds?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id: string
          snapshot_id?: string | null
          status?: Database["public"]["Enums"]["medical_output_status"]
          structured_summary?: string | null
          superseded_at?: string | null
          superseded_reason?: string | null
          transcription_id?: string | null
          version_number?: number | null
        }
        Update: {
          certification_hash?: string | null
          certified_at?: string | null
          certified_by?: string | null
          clinical_findings_json?: Json | null
          clinical_snapshot?: Json | null
          content_hash?: string | null
          context_hash?: string | null
          context_version?: number | null
          context_version_id?: string | null
          created_at?: string | null
          generation_timestamp?: string | null
          id?: string
          is_finalized?: boolean | null
          is_superseded?: boolean
          language_safety_version?: string | null
          missing_data_json?: Json | null
          model_used?: string | null
          output_hash?: string | null
          parent_output_id?: string | null
          pre_diagnosis?: string | null
          pre_laud_draft?: string | null
          pre_report_draft?: string | null
          professional_tag_snapshot?: string | null
          reprocess_reason?: string | null
          reprocessed_at?: string | null
          reprocessed_by?: string | null
          review_duration_seconds?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_id?: string
          snapshot_id?: string | null
          status?: Database["public"]["Enums"]["medical_output_status"]
          structured_summary?: string | null
          superseded_at?: string | null
          superseded_reason?: string | null
          transcription_id?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_session_outputs_context_version_id_fkey"
            columns: ["context_version_id"]
            isOneToOne: false
            referencedRelation: "session_context_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_session_outputs_parent_output_id_fkey"
            columns: ["parent_output_id"]
            isOneToOne: false
            referencedRelation: "medical_session_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_session_outputs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_session_outputs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_session_outputs_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "session_processing_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_session_outputs_transcription_id_fkey"
            columns: ["transcription_id"]
            isOneToOne: false
            referencedRelation: "session_transcriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      nija_case_analysis: {
        Row: {
          analysis: Json | null
          analysis_key: string | null
          case_id: string | null
          created_at: string | null
          documents_hash: string | null
          id: string
          session_id: string | null
        }
        Insert: {
          analysis?: Json | null
          analysis_key?: string | null
          case_id?: string | null
          created_at?: string | null
          documents_hash?: string | null
          id?: string
          session_id?: string | null
        }
        Update: {
          analysis?: Json | null
          analysis_key?: string | null
          case_id?: string | null
          created_at?: string | null
          documents_hash?: string | null
          id?: string
          session_id?: string | null
        }
        Relationships: []
      }
      nija_eproc_event_dictionary: {
        Row: {
          auto_link_to_previous: boolean | null
          category: string | null
          code: string | null
          created_at: string | null
          generates_deadline: boolean | null
          id: string
          interrupts_prescription: boolean | null
          is_active: boolean | null
          label: string | null
          meaning: string | null
          nature: string | null
          priority_score: number | null
          requires_ocr: boolean | null
          updated_at: string | null
        }
        Insert: {
          auto_link_to_previous?: boolean | null
          category?: string | null
          code?: string | null
          created_at?: string | null
          generates_deadline?: boolean | null
          id?: string
          interrupts_prescription?: boolean | null
          is_active?: boolean | null
          label?: string | null
          meaning?: string | null
          nature?: string | null
          priority_score?: number | null
          requires_ocr?: boolean | null
          updated_at?: string | null
        }
        Update: {
          auto_link_to_previous?: boolean | null
          category?: string | null
          code?: string | null
          created_at?: string | null
          generates_deadline?: boolean | null
          id?: string
          interrupts_prescription?: boolean | null
          is_active?: boolean | null
          label?: string | null
          meaning?: string | null
          nature?: string | null
          priority_score?: number | null
          requires_ocr?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      nija_extractions: {
        Row: {
          case_id: string | null
          created_at: string | null
          created_by: string | null
          document_id: string | null
          documents_hash: string | null
          extraction_hash: string | null
          extractor_version: string | null
          id: string
          integrity_hash: string | null
          legal_basis: string | null
          office_id: string | null
          origin_metadata: Json | null
          result_json: Json | null
          session_id: string | null
          system: string | null
          updated_at: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string | null
          created_by?: string | null
          document_id?: string | null
          documents_hash?: string | null
          extraction_hash?: string | null
          extractor_version?: string | null
          id?: string
          integrity_hash?: string | null
          legal_basis?: string | null
          office_id?: string | null
          origin_metadata?: Json | null
          result_json?: Json | null
          session_id?: string | null
          system?: string | null
          updated_at?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string | null
          created_by?: string | null
          document_id?: string | null
          documents_hash?: string | null
          extraction_hash?: string | null
          extractor_version?: string | null
          id?: string
          integrity_hash?: string | null
          legal_basis?: string | null
          office_id?: string | null
          origin_metadata?: Json | null
          result_json?: Json | null
          session_id?: string | null
          system?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      nija_generated_pieces: {
        Row: {
          case_id: string | null
          created_at: string | null
          documents_hash: string | null
          id: string
          piece: Json | null
          piece_type: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string | null
          documents_hash?: string | null
          id?: string
          piece?: Json | null
          piece_type?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string | null
          documents_hash?: string | null
          id?: string
          piece?: Json | null
          piece_type?: string | null
        }
        Relationships: []
      }
      nija_logs: {
        Row: {
          action: string | null
          case_id: string | null
          created_at: string | null
          duration_ms: number | null
          error: Json | null
          id: string
          level: string | null
          office_id: string | null
          payload: Json | null
          result: Json | null
          session_id: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          case_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error?: Json | null
          id?: string
          level?: string | null
          office_id?: string | null
          payload?: Json | null
          result?: Json | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          case_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error?: Json | null
          id?: string
          level?: string | null
          office_id?: string | null
          payload?: Json | null
          result?: Json | null
          session_id?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      nija_loose_docs: {
        Row: {
          created_at: string | null
          extracted_text: string | null
          file_size: number | null
          filename: string | null
          id: string
          mime_type: string | null
          session_id: string | null
          storage_bucket: string | null
          storage_path: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          extracted_text?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          session_id?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          extracted_text?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          session_id?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      nija_pipeline_runs: {
        Row: {
          case_id: string
          config_fallback_used: boolean | null
          config_resolver_id: string | null
          config_resolver_source: string | null
          config_resolver_version: number | null
          current_stage: string | null
          dossier_id: string | null
          final_piece_id: string | null
          finished_at: string | null
          id: string
          initial_piece_id: string | null
          judge_simulation_id: string | null
          logs: string[] | null
          metadata: Json | null
          office_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          case_id: string
          config_fallback_used?: boolean | null
          config_resolver_id?: string | null
          config_resolver_source?: string | null
          config_resolver_version?: number | null
          current_stage?: string | null
          dossier_id?: string | null
          final_piece_id?: string | null
          finished_at?: string | null
          id?: string
          initial_piece_id?: string | null
          judge_simulation_id?: string | null
          logs?: string[] | null
          metadata?: Json | null
          office_id: string
          started_at?: string
          status: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          config_fallback_used?: boolean | null
          config_resolver_id?: string | null
          config_resolver_source?: string | null
          config_resolver_version?: number | null
          current_stage?: string | null
          dossier_id?: string | null
          final_piece_id?: string | null
          finished_at?: string | null
          id?: string
          initial_piece_id?: string | null
          judge_simulation_id?: string | null
          logs?: string[] | null
          metadata?: Json | null
          office_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nija_pipeline_runs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_pipeline_runs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      nija_reviews: {
        Row: {
          config_fallback_used: boolean | null
          config_resolver_id: string | null
          config_resolver_source: string | null
          config_resolver_version: number | null
          created_at: string
          critical_risks: Json | null
          document_id: string
          id: string
          office_id: string
          quality_score: number | null
          report_json: Json | null
          structured_findings: Json | null
          suggestions: Json | null
        }
        Insert: {
          config_fallback_used?: boolean | null
          config_resolver_id?: string | null
          config_resolver_source?: string | null
          config_resolver_version?: number | null
          created_at?: string
          critical_risks?: Json | null
          document_id: string
          id?: string
          office_id: string
          quality_score?: number | null
          report_json?: Json | null
          structured_findings?: Json | null
          suggestions?: Json | null
        }
        Update: {
          config_fallback_used?: boolean | null
          config_resolver_id?: string | null
          config_resolver_source?: string | null
          config_resolver_version?: number | null
          created_at?: string
          critical_risks?: Json | null
          document_id?: string
          id?: string
          office_id?: string
          quality_score?: number | null
          report_json?: Json | null
          structured_findings?: Json | null
          suggestions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "nija_reviews_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      nija_sessions: {
        Row: {
          acting_side: string | null
          analysis_result: Json | null
          attachments: Json | null
          case_id: string | null
          client_name: string | null
          cnj_number: string | null
          created_at: string | null
          created_by: string | null
          document_ids: Json | null
          document_names: Json | null
          documents_hash: string | null
          extraction_result: Json | null
          id: string
          input_summary: string | null
          mode: string | null
          office_id: string | null
          opponent_name: string | null
          output_alerts: Json | null
          output_checklist: Json | null
          output_draft: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          acting_side?: string | null
          analysis_result?: Json | null
          attachments?: Json | null
          case_id?: string | null
          client_name?: string | null
          cnj_number?: string | null
          created_at?: string | null
          created_by?: string | null
          document_ids?: Json | null
          document_names?: Json | null
          documents_hash?: string | null
          extraction_result?: Json | null
          id?: string
          input_summary?: string | null
          mode?: string | null
          office_id?: string | null
          opponent_name?: string | null
          output_alerts?: Json | null
          output_checklist?: Json | null
          output_draft?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          acting_side?: string | null
          analysis_result?: Json | null
          attachments?: Json | null
          case_id?: string | null
          client_name?: string | null
          cnj_number?: string | null
          created_at?: string | null
          created_by?: string | null
          document_ids?: Json | null
          document_names?: Json | null
          documents_hash?: string | null
          extraction_result?: Json | null
          id?: string
          input_summary?: string | null
          mode?: string | null
          office_id?: string | null
          opponent_name?: string | null
          output_alerts?: Json | null
          output_checklist?: Json | null
          output_draft?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      nija_tjto_document_dictionary: {
        Row: {
          active: boolean | null
          category: string | null
          code: string | null
          created_at: string | null
          id: string
          label: string | null
          legal_desc: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          legal_desc?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          code?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          legal_desc?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      nija_usage: {
        Row: {
          case_id: string | null
          created_at: string | null
          executed_by: string | null
          id: string
          module: string | null
          office_id: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string | null
          executed_by?: string | null
          id?: string
          module?: string | null
          office_id?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string | null
          executed_by?: string | null
          id?: string
          module?: string | null
          office_id?: string | null
        }
        Relationships: []
      }
      office_ai_budgets: {
        Row: {
          anomaly_threshold_multiplier: number | null
          created_at: string
          daily_hard_cap: number
          daily_token_cap: number
          last_reset_date: string
          last_reset_month: string
          monthly_cap: number
          office_id: string
          override_by: string | null
          override_expires_at: string | null
          override_reason: string | null
          tokens_used_month: number
          tokens_used_today: number
          updated_at: string
          warn_threshold_pct: number
          weekly_token_cap: number | null
          weekly_tokens_used: number | null
        }
        Insert: {
          anomaly_threshold_multiplier?: number | null
          created_at?: string
          daily_hard_cap?: number
          daily_token_cap?: number
          last_reset_date?: string
          last_reset_month?: string
          monthly_cap?: number
          office_id: string
          override_by?: string | null
          override_expires_at?: string | null
          override_reason?: string | null
          tokens_used_month?: number
          tokens_used_today?: number
          updated_at?: string
          warn_threshold_pct?: number
          weekly_token_cap?: number | null
          weekly_tokens_used?: number | null
        }
        Update: {
          anomaly_threshold_multiplier?: number | null
          created_at?: string
          daily_hard_cap?: number
          daily_token_cap?: number
          last_reset_date?: string
          last_reset_month?: string
          monthly_cap?: number
          office_id?: string
          override_by?: string | null
          override_expires_at?: string | null
          override_reason?: string | null
          tokens_used_month?: number
          tokens_used_today?: number
          updated_at?: string
          warn_threshold_pct?: number
          weekly_token_cap?: number | null
          weekly_tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "office_ai_budgets_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_ai_policies: {
        Row: {
          block_unreviewed_output: boolean
          created_at: string
          forensic_mode_enabled: boolean
          id: string
          low_temperature_mode: boolean
          max_refinement_attempts: number
          multi_stage_generation_enabled: boolean
          office_id: string
          strict_grammar_check: boolean
          updated_at: string
        }
        Insert: {
          block_unreviewed_output?: boolean
          created_at?: string
          forensic_mode_enabled?: boolean
          id?: string
          low_temperature_mode?: boolean
          max_refinement_attempts?: number
          multi_stage_generation_enabled?: boolean
          office_id: string
          strict_grammar_check?: boolean
          updated_at?: string
        }
        Update: {
          block_unreviewed_output?: boolean
          created_at?: string
          forensic_mode_enabled?: boolean
          id?: string
          low_temperature_mode?: boolean
          max_refinement_attempts?: number
          multi_stage_generation_enabled?: boolean
          office_id?: string
          strict_grammar_check?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_ai_policies_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_integrations: {
        Row: {
          access_token: string | null
          calendar_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          last_error: string | null
          office_id: string
          provider: string
          provider_account_email: string | null
          refresh_token: string
          scopes: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_error?: string | null
          office_id: string
          provider: string
          provider_account_email?: string | null
          refresh_token: string
          scopes?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_error?: string | null
          office_id?: string
          provider?: string
          provider_account_email?: string | null
          refresh_token?: string
          scopes?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "office_integrations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string
          invited_by: string | null
          office_id: string | null
          phone: string | null
          role: string | null
          token: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          office_id?: string | null
          phone?: string | null
          role?: string | null
          token?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          office_id?: string | null
          phone?: string | null
          role?: string | null
          token?: string | null
        }
        Relationships: []
      }
      office_members: {
        Row: {
          address_city: string | null
          address_neighborhood: string | null
          address_state: string | null
          address_street: string | null
          address_zip_code: string | null
          avatar_url: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          marital_status: string | null
          nationality: string | null
          oab_number: string | null
          oab_uf: string | null
          office_id: string | null
          phone: string | null
          profession: string | null
          rg: string | null
          rg_issuer: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          marital_status?: string | null
          nationality?: string | null
          oab_number?: string | null
          oab_uf?: string | null
          office_id?: string | null
          phone?: string | null
          profession?: string | null
          rg?: string | null
          rg_issuer?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          marital_status?: string | null
          nationality?: string | null
          oab_number?: string | null
          oab_uf?: string | null
          office_id?: string | null
          phone?: string | null
          profession?: string | null
          rg?: string | null
          rg_issuer?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      office_onboarding_steps: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          office_id: string
          step_key: string
          updated_at: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          office_id: string
          step_key: string
          updated_at?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          office_id?: string
          step_key?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "office_onboarding_steps_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_settings: {
        Row: {
          created_at: string | null
          knowledge_cache_ttl_minutes: number | null
          nija_soft_limit_pct: number | null
          office_id: string | null
          plan_code: string | null
          precedents_limit: number | null
          prefer_curated: boolean | null
          updated_at: string | null
          videos_limit: number | null
        }
        Insert: {
          created_at?: string | null
          knowledge_cache_ttl_minutes?: number | null
          nija_soft_limit_pct?: number | null
          office_id?: string | null
          plan_code?: string | null
          precedents_limit?: number | null
          prefer_curated?: boolean | null
          updated_at?: string | null
          videos_limit?: number | null
        }
        Update: {
          created_at?: string | null
          knowledge_cache_ttl_minutes?: number | null
          nija_soft_limit_pct?: number | null
          office_id?: string | null
          plan_code?: string | null
          precedents_limit?: number | null
          prefer_curated?: boolean | null
          updated_at?: string | null
          videos_limit?: number | null
        }
        Relationships: []
      }
      office_ui_settings: {
        Row: {
          accent: string | null
          office_id: string | null
          sidebar_logo_scale: number | null
          ui_density: string | null
          ui_font: string | null
          ui_scale: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          accent?: string | null
          office_id?: string | null
          sidebar_logo_scale?: number | null
          ui_density?: string | null
          ui_font?: string | null
          ui_scale?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          accent?: string | null
          office_id?: string | null
          sidebar_logo_scale?: number | null
          ui_density?: string | null
          ui_font?: string | null
          ui_scale?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      office_units: {
        Row: {
          address_line: string | null
          city: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          office_id: string
          state: string | null
          unit_type: string | null
          updated_at: string | null
        }
        Insert: {
          address_line?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          office_id: string
          state?: string | null
          unit_type?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line?: string | null
          city?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          office_id?: string
          state?: string | null
          unit_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "office_units_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          address_city: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip_code: string | null
          branding: Json | null
          city: string | null
          cnpj: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          header_block: string | null
          id: string
          instagram_handle: string | null
          institutional_notes: string | null
          legal_name: string | null
          logo_storage_bucket: string | null
          logo_storage_path: string | null
          metadata: Json | null
          name: string | null
          nija_limit_monthly: number | null
          nija_runs_monthly: number | null
          nija_runs_reset_at: string | null
          oab_number: string | null
          oab_sociedade: string | null
          oab_uf: string | null
          office_type: string | null
          onboarding_completed: boolean | null
          primary_color: string | null
          responsible_lawyer_name: string | null
          responsible_lawyer_oab_number: string | null
          responsible_lawyer_oab_uf: string | null
          secondary_color: string | null
          signature_storage_bucket: string | null
          signature_storage_path: string | null
          slug: string | null
          state: string | null
          website_url: string | null
        }
        Insert: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          branding?: Json | null
          city?: string | null
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          header_block?: string | null
          id?: string
          instagram_handle?: string | null
          institutional_notes?: string | null
          legal_name?: string | null
          logo_storage_bucket?: string | null
          logo_storage_path?: string | null
          metadata?: Json | null
          name?: string | null
          nija_limit_monthly?: number | null
          nija_runs_monthly?: number | null
          nija_runs_reset_at?: string | null
          oab_number?: string | null
          oab_sociedade?: string | null
          oab_uf?: string | null
          office_type?: string | null
          onboarding_completed?: boolean | null
          primary_color?: string | null
          responsible_lawyer_name?: string | null
          responsible_lawyer_oab_number?: string | null
          responsible_lawyer_oab_uf?: string | null
          secondary_color?: string | null
          signature_storage_bucket?: string | null
          signature_storage_path?: string | null
          slug?: string | null
          state?: string | null
          website_url?: string | null
        }
        Update: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          branding?: Json | null
          city?: string | null
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          header_block?: string | null
          id?: string
          instagram_handle?: string | null
          institutional_notes?: string | null
          legal_name?: string | null
          logo_storage_bucket?: string | null
          logo_storage_path?: string | null
          metadata?: Json | null
          name?: string | null
          nija_limit_monthly?: number | null
          nija_runs_monthly?: number | null
          nija_runs_reset_at?: string | null
          oab_number?: string | null
          oab_sociedade?: string | null
          oab_uf?: string | null
          office_type?: string | null
          onboarding_completed?: boolean | null
          primary_color?: string | null
          responsible_lawyer_name?: string | null
          responsible_lawyer_oab_number?: string | null
          responsible_lawyer_oab_uf?: string | null
          secondary_color?: string | null
          signature_storage_bucket?: string | null
          signature_storage_path?: string | null
          slug?: string | null
          state?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      operator_action_log: {
        Row: {
          action_type: string
          created_at: string
          error_detail: string | null
          execution_result: string
          id: string
          idempotency_key: string | null
          justification: string | null
          office_id: string | null
          operator_id: string
          operator_role: string
          rejection_reason: string | null
          target_resource_id: string | null
          target_resource_type: string | null
          trace_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          error_detail?: string | null
          execution_result: string
          id?: string
          idempotency_key?: string | null
          justification?: string | null
          office_id?: string | null
          operator_id: string
          operator_role: string
          rejection_reason?: string | null
          target_resource_id?: string | null
          target_resource_type?: string | null
          trace_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          error_detail?: string | null
          execution_result?: string
          id?: string
          idempotency_key?: string | null
          justification?: string | null
          office_id?: string | null
          operator_id?: string
          operator_role?: string
          rejection_reason?: string | null
          target_resource_id?: string | null
          target_resource_type?: string | null
          trace_id?: string | null
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          ai_extracted: boolean | null
          client_id: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string | null
          created_by: string | null
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          id: string
          lgpd_consent: boolean | null
          lgpd_consent_at: string | null
          marital_status: string | null
          metadata: Json | null
          nationality: string | null
          nome: string
          office_id: string
          person_type: string | null
          profession: string | null
          representative_cpf: string | null
          representative_marital_status: string | null
          representative_name: string | null
          representative_nationality: string | null
          representative_profession: string | null
          representative_rg: string | null
          representative_rg_issuer: string | null
          rg: string | null
          rg_issuer: string | null
          sexo: string | null
          source: string | null
          status: string | null
          telefone: string | null
          trade_name: string | null
          updated_at: string | null
        }
        Insert: {
          ai_extracted?: boolean | null
          client_id?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          lgpd_consent?: boolean | null
          lgpd_consent_at?: string | null
          marital_status?: string | null
          metadata?: Json | null
          nationality?: string | null
          nome: string
          office_id: string
          person_type?: string | null
          profession?: string | null
          representative_cpf?: string | null
          representative_marital_status?: string | null
          representative_name?: string | null
          representative_nationality?: string | null
          representative_profession?: string | null
          representative_rg?: string | null
          representative_rg_issuer?: string | null
          rg?: string | null
          rg_issuer?: string | null
          sexo?: string | null
          source?: string | null
          status?: string | null
          telefone?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_extracted?: boolean | null
          client_id?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          lgpd_consent?: boolean | null
          lgpd_consent_at?: string | null
          marital_status?: string | null
          metadata?: Json | null
          nationality?: string | null
          nome?: string
          office_id?: string
          person_type?: string | null
          profession?: string | null
          representative_cpf?: string | null
          representative_marital_status?: string | null
          representative_name?: string | null
          representative_nationality?: string | null
          representative_profession?: string | null
          representative_rg?: string | null
          representative_rg_issuer?: string | null
          rg?: string | null
          rg_issuer?: string | null
          sexo?: string | null
          source?: string | null
          status?: string | null
          telefone?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_signatures"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pacientes_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      plaud_analysis_jobs: {
        Row: {
          case_id: string | null
          created_at: string | null
          error: string | null
          finished_at: string | null
          id: string
          office_id: string | null
          plaud_asset_id: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          office_id?: string | null
          plaud_asset_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          office_id?: string | null
          plaud_asset_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      plaud_asset_analysis: {
        Row: {
          analysis: Json | null
          created_at: string | null
          id: string
          model_used: string | null
          plaud_asset_id: string | null
          tokens_used: number | null
        }
        Insert: {
          analysis?: Json | null
          created_at?: string | null
          id?: string
          model_used?: string | null
          plaud_asset_id?: string | null
          tokens_used?: number | null
        }
        Update: {
          analysis?: Json | null
          created_at?: string | null
          id?: string
          model_used?: string | null
          plaud_asset_id?: string | null
          tokens_used?: number | null
        }
        Relationships: []
      }
      plaud_assets: {
        Row: {
          assigned_to: string | null
          audio_url: string | null
          case_id: string | null
          created_at: string | null
          created_at_source: string | null
          created_by: string | null
          duration: number | null
          external_id: string | null
          id: string
          is_office_visible: boolean | null
          language: string | null
          linked_at: string | null
          linked_by: string | null
          occurred_at: string | null
          office_id: string | null
          raw: Json | null
          received_at: string | null
          source: string | null
          summary: string | null
          title: string | null
          transcript: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          audio_url?: string | null
          case_id?: string | null
          created_at?: string | null
          created_at_source?: string | null
          created_by?: string | null
          duration?: number | null
          external_id?: string | null
          id?: string
          is_office_visible?: boolean | null
          language?: string | null
          linked_at?: string | null
          linked_by?: string | null
          occurred_at?: string | null
          office_id?: string | null
          raw?: Json | null
          received_at?: string | null
          source?: string | null
          summary?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          audio_url?: string | null
          case_id?: string | null
          created_at?: string | null
          created_at_source?: string | null
          created_by?: string | null
          duration?: number | null
          external_id?: string | null
          id?: string
          is_office_visible?: boolean | null
          language?: string | null
          linked_at?: string | null
          linked_by?: string | null
          occurred_at?: string | null
          office_id?: string | null
          raw?: Json | null
          received_at?: string | null
          source?: string | null
          summary?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      plaud_senior_analysis: {
        Row: {
          case_id: string | null
          checklist: Json | null
          consequencia_juridica: string | null
          created_at: string | null
          decisao_estrategica: string | null
          fase_processual: string | null
          fato_central: string | null
          fundamento_legal: string | null
          id: string
          justificativa_silencio: string | null
          model_version: string | null
          office_id: string | null
          peca_sugerida: string | null
          plaud_asset_id: string | null
          risco_preclusao: string | null
          status_juridico: string | null
          tipo_ato: string | null
          tokens_used: number | null
          updated_at: string | null
        }
        Insert: {
          case_id?: string | null
          checklist?: Json | null
          consequencia_juridica?: string | null
          created_at?: string | null
          decisao_estrategica?: string | null
          fase_processual?: string | null
          fato_central?: string | null
          fundamento_legal?: string | null
          id?: string
          justificativa_silencio?: string | null
          model_version?: string | null
          office_id?: string | null
          peca_sugerida?: string | null
          plaud_asset_id?: string | null
          risco_preclusao?: string | null
          status_juridico?: string | null
          tipo_ato?: string | null
          tokens_used?: number | null
          updated_at?: string | null
        }
        Update: {
          case_id?: string | null
          checklist?: Json | null
          consequencia_juridica?: string | null
          created_at?: string | null
          decisao_estrategica?: string | null
          fase_processual?: string | null
          fato_central?: string | null
          fundamento_legal?: string | null
          id?: string
          justificativa_silencio?: string | null
          model_version?: string | null
          office_id?: string | null
          peca_sugerida?: string | null
          plaud_asset_id?: string | null
          risco_preclusao?: string | null
          status_juridico?: string | null
          tipo_ato?: string | null
          tokens_used?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      process_dossiers: {
        Row: {
          case_id: string | null
          config_fallback_used: boolean | null
          config_resolver_id: string | null
          config_resolver_source: string | null
          config_resolver_version: number | null
          created_at: string | null
          documentos_utilizados: string[] | null
          drafting_readiness_status: string | null
          estrategias: Json | null
          evidence_inventory: string | null
          fase_processual: string | null
          fato_prova_map: Json | null
          full_analysis: Json
          grau_risco: string | null
          id: string
          lacunas_detectadas: Json | null
          office_id: string | null
          pedidos_estruturados: Json | null
          polo: string | null
          provas: Json | null
          ramo: string | null
          resumo_tatico: Json | null
          sugestao_peca: Json | null
          timeline_factual: Json | null
          timeline_processual: Json | null
          updated_at: string | null
          version: number
          vicios: Json | null
        }
        Insert: {
          case_id?: string | null
          config_fallback_used?: boolean | null
          config_resolver_id?: string | null
          config_resolver_source?: string | null
          config_resolver_version?: number | null
          created_at?: string | null
          documentos_utilizados?: string[] | null
          drafting_readiness_status?: string | null
          estrategias?: Json | null
          evidence_inventory?: string | null
          fase_processual?: string | null
          fato_prova_map?: Json | null
          full_analysis?: Json
          grau_risco?: string | null
          id?: string
          lacunas_detectadas?: Json | null
          office_id?: string | null
          pedidos_estruturados?: Json | null
          polo?: string | null
          provas?: Json | null
          ramo?: string | null
          resumo_tatico?: Json | null
          sugestao_peca?: Json | null
          timeline_factual?: Json | null
          timeline_processual?: Json | null
          updated_at?: string | null
          version?: number
          vicios?: Json | null
        }
        Update: {
          case_id?: string | null
          config_fallback_used?: boolean | null
          config_resolver_id?: string | null
          config_resolver_source?: string | null
          config_resolver_version?: number | null
          created_at?: string | null
          documentos_utilizados?: string[] | null
          drafting_readiness_status?: string | null
          estrategias?: Json | null
          evidence_inventory?: string | null
          fase_processual?: string | null
          fato_prova_map?: Json | null
          full_analysis?: Json
          grau_risco?: string | null
          id?: string
          lacunas_detectadas?: Json | null
          office_id?: string | null
          pedidos_estruturados?: Json | null
          polo?: string | null
          provas?: Json | null
          ramo?: string | null
          resumo_tatico?: Json | null
          sugestao_peca?: Json | null
          timeline_factual?: Json | null
          timeline_processual?: Json | null
          updated_at?: string | null
          version?: number
          vicios?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "process_dossiers_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_dossiers_config_resolver_id_fkey"
            columns: ["config_resolver_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_dossiers_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      production_readiness_checks: {
        Row: {
          category: string
          check_name: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_blocking: boolean
          threshold: number | null
          threshold_unit: string | null
        }
        Insert: {
          category: string
          check_name: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          is_blocking?: boolean
          threshold?: number | null
          threshold_unit?: string | null
        }
        Update: {
          category?: string
          check_name?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_blocking?: boolean
          threshold?: number | null
          threshold_unit?: string | null
        }
        Relationships: []
      }
      production_readiness_runs: {
        Row: {
          all_results: Json
          blocking_failures: Json
          check_count: number
          failed_count: number
          id: string
          overall_passing: boolean
          ran_at: string
          triggered_by: string
          warning_failures: Json
        }
        Insert: {
          all_results?: Json
          blocking_failures?: Json
          check_count?: number
          failed_count?: number
          id?: string
          overall_passing: boolean
          ran_at?: string
          triggered_by?: string
          warning_failures?: Json
        }
        Update: {
          all_results?: Json
          blocking_failures?: Json
          check_count?: number
          failed_count?: number
          id?: string
          overall_passing?: boolean
          ran_at?: string
          triggered_by?: string
          warning_failures?: Json
        }
        Relationships: []
      }
      profile_professional_settings: {
        Row: {
          created_at: string | null
          id: string
          ident_number: string | null
          ident_type: string | null
          ident_uf: string | null
          legal_specific: Json | null
          medical_specific: Json | null
          office_id: string
          professional_name: string | null
          signatures: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ident_number?: string | null
          ident_type?: string | null
          ident_uf?: string | null
          legal_specific?: Json | null
          medical_specific?: Json | null
          office_id: string
          professional_name?: string | null
          signatures?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ident_number?: string | null
          ident_type?: string | null
          ident_uf?: string | null
          legal_specific?: Json | null
          medical_specific?: Json | null
          office_id?: string
          professional_name?: string | null
          signatures?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_professional_settings_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolos_terapeuticos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          condicao: string
          conteudo: Json | null
          created_at: string | null
          descricao: string | null
          id: string
          nivel_evidencia: string | null
          office_id: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          condicao: string
          conteudo?: Json | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nivel_evidencia?: string | null
          office_id: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          condicao?: string
          conteudo?: Json | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nivel_evidencia?: string | null
          office_id?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "protocolos_terapeuticos_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          action: string
          blocked_at: string | null
          count: number
          created_at: string
          id: string
          scope_id: string
          scope_type: string
          window_start: string
        }
        Insert: {
          action: string
          blocked_at?: string | null
          count?: number
          created_at?: string
          id?: string
          scope_id: string
          scope_type: string
          window_start?: string
        }
        Update: {
          action?: string
          blocked_at?: string | null
          count?: number
          created_at?: string
          id?: string
          scope_id?: string
          scope_type?: string
          window_start?: string
        }
        Relationships: []
      }
      rebuild_jobs: {
        Row: {
          audit_snapshot_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          frontend_snapshot_id: string | null
          functions_sql: string | null
          id: string
          mode: string | null
          office_id: string | null
          rebuild_plan_md: string | null
          rls_sql: string | null
          schema_sql: string | null
          status: string | null
        }
        Insert: {
          audit_snapshot_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          frontend_snapshot_id?: string | null
          functions_sql?: string | null
          id?: string
          mode?: string | null
          office_id?: string | null
          rebuild_plan_md?: string | null
          rls_sql?: string | null
          schema_sql?: string | null
          status?: string | null
        }
        Update: {
          audit_snapshot_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          frontend_snapshot_id?: string | null
          functions_sql?: string | null
          id?: string
          mode?: string | null
          office_id?: string | null
          rebuild_plan_md?: string | null
          rls_sql?: string | null
          schema_sql?: string | null
          status?: string | null
        }
        Relationships: []
      }
      receitas_dietas: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          itens: Json | null
          office_id: string
          orientacoes: string | null
          patient_id: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          itens?: Json | null
          office_id: string
          orientacoes?: string | null
          patient_id: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          itens?: Json | null
          office_id?: string
          orientacoes?: string | null
          patient_id?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receitas_dietas_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_dietas_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_quotas: {
        Row: {
          billing_cycle_end: string
          billing_cycle_start: string
          created_at: string
          forensic_reviews_count: number | null
          id: string
          legal_pieces_limit: number
          legal_pieces_used: number
          medical_analysis_limit: number
          medical_analysis_used: number
          office_id: string
          refinement_cycles_count: number | null
          updated_at: string
        }
        Insert: {
          billing_cycle_end?: string
          billing_cycle_start?: string
          created_at?: string
          forensic_reviews_count?: number | null
          id?: string
          legal_pieces_limit?: number
          legal_pieces_used?: number
          medical_analysis_limit?: number
          medical_analysis_used?: number
          office_id: string
          refinement_cycles_count?: number | null
          updated_at?: string
        }
        Update: {
          billing_cycle_end?: string
          billing_cycle_start?: string
          created_at?: string
          forensic_reviews_count?: number | null
          id?: string
          legal_pieces_limit?: number
          legal_pieces_used?: number
          medical_analysis_limit?: number
          medical_analysis_used?: number
          office_id?: string
          refinement_cycles_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_quotas_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      session_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          execution_context: string | null
          id: string
          metadata: Json | null
          new_value: Json | null
          office_id: string
          old_value: Json | null
          performed_by: string | null
          resource_id: string
          resource_type: string
          session_id: string | null
          trigger_source: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          execution_context?: string | null
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          office_id: string
          old_value?: Json | null
          performed_by?: string | null
          resource_id: string
          resource_type: string
          session_id?: string | null
          trigger_source?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          execution_context?: string | null
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          office_id?: string
          old_value?: Json | null
          performed_by?: string | null
          resource_id?: string
          resource_type?: string
          session_id?: string | null
          trigger_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_audit_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_audit_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      session_context_sources: {
        Row: {
          content_snapshot: string | null
          context_version: number
          id: string
          included_at: string | null
          included_by: string | null
          relevance_score: number | null
          session_id: string
          source_hash: string | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["context_source_type"]
        }
        Insert: {
          content_snapshot?: string | null
          context_version?: number
          id?: string
          included_at?: string | null
          included_by?: string | null
          relevance_score?: number | null
          session_id: string
          source_hash?: string | null
          source_id?: string | null
          source_type: Database["public"]["Enums"]["context_source_type"]
        }
        Update: {
          content_snapshot?: string | null
          context_version?: number
          id?: string
          included_at?: string | null
          included_by?: string | null
          relevance_score?: number | null
          session_id?: string
          source_hash?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["context_source_type"]
        }
        Relationships: [
          {
            foreignKeyName: "session_context_sources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_context_sources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      session_context_versions: {
        Row: {
          context_hash: string
          context_snapshot: Json
          created_at: string | null
          id: string
          session_id: string
          version_number: number
        }
        Insert: {
          context_hash: string
          context_snapshot: Json
          created_at?: string | null
          id?: string
          session_id: string
          version_number: number
        }
        Update: {
          context_hash?: string
          context_snapshot?: Json
          created_at?: string | null
          id?: string
          session_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_context_versions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_context_versions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      session_health_alerts: {
        Row: {
          alert_type: string
          created_at: string
          detail: Json | null
          id: string
          office_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          session_id: string
          severity: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          detail?: Json | null
          id?: string
          office_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id: string
          severity?: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          detail?: Json | null
          id?: string
          office_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_health_alerts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_health_alerts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_health_alerts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      session_jobs: {
        Row: {
          actual_tokens_input: number | null
          actual_tokens_output: number | null
          attempt_count: number
          cache_hit: boolean | null
          claimed_at: string | null
          compensation_reason: string | null
          config_json: Json
          cost_usd: number | null
          created_at: string
          created_by: string | null
          decision_taken: string | null
          dedup_hit: boolean | null
          estimated_cost_usd: number | null
          execution_duration_ms: number | null
          finished_at: string | null
          heartbeat_interval_s: number
          id: string
          idempotency_key: string
          job_type: Database["public"]["Enums"]["session_job_type"]
          last_error: string | null
          last_heartbeat_at: string | null
          lease_duration_s: number
          lease_expires_at: string | null
          max_attempts: number
          office_id: string
          priority: number
          reclaim_attempts: number
          scheduled_at: string
          session_id: string
          side_effect_confirmed: boolean
          started_at: string | null
          status: Database["public"]["Enums"]["session_job_status"]
          token_estimate: number | null
          trace_id: string | null
          updated_at: string
          worker_id: string | null
          worker_type: Database["public"]["Enums"]["session_worker_type"]
        }
        Insert: {
          actual_tokens_input?: number | null
          actual_tokens_output?: number | null
          attempt_count?: number
          cache_hit?: boolean | null
          claimed_at?: string | null
          compensation_reason?: string | null
          config_json?: Json
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          decision_taken?: string | null
          dedup_hit?: boolean | null
          estimated_cost_usd?: number | null
          execution_duration_ms?: number | null
          finished_at?: string | null
          heartbeat_interval_s?: number
          id?: string
          idempotency_key: string
          job_type: Database["public"]["Enums"]["session_job_type"]
          last_error?: string | null
          last_heartbeat_at?: string | null
          lease_duration_s?: number
          lease_expires_at?: string | null
          max_attempts?: number
          office_id: string
          priority?: number
          reclaim_attempts?: number
          scheduled_at?: string
          session_id: string
          side_effect_confirmed?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_job_status"]
          token_estimate?: number | null
          trace_id?: string | null
          updated_at?: string
          worker_id?: string | null
          worker_type: Database["public"]["Enums"]["session_worker_type"]
        }
        Update: {
          actual_tokens_input?: number | null
          actual_tokens_output?: number | null
          attempt_count?: number
          cache_hit?: boolean | null
          claimed_at?: string | null
          compensation_reason?: string | null
          config_json?: Json
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          decision_taken?: string | null
          dedup_hit?: boolean | null
          estimated_cost_usd?: number | null
          execution_duration_ms?: number | null
          finished_at?: string | null
          heartbeat_interval_s?: number
          id?: string
          idempotency_key?: string
          job_type?: Database["public"]["Enums"]["session_job_type"]
          last_error?: string | null
          last_heartbeat_at?: string | null
          lease_duration_s?: number
          lease_expires_at?: string | null
          max_attempts?: number
          office_id?: string
          priority?: number
          reclaim_attempts?: number
          scheduled_at?: string
          session_id?: string
          side_effect_confirmed?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_job_status"]
          token_estimate?: number | null
          trace_id?: string | null
          updated_at?: string
          worker_id?: string | null
          worker_type?: Database["public"]["Enums"]["session_worker_type"]
        }
        Relationships: [
          {
            foreignKeyName: "session_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_jobs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_jobs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      session_processing_snapshots: {
        Row: {
          context_hash: string
          context_version: number
          created_at: string | null
          created_by: string | null
          excluded_sources_json: Json | null
          id: string
          model_metadata_json: Json | null
          ordered_sources_json: Json
          prompt_metadata_json: Json | null
          session_id: string
          snapshot_hash: string
          transcription_id: string
        }
        Insert: {
          context_hash: string
          context_version: number
          created_at?: string | null
          created_by?: string | null
          excluded_sources_json?: Json | null
          id?: string
          model_metadata_json?: Json | null
          ordered_sources_json: Json
          prompt_metadata_json?: Json | null
          session_id: string
          snapshot_hash: string
          transcription_id: string
        }
        Update: {
          context_hash?: string
          context_version?: number
          created_at?: string | null
          created_by?: string | null
          excluded_sources_json?: Json | null
          id?: string
          model_metadata_json?: Json | null
          ordered_sources_json?: Json
          prompt_metadata_json?: Json | null
          session_id?: string
          snapshot_hash?: string
          transcription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_processing_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_processing_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_processing_snapshots_transcription_id_fkey"
            columns: ["transcription_id"]
            isOneToOne: false
            referencedRelation: "session_transcriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_recording_chunks: {
        Row: {
          checksum_sha256: string | null
          chunk_index: number
          confirmed_at: string | null
          duration: number | null
          id: string
          retry_count: number | null
          session_id: string
          size_bytes: number | null
          storage_path: string
          upload_status: string | null
          uploaded_at: string | null
        }
        Insert: {
          checksum_sha256?: string | null
          chunk_index: number
          confirmed_at?: string | null
          duration?: number | null
          id?: string
          retry_count?: number | null
          session_id: string
          size_bytes?: number | null
          storage_path: string
          upload_status?: string | null
          uploaded_at?: string | null
        }
        Update: {
          checksum_sha256?: string | null
          chunk_index?: number
          confirmed_at?: string | null
          duration?: number | null
          id?: string
          retry_count?: number | null
          session_id?: string
          size_bytes?: number | null
          storage_path?: string
          upload_status?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_recording_chunks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_recording_chunks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      session_segments: {
        Row: {
          confidence: number | null
          end_time: number
          id: string
          resolved_speaker_name: string | null
          session_id: string
          speaker_id: string | null
          speaker_label: string | null
          start_time: number
          text: string | null
          transcription_id: string
        }
        Insert: {
          confidence?: number | null
          end_time: number
          id?: string
          resolved_speaker_name?: string | null
          session_id: string
          speaker_id?: string | null
          speaker_label?: string | null
          start_time: number
          text?: string | null
          transcription_id: string
        }
        Update: {
          confidence?: number | null
          end_time?: number
          id?: string
          resolved_speaker_name?: string | null
          session_id?: string
          speaker_id?: string | null
          speaker_label?: string | null
          start_time?: number
          text?: string | null
          transcription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_segments_speaker_id_fkey"
            columns: ["speaker_id"]
            isOneToOne: false
            referencedRelation: "session_speakers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_segments_transcription_id_fkey"
            columns: ["transcription_id"]
            isOneToOne: false
            referencedRelation: "session_transcriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_speakers: {
        Row: {
          created_at: string | null
          id: string
          mapped_at: string | null
          mapped_by: string | null
          mapped_name: string | null
          role: string | null
          session_id: string
          speaker_label: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mapped_at?: string | null
          mapped_by?: string | null
          mapped_name?: string | null
          role?: string | null
          session_id: string
          speaker_label: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mapped_at?: string | null
          mapped_by?: string | null
          mapped_name?: string | null
          role?: string | null
          session_id?: string
          speaker_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_speakers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_speakers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      session_transcriptions: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          id: string
          is_locked: boolean | null
          language: string | null
          provider: string | null
          provider_job_id: string | null
          raw_text: string | null
          session_id: string
          source_transcription_id: string | null
          structured_json: Json | null
          version_number: number
          version_type: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          language?: string | null
          provider?: string | null
          provider_job_id?: string | null
          raw_text?: string | null
          session_id: string
          source_transcription_id?: string | null
          structured_json?: Json | null
          version_number: number
          version_type: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          language?: string | null
          provider?: string | null
          provider_job_id?: string | null
          raw_text?: string | null
          session_id?: string
          source_transcription_id?: string | null
          structured_json?: Json | null
          version_number?: number
          version_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_transcriptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_transcriptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "vw_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_transcriptions_source_transcription_id_fkey"
            columns: ["source_transcription_id"]
            isOneToOne: false
            referencedRelation: "session_transcriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          aggregate_session_hash: string | null
          confidentiality_level: string | null
          created_at: string | null
          created_by: string
          current_snapshot_id: string | null
          duration_seconds: number | null
          ended_at: string | null
          final_audio_hash: string | null
          final_audio_path: string | null
          id: string
          linked_entity_id: string | null
          linked_entity_type: string | null
          linked_later: boolean | null
          office_id: string
          processing_error: string | null
          processing_lock_at: string | null
          processing_step: string | null
          session_type: Database["public"]["Enums"]["session_type"]
          started_at: string | null
          status: Database["public"]["Enums"]["session_status"]
          title: string
          total_chunks_expected: number | null
          total_chunks_received: number | null
          updated_at: string
        }
        Insert: {
          aggregate_session_hash?: string | null
          confidentiality_level?: string | null
          created_at?: string | null
          created_by: string
          current_snapshot_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          final_audio_hash?: string | null
          final_audio_path?: string | null
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          linked_later?: boolean | null
          office_id: string
          processing_error?: string | null
          processing_lock_at?: string | null
          processing_step?: string | null
          session_type?: Database["public"]["Enums"]["session_type"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          title: string
          total_chunks_expected?: number | null
          total_chunks_received?: number | null
          updated_at?: string
        }
        Update: {
          aggregate_session_hash?: string | null
          confidentiality_level?: string | null
          created_at?: string | null
          created_by?: string
          current_snapshot_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          final_audio_hash?: string | null
          final_audio_path?: string | null
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          linked_later?: boolean | null
          office_id?: string
          processing_error?: string | null
          processing_lock_at?: string | null
          processing_step?: string | null
          session_type?: Database["public"]["Enums"]["session_type"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          title?: string
          total_chunks_expected?: number | null
          total_chunks_received?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_current_snapshot"
            columns: ["current_snapshot_id"]
            isOneToOne: false
            referencedRelation: "session_processing_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_links: {
        Row: {
          client_id: string
          created_at: string | null
          expires_at: string
          id: string
          office_id: string
          status: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          office_id: string
          status?: string | null
          token?: string
          used_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          office_id?: string
          status?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_signatures"
            referencedColumns: ["client_id"]
          },
        ]
      }
      system_kill_switches: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          activation_reason: string
          confirmation_token: string | null
          created_at: string
          deactivated_at: string | null
          deactivated_by: string | null
          deactivation_reason: string | null
          id: string
          is_active: boolean
          requires_confirmation: boolean
          scope: string
          scope_id: string | null
          switch_type: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          activation_reason: string
          confirmation_token?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          id?: string
          is_active?: boolean
          requires_confirmation?: boolean
          scope: string
          scope_id?: string | null
          switch_type: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          activation_reason?: string
          confirmation_token?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          id?: string
          is_active?: boolean
          requires_confirmation?: boolean
          scope?: string
          scope_id?: string | null
          switch_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_scaling_config: {
        Row: {
          backpressure_active: boolean | null
          default_max_tpm: number | null
          id: string
          max_global_concurrency: number | null
          max_office_burst: number | null
          updated_at: string | null
        }
        Insert: {
          backpressure_active?: boolean | null
          default_max_tpm?: number | null
          id?: string
          max_global_concurrency?: number | null
          max_office_burst?: number | null
          updated_at?: string | null
        }
        Update: {
          backpressure_active?: boolean | null
          default_max_tpm?: number | null
          id?: string
          max_global_concurrency?: number | null
          max_office_burst?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_telemetry: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          id: string
          kind: string | null
          office_id: string | null
          payload: Json | null
          route: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          kind?: string | null
          office_id?: string | null
          payload?: Json | null
          route?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          kind?: string | null
          office_id?: string | null
          payload?: Json | null
          route?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      template_ai_jobs: {
        Row: {
          case_id: string | null
          created_at: string | null
          error: string | null
          id: string
          input: Json | null
          office_id: string | null
          output: Json | null
          status: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          input?: Json | null
          office_id?: string | null
          output?: Json | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          input?: Json | null
          office_id?: string | null
          output?: Json | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      video_transcriptions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          office_id: string | null
          source: string | null
          tags: string | null
          title: string | null
          transcription: string | null
          updated_at: string | null
          url: string | null
          video_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          office_id?: string | null
          source?: string | null
          tags?: string | null
          title?: string | null
          transcription?: string | null
          updated_at?: string | null
          url?: string | null
          video_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          office_id?: string | null
          source?: string | null
          tags?: string | null
          title?: string | null
          transcription?: string | null
          updated_at?: string | null
          url?: string | null
          video_id?: string | null
        }
        Relationships: []
      }
      worker_state: {
        Row: {
          id: string
          locked_at: string | null
          locked_by: string | null
          locked_until: string | null
        }
        Insert: {
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          locked_until?: string | null
        }
        Update: {
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          locked_until?: string | null
        }
        Relationships: []
      }
      zapsign_webhook_events: {
        Row: {
          doc_token: string | null
          event_type: string | null
          id: string
          last_error: string | null
          office_id: string | null
          payload: Json | null
          processed_at: string | null
          received_at: string | null
          zapsign_event_id: string | null
        }
        Insert: {
          doc_token?: string | null
          event_type?: string | null
          id?: string
          last_error?: string | null
          office_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          received_at?: string | null
          zapsign_event_id?: string | null
        }
        Update: {
          doc_token?: string | null
          event_type?: string | null
          id?: string
          last_error?: string | null
          office_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          received_at?: string | null
          zapsign_event_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      session_performance_metrics: {
        Row: {
          avg_duration_ms: number | null
          count: number | null
          retry_count: number | null
          status: Database["public"]["Enums"]["session_job_status"] | null
          total_tokens: number | null
          worker_type: Database["public"]["Enums"]["session_worker_type"] | null
        }
        Relationships: []
      }
      unified_client_events: {
        Row: {
          client_id: string | null
          event_date: string | null
          event_type: string | null
          id: string | null
          metadata: Json | null
          module: string | null
          office_id: string | null
          status: string | null
          title: string | null
        }
        Relationships: []
      }
      vw_case_current_state: {
        Row: {
          case_id: string | null
          current_state_changed_at: string | null
          current_state_changed_by: string | null
          current_state_id: string | null
          current_state_note: string | null
          office_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lexos_case_state_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_state_history_to_state_id_fkey"
            columns: ["current_state_id"]
            isOneToOne: false
            referencedRelation: "lexos_case_states"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_case_state_timeline: {
        Row: {
          case_id: string | null
          changed_at: string | null
          changed_by: string | null
          from_state_code: string | null
          from_state_id: string | null
          from_state_name: string | null
          history_id: string | null
          note: string | null
          to_state_code: string | null
          to_state_id: string | null
          to_state_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lexos_case_state_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_state_history_from_state_id_fkey"
            columns: ["from_state_id"]
            isOneToOne: false
            referencedRelation: "lexos_case_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_state_history_to_state_id_fkey"
            columns: ["to_state_id"]
            isOneToOne: false
            referencedRelation: "lexos_case_states"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_client_signatures: {
        Row: {
          client_id: string | null
          cpf: string | null
          full_name: string | null
          office_id: string | null
          signature_base64: string | null
          signature_id: string | null
          signed_at: string | null
        }
        Relationships: []
      }
      vw_meetings: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          final_audio_hash: string | null
          final_audio_path: string | null
          id: string | null
          linked_later: boolean | null
          office_id: string | null
          processing_error: string | null
          started_at: string | null
          status: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          final_audio_hash?: string | null
          final_audio_path?: string | null
          id?: string | null
          linked_later?: boolean | null
          office_id?: string | null
          processing_error?: string | null
          started_at?: string | null
          status?: never
          title?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          final_audio_hash?: string | null
          final_audio_path?: string | null
          id?: string | null
          linked_later?: boolean | null
          office_id?: string | null
          processing_error?: string | null
          started_at?: string | null
          status?: never
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_office_invite: { Args: { p_token: string }; Returns: Json }
      activate_kill_switch: {
        Args: {
          p_reason?: string
          p_scope?: string
          p_scope_id?: string
          p_switch_type: string
        }
        Returns: Json
      }
      assert_medical_output_certifiable: {
        Args: { p_output_id: string }
        Returns: undefined
      }
      calculate_office_cost_forecast: {
        Args: { p_office_id: string }
        Returns: {
          avg_daily_usd: number
          budget_remaining_usd: number
          is_at_risk: boolean
          projected_30d_usd: number
        }[]
      }
      check_and_charge_ai_budget: {
        Args: {
          p_estimated_tokens: number
          p_is_critical?: boolean
          p_job_type?: string
          p_office_id: string
        }
        Returns: Json
      }
      check_and_increment_rate_limit: {
        Args: {
          p_action: string
          p_limit_per_window: number
          p_scope_id: string
          p_scope_type: string
          p_window_minutes?: number
        }
        Returns: Json
      }
      check_rerun_loop_guard: {
        Args: { p_session_id: string; p_snapshot_hash: string }
        Returns: {
          allowed: boolean
          reason: string
        }[]
      }
      check_token_rate_limit: {
        Args: { p_estimated_tokens: number; p_office_id: string }
        Returns: {
          allowed: boolean
          current_tpm: number
          limit_tpm: number
        }[]
      }
      claim_session_job:
        | {
            Args: {
              p_lease_duration?: string
              p_max_jobs?: number
              p_worker_id: string
            }
            Returns: {
              actual_tokens_input: number | null
              actual_tokens_output: number | null
              attempt_count: number
              cache_hit: boolean | null
              claimed_at: string | null
              compensation_reason: string | null
              config_json: Json
              cost_usd: number | null
              created_at: string
              created_by: string | null
              decision_taken: string | null
              dedup_hit: boolean | null
              estimated_cost_usd: number | null
              execution_duration_ms: number | null
              finished_at: string | null
              heartbeat_interval_s: number
              id: string
              idempotency_key: string
              job_type: Database["public"]["Enums"]["session_job_type"]
              last_error: string | null
              last_heartbeat_at: string | null
              lease_duration_s: number
              lease_expires_at: string | null
              max_attempts: number
              office_id: string
              priority: number
              reclaim_attempts: number
              scheduled_at: string
              session_id: string
              side_effect_confirmed: boolean
              started_at: string | null
              status: Database["public"]["Enums"]["session_job_status"]
              token_estimate: number | null
              trace_id: string | null
              updated_at: string
              worker_id: string | null
              worker_type: Database["public"]["Enums"]["session_worker_type"]
            }[]
            SetofOptions: {
              from: "*"
              to: "session_jobs"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              p_ai_per_office_limit?: number
              p_lease_duration?: string
              p_max_jobs?: number
              p_worker_id: string
              p_worker_type: Database["public"]["Enums"]["session_worker_type"]
            }
            Returns: {
              actual_tokens_input: number | null
              actual_tokens_output: number | null
              attempt_count: number
              cache_hit: boolean | null
              claimed_at: string | null
              compensation_reason: string | null
              config_json: Json
              cost_usd: number | null
              created_at: string
              created_by: string | null
              decision_taken: string | null
              dedup_hit: boolean | null
              estimated_cost_usd: number | null
              execution_duration_ms: number | null
              finished_at: string | null
              heartbeat_interval_s: number
              id: string
              idempotency_key: string
              job_type: Database["public"]["Enums"]["session_job_type"]
              last_error: string | null
              last_heartbeat_at: string | null
              lease_duration_s: number
              lease_expires_at: string | null
              max_attempts: number
              office_id: string
              priority: number
              reclaim_attempts: number
              scheduled_at: string
              session_id: string
              side_effect_confirmed: boolean
              started_at: string | null
              status: Database["public"]["Enums"]["session_job_status"]
              token_estimate: number | null
              trace_id: string | null
              updated_at: string
              worker_id: string | null
              worker_type: Database["public"]["Enums"]["session_worker_type"]
            }[]
            SetofOptions: {
              from: "*"
              to: "session_jobs"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              p_lease_duration?: string
              p_max_jobs?: number
              p_worker_id: string
              p_worker_type?: string
            }
            Returns: {
              actual_tokens_input: number | null
              actual_tokens_output: number | null
              attempt_count: number
              cache_hit: boolean | null
              claimed_at: string | null
              compensation_reason: string | null
              config_json: Json
              cost_usd: number | null
              created_at: string
              created_by: string | null
              decision_taken: string | null
              dedup_hit: boolean | null
              estimated_cost_usd: number | null
              execution_duration_ms: number | null
              finished_at: string | null
              heartbeat_interval_s: number
              id: string
              idempotency_key: string
              job_type: Database["public"]["Enums"]["session_job_type"]
              last_error: string | null
              last_heartbeat_at: string | null
              lease_duration_s: number
              lease_expires_at: string | null
              max_attempts: number
              office_id: string
              priority: number
              reclaim_attempts: number
              scheduled_at: string
              session_id: string
              side_effect_confirmed: boolean
              started_at: string | null
              status: Database["public"]["Enums"]["session_job_status"]
              token_estimate: number | null
              trace_id: string | null
              updated_at: string
              worker_id: string | null
              worker_type: Database["public"]["Enums"]["session_worker_type"]
            }[]
            SetofOptions: {
              from: "*"
              to: "session_jobs"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      complete_onboarding_step: { Args: { p_step: string }; Returns: undefined }
      confirm_job_side_effect: {
        Args: { p_job_id: string; p_worker_id: string }
        Returns: boolean
      }
      confirm_kill_switch: {
        Args: { p_confirmation_token: string; p_switch_id: string }
        Returns: Json
      }
      current_office_id: { Args: never; Returns: string }
      deactivate_kill_switch: {
        Args: { p_reason?: string; p_switch_id: string }
        Returns: Json
      }
      detect_job_cost_anomaly: {
        Args: { p_actual_cost: number; p_job_id: string }
        Returns: boolean
      }
      ensure_personal_office: { Args: never; Returns: string }
      get_adaptive_model_tier: {
        Args: {
          p_decision_taken?: string
          p_job_type: string
          p_office_id: string
        }
        Returns: string
      }
      get_agenda_month_bundle: {
        Args: { p_month: number; p_office_id: string; p_year: number }
        Returns: Json
      }
      get_office_invite_public: {
        Args: { p_token: string }
        Returns: {
          created_by: string
          email: string
          expires_at: string
          invite_id: string
          office_id: string
          office_name: string
          role: string
        }[]
      }
      get_office_onboarding_status: {
        Args: never
        Returns: {
          completed: boolean
          step_key: string
        }[]
      }
      get_pre_execution_verdict: {
        Args: { p_estimated_tokens: number; p_job_id: string }
        Returns: {
          allowed: boolean
          decision_taken: string
          estimated_cost_usd: number
          reason: string
        }[]
      }
      get_service_config: { Args: { query: string }; Returns: Json }
      hard_delete_client: { Args: { p_client_id: string }; Returns: Json }
      increment_session_chunks: {
        Args: { session_id: string }
        Returns: undefined
      }
      init_office_onboarding_steps: {
        Args: { p_office_id: string }
        Returns: undefined
      }
      is_kill_switch_active: {
        Args: { p_scope_id?: string; p_switch_type: string }
        Returns: boolean
      }
      lexos_healthcheck_session: {
        Args: never
        Returns: {
          auth_uid: string
          office_id: string
          ok: boolean
          reason: string
          role: string
        }[]
      }
      lexos_next_states_for_case: {
        Args: { p_case_id: string }
        Returns: {
          sort_order: number
          to_state_code: string
          to_state_id: string
          to_state_name: string
        }[]
      }
      lexos_transition_case_state: {
        Args: { p_case_id: string; p_note?: string; p_to_state_id: string }
        Returns: string
      }
      lookup_smart_dedup: {
        Args: {
          p_job_type: string
          p_office_id: string
          p_snapshot_hash: string
        }
        Returns: {
          existing_output_id: string
          found: boolean
        }[]
      }
      normalize_document: { Args: { doc: string }; Returns: string }
      render_template_preview: {
        Args: { p_data: Json; p_template_id: string }
        Returns: string
      }
      renew_job_lease: {
        Args: { p_extend_s?: number; p_job_id: string; p_worker_id: string }
        Returns: boolean
      }
      reset_ai_budgets: { Args: never; Returns: undefined }
      resolve_session_job_worker: {
        Args: { p_job_type: Database["public"]["Enums"]["session_job_type"] }
        Returns: Database["public"]["Enums"]["session_worker_type"]
      }
      run_readiness_checks: { Args: { p_trigger?: string }; Returns: Json }
      session_job_janitor: { Args: never; Returns: undefined }
      system_housekeeping: {
        Args: { p_dry_run?: boolean; p_trigger?: string }
        Returns: Json
      }
      transition_session_fsm:
        | {
            Args: {
              p_caller_office_id?: string
              p_execution_context?: string
              p_metadata?: Json
              p_reason?: string
              p_session_id: string
              p_target_status: Database["public"]["Enums"]["session_status"]
              p_target_step?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_metadata?: Json
              p_performed_by?: string
              p_reason?: string
              p_session_id: string
              p_target_status: Database["public"]["Enums"]["session_status"]
              p_target_step?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_caller_office_id?: string
              p_execution_context?: string
              p_metadata?: Json
              p_performed_by?: string
              p_reason?: string
              p_session_id: string
              p_target_status: Database["public"]["Enums"]["session_status"]
              p_target_step?: string
            }
            Returns: undefined
          }
    }
    Enums: {
      asaas_billing_type: "PIX" | "BOLETO" | "CREDIT_CARD"
      asaas_payment_status:
        | "PENDING"
        | "RECEIVED"
        | "CONFIRMED"
        | "OVERDUE"
        | "REFUNDED"
        | "CANCELED"
        | "ERROR"
      case_side: "ATAQUE" | "DEFESA"
      client_file_kind:
        | "IDENTIDADE"
        | "CPF_CNPJ"
        | "COMPROVANTE_ENDERECO"
        | "CONTRATO_ASSINADO"
        | "OUTRO"
        | "KIT_PROCURACAO"
        | "KIT_DECLARACAO"
        | "KIT_CONTRATO"
        | "ASSINATURA"
        | "COMPROVANTE_RENDA"
        | "KIT_RECIBO"
      context_source_type:
        | "audio"
        | "legal_document"
        | "medical_record"
        | "exam"
        | "image"
        | "prior_note"
      doc_kind:
        | "PROCURACAO"
        | "DECLARACAO"
        | "CONTRATO"
        | "PECA"
        | "ANEXO"
        | "PROCESSO_PDF"
        | "OUTRO"
      governance_incident_category: "clinical_behavioral" | "operational_engine"
      governance_severity:
        | "info"
        | "warning"
        | "high"
        | "critical"
        | "operational"
      medical_output_status:
        | "ai_draft"
        | "pending_medical_review"
        | "approved_signed"
        | "approved_with_edits"
        | "rejected"
      office_role: "OWNER" | "ADMIN" | "MEMBER"
      output_validation_level: "LEVEL_A" | "LEVEL_B" | "LEVEL_C" | "LEVEL_D"
      person_type: "PF" | "PJ"
      person_type_enum: "PF" | "PJ"
      precedent_job_type: "CHECK_SOURCE"
      precedent_kind:
        | "SUMULA"
        | "ACORDAO"
        | "JURISPRUDENCIA"
        | "TEMA_REPETITIVO"
        | "REPERcussAO_GERAL"
        | "ORIENTACAO_JURISPRUDENCIAL"
        | "TESE"
        | "INFORMATIVO"
        | "OUTRO"
      precedent_source_kind: "OFICIAL" | "SECUNDARIA"
      precedent_status:
        | "ATIVA"
        | "CANCELADA"
        | "ALTERADA"
        | "SUPERADA"
        | "DESCONHECIDO"
      session_job_status:
        | "queued"
        | "claimed"
        | "running"
        | "succeeded"
        | "failed"
        | "dead_lettered"
        | "cancelled"
        | "heartbeat_lost"
        | "compensated"
      session_job_type:
        | "TRANSCRIBE"
        | "INGEST"
        | "SNAPSHOT"
        | "ANALYZE_LEGAL"
        | "ANALYZE_MEDICAL"
        | "FULL_PROCESS"
      session_status:
        | "created"
        | "recording"
        | "uploading"
        | "processing"
        | "transcribed"
        | "analyzed"
        | "archived"
        | "interrupted"
        | "failed"
        | "ready_for_integrity_check"
        | "ready_for_transcription"
        | "context_ready"
        | "snapshot_created"
        | "analyzing"
        | "outputs_generated"
        | "approved"
        | "compensating"
        | "dead_lettered"
      session_type: "legal_meeting" | "medical_consultation" | "generic"
      session_worker_type: "IO" | "CPU" | "AI"
      variable_context: "GLOBAL" | "LEGAL" | "MEDICAL" | "AGENDA"
      variable_source: "TABLE_FIELD" | "COMPUTED" | "STATIC" | "CUSTOM"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      asaas_billing_type: ["PIX", "BOLETO", "CREDIT_CARD"],
      asaas_payment_status: [
        "PENDING",
        "RECEIVED",
        "CONFIRMED",
        "OVERDUE",
        "REFUNDED",
        "CANCELED",
        "ERROR",
      ],
      case_side: ["ATAQUE", "DEFESA"],
      client_file_kind: [
        "IDENTIDADE",
        "CPF_CNPJ",
        "COMPROVANTE_ENDERECO",
        "CONTRATO_ASSINADO",
        "OUTRO",
        "KIT_PROCURACAO",
        "KIT_DECLARACAO",
        "KIT_CONTRATO",
        "ASSINATURA",
        "COMPROVANTE_RENDA",
        "KIT_RECIBO",
      ],
      context_source_type: [
        "audio",
        "legal_document",
        "medical_record",
        "exam",
        "image",
        "prior_note",
      ],
      doc_kind: [
        "PROCURACAO",
        "DECLARACAO",
        "CONTRATO",
        "PECA",
        "ANEXO",
        "PROCESSO_PDF",
        "OUTRO",
      ],
      governance_incident_category: [
        "clinical_behavioral",
        "operational_engine",
      ],
      governance_severity: [
        "info",
        "warning",
        "high",
        "critical",
        "operational",
      ],
      medical_output_status: [
        "ai_draft",
        "pending_medical_review",
        "approved_signed",
        "approved_with_edits",
        "rejected",
      ],
      office_role: ["OWNER", "ADMIN", "MEMBER"],
      output_validation_level: ["LEVEL_A", "LEVEL_B", "LEVEL_C", "LEVEL_D"],
      person_type: ["PF", "PJ"],
      person_type_enum: ["PF", "PJ"],
      precedent_job_type: ["CHECK_SOURCE"],
      precedent_kind: [
        "SUMULA",
        "ACORDAO",
        "JURISPRUDENCIA",
        "TEMA_REPETITIVO",
        "REPERcussAO_GERAL",
        "ORIENTACAO_JURISPRUDENCIAL",
        "TESE",
        "INFORMATIVO",
        "OUTRO",
      ],
      precedent_source_kind: ["OFICIAL", "SECUNDARIA"],
      precedent_status: [
        "ATIVA",
        "CANCELADA",
        "ALTERADA",
        "SUPERADA",
        "DESCONHECIDO",
      ],
      session_job_status: [
        "queued",
        "claimed",
        "running",
        "succeeded",
        "failed",
        "dead_lettered",
        "cancelled",
        "heartbeat_lost",
        "compensated",
      ],
      session_job_type: [
        "TRANSCRIBE",
        "INGEST",
        "SNAPSHOT",
        "ANALYZE_LEGAL",
        "ANALYZE_MEDICAL",
        "FULL_PROCESS",
      ],
      session_status: [
        "created",
        "recording",
        "uploading",
        "processing",
        "transcribed",
        "analyzed",
        "archived",
        "interrupted",
        "failed",
        "ready_for_integrity_check",
        "ready_for_transcription",
        "context_ready",
        "snapshot_created",
        "analyzing",
        "outputs_generated",
        "approved",
        "compensating",
        "dead_lettered",
      ],
      session_type: ["legal_meeting", "medical_consultation", "generic"],
      session_worker_type: ["IO", "CPU", "AI"],
      variable_context: ["GLOBAL", "LEGAL", "MEDICAL", "AGENDA"],
      variable_source: ["TABLE_FIELD", "COMPUTED", "STATIC", "CUSTOM"],
    },
  },
} as const
