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
      agenda_items: {
        Row: {
          all_day: boolean
          assigned_to: string | null
          case_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          date: string
          end_at: string | null
          external_event_id: string | null
          external_source: string | null
          ics_uid: string | null
          id: string
          kind: string | null
          location: string | null
          meeting_provider: string | null
          meeting_url: string | null
          notes: string | null
          office_id: string
          priority: string
          raw_payload: Json | null
          source_id: string | null
          source_table: string | null
          start_at: string | null
          status: string | null
          time: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          all_day?: boolean
          assigned_to?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          end_at?: string | null
          external_event_id?: string | null
          external_source?: string | null
          ics_uid?: string | null
          id?: string
          kind?: string | null
          location?: string | null
          meeting_provider?: string | null
          meeting_url?: string | null
          notes?: string | null
          office_id: string
          priority?: string
          raw_payload?: Json | null
          source_id?: string | null
          source_table?: string | null
          start_at?: string | null
          status?: string | null
          time?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          all_day?: boolean
          assigned_to?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          end_at?: string | null
          external_event_id?: string | null
          external_source?: string | null
          ics_uid?: string | null
          id?: string
          kind?: string | null
          location?: string | null
          meeting_provider?: string | null
          meeting_url?: string | null
          notes?: string | null
          office_id?: string
          priority?: string
          raw_payload?: Json | null
          source_id?: string | null
          source_table?: string | null
          start_at?: string | null
          status?: string | null
          time?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "agenda_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "agenda_items_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "agenda_items_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_subjects: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string | null
          finished_at: string
          id: string
          office_id: string
          snapshot: Json | null
          status: string
          subject: string
          subject_hash: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          finished_at?: string
          id?: string
          office_id: string
          snapshot?: Json | null
          status?: string
          subject: string
          subject_hash: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          finished_at?: string
          id?: string
          office_id?: string
          snapshot?: Json | null
          status?: string
          subject?: string
          subject_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_subjects_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "analysis_subjects_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_subjects_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_customers: {
        Row: {
          asaas_customer_id: string | null
          client_id: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string | null
          office_id: string
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          client_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string | null
          office_id: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          client_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string | null
          office_id?: string
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      asaas_payments: {
        Row: {
          asaas_payment_id: string | null
          billing_type: Database["public"]["Enums"]["asaas_billing_type"]
          boleto_url: string | null
          case_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          customer_local_id: string | null
          description: string | null
          due_date: string | null
          id: string
          invoice_url: string | null
          office_id: string
          paid_at: string | null
          pix_payload: string | null
          pix_qr_code_base64: string | null
          status: Database["public"]["Enums"]["asaas_payment_status"]
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          asaas_payment_id?: string | null
          billing_type?: Database["public"]["Enums"]["asaas_billing_type"]
          boleto_url?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_local_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          office_id: string
          paid_at?: string | null
          pix_payload?: string | null
          pix_qr_code_base64?: string | null
          status?: Database["public"]["Enums"]["asaas_payment_status"]
          updated_at?: string
          updated_by?: string | null
          value: number
        }
        Update: {
          asaas_payment_id?: string | null
          billing_type?: Database["public"]["Enums"]["asaas_billing_type"]
          boleto_url?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_local_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          office_id?: string
          paid_at?: string | null
          pix_payload?: string | null
          pix_qr_code_base64?: string | null
          status?: Database["public"]["Enums"]["asaas_payment_status"]
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "asaas_payments_customer_local_id_fkey"
            columns: ["customer_local_id"]
            isOneToOne: false
            referencedRelation: "asaas_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhook_events: {
        Row: {
          asaas_event_id: string | null
          asaas_payment_id: string | null
          created_by: string | null
          event_type: string
          id: string
          last_error: string | null
          office_id: string | null
          payload: Json
          processed_at: string | null
          received_at: string
        }
        Insert: {
          asaas_event_id?: string | null
          asaas_payment_id?: string | null
          created_by?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          office_id?: string | null
          payload: Json
          processed_at?: string | null
          received_at?: string
        }
        Update: {
          asaas_event_id?: string | null
          asaas_payment_id?: string | null
          created_by?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          office_id?: string | null
          payload?: Json
          processed_at?: string | null
          received_at?: string
        }
        Relationships: []
      }
      assistant_memory: {
        Row: {
          id: string
          key: string
          office_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          office_id: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          office_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "assistant_memory_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "assistant_memory_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_memory_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events_legacy: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json | null
          office_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          office_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          office_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "audit_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log_legacy__table: {
        Row: {
          created_at: string
          id: number
          new_data: Json | null
          office_id: string | null
          old_data: Json | null
          operation: string
          row_pk: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          new_data?: Json | null
          office_id?: string | null
          old_data?: Json | null
          operation: string
          row_pk?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          new_data?: Json | null
          office_id?: string | null
          old_data?: Json | null
          operation?: string
          row_pk?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
          metadata: Json
          office_id: string | null
          record_id: string | null
          table_name: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          office_id?: string | null
          record_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
          office_id?: string | null
          record_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_snapshots: {
        Row: {
          created_at: string
          created_by: string
          hash: string | null
          id: string
          meta: Json
          office_id: string
          report_md: string
          risk: Json
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          hash?: string | null
          id?: string
          meta?: Json
          office_id: string
          report_md: string
          risk?: Json
          source?: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          hash?: string | null
          id?: string
          meta?: Json
          office_id?: string
          report_md?: string
          risk?: Json
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_snapshots_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "audit_snapshots_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_snapshots_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      case_cnj_snapshots: {
        Row: {
          case_id: string
          cnj_digits: string
          created_by: string | null
          fetched_at: string
          id: string
          provider: string
          response: Json
          tribunal_alias: string | null
        }
        Insert: {
          case_id: string
          cnj_digits: string
          created_by?: string | null
          fetched_at?: string
          id?: string
          provider: string
          response: Json
          tribunal_alias?: string | null
        }
        Update: {
          case_id?: string
          cnj_digits?: string
          created_by?: string | null
          fetched_at?: string
          id?: string
          provider?: string
          response?: Json
          tribunal_alias?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_cnj_snapshots_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_cnj_snapshots_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_cnj_snapshots_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_cnj_snapshots_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_cnj_snapshots_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
        ]
      }
      case_deadlines: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string | null
          days: number
          due_date: string | null
          id: string
          kind: string
          notes: string | null
          office_id: string | null
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          days: number
          due_date?: string | null
          id?: string
          kind?: string
          notes?: string | null
          office_id?: string | null
          start_date: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          days?: number
          due_date?: string | null
          id?: string
          kind?: string
          notes?: string | null
          office_id?: string | null
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_deadlines_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "case_deadlines_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_deadlines_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      case_event_segments: {
        Row: {
          case_id: string
          confidence: string
          created_at: string
          document_nature: string
          event_date: string | null
          event_id: string
          excerpt: string | null
          id: string
          label: string
          office_id: string
          raw_description: string
          seq: number
          tjto_code: string | null
        }
        Insert: {
          case_id: string
          confidence?: string
          created_at?: string
          document_nature: string
          event_date?: string | null
          event_id: string
          excerpt?: string | null
          id?: string
          label: string
          office_id: string
          raw_description: string
          seq: number
          tjto_code?: string | null
        }
        Update: {
          case_id?: string
          confidence?: string
          created_at?: string
          document_nature?: string
          event_date?: string | null
          event_id?: string
          excerpt?: string | null
          id?: string
          label?: string
          office_id?: string
          raw_description?: string
          seq?: number
          tjto_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_event_segments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_event_segments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_event_segments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_event_segments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_event_segments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_event_segments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "case_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_event_segments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "case_event_segments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_event_segments_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      case_events: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          payload: Json
          source: string | null
          title: string
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          payload?: Json
          source?: string | null
          title: string
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          payload?: Json
          source?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
        ]
      }
      case_expenses: {
        Row: {
          amount: number
          case_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          kind: string
          office_id: string | null
          paid: boolean
          paid_at: string | null
          receipt_url: string | null
        }
        Insert: {
          amount?: number
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          kind: string
          office_id?: string | null
          paid?: boolean
          paid_at?: string | null
          receipt_url?: string | null
        }
        Update: {
          amount?: number
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          kind?: string
          office_id?: string | null
          paid?: boolean
          paid_at?: string | null
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_expenses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_expenses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_expenses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_expenses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_expenses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_expenses_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "case_expenses_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_expenses_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      case_knowledge_snapshots: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string | null
          id: string
          office_id: string
          precedents: Json
          settings: Json
          subject: string
          subject_hash: string
          used_query: string
          videos: Json
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          office_id: string
          precedents?: Json
          settings?: Json
          subject: string
          subject_hash: string
          used_query: string
          videos?: Json
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          office_id?: string
          precedents?: Json
          settings?: Json
          subject?: string
          subject_hash?: string
          used_query?: string
          videos?: Json
        }
        Relationships: []
      }
      case_permissions: {
        Row: {
          case_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_permissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_permissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_permissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_permissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_permissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
        ]
      }
      case_stage_logs: {
        Row: {
          case_id: string
          changed_at: string
          changed_by: string | null
          id: number
          new_stage: string
          old_stage: string | null
        }
        Insert: {
          case_id: string
          changed_at?: string
          changed_by?: string | null
          id?: number
          new_stage: string
          old_stage?: string | null
        }
        Update: {
          case_id?: string
          changed_at?: string
          changed_by?: string | null
          id?: number
          new_stage?: string
          old_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_stage_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_stage_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_stage_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_stage_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_stage_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
        ]
      }
      case_stage_rules: {
        Row: {
          from_stage: string
          id: number
          to_stage: string
        }
        Insert: {
          from_stage: string
          id?: number
          to_stage: string
        }
        Update: {
          from_stage?: string
          id?: number
          to_stage?: string
        }
        Relationships: []
      }
      case_status_logs: {
        Row: {
          case_id: string
          changed_at: string | null
          changed_by: string | null
          id: string
          new_status: string | null
          old_status: string | null
        }
        Insert: {
          case_id: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
        }
        Update: {
          case_id?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_status_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_status_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_status_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_status_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_status_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
        ]
      }
      case_status_rules: {
        Row: {
          from_status: string
          to_status: string
        }
        Insert: {
          from_status: string
          to_status: string
        }
        Update: {
          from_status?: string
          to_status?: string
        }
        Relationships: []
      }
      case_status_transitions: {
        Row: {
          actor_user_id: string | null
          case_id: string
          created_at: string
          from_status: string | null
          id: string
          metadata: Json
          office_id: string
          reason: string | null
          to_status: string
        }
        Insert: {
          actor_user_id?: string | null
          case_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          office_id: string
          reason?: string | null
          to_status: string
        }
        Update: {
          actor_user_id?: string | null
          case_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          office_id?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_status_transitions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_status_transitions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_status_transitions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_status_transitions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_status_transitions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_status_transitions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "case_status_transitions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_status_transitions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      case_task_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_required: boolean
          sort_order: number
          stage: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          sort_order?: number
          stage: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          sort_order?: number
          stage?: string
          title?: string
        }
        Relationships: []
      }
      case_tasks: {
        Row: {
          case_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          sort_order: number
          stage: string
          status: string
          template_id: string | null
          title: string
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          sort_order?: number
          stage: string
          status?: string
          template_id?: string | null
          title: string
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          sort_order?: number
          stage?: string
          status?: string
          template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "case_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          area: string | null
          client_id: string
          cnj_number: string | null
          cnj_validated_at: string | null
          comarca: string | null
          court_name: string | null
          created_at: string
          created_by: string
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
          office_id: string
          opponent_doc: string | null
          opponent_name: string | null
          side: Database["public"]["Enums"]["case_side"]
          stage: string
          state_id: string | null
          status: string
          subject_id: string | null
          subtype: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          client_id: string
          cnj_number?: string | null
          cnj_validated_at?: string | null
          comarca?: string | null
          court_name?: string | null
          created_at?: string
          created_by: string
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
          office_id: string
          opponent_doc?: string | null
          opponent_name?: string | null
          side: Database["public"]["Enums"]["case_side"]
          stage?: string
          state_id?: string | null
          status?: string
          subject_id?: string | null
          subtype?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          client_id?: string
          cnj_number?: string | null
          cnj_validated_at?: string | null
          comarca?: string | null
          court_name?: string | null
          created_at?: string
          created_by?: string
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
          office_id?: string
          opponent_doc?: string | null
          opponent_name?: string | null
          side?: Database["public"]["Enums"]["case_side"]
          stage?: string
          state_id?: string | null
          status?: string
          subject_id?: string | null
          subtype?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cases_subject"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "legal_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_ai_logs: {
        Row: {
          case_id: string | null
          created_at: string
          id: string
          message: string
          model: string | null
          office_id: string | null
          response: string
          tokens: number | null
          user_id: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          id?: string
          message: string
          model?: string | null
          office_id?: string | null
          response: string
          tokens?: number | null
          user_id?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string
          id?: string
          message?: string
          model?: string | null
          office_id?: string | null
          response?: string
          tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_ai_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_ai_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "chat_ai_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_ai_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "chat_ai_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "chat_ai_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "chat_ai_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_ai_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json
          role: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string
          id: string
          office_id: string
          route: string | null
          scope: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          office_id: string
          route?: string | null
          scope?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          office_id?: string
          route?: string | null
          scope?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "chat_threads_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "chat_threads_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "chat_threads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "chat_threads_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "chat_threads_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assigned_lawyers: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          member_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          member_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assigned_lawyers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assigned_lawyers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_assigned_lawyers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "office_members"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contract_snapshots: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          kind: string
          office_id: string | null
          template_key: string | null
          variables: Json
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          kind: string
          office_id?: string | null
          template_key?: string | null
          variables?: Json
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          kind?: string
          office_id?: string | null
          template_key?: string | null
          variables?: Json
        }
        Relationships: []
      }
      client_contract_terms: {
        Row: {
          chave_pix: string | null
          client_id: string
          created_at: string | null
          created_by: string | null
          data_primeira_parcela: string | null
          datas_parcelas: Json | null
          forma_pagamento: string
          id: string
          metodo_pagamento: string
          numero_parcelas: number | null
          office_id: string
          percentual_honorarios: number | null
          tipo_remuneracao: string
          updated_at: string | null
          valor_entrada: number | null
          valor_fixo_honorarios: number | null
          valor_parcela: number | null
        }
        Insert: {
          chave_pix?: string | null
          client_id: string
          created_at?: string | null
          created_by?: string | null
          data_primeira_parcela?: string | null
          datas_parcelas?: Json | null
          forma_pagamento?: string
          id?: string
          metodo_pagamento?: string
          numero_parcelas?: number | null
          office_id: string
          percentual_honorarios?: number | null
          tipo_remuneracao?: string
          updated_at?: string | null
          valor_entrada?: number | null
          valor_fixo_honorarios?: number | null
          valor_parcela?: number | null
        }
        Update: {
          chave_pix?: string | null
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          data_primeira_parcela?: string | null
          datas_parcelas?: Json | null
          forma_pagamento?: string
          id?: string
          metodo_pagamento?: string
          numero_parcelas?: number | null
          office_id?: string
          percentual_honorarios?: number | null
          tipo_remuneracao?: string
          updated_at?: string | null
          valor_entrada?: number | null
          valor_fixo_honorarios?: number | null
          valor_parcela?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contract_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contract_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_contract_terms_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "client_contract_terms_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contract_terms_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      client_events: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_email: string | null
          client_id: string
          event_type: string
          id: string
          new_status: string | null
          office_id: string
          old_status: string | null
          payload: Json
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          client_id: string
          event_type: string
          id?: string
          new_status?: string | null
          office_id: string
          old_status?: string | null
          payload?: Json
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          client_id?: string
          event_type?: string
          id?: string
          new_status?: string | null
          office_id?: string
          old_status?: string | null
          payload?: Json
        }
        Relationships: []
      }
      client_files: {
        Row: {
          case_id: string | null
          client_id: string
          description: string | null
          file_name: string
          file_size: number | null
          id: string
          kind: Database["public"]["Enums"]["client_file_kind"]
          metadata: Json
          mime_type: string | null
          office_id: string
          storage_bucket: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          case_id?: string | null
          client_id: string
          description?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["client_file_kind"]
          metadata?: Json
          mime_type?: string | null
          office_id: string
          storage_bucket?: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string | null
          client_id?: string
          description?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["client_file_kind"]
          metadata?: Json
          mime_type?: string | null
          office_id?: string
          storage_bucket?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "client_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "client_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      client_kit_items: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          client_file_id: string | null
          client_id: string
          created_at: string
          document_id: string | null
          due_date: string | null
          id: string
          kit_category: string
          kit_status: string
          notes: string | null
          office_id: string
          updated_at: string
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          client_file_id?: string | null
          client_id: string
          created_at?: string
          document_id?: string | null
          due_date?: string | null
          id?: string
          kit_category: string
          kit_status?: string
          notes?: string | null
          office_id: string
          updated_at?: string
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          client_file_id?: string | null
          client_id?: string
          created_at?: string
          document_id?: string | null
          due_date?: string | null
          id?: string
          kit_category?: string
          kit_status?: string
          notes?: string | null
          office_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_kit_items_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "client_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_items_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "vw_client_files"
            referencedColumns: ["file_id"]
          },
          {
            foreignKeyName: "client_kit_items_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "vw_client_kit_latest_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_items_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "vw_lexos_kit_files_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_items_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "vw_lexos_kit_inconsistencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_items_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "vw_lexos_kit_need_migration"
            referencedColumns: ["html_file_id"]
          },
          {
            foreignKeyName: "client_kit_items_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "vw_lexos_kit_status_by_client"
            referencedColumns: ["chosen_file_id"]
          },
          {
            foreignKeyName: "client_kit_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_kit_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "client_kit_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_documents_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_items_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "client_kit_items_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_items_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      client_kit_requirements: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          client_file_id: string | null
          client_id: string
          created_at: string
          document_id: string | null
          due_date: string | null
          id: string
          notes: string | null
          office_id: string
          req_group: string
          req_label: string
          req_status: string
          updated_at: string
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          client_file_id?: string | null
          client_id: string
          created_at?: string
          document_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          office_id: string
          req_group: string
          req_label: string
          req_status?: string
          updated_at?: string
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          client_file_id?: string | null
          client_id?: string
          created_at?: string
          document_id?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          office_id?: string
          req_group?: string
          req_label?: string
          req_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_kit_requirements_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "client_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_requirements_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "vw_client_files"
            referencedColumns: ["file_id"]
          },
          {
            foreignKeyName: "client_kit_requirements_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "vw_client_kit_latest_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_requirements_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "vw_lexos_kit_files_audit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_requirements_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "vw_lexos_kit_inconsistencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_requirements_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "vw_lexos_kit_need_migration"
            referencedColumns: ["html_file_id"]
          },
          {
            foreignKeyName: "client_kit_requirements_client_file_id_fkey"
            columns: ["client_file_id"]
            isOneToOne: false
            referencedRelation: "vw_lexos_kit_status_by_client"
            referencedColumns: ["chosen_file_id"]
          },
          {
            foreignKeyName: "client_kit_requirements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_requirements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_kit_requirements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_requirements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_requirements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "client_kit_requirements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_documents_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_requirements_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "client_kit_requirements_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kit_requirements_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
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
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          display_id: string | null
          email: string | null
          full_name: string
          id: string
          lgpd_consent: boolean
          lgpd_consent_at: string | null
          marital_status: string | null
          nationality: string | null
          notes: string | null
          office_id: string
          person_type: Database["public"]["Enums"]["person_type"]
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
          status: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          ai_extracted?: boolean | null
          all_lawyers_assigned?: boolean | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          display_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          lgpd_consent?: boolean
          lgpd_consent_at?: string | null
          marital_status?: string | null
          nationality?: string | null
          notes?: string | null
          office_id: string
          person_type: Database["public"]["Enums"]["person_type"]
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
          status?: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          ai_extracted?: boolean | null
          all_lawyers_assigned?: boolean | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          display_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          lgpd_consent?: boolean
          lgpd_consent_at?: string | null
          marital_status?: string | null
          nationality?: string | null
          notes?: string | null
          office_id?: string
          person_type?: Database["public"]["Enums"]["person_type"]
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
          status?: string
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "clients_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_logs: {
        Row: {
          action: string
          created_at: string
          document_id: string | null
          id: string
          metadata: Json
          office_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          document_id?: string | null
          id?: string
          metadata?: Json
          office_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          document_id?: string | null
          id?: string
          metadata?: Json
          office_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_access_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_documents_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "document_access_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      document_events: {
        Row: {
          actor_user_id: string | null
          case_id: string
          created_at: string
          document_id: string
          event_type: string
          id: string
          message: string | null
          metadata: Json
          office_id: string
        }
        Insert: {
          actor_user_id?: string | null
          case_id: string
          created_at?: string
          document_id: string
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json
          office_id: string
        }
        Update: {
          actor_user_id?: string | null
          case_id?: string
          created_at?: string
          document_id?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "document_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "document_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "document_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_documents_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "document_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      document_render_jobs: {
        Row: {
          case_id: string | null
          created_at: string
          error: string | null
          format: string
          generated_document_id: string | null
          id: string
          office_id: string | null
          payload: Json
          status: string
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          error?: string | null
          format: string
          generated_document_id?: string | null
          id?: string
          office_id?: string | null
          payload?: Json
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          error?: string | null
          format?: string
          generated_document_id?: string | null
          id?: string
          office_id?: string | null
          payload?: Json
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_render_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_render_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "document_render_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_render_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "document_render_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "document_render_jobs_generated_document_id_fkey"
            columns: ["generated_document_id"]
            isOneToOne: false
            referencedRelation: "generated_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_render_jobs_generated_document_id_fkey"
            columns: ["generated_document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_render_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "document_render_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_render_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sign_requests: {
        Row: {
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          office_id: string
          provider: string | null
          provider_payload: Json
          signed_file_path: string | null
          status: string
          updated_at: string
          zapsign_doc_token: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          office_id: string
          provider?: string | null
          provider_payload?: Json
          signed_file_path?: string | null
          status?: string
          updated_at?: string
          zapsign_doc_token?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          office_id?: string
          provider?: string | null
          provider_payload?: Json
          signed_file_path?: string | null
          status?: string
          updated_at?: string
          zapsign_doc_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_sign_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_sign_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_sign_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_sign_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_documents_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_sign_requests_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "document_sign_requests_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_sign_requests_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      document_status_logs: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          document_id: string | null
          generated_doc_id: string | null
          id: string
          new_status: string | null
          old_status: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          document_id?: string | null
          generated_doc_id?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          document_id?: string | null
          generated_doc_id?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
        }
        Relationships: []
      }
      document_status_rules: {
        Row: {
          from_status: string
          to_status: string
        }
        Insert: {
          from_status: string
          to_status: string
        }
        Update: {
          from_status?: string
          to_status?: string
        }
        Relationships: []
      }
      document_template_tag_map: {
        Row: {
          tag_id: string
          template_id: string
        }
        Insert: {
          tag_id: string
          template_id: string
        }
        Update: {
          tag_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_template_tag_map_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "document_template_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_template_tag_map_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_template_tag_map_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "vw_templates_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      document_template_tags: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      document_template_versions: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          template_id: string | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          template_id?: string | null
          version: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          template_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "vw_templates_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          category: string
          code: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          office_id: string | null
          updated_at: string
        }
        Insert: {
          category: string
          code?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          office_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          office_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "document_templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      document_type_permissions: {
        Row: {
          can_delete: boolean
          can_download: boolean
          can_upload: boolean
          can_view: boolean
          created_at: string
          id: string
          office_id: string
          role: string
          type_id: string
        }
        Insert: {
          can_delete?: boolean
          can_download?: boolean
          can_upload?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          office_id: string
          role: string
          type_id: string
        }
        Update: {
          can_delete?: boolean
          can_download?: boolean
          can_upload?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          office_id?: string
          role?: string
          type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_type_permissions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "document_type_permissions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_type_permissions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_type_permissions_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          office_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          office_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_types_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "document_types_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_types_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          office_id: string
          snapshot: Json
          version_no: number
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          office_id: string
          snapshot: Json
          version_no: number
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          office_id?: string
          snapshot?: Json
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_documents_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "document_versions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
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
          filename: string
          id: string
          is_image_pdf: boolean | null
          is_locked: boolean
          kind: Database["public"]["Enums"]["doc_kind"]
          locked_at: string | null
          locked_by: string | null
          metadata: Json
          mime_type: string | null
          office_id: string
          reading_status: string | null
          signed_at: string | null
          signed_by: string | null
          status: string | null
          storage_bucket: string
          storage_path: string
          type_id: string | null
          uploaded_at: string
          uploaded_by: string
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
          filename: string
          id?: string
          is_image_pdf?: boolean | null
          is_locked?: boolean
          kind: Database["public"]["Enums"]["doc_kind"]
          locked_at?: string | null
          locked_by?: string | null
          metadata?: Json
          mime_type?: string | null
          office_id?: string
          reading_status?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          storage_bucket?: string
          storage_path: string
          type_id?: string | null
          uploaded_at?: string
          uploaded_by: string
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
          filename?: string
          id?: string
          is_image_pdf?: boolean | null
          is_locked?: boolean
          kind?: Database["public"]["Enums"]["doc_kind"]
          locked_at?: string | null
          locked_by?: string | null
          metadata?: Json
          mime_type?: string | null
          office_id?: string
          reading_status?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string | null
          storage_bucket?: string
          storage_path?: string
          type_id?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      e_signatures: {
        Row: {
          case_id: string | null
          client_id: string | null
          generated_document_id: string | null
          id: string
          ip: string | null
          metadata: Json
          office_id: string | null
          signature_base64: string | null
          signature_status: string | null
          signed_at: string | null
          signed_hash: string
          signer_doc: string | null
          signer_email: string | null
          signer_name: string
          signer_phone: string | null
          signer_type: string
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
          metadata?: Json
          office_id?: string | null
          signature_base64?: string | null
          signature_status?: string | null
          signed_at?: string | null
          signed_hash: string
          signer_doc?: string | null
          signer_email?: string | null
          signer_name: string
          signer_phone?: string | null
          signer_type: string
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
          metadata?: Json
          office_id?: string | null
          signature_base64?: string | null
          signature_status?: string | null
          signed_at?: string | null
          signed_hash?: string
          signer_doc?: string | null
          signer_email?: string | null
          signer_name?: string
          signer_phone?: string | null
          signer_type?: string
          user_agent?: string | null
          zapsign_doc_token?: string | null
          zapsign_signer_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "e_signatures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_signatures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "e_signatures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_signatures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "e_signatures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "e_signatures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_signatures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "e_signatures_generated_document_id_fkey"
            columns: ["generated_document_id"]
            isOneToOne: false
            referencedRelation: "generated_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_signatures_generated_document_id_fkey"
            columns: ["generated_document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_signatures_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "e_signatures_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_signatures_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      frontend_audit_snapshots: {
        Row: {
          created_at: string
          created_by: string
          hash: string | null
          id: string
          manifest: Json
          menu: Json
          office_id: string
          routes: Json
          workflows: Json
        }
        Insert: {
          created_at?: string
          created_by: string
          hash?: string | null
          id?: string
          manifest?: Json
          menu?: Json
          office_id: string
          routes?: Json
          workflows?: Json
        }
        Update: {
          created_at?: string
          created_by?: string
          hash?: string | null
          id?: string
          manifest?: Json
          menu?: Json
          office_id?: string
          routes?: Json
          workflows?: Json
        }
        Relationships: [
          {
            foreignKeyName: "frontend_audit_snapshots_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "frontend_audit_snapshots_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frontend_audit_snapshots_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_docs_legacy: {
        Row: {
          case_id: string | null
          client_id: string | null
          content: string
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          document_id: string | null
          file_path: string | null
          filename: string | null
          id: string
          kind: Database["public"]["Enums"]["doc_kind"]
          metadata: Json
          mime_type: string | null
          office_id: string
          source_template_id: string | null
          status: string | null
          title: string
          version: number
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          content: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          document_id?: string | null
          file_path?: string | null
          filename?: string | null
          id?: string
          kind: Database["public"]["Enums"]["doc_kind"]
          metadata?: Json
          mime_type?: string | null
          office_id: string
          source_template_id?: string | null
          status?: string | null
          title: string
          version?: number
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          content?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          document_id?: string | null
          file_path?: string | null
          filename?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["doc_kind"]
          metadata?: Json
          mime_type?: string | null
          office_id?: string
          source_template_id?: string | null
          status?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "generated_docs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "generated_docs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "generated_docs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "generated_docs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "generated_docs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "generated_docs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_documents_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "generated_docs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "vw_templates_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string
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
          created_at?: string
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
          created_at?: string
          data_used?: Json | null
          file_path?: string | null
          generated_by?: string | null
          id?: string
          mime_type?: string | null
          office_id?: string | null
          source_template_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "generated_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "generated_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "generated_documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "generated_documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "vw_templates_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_connections: {
        Row: {
          access_token: string | null
          calendar_id: string
          created_at: string
          id: string
          office_id: string | null
          refresh_token: string | null
          scopes: string[]
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string
          created_at?: string
          id?: string
          office_id?: string | null
          refresh_token?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          calendar_id?: string
          created_at?: string
          id?: string
          office_id?: string | null
          refresh_token?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "google_calendar_connections_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_connections_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      in_app_notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string
          href: string | null
          id: string
          kind: string
          office_id: string
          read_at: string | null
          severity: string
          source_id: string | null
          source_table: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key: string
          href?: string | null
          id?: string
          kind?: string
          office_id: string
          read_at?: string | null
          severity?: string
          source_id?: string | null
          source_table?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string
          href?: string | null
          id?: string
          kind?: string
          office_id?: string
          read_at?: string | null
          severity?: string
          source_id?: string | null
          source_table?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "in_app_notifications_office_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "in_app_notifications_office_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "in_app_notifications_office_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          kind: string
          office_id: string | null
          payload: Json
          provider: string
          result: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          office_id?: string | null
          payload?: Json
          provider: string
          result?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          office_id?: string | null
          payload?: Json
          provider?: string
          result?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "integration_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_generation_jobs: {
        Row: {
          attempts: number
          client_id: string | null
          created_at: string
          created_by: string | null
          error_code: string | null
          error_message: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          office_id: string | null
          requested_codes: string[]
          requested_codes_key: string
          status: string
          step: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          office_id?: string | null
          requested_codes: string[]
          requested_codes_key?: string
          status?: string
          step?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          office_id?: string | null
          requested_codes?: string[]
          requested_codes_key?: string
          status?: string
          step?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_cache: {
        Row: {
          cached_at: string
          case_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          office_id: string
          payload: Json
          subject: string
          subject_hash: string
          updated_at: string
          used_query: string | null
        }
        Insert: {
          cached_at?: string
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          office_id: string
          payload?: Json
          subject: string
          subject_hash: string
          updated_at?: string
          used_query?: string | null
        }
        Update: {
          cached_at?: string
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          office_id?: string
          payload?: Json
          subject?: string
          subject_hash?: string
          updated_at?: string
          used_query?: string | null
        }
        Relationships: []
      }
      knowledge_run_logs: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string | null
          id: string
          office_id: string
          precedents_count: number
          run_source: string
          settings: Json
          snapshot_ref: string | null
          subject: string
          subject_hash: string
          used_query: string
          videos_count: number
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          office_id: string
          precedents_count?: number
          run_source: string
          settings?: Json
          snapshot_ref?: string | null
          subject: string
          subject_hash: string
          used_query: string
          videos_count?: number
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          office_id?: string
          precedents_count?: number
          run_source?: string
          settings?: Json
          snapshot_ref?: string | null
          subject?: string
          subject_hash?: string
          used_query?: string
          videos_count?: number
        }
        Relationships: []
      }
      knowledge_usage_stats: {
        Row: {
          case_id: string | null
          case_uses: number
          created_at: string
          id: string
          kind: string
          last_used_at: string | null
          office_id: string
          ref_id: string
          subject_hash: string
          total_uses: number
        }
        Insert: {
          case_id?: string | null
          case_uses?: number
          created_at?: string
          id?: string
          kind: string
          last_used_at?: string | null
          office_id: string
          ref_id: string
          subject_hash: string
          total_uses?: number
        }
        Update: {
          case_id?: string | null
          case_uses?: number
          created_at?: string
          id?: string
          kind?: string
          last_used_at?: string | null
          office_id?: string
          ref_id?: string
          subject_hash?: string
          total_uses?: number
        }
        Relationships: []
      }
      legal_branches: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      legal_holidays: {
        Row: {
          day: string
          description: string | null
          id: string
          office_id: string | null
        }
        Insert: {
          day: string
          description?: string | null
          id?: string
          office_id?: string | null
        }
        Update: {
          day?: string
          description?: string | null
          id?: string
          office_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_holidays_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "legal_holidays_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_holidays_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_precedent_jobs: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          job_type: string
          last_error: string | null
          payload: Json
          source_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          job_type?: string
          last_error?: string | null
          payload?: Json
          source_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          job_type?: string
          last_error?: string | null
          payload?: Json
          source_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_precedent_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "legal_precedent_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_precedent_jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "vw_precedent_source_health"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_precedent_sources: {
        Row: {
          check_interval_hours: number
          court: string
          created_at: string
          enabled: boolean
          id: string
          kind: Database["public"]["Enums"]["precedent_kind"]
          last_check_error: string | null
          last_check_http_status: number | null
          last_checked_at: string | null
          last_run_at: string | null
          source_kind: Database["public"]["Enums"]["precedent_source_kind"]
          source_url: string
          updated_at: string | null
        }
        Insert: {
          check_interval_hours?: number
          court: string
          created_at?: string
          enabled?: boolean
          id?: string
          kind: Database["public"]["Enums"]["precedent_kind"]
          last_check_error?: string | null
          last_check_http_status?: number | null
          last_checked_at?: string | null
          last_run_at?: string | null
          source_kind?: Database["public"]["Enums"]["precedent_source_kind"]
          source_url: string
          updated_at?: string | null
        }
        Update: {
          check_interval_hours?: number
          court?: string
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["precedent_kind"]
          last_check_error?: string | null
          last_check_http_status?: number | null
          last_checked_at?: string | null
          last_run_at?: string | null
          source_kind?: Database["public"]["Enums"]["precedent_source_kind"]
          source_url?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      legal_precedent_suggestions: {
        Row: {
          case_id: string | null
          court: string | null
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
          captured_at: string
          checksum_text: string | null
          id: string
          precedent_id: string
          source_url: string | null
          status: Database["public"]["Enums"]["precedent_status"] | null
          text_snapshot: string | null
        }
        Insert: {
          captured_at?: string
          checksum_text?: string | null
          id?: string
          precedent_id: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["precedent_status"] | null
          text_snapshot?: string | null
        }
        Update: {
          captured_at?: string
          checksum_text?: string | null
          id?: string
          precedent_id?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["precedent_status"] | null
          text_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_precedent_versions_precedent_id_fkey"
            columns: ["precedent_id"]
            isOneToOne: false
            referencedRelation: "legal_precedents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_precedents: {
        Row: {
          area: string | null
          ativo: boolean
          court: string | null
          created_at: string
          created_by: string | null
          ementa: string
          id: string
          importance: number
          is_binding: boolean | null
          is_curated: boolean
          kind: string | null
          link: string | null
          link_oficial: string | null
          numero: string | null
          office_id: string
          official_text: string | null
          palavras_chave: string[]
          ref_code: string | null
          search_tsv: unknown
          source: string | null
          status: string | null
          summary: string | null
          tags: string[] | null
          thesis: string | null
          tipo: string
          title: string | null
          titulo: string | null
          tribunal: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          ativo?: boolean
          court?: string | null
          created_at?: string
          created_by?: string | null
          ementa: string
          id?: string
          importance?: number
          is_binding?: boolean | null
          is_curated?: boolean
          kind?: string | null
          link?: string | null
          link_oficial?: string | null
          numero?: string | null
          office_id: string
          official_text?: string | null
          palavras_chave?: string[]
          ref_code?: string | null
          search_tsv?: unknown
          source?: string | null
          status?: string | null
          summary?: string | null
          tags?: string[] | null
          thesis?: string | null
          tipo: string
          title?: string | null
          titulo?: string | null
          tribunal: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          ativo?: boolean
          court?: string | null
          created_at?: string
          created_by?: string | null
          ementa?: string
          id?: string
          importance?: number
          is_binding?: boolean | null
          is_curated?: boolean
          kind?: string | null
          link?: string | null
          link_oficial?: string | null
          numero?: string | null
          office_id?: string
          official_text?: string | null
          palavras_chave?: string[]
          ref_code?: string | null
          search_tsv?: unknown
          source?: string | null
          status?: string | null
          summary?: string | null
          tags?: string[] | null
          thesis?: string | null
          tipo?: string
          title?: string | null
          titulo?: string | null
          tribunal?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_precedents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "legal_precedents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_precedents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_subjects: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_subjects_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "legal_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_templates: {
        Row: {
          branch_id: string | null
          content: string
          created_at: string
          id: string
          is_active: boolean
          subject_id: string | null
          title: string
          version: number
        }
        Insert: {
          branch_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          subject_id?: string | null
          title: string
          version?: number
        }
        Update: {
          branch_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          subject_id?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_templates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "legal_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_templates_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "legal_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_videos: {
        Row: {
          area: string | null
          ativo: boolean
          created_at: string
          created_by: string | null
          duracao_seconds: number | null
          id: string
          importance: number
          is_curated: boolean
          office_id: string | null
          search_tsv: unknown
          tags: string[]
          tipo: string
          titulo: string
          updated_at: string
          url: string
        }
        Insert: {
          area?: string | null
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          duracao_seconds?: number | null
          id?: string
          importance?: number
          is_curated?: boolean
          office_id?: string | null
          search_tsv?: unknown
          tags?: string[]
          tipo: string
          titulo: string
          updated_at?: string
          url: string
        }
        Update: {
          area?: string | null
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          duracao_seconds?: number | null
          id?: string
          importance?: number
          is_curated?: boolean
          office_id?: string | null
          search_tsv?: unknown
          tags?: string[]
          tipo?: string
          titulo?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_videos_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "legal_videos_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_videos_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      lexos_case_deadlines: {
        Row: {
          case_id: string
          created_at: string
          created_by: string
          due_at: string
          id: string
          office_id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by: string
          due_at: string
          id?: string
          office_id: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string
          due_at?: string
          id?: string
          office_id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lexos_case_deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "lexos_case_deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "lexos_case_deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
        ]
      }
      lexos_case_notifications: {
        Row: {
          body: string | null
          case_id: string
          created_at: string
          created_by: string | null
          history_id: string
          id: string
          is_read: boolean
          title: string
        }
        Insert: {
          body?: string | null
          case_id: string
          created_at?: string
          created_by?: string | null
          history_id: string
          id?: string
          is_read?: boolean
          title: string
        }
        Update: {
          body?: string | null
          case_id?: string
          created_at?: string
          created_by?: string | null
          history_id?: string
          id?: string
          is_read?: boolean
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
            foreignKeyName: "lexos_case_notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "lexos_case_notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "lexos_case_notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "lexos_case_notifications_history_id_fkey"
            columns: ["history_id"]
            isOneToOne: false
            referencedRelation: "lexos_case_state_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_notifications_history_id_fkey"
            columns: ["history_id"]
            isOneToOne: false
            referencedRelation: "vw_case_state_timeline"
            referencedColumns: ["history_id"]
          },
        ]
      }
      lexos_case_state_history: {
        Row: {
          case_id: string
          changed_at: string
          changed_by: string
          from_state_id: string | null
          id: string
          note: string | null
          office_id: string
          to_state_id: string
        }
        Insert: {
          case_id: string
          changed_at?: string
          changed_by: string
          from_state_id?: string | null
          id?: string
          note?: string | null
          office_id: string
          to_state_id: string
        }
        Update: {
          case_id?: string
          changed_at?: string
          changed_by?: string
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
            foreignKeyName: "lexos_case_state_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "lexos_case_state_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_state_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "lexos_case_state_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
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
      lexos_case_state_transitions: {
        Row: {
          created_at: string
          from_state_id: string
          id: string
          is_active: boolean
          to_state_id: string
        }
        Insert: {
          created_at?: string
          from_state_id: string
          id?: string
          is_active?: boolean
          to_state_id: string
        }
        Update: {
          created_at?: string
          from_state_id?: string
          id?: string
          is_active?: boolean
          to_state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lexos_case_state_transitions_from_state_id_fkey"
            columns: ["from_state_id"]
            isOneToOne: false
            referencedRelation: "lexos_case_states"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_state_transitions_to_state_id_fkey"
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
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_terminal?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_terminal?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      lexos_cron_control: {
        Row: {
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      lexos_deadline_alert_logs: {
        Row: {
          alert_id: string
          changed_at: string
          changed_by: string | null
          id: string
          new_status: string | null
          office_id: string
          old_status: string | null
        }
        Insert: {
          alert_id: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: string | null
          office_id: string
          old_status?: string | null
        }
        Update: {
          alert_id?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: string | null
          office_id?: string
          old_status?: string | null
        }
        Relationships: []
      }
      lexos_deadline_alerts: {
        Row: {
          channel: string
          created_at: string
          deadline_id: string
          id: string
          notify_at: string
          office_id: string
          status: string
        }
        Insert: {
          channel?: string
          created_at?: string
          deadline_id: string
          id?: string
          notify_at: string
          office_id: string
          status?: string
        }
        Update: {
          channel?: string
          created_at?: string
          deadline_id?: string
          id?: string
          notify_at?: string
          office_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lexos_deadline_alerts_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "lexos_case_deadlines"
            referencedColumns: ["id"]
          },
        ]
      }
      lexos_deadline_alerts_sla_notified: {
        Row: {
          alert_id: string
          last_notified_at: string
          office_id: string
        }
        Insert: {
          alert_id: string
          last_notified_at?: string
          office_id: string
        }
        Update: {
          alert_id?: string
          last_notified_at?: string
          office_id?: string
        }
        Relationships: []
      }
      lexos_healthcheck_runs: {
        Row: {
          id: string
          office_id: string | null
          ran_at: string
          ran_by: string | null
          results: Json
        }
        Insert: {
          id?: string
          office_id?: string | null
          ran_at?: string
          ran_by?: string | null
          results: Json
        }
        Update: {
          id?: string
          office_id?: string | null
          ran_at?: string
          ran_by?: string | null
          results?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lexos_healthcheck_runs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "lexos_healthcheck_runs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_healthcheck_runs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      lexos_knowledge: {
        Row: {
          active: boolean
          content: string
          created_at: string
          created_by: string
          id: string
          office_id: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          content: string
          created_at?: string
          created_by: string
          id?: string
          office_id: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          office_id?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lexos_knowledge_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "lexos_knowledge_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_knowledge_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      lexos_schema_audit_findings: {
        Row: {
          category: string
          created_at: string
          details: Json
          id: number
          object_name: string
          object_type: string
          related_object: string | null
          risk: string
          schema_name: string
        }
        Insert: {
          category: string
          created_at?: string
          details?: Json
          id?: number
          object_name: string
          object_type: string
          related_object?: string | null
          risk?: string
          schema_name: string
        }
        Update: {
          category?: string
          created_at?: string
          details?: Json
          id?: number
          object_name?: string
          object_type?: string
          related_object?: string | null
          risk?: string
          schema_name?: string
        }
        Relationships: []
      }
      lexos_security_baseline: {
        Row: {
          baseline_hash: string
          created_at: string
          id: number
          notes: string | null
          total_definer: number
          total_functions: number
          total_high: number
          total_low: number
          total_medium: number
        }
        Insert: {
          baseline_hash: string
          created_at?: string
          id?: number
          notes?: string | null
          total_definer: number
          total_functions: number
          total_high: number
          total_low: number
          total_medium: number
        }
        Update: {
          baseline_hash?: string
          created_at?: string
          id?: number
          notes?: string | null
          total_definer?: number
          total_functions?: number
          total_high?: number
          total_low?: number
          total_medium?: number
        }
        Relationships: []
      }
      lexos_security_definer_audit: {
        Row: {
          args: string
          created_at: string
          function_name: string
          grantees: string | null
          has_grant_to_anon: boolean
          has_grant_to_authenticated: boolean
          has_search_path_secure: boolean
          has_set_search_path: boolean
          id: number
          leakproof: boolean
          owner_name: string | null
          risk_level: string
          risk_reasons: string
          schema_name: string
          security_definer: boolean
          volatile: string
        }
        Insert: {
          args: string
          created_at?: string
          function_name: string
          grantees?: string | null
          has_grant_to_anon: boolean
          has_grant_to_authenticated: boolean
          has_search_path_secure: boolean
          has_set_search_path: boolean
          id?: number
          leakproof: boolean
          owner_name?: string | null
          risk_level: string
          risk_reasons: string
          schema_name: string
          security_definer: boolean
          volatile: string
        }
        Update: {
          args?: string
          created_at?: string
          function_name?: string
          grantees?: string | null
          has_grant_to_anon?: boolean
          has_grant_to_authenticated?: boolean
          has_search_path_secure?: boolean
          has_set_search_path?: boolean
          id?: number
          leakproof?: boolean
          owner_name?: string | null
          risk_level?: string
          risk_reasons?: string
          schema_name?: string
          security_definer?: boolean
          volatile?: string
        }
        Relationships: []
      }
      nija_case_analysis: {
        Row: {
          analysis: Json
          analysis_key: string | null
          case_id: string | null
          created_at: string | null
          documents_hash: string
          id: string
          session_id: string | null
        }
        Insert: {
          analysis: Json
          analysis_key?: string | null
          case_id?: string | null
          created_at?: string | null
          documents_hash: string
          id?: string
          session_id?: string | null
        }
        Update: {
          analysis?: Json
          analysis_key?: string | null
          case_id?: string | null
          created_at?: string | null
          documents_hash?: string
          id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nija_case_analysis_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_case_analysis_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_case_analysis_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_case_analysis_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_case_analysis_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
        ]
      }
      nija_eproc_event_dictionary: {
        Row: {
          auto_link_to_previous: boolean | null
          category: string | null
          code: string
          created_at: string | null
          generates_deadline: boolean | null
          id: string
          interrupts_prescription: boolean | null
          is_active: boolean | null
          label: string
          meaning: string | null
          nature: string | null
          priority_score: number | null
          requires_ocr: boolean | null
          updated_at: string | null
        }
        Insert: {
          auto_link_to_previous?: boolean | null
          category?: string | null
          code: string
          created_at?: string | null
          generates_deadline?: boolean | null
          id?: string
          interrupts_prescription?: boolean | null
          is_active?: boolean | null
          label: string
          meaning?: string | null
          nature?: string | null
          priority_score?: number | null
          requires_ocr?: boolean | null
          updated_at?: string | null
        }
        Update: {
          auto_link_to_previous?: boolean | null
          category?: string | null
          code?: string
          created_at?: string | null
          generates_deadline?: boolean | null
          id?: string
          interrupts_prescription?: boolean | null
          is_active?: boolean | null
          label?: string
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
          created_at: string
          created_by: string | null
          document_id: string | null
          documents_hash: string | null
          extraction_hash: string
          extractor_version: string
          id: string
          office_id: string
          result_json: Json
          session_id: string | null
          system: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          documents_hash?: string | null
          extraction_hash: string
          extractor_version?: string
          id?: string
          office_id: string
          result_json?: Json
          session_id?: string | null
          system: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          documents_hash?: string | null
          extraction_hash?: string
          extractor_version?: string
          id?: string
          office_id?: string
          result_json?: Json
          session_id?: string | null
          system?: string
          updated_at?: string
        }
        Relationships: []
      }
      nija_generated_pieces: {
        Row: {
          case_id: string
          created_at: string | null
          documents_hash: string
          id: string
          piece: Json
          piece_type: string
        }
        Insert: {
          case_id: string
          created_at?: string | null
          documents_hash: string
          id?: string
          piece: Json
          piece_type: string
        }
        Update: {
          case_id?: string
          created_at?: string | null
          documents_hash?: string
          id?: string
          piece?: Json
          piece_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "nija_generated_pieces_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_generated_pieces_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_generated_pieces_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_generated_pieces_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_generated_pieces_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
        ]
      }
      nija_logs: {
        Row: {
          action: string
          case_id: string | null
          created_at: string
          duration_ms: number | null
          error: Json | null
          id: string
          level: string
          office_id: string | null
          payload: Json | null
          result: Json | null
          session_id: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          action: string
          case_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: Json | null
          id?: string
          level: string
          office_id?: string | null
          payload?: Json | null
          result?: Json | null
          session_id?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          action?: string
          case_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: Json | null
          id?: string
          level?: string
          office_id?: string | null
          payload?: Json | null
          result?: Json | null
          session_id?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nija_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "nija_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      nija_loose_docs: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_size: number | null
          filename: string
          id: string
          mime_type: string | null
          session_id: string
          storage_bucket: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_size?: number | null
          filename: string
          id?: string
          mime_type?: string | null
          session_id: string
          storage_bucket?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_size?: number | null
          filename?: string
          id?: string
          mime_type?: string | null
          session_id?: string
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      nija_quota_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          month: string
          office_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          month: string
          office_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          month?: string
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nija_quota_alerts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "nija_quota_alerts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_quota_alerts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      nija_sessions: {
        Row: {
          acting_side: string | null
          analysis_result: Json | null
          attachments: Json
          case_id: string | null
          client_name: string | null
          cnj_number: string | null
          created_at: string
          created_by: string
          document_ids: Json | null
          document_names: Json | null
          documents_hash: string | null
          extraction_result: Json | null
          id: string
          input_summary: string | null
          mode: string
          office_id: string
          opponent_name: string | null
          output_alerts: Json
          output_checklist: Json
          output_draft: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          acting_side?: string | null
          analysis_result?: Json | null
          attachments?: Json
          case_id?: string | null
          client_name?: string | null
          cnj_number?: string | null
          created_at?: string
          created_by: string
          document_ids?: Json | null
          document_names?: Json | null
          documents_hash?: string | null
          extraction_result?: Json | null
          id?: string
          input_summary?: string | null
          mode?: string
          office_id: string
          opponent_name?: string | null
          output_alerts?: Json
          output_checklist?: Json
          output_draft?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          acting_side?: string | null
          analysis_result?: Json | null
          attachments?: Json
          case_id?: string | null
          client_name?: string | null
          cnj_number?: string | null
          created_at?: string
          created_by?: string
          document_ids?: Json | null
          document_names?: Json | null
          documents_hash?: string | null
          extraction_result?: Json | null
          id?: string
          input_summary?: string | null
          mode?: string
          office_id?: string
          opponent_name?: string | null
          output_alerts?: Json
          output_checklist?: Json
          output_draft?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nija_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_sessions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "nija_sessions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_sessions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      nija_tjto_document_dictionary: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          id: string
          label: string
          legal_desc: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          created_at?: string
          id?: string
          label: string
          legal_desc: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          id?: string
          label?: string
          legal_desc?: string
          updated_at?: string
        }
        Relationships: []
      }
      nija_tjto_unknown_codes: {
        Row: {
          action_taken: string | null
          case_id: string | null
          code: string
          created_at: string | null
          id: string
          office_id: string | null
          raw_text: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_document: string | null
        }
        Insert: {
          action_taken?: string | null
          case_id?: string | null
          code: string
          created_at?: string | null
          id?: string
          office_id?: string | null
          raw_text?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_document?: string | null
        }
        Update: {
          action_taken?: string | null
          case_id?: string | null
          code?: string
          created_at?: string | null
          id?: string
          office_id?: string | null
          raw_text?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_document?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nija_tjto_unknown_codes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_tjto_unknown_codes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_tjto_unknown_codes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_tjto_unknown_codes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_tjto_unknown_codes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_tjto_unknown_codes_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "nija_tjto_unknown_codes_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_tjto_unknown_codes_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      nija_usage: {
        Row: {
          case_id: string | null
          created_at: string
          executed_by: string | null
          id: string
          module: string
          office_id: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          executed_by?: string | null
          id?: string
          module: string
          office_id: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          executed_by?: string | null
          id?: string
          module?: string
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nija_usage_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_usage_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_usage_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_usage_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_usage_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "nija_usage_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "nija_usage_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_usage_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          kind: string
          metadata: Json
          office_id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          kind: string
          metadata?: Json
          office_id: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string
          metadata?: Json
          office_id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      office_integrations: {
        Row: {
          config: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          integration_key: string
          is_active: boolean | null
          office_id: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          integration_key: string
          is_active?: boolean | null
          office_id: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          integration_key?: string
          is_active?: boolean | null
          office_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "office_integrations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "office_integrations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_integrations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      office_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string
          office_id: string
          phone: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by: string
          office_id: string
          phone?: string | null
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          office_id?: string
          phone?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_invites_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "office_invites_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_invites_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
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
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          marital_status: string | null
          nationality: string | null
          oab_number: string | null
          oab_uf: string | null
          office_id: string
          phone: string | null
          profession: string | null
          rg: string | null
          rg_issuer: string | null
          role: string
          user_id: string
        }
        Insert: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          marital_status?: string | null
          nationality?: string | null
          oab_number?: string | null
          oab_uf?: string | null
          office_id: string
          phone?: string | null
          profession?: string | null
          rg?: string | null
          rg_issuer?: string | null
          role?: string
          user_id: string
        }
        Update: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          marital_status?: string | null
          nationality?: string | null
          oab_number?: string | null
          oab_uf?: string | null
          office_id?: string
          phone?: string | null
          profession?: string | null
          rg?: string | null
          rg_issuer?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_members_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "office_members_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_members_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      office_onboarding_steps: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          id: string
          office_id: string | null
          step_key: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          office_id?: string | null
          step_key: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          id?: string
          office_id?: string | null
          step_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_onboarding_steps_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "office_onboarding_steps_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_onboarding_steps_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      office_plans: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          name: string
          nija_monthly_limit: number
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          name: string
          nija_monthly_limit: number
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          name?: string
          nija_monthly_limit?: number
        }
        Relationships: []
      }
      office_quotas: {
        Row: {
          ai_requests_limit: number
          ai_requests_used: number
          docs_gen_limit: number
          docs_gen_used: number
          office_id: string
          storage_mb_limit: number
          storage_mb_used: number
          updated_at: string
        }
        Insert: {
          ai_requests_limit?: number
          ai_requests_used?: number
          docs_gen_limit?: number
          docs_gen_used?: number
          office_id: string
          storage_mb_limit?: number
          storage_mb_used?: number
          updated_at?: string
        }
        Update: {
          ai_requests_limit?: number
          ai_requests_used?: number
          docs_gen_limit?: number
          docs_gen_used?: number
          office_id?: string
          storage_mb_limit?: number
          storage_mb_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_quotas_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "office_quotas_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_quotas_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      office_settings: {
        Row: {
          created_at: string
          knowledge_cache_ttl_minutes: number
          nija_soft_limit_pct: number
          office_id: string
          plan_code: string
          precedents_limit: number
          prefer_curated: boolean
          updated_at: string
          videos_limit: number
        }
        Insert: {
          created_at?: string
          knowledge_cache_ttl_minutes?: number
          nija_soft_limit_pct?: number
          office_id: string
          plan_code: string
          precedents_limit?: number
          prefer_curated?: boolean
          updated_at?: string
          videos_limit?: number
        }
        Update: {
          created_at?: string
          knowledge_cache_ttl_minutes?: number
          nija_soft_limit_pct?: number
          office_id?: string
          plan_code?: string
          precedents_limit?: number
          prefer_curated?: boolean
          updated_at?: string
          videos_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "office_settings_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "office_settings_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_settings_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_settings_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "office_plans"
            referencedColumns: ["code"]
          },
        ]
      }
      office_ui_settings: {
        Row: {
          accent: string
          office_id: string
          sidebar_logo_scale: number
          ui_density: string
          ui_font: string
          ui_scale: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent?: string
          office_id: string
          sidebar_logo_scale?: number
          ui_density?: string
          ui_font?: string
          ui_scale?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent?: string
          office_id?: string
          sidebar_logo_scale?: number
          ui_density?: string
          ui_font?: string
          ui_scale?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "office_ui_settings_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "office_ui_settings_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_ui_settings_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "vw_office_institutional_data"
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
          city: string | null
          cnpj: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          header_block: string | null
          id: string
          instagram_handle: string | null
          logo_storage_bucket: string | null
          logo_storage_path: string | null
          metadata: Json | null
          name: string
          nija_limit_monthly: number
          nija_runs_monthly: number
          nija_runs_reset_at: string
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
          city?: string | null
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          header_block?: string | null
          id?: string
          instagram_handle?: string | null
          logo_storage_bucket?: string | null
          logo_storage_path?: string | null
          metadata?: Json | null
          name: string
          nija_limit_monthly?: number
          nija_runs_monthly?: number
          nija_runs_reset_at?: string
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
          city?: string | null
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          header_block?: string | null
          id?: string
          instagram_handle?: string | null
          logo_storage_bucket?: string | null
          logo_storage_path?: string | null
          metadata?: Json | null
          name?: string
          nija_limit_monthly?: number
          nija_runs_monthly?: number
          nija_runs_reset_at?: string
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
      omni_trace_events: {
        Row: {
          asset_id: string | null
          case_id: string | null
          created_at: string
          created_by: string
          decision: string
          id: string
          input_hash: string | null
          metadata: Json
          office_id: string
          rationale: Json
          source: string
          summary: string | null
          title: string | null
        }
        Insert: {
          asset_id?: string | null
          case_id?: string | null
          created_at?: string
          created_by?: string
          decision: string
          id?: string
          input_hash?: string | null
          metadata?: Json
          office_id: string
          rationale?: Json
          source?: string
          summary?: string | null
          title?: string | null
        }
        Update: {
          asset_id?: string | null
          case_id?: string | null
          created_at?: string
          created_by?: string
          decision?: string
          id?: string
          input_hash?: string | null
          metadata?: Json
          office_id?: string
          rationale?: Json
          source?: string
          summary?: string | null
          title?: string | null
        }
        Relationships: []
      }
      plaud_analysis_jobs: {
        Row: {
          case_id: string | null
          created_at: string | null
          error: string | null
          finished_at: string | null
          id: string
          office_id: string
          plaud_asset_id: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          office_id: string
          plaud_asset_id: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          office_id?: string
          plaud_asset_id?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plaud_analysis_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaud_analysis_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "plaud_analysis_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaud_analysis_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "plaud_analysis_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "plaud_analysis_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "plaud_analysis_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaud_analysis_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaud_analysis_jobs_plaud_asset_id_fkey"
            columns: ["plaud_asset_id"]
            isOneToOne: true
            referencedRelation: "plaud_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      plaud_asset_analysis: {
        Row: {
          analysis: Json
          created_at: string | null
          id: string
          model_used: string | null
          plaud_asset_id: string
          tokens_used: number | null
        }
        Insert: {
          analysis?: Json
          created_at?: string | null
          id?: string
          model_used?: string | null
          plaud_asset_id: string
          tokens_used?: number | null
        }
        Update: {
          analysis?: Json
          created_at?: string | null
          id?: string
          model_used?: string | null
          plaud_asset_id?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plaud_asset_analysis_plaud_asset_id_fkey"
            columns: ["plaud_asset_id"]
            isOneToOne: true
            referencedRelation: "plaud_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      plaud_assets: {
        Row: {
          assigned_to: string | null
          audio_url: string | null
          case_id: string | null
          created_at: string
          created_at_source: string | null
          created_by: string | null
          duration: number | null
          external_id: string
          id: string
          is_office_visible: boolean
          language: string | null
          linked_at: string | null
          linked_by: string | null
          occurred_at: string | null
          office_id: string
          raw: Json
          received_at: string | null
          source: string
          summary: string | null
          title: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          audio_url?: string | null
          case_id?: string | null
          created_at?: string
          created_at_source?: string | null
          created_by?: string | null
          duration?: number | null
          external_id: string
          id?: string
          is_office_visible?: boolean
          language?: string | null
          linked_at?: string | null
          linked_by?: string | null
          occurred_at?: string | null
          office_id: string
          raw?: Json
          received_at?: string | null
          source?: string
          summary?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          audio_url?: string | null
          case_id?: string | null
          created_at?: string
          created_at_source?: string | null
          created_by?: string | null
          duration?: number | null
          external_id?: string
          id?: string
          is_office_visible?: boolean
          language?: string | null
          linked_at?: string | null
          linked_by?: string | null
          occurred_at?: string | null
          office_id?: string
          raw?: Json
          received_at?: string | null
          source?: string
          summary?: string | null
          title?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plaud_senior_analysis: {
        Row: {
          case_id: string | null
          checklist: Json
          consequencia_juridica: string | null
          created_at: string | null
          decisao_estrategica: string
          fase_processual: string | null
          fato_central: string | null
          fundamento_legal: string | null
          id: string
          justificativa_silencio: string | null
          model_version: string | null
          office_id: string
          peca_sugerida: string | null
          plaud_asset_id: string
          risco_preclusao: string | null
          status_juridico: string
          tipo_ato: string | null
          tokens_used: number | null
          updated_at: string | null
        }
        Insert: {
          case_id?: string | null
          checklist?: Json
          consequencia_juridica?: string | null
          created_at?: string | null
          decisao_estrategica: string
          fase_processual?: string | null
          fato_central?: string | null
          fundamento_legal?: string | null
          id?: string
          justificativa_silencio?: string | null
          model_version?: string | null
          office_id: string
          peca_sugerida?: string | null
          plaud_asset_id: string
          risco_preclusao?: string | null
          status_juridico?: string
          tipo_ato?: string | null
          tokens_used?: number | null
          updated_at?: string | null
        }
        Update: {
          case_id?: string | null
          checklist?: Json
          consequencia_juridica?: string | null
          created_at?: string | null
          decisao_estrategica?: string
          fase_processual?: string | null
          fato_central?: string | null
          fundamento_legal?: string | null
          id?: string
          justificativa_silencio?: string | null
          model_version?: string | null
          office_id?: string
          peca_sugerida?: string | null
          plaud_asset_id?: string
          risco_preclusao?: string | null
          status_juridico?: string
          tipo_ato?: string | null
          tokens_used?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plaud_senior_analysis_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaud_senior_analysis_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "plaud_senior_analysis_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaud_senior_analysis_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "plaud_senior_analysis_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "plaud_senior_analysis_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "plaud_senior_analysis_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaud_senior_analysis_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaud_senior_analysis_plaud_asset_id_fkey"
            columns: ["plaud_asset_id"]
            isOneToOne: true
            referencedRelation: "plaud_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      plaud_webhook_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string
          id: string
          office_id: string | null
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          status: string
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          office_id?: string | null
          payload: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          office_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      rebuild_jobs: {
        Row: {
          audit_snapshot_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          error_message: string | null
          frontend_snapshot_id: string | null
          functions_sql: string | null
          id: string
          mode: string
          office_id: string
          rebuild_plan_md: string | null
          rls_sql: string | null
          schema_sql: string | null
          status: string
        }
        Insert: {
          audit_snapshot_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          error_message?: string | null
          frontend_snapshot_id?: string | null
          functions_sql?: string | null
          id?: string
          mode?: string
          office_id: string
          rebuild_plan_md?: string | null
          rls_sql?: string | null
          schema_sql?: string | null
          status?: string
        }
        Update: {
          audit_snapshot_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error_message?: string | null
          frontend_snapshot_id?: string | null
          functions_sql?: string | null
          id?: string
          mode?: string
          office_id?: string
          rebuild_plan_md?: string | null
          rls_sql?: string | null
          schema_sql?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rebuild_jobs_audit_snapshot_id_fkey"
            columns: ["audit_snapshot_id"]
            isOneToOne: false
            referencedRelation: "audit_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rebuild_jobs_frontend_snapshot_id_fkey"
            columns: ["frontend_snapshot_id"]
            isOneToOne: false
            referencedRelation: "frontend_audit_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rebuild_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "rebuild_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rebuild_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      security_checklist: {
        Row: {
          key: string
          notes: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          key: string
          notes?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          key?: string
          notes?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          description: string | null
          details: Json
          event_type: string
          id: number
          office_id: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          details?: Json
          event_type: string
          id?: number
          office_id?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          details?: Json
          event_type?: string
          id?: number
          office_id?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      security_findings: {
        Row: {
          created_at: string
          id: number
          kind: string
          note: string
          object_name: string
          severity: string
        }
        Insert: {
          created_at?: string
          id?: number
          kind: string
          note: string
          object_name: string
          severity: string
        }
        Update: {
          created_at?: string
          id?: number
          kind?: string
          note?: string
          object_name?: string
          severity?: string
        }
        Relationships: []
      }
      system_flags: {
        Row: {
          key: string
          updated_at: string
          value: boolean
        }
        Insert: {
          key: string
          updated_at?: string
          value: boolean
        }
        Update: {
          key?: string
          updated_at?: string
          value?: boolean
        }
        Relationships: []
      }
      system_telemetry: {
        Row: {
          created_at: string
          duration_ms: number | null
          id: string
          kind: string
          office_id: string | null
          payload: Json
          route: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind: string
          office_id?: string | null
          payload?: Json
          route?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: string
          office_id?: string | null
          payload?: Json
          route?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_telemetry_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "system_telemetry_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_telemetry_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      template_ai_jobs: {
        Row: {
          case_id: string | null
          created_at: string
          error: string | null
          id: string
          input: Json
          office_id: string | null
          output: Json | null
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json
          office_id?: string | null
          output?: Json | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json
          office_id?: string | null
          output?: Json | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_ai_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_ai_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "template_ai_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_ai_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "template_ai_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "template_ai_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "template_ai_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_ai_jobs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_ai_jobs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_ai_jobs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "vw_templates_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      template_tags: {
        Row: {
          created_at: string
          created_by: string
          id: string
          office_id: string
          tag: string
          template_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          office_id: string
          tag: string
          template_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          office_id?: string
          tag?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_tags_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "template_tags_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_tags_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_tags_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_tags_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "v_templates_pro"
            referencedColumns: ["id"]
          },
        ]
      }
      template_usage_logs: {
        Row: {
          case_id: string
          id: string
          template_id: string
          used_at: string
          used_by: string
        }
        Insert: {
          case_id: string
          id?: string
          template_id: string
          used_at?: string
          used_by: string
        }
        Update: {
          case_id?: string
          id?: string
          template_id?: string
          used_at?: string
          used_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_usage_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_usage_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "template_usage_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_usage_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "template_usage_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "template_usage_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "legal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          code: string | null
          content: string
          created_at: string
          created_by: string
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["doc_kind"]
          name: string
          office_id: string
          variables: Json
          version: number
        }
        Insert: {
          code?: string | null
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_default?: boolean
          kind: Database["public"]["Enums"]["doc_kind"]
          name: string
          office_id: string
          variables?: Json
          version?: number
        }
        Update: {
          code?: string | null
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["doc_kind"]
          name?: string
          office_id?: string
          variables?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      tjto_document_dictionary: {
        Row: {
          category: string
          code: string
          created_at: string
          id: string
          label: string
          legal_desc: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          id?: string
          label: string
          legal_desc: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          id?: string
          label?: string
          legal_desc?: string
        }
        Relationships: []
      }
      video_chapters: {
        Row: {
          fim_seconds: number | null
          id: string
          inicio_seconds: number
          resumo: string
          tags: string[]
          video_id: string
        }
        Insert: {
          fim_seconds?: number | null
          id?: string
          inicio_seconds?: number
          resumo: string
          tags?: string[]
          video_id: string
        }
        Update: {
          fim_seconds?: number | null
          id?: string
          inicio_seconds?: number
          resumo?: string
          tags?: string[]
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_chapters_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "legal_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_transcriptions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          office_id: string | null
          source: string | null
          tags: string[] | null
          title: string
          transcription: string
          updated_at: string
          url: string | null
          video_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          office_id?: string | null
          source?: string | null
          tags?: string[] | null
          title: string
          transcription: string
          updated_at?: string
          url?: string | null
          video_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          office_id?: string | null
          source?: string | null
          tags?: string[] | null
          title?: string
          transcription?: string
          updated_at?: string
          url?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_transcriptions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "video_transcriptions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_transcriptions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_transcriptions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "legal_videos"
            referencedColumns: ["id"]
          },
        ]
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
          event_type: string
          id: string
          last_error: string | null
          office_id: string | null
          payload: Json
          processed_at: string | null
          received_at: string | null
          zapsign_event_id: string | null
        }
        Insert: {
          doc_token?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          office_id?: string | null
          payload?: Json
          processed_at?: string | null
          received_at?: string | null
          zapsign_event_id?: string | null
        }
        Update: {
          doc_token?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          office_id?: string | null
          payload?: Json
          processed_at?: string | null
          received_at?: string | null
          zapsign_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapsign_webhook_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "zapsign_webhook_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapsign_webhook_events_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      audit_events: {
        Row: {
          action: string | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: string | null
          metadata: Json | null
          office_id: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string | null
          metadata?: Json | null
          office_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string | null
          metadata?: Json | null
          office_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string | null
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          details: Json | null
          entity: string | null
          entity_id: string | null
          id: string | null
          metadata: Json | null
          office_id: string | null
          record_id: string | null
          table_name: string | null
        }
        Insert: {
          action?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string | null
          metadata?: Json | null
          office_id?: string | null
          record_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string | null
          metadata?: Json | null
          office_id?: string | null
          record_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log_legacy: {
        Row: {
          action: string | null
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          details: Json | null
          entity: string | null
          entity_id: string | null
          id: string | null
          metadata: Json | null
          office_id: string | null
          record_id: string | null
          table_name: string | null
        }
        Insert: {
          action?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string | null
          metadata?: Json | null
          office_id?: string | null
          record_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string | null
          metadata?: Json | null
          office_id?: string | null
          record_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log_legacy_view: {
        Row: {
          action: string | null
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          details: Json | null
          entity: string | null
          entity_id: string | null
          id: string | null
          metadata: Json | null
          office_id: string | null
          record_id: string | null
          table_name: string | null
        }
        Insert: {
          action?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string | null
          metadata?: Json | null
          office_id?: string | null
          record_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          details?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string | null
          metadata?: Json | null
          office_id?: string | null
          record_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_docs: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string | null
          data_used: Json | null
          file_path: string | null
          generated_by: string | null
          id: string | null
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
          id?: string | null
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
          id?: string | null
          mime_type?: string | null
          office_id?: string | null
          source_template_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "generated_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "generated_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "generated_documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "generated_documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "vw_templates_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      lexos_healthcheck: {
        Row: {
          item: string | null
          qtd: number | null
        }
        Relationships: []
      }
      lexos_healthcheck_latest: {
        Row: {
          office_id: string | null
          ran_at: string | null
          ran_by: string | null
          results: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lexos_healthcheck_runs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "lexos_healthcheck_runs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_healthcheck_runs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      lexos_kpi_cases_by_state: {
        Row: {
          office_id: string | null
          state_code: string | null
          state_name: string | null
          total_cases: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      lexos_kpi_deadlines: {
        Row: {
          done_deadlines: number | null
          office_id: string | null
          open_deadlines: number | null
          overdue_deadlines: number | null
        }
        Relationships: []
      }
      lexos_rls_audit_v1: {
        Row: {
          auth_delete: boolean | null
          auth_insert: boolean | null
          auth_select: boolean | null
          auth_update: boolean | null
          delete_policies: number | null
          insert_policies: number | null
          policies_count: number | null
          risk_note: string | null
          rls_enabled: boolean | null
          rls_forced: boolean | null
          schema_name: unknown
          select_policies: number | null
          table_name: unknown
          update_policies: number | null
        }
        Relationships: []
      }
      lexos_template_usage_report: {
        Row: {
          branch: string | null
          subject: string | null
          total_usos: number | null
        }
        Relationships: []
      }
      mv_backup_core_monthly: {
        Row: {
          office_id: string | null
          office_name: string | null
          plan_code: string | null
          snapshot_at: string | null
          total_cases: number | null
          total_nija_usage: number | null
        }
        Relationships: []
      }
      mv_deadline_alerts_dashboard: {
        Row: {
          avg_delay_from_notify_seconds: number | null
          avg_time_to_send_seconds: number | null
          office_id: string | null
          pending_due: number | null
          sla_violations: number | null
          total_failed: number | null
          total_pending: number | null
          total_sent: number | null
          total_sent_late: number | null
        }
        Relationships: []
      }
      mv_nija_kpis_hourly: {
        Row: {
          bucket: string | null
          exec_24h: number | null
          office_id: string | null
          total_execucoes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nija_usage_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "nija_usage_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_usage_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ai_context: {
        Row: {
          case_area: string | null
          case_id: string | null
          case_subtype: string | null
          case_title: string | null
          client_name: string | null
          office_name: string | null
        }
        Relationships: []
      }
      v_case_kanban: {
        Row: {
          cnj_number: string | null
          created_at: string | null
          id: string | null
          stage: string | null
          tasks_done: number | null
          tasks_total: number | null
        }
        Relationships: []
      }
      v_case_kpis: {
        Row: {
          archived_cases: number | null
          office_id: string | null
          total_cases: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      v_deadline_kpis: {
        Row: {
          office_id: string | null
          open_deadlines: number | null
          overdue_deadlines: number | null
        }
        Relationships: [
          {
            foreignKeyName: "case_deadlines_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "case_deadlines_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_deadlines_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      v_finance_kpis: {
        Row: {
          office_id: string | null
          paid_expenses: number | null
          total_expenses: number | null
          unpaid_expenses: number | null
        }
        Relationships: [
          {
            foreignKeyName: "case_expenses_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "case_expenses_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_expenses_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      v_lexos_security_definer_risk_report: {
        Row: {
          args: string | null
          created_at: string | null
          function_name: string | null
          grantees: string | null
          has_grant_to_anon: boolean | null
          has_grant_to_authenticated: boolean | null
          has_search_path_secure: boolean | null
          has_set_search_path: boolean | null
          leakproof: boolean | null
          owner_name: string | null
          risk_level: string | null
          risk_reasons: string | null
          schema_name: string | null
          security_definer: boolean | null
          volatile: string | null
        }
        Insert: {
          args?: string | null
          created_at?: string | null
          function_name?: string | null
          grantees?: string | null
          has_grant_to_anon?: boolean | null
          has_grant_to_authenticated?: boolean | null
          has_search_path_secure?: boolean | null
          has_set_search_path?: boolean | null
          leakproof?: boolean | null
          owner_name?: string | null
          risk_level?: string | null
          risk_reasons?: string | null
          schema_name?: string | null
          security_definer?: boolean | null
          volatile?: string | null
        }
        Update: {
          args?: string | null
          created_at?: string | null
          function_name?: string | null
          grantees?: string | null
          has_grant_to_anon?: boolean | null
          has_grant_to_authenticated?: boolean | null
          has_search_path_secure?: boolean | null
          has_set_search_path?: boolean | null
          leakproof?: boolean | null
          owner_name?: string | null
          risk_level?: string | null
          risk_reasons?: string | null
          schema_name?: string | null
          security_definer?: boolean | null
          volatile?: string | null
        }
        Relationships: []
      }
      v_nija_monthly_report: {
        Row: {
          ambos: number | null
          decadencia: number | null
          month: string | null
          office_id: string | null
          prescricao: number | null
          total_execucoes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nija_usage_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "nija_usage_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nija_usage_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      v_system_health: {
        Row: {
          alerts_24h: number | null
          checked_at: string | null
          nija_1h: number | null
          nija_24h: number | null
          total_cases: number | null
        }
        Relationships: []
      }
      v_templates_pro: {
        Row: {
          code: string | null
          created_at: string | null
          id: string | null
          is_default: boolean | null
          kind: Database["public"]["Enums"]["doc_kind"] | null
          name: string | null
          office_id: string | null
          version: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string | null
          is_default?: boolean | null
          kind?: Database["public"]["Enums"]["doc_kind"] | null
          name?: string | null
          office_id?: string | null
          version?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string | null
          is_default?: boolean | null
          kind?: Database["public"]["Enums"]["doc_kind"] | null
          name?: string | null
          office_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_agenda_calendar: {
        Row: {
          all_day: boolean | null
          assigned_to: string | null
          case_id: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          duration_minutes: number | null
          end_at: string | null
          end_local: string | null
          id: string | null
          is_next_24h: boolean | null
          is_overdue: boolean | null
          kind: string | null
          local_date: string | null
          local_time: string | null
          location: string | null
          notes: string | null
          office_id: string | null
          priority: string | null
          start_at: string | null
          start_local: string | null
          status: string | null
          title: string | null
          ui_kind_key: string | null
          updated_at: string | null
          visibility: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "agenda_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "agenda_items_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "agenda_items_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_agenda_overdue: {
        Row: {
          assigned_to: string | null
          case_id: string | null
          client_id: string | null
          created_by: string | null
          end_at: string | null
          id: string | null
          kind: string | null
          now_local: string | null
          office_id: string | null
          overdue_days: number | null
          overdue_interval: unknown
          overdue_minutes: number | null
          priority: string | null
          start_at: string | null
          start_local: string | null
          status: string | null
          title: string | null
          visibility: string | null
        }
        Insert: {
          assigned_to?: string | null
          case_id?: string | null
          client_id?: string | null
          created_by?: string | null
          end_at?: string | null
          id?: string | null
          kind?: string | null
          now_local?: never
          office_id?: string | null
          overdue_days?: never
          overdue_interval?: never
          overdue_minutes?: never
          priority?: string | null
          start_at?: string | null
          start_local?: never
          status?: string | null
          title?: string | null
          visibility?: string | null
        }
        Update: {
          assigned_to?: string | null
          case_id?: string | null
          client_id?: string | null
          created_by?: string | null
          end_at?: string | null
          id?: string | null
          kind?: string | null
          now_local?: never
          office_id?: string | null
          overdue_days?: never
          overdue_interval?: never
          overdue_minutes?: never
          priority?: string | null
          start_at?: string | null
          start_local?: never
          status?: string | null
          title?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "agenda_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "agenda_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "agenda_items_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "agenda_items_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_audit_logs_full: {
        Row: {
          action: string | null
          actor_role: string | null
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: string | null
          metadata: Json | null
          office_id: string | null
          office_name: string | null
          record_id: string | null
          table_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_case_documents: {
        Row: {
          case_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          extracted_text: string | null
          file_size: number | null
          filename: string | null
          id: string | null
          is_locked: boolean | null
          kind: Database["public"]["Enums"]["doc_kind"] | null
          locked_at: string | null
          locked_by: string | null
          metadata: Json | null
          mime_type: string | null
          office_id: string | null
          signed_at: string | null
          signed_by: string | null
          storage_bucket: string | null
          storage_path: string | null
          type_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          case_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          extracted_text?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string | null
          is_locked?: boolean | null
          kind?: Database["public"]["Enums"]["doc_kind"] | null
          locked_at?: string | null
          locked_by?: string | null
          metadata?: Json | null
          mime_type?: string | null
          office_id?: string | null
          signed_at?: string | null
          signed_by?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          type_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          extracted_text?: string | null
          file_size?: number | null
          filename?: string | null
          id?: string | null
          is_locked?: boolean | null
          kind?: Database["public"]["Enums"]["doc_kind"] | null
          locked_at?: string | null
          locked_by?: string | null
          metadata?: Json | null
          mime_type?: string | null
          office_id?: string | null
          signed_at?: string | null
          signed_by?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          type_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_case_generated_docs: {
        Row: {
          case_id: string | null
          content: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          document_id: string | null
          file_path: string | null
          filename: string | null
          id: string | null
          kind: Database["public"]["Enums"]["doc_kind"] | null
          metadata: Json | null
          mime_type: string | null
          office_id: string | null
          source_template_id: string | null
          title: string | null
          version: number | null
        }
        Insert: {
          case_id?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          document_id?: string | null
          file_path?: string | null
          filename?: string | null
          id?: string | null
          kind?: Database["public"]["Enums"]["doc_kind"] | null
          metadata?: Json | null
          mime_type?: string | null
          office_id?: string | null
          source_template_id?: string | null
          title?: string | null
          version?: number | null
        }
        Update: {
          case_id?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          document_id?: string | null
          file_path?: string | null
          filename?: string | null
          id?: string | null
          kind?: Database["public"]["Enums"]["doc_kind"] | null
          metadata?: Json | null
          mime_type?: string | null
          office_id?: string | null
          source_template_id?: string | null
          title?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_docs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "generated_docs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "generated_docs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "generated_docs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["document_id"]
          },
          {
            foreignKeyName: "generated_docs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "vw_documents_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "generated_docs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_docs_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "vw_templates_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_case_payments: {
        Row: {
          billing_type: Database["public"]["Enums"]["asaas_billing_type"] | null
          boleto_url: string | null
          case_id: string | null
          client_id: string | null
          created_at: string | null
          due_date: string | null
          id: string | null
          invoice_url: string | null
          paid_at: string | null
          pix_payload: string | null
          pix_qr_code_base64: string | null
          status: Database["public"]["Enums"]["asaas_payment_status"] | null
          value: number | null
        }
        Insert: {
          billing_type?:
            | Database["public"]["Enums"]["asaas_billing_type"]
            | null
          boleto_url?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string | null
          invoice_url?: string | null
          paid_at?: string | null
          pix_payload?: string | null
          pix_qr_code_base64?: string | null
          status?: Database["public"]["Enums"]["asaas_payment_status"] | null
          value?: number | null
        }
        Update: {
          billing_type?:
            | Database["public"]["Enums"]["asaas_billing_type"]
            | null
          boleto_url?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string | null
          invoice_url?: string | null
          paid_at?: string | null
          pix_payload?: string | null
          pix_qr_code_base64?: string | null
          status?: Database["public"]["Enums"]["asaas_payment_status"] | null
          value?: number | null
        }
        Relationships: []
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
            foreignKeyName: "lexos_case_state_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "lexos_case_state_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexos_case_state_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "lexos_case_state_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
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
      vw_case_status_history: {
        Row: {
          actor_user_id: string | null
          case_id: string | null
          created_at: string | null
          from_status: string | null
          id: string | null
          metadata: Json | null
          office_id: string | null
          reason: string | null
          to_status: string | null
        }
        Insert: {
          actor_user_id?: string | null
          case_id?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string | null
          metadata?: Json | null
          office_id?: string | null
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          actor_user_id?: string | null
          case_id?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string | null
          metadata?: Json | null
          office_id?: string | null
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_status_transitions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_status_transitions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_status_transitions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_status_transitions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_status_transitions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "case_status_transitions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "case_status_transitions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_status_transitions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_case_status_transitions: {
        Row: {
          description: string | null
          from_status: string | null
          to_status: string | null
        }
        Insert: {
          description?: never
          from_status?: string | null
          to_status?: string | null
        }
        Update: {
          description?: never
          from_status?: string | null
          to_status?: string | null
        }
        Relationships: []
      }
      vw_client_documents: {
        Row: {
          case_id: string | null
          case_title: string | null
          client_id: string | null
          client_name: string | null
          document_id: string | null
          filename: string | null
          storage_path: string | null
          uploaded_at: string | null
        }
        Relationships: []
      }
      vw_client_files: {
        Row: {
          client_id: string | null
          client_name: string | null
          description: string | null
          file_id: string | null
          file_name: string | null
          file_size: number | null
          kind: Database["public"]["Enums"]["client_file_kind"] | null
          mime_type: string | null
          storage_bucket: string | null
          storage_path: string | null
          uploaded_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
        ]
      }
      vw_client_kit_latest_files: {
        Row: {
          case_id: string | null
          client_id: string | null
          description: string | null
          file_name: string | null
          file_size: number | null
          id: string | null
          kind: Database["public"]["Enums"]["client_file_kind"] | null
          kit_type: string | null
          metadata: Json | null
          mime_type: string | null
          office_id: string | null
          status: string | null
          storage_bucket: string | null
          storage_path: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "client_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "client_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_client_kit_overview: {
        Row: {
          category: string | null
          checked_at: string | null
          checked_by: string | null
          client_file_id: string | null
          client_id: string | null
          created_at: string | null
          document_id: string | null
          due_date: string | null
          item_kind: string | null
          office_id: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      vw_client_signatures: {
        Row: {
          case_id: string | null
          client_id: string | null
          client_name: string | null
          generated_document_id: string | null
          id: string | null
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
        Relationships: [
          {
            foreignKeyName: "e_signatures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_signatures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "e_signatures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_signatures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "e_signatures_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "e_signatures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_signatures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "e_signatures_generated_document_id_fkey"
            columns: ["generated_document_id"]
            isOneToOne: false
            referencedRelation: "generated_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_signatures_generated_document_id_fkey"
            columns: ["generated_document_id"]
            isOneToOne: false
            referencedRelation: "generated_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_signatures_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "e_signatures_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "e_signatures_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_deadline_alerts_dashboard: {
        Row: {
          avg_delay_from_notify_seconds: number | null
          avg_time_to_send_seconds: number | null
          office_id: string | null
          pending_due: number | null
          sla_violations: number | null
          total_failed: number | null
          total_pending: number | null
          total_sent: number | null
          total_sent_late: number | null
        }
        Relationships: []
      }
      vw_deadline_alerts_kpis: {
        Row: {
          failed: number | null
          next_24h: number | null
          office_id: string | null
          overdue: number | null
          pending: number | null
        }
        Relationships: []
      }
      vw_deadline_alerts_metrics: {
        Row: {
          avg_delay_from_notify_seconds: number | null
          avg_time_to_send_seconds: number | null
          office_id: string | null
          total_failed: number | null
          total_pending: number | null
          total_sent: number | null
          total_sent_late: number | null
        }
        Relationships: []
      }
      vw_deadline_alerts_pending: {
        Row: {
          case_id: string | null
          channel: string | null
          created_at: string | null
          deadline_id: string | null
          fire_at: string | null
          id: string | null
          last_error: string | null
          office_id: string | null
          payload: Json | null
          status: string | null
          tries: number | null
          updated_at: string | null
        }
        Insert: {
          case_id?: never
          channel?: string | null
          created_at?: string | null
          deadline_id?: string | null
          fire_at?: string | null
          id?: string | null
          last_error?: never
          office_id?: string | null
          payload?: never
          status?: string | null
          tries?: never
          updated_at?: never
        }
        Update: {
          case_id?: never
          channel?: string | null
          created_at?: string | null
          deadline_id?: string | null
          fire_at?: string | null
          id?: string | null
          last_error?: never
          office_id?: string | null
          payload?: never
          status?: string | null
          tries?: never
          updated_at?: never
        }
        Relationships: [
          {
            foreignKeyName: "lexos_deadline_alerts_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "lexos_case_deadlines"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_deadline_alerts_sla_notify_queue: {
        Row: {
          alert_id: string | null
          deadline_id: string | null
          delay_seconds: number | null
          first_sent_at: string | null
          notify_at: string | null
          office_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lexos_deadline_alerts_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "lexos_case_deadlines"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_deadline_alerts_sla_violations: {
        Row: {
          alert_id: string | null
          deadline_id: string | null
          delay_seconds: number | null
          first_sent_at: string | null
          notify_at: string | null
          office_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lexos_deadline_alerts_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "lexos_case_deadlines"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_document_timeline: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          changed_by_email: string | null
          item_id: string | null
          item_type: string | null
          log_id: string | null
          new_status: string | null
          old_status: string | null
        }
        Relationships: []
      }
      vw_documents_inbox: {
        Row: {
          case_id: string | null
          client_name: string | null
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
          id: string | null
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
          template_code: string | null
          type_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_ai_context"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "v_case_kanban"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_case_current_state"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_financial_kpis: {
        Row: {
          conversion_rate_percent: number | null
          paid_charges: number | null
          ticket_medio: number | null
          total_canceled: number | null
          total_charges: number | null
          total_overdue: number | null
          total_paid: number | null
          total_pending: number | null
        }
        Relationships: []
      }
      vw_financial_monthly: {
        Row: {
          month: string | null
          total_charges: number | null
          total_overdue: number | null
          total_paid: number | null
          total_pending: number | null
        }
        Relationships: []
      }
      vw_knowledge_kpis_day: {
        Row: {
          avg_precedents: number | null
          avg_videos: number | null
          cache_hit_rate: number | null
          cache_hits: number | null
          case_id: string | null
          day: string | null
          fresh_runs: number | null
          office_id: string | null
          refresh_runs: number | null
          total_runs: number | null
        }
        Relationships: []
      }
      vw_knowledge_kpis_subject: {
        Row: {
          avg_precedents: number | null
          avg_videos: number | null
          cache_hits: number | null
          case_id: string | null
          last_run_at: string | null
          office_id: string | null
          refresh_runs: number | null
          subject: string | null
          subject_hash: string | null
          total_runs: number | null
        }
        Relationships: []
      }
      vw_lexos_healthcheck: {
        Row: {
          details: Json | null
          item: string | null
          qtd: number | null
          status: string | null
        }
        Relationships: []
      }
      vw_lexos_kit_files_audit: {
        Row: {
          bad_html_path: boolean | null
          bad_pdf_path: boolean | null
          client_id: string | null
          description: string | null
          file_name: string | null
          file_size: number | null
          html_path_wrong_mime: boolean | null
          id: string | null
          is_html: boolean | null
          is_pdf: boolean | null
          kind: Database["public"]["Enums"]["client_file_kind"] | null
          mime_type: string | null
          office_id: string | null
          pdf_path_wrong_mime: boolean | null
          storage_bucket: string | null
          storage_path: string | null
          uploaded_at: string | null
        }
        Insert: {
          bad_html_path?: never
          bad_pdf_path?: never
          client_id?: string | null
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          html_path_wrong_mime?: never
          id?: string | null
          is_html?: never
          is_pdf?: never
          kind?: Database["public"]["Enums"]["client_file_kind"] | null
          mime_type?: string | null
          office_id?: string | null
          pdf_path_wrong_mime?: never
          storage_bucket?: string | null
          storage_path?: string | null
          uploaded_at?: string | null
        }
        Update: {
          bad_html_path?: never
          bad_pdf_path?: never
          client_id?: string | null
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          html_path_wrong_mime?: never
          id?: string | null
          is_html?: never
          is_pdf?: never
          kind?: Database["public"]["Enums"]["client_file_kind"] | null
          mime_type?: string | null
          office_id?: string | null
          pdf_path_wrong_mime?: never
          storage_bucket?: string | null
          storage_path?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_lexos_kit_inconsistencies: {
        Row: {
          bad_html_path: boolean | null
          bad_pdf_path: boolean | null
          client_id: string | null
          file_name: string | null
          html_path_wrong_mime: boolean | null
          id: string | null
          kind: Database["public"]["Enums"]["client_file_kind"] | null
          mime_type: string | null
          office_id: string | null
          pdf_path_wrong_mime: boolean | null
          storage_path: string | null
          uploaded_at: string | null
        }
        Insert: {
          bad_html_path?: never
          bad_pdf_path?: never
          client_id?: string | null
          file_name?: string | null
          html_path_wrong_mime?: never
          id?: string | null
          kind?: Database["public"]["Enums"]["client_file_kind"] | null
          mime_type?: string | null
          office_id?: string | null
          pdf_path_wrong_mime?: never
          storage_path?: string | null
          uploaded_at?: string | null
        }
        Update: {
          bad_html_path?: never
          bad_pdf_path?: never
          client_id?: string | null
          file_name?: string | null
          html_path_wrong_mime?: never
          id?: string | null
          kind?: Database["public"]["Enums"]["client_file_kind"] | null
          mime_type?: string | null
          office_id?: string | null
          pdf_path_wrong_mime?: never
          storage_path?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_lexos_kit_need_migration: {
        Row: {
          client_id: string | null
          file_name: string | null
          html_file_id: string | null
          kind: Database["public"]["Enums"]["client_file_kind"] | null
          mime_type: string | null
          office_id: string | null
          storage_path: string | null
          uploaded_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_lexos_kit_status_by_client: {
        Row: {
          chosen_file_id: string | null
          chosen_file_name: string | null
          chosen_mime_type: string | null
          chosen_storage_path: string | null
          chosen_uploaded_at: string | null
          client_id: string | null
          kind: Database["public"]["Enums"]["client_file_kind"] | null
          kit_status: string | null
          office_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_client_documents"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_lexos_kit_status_summary_by_office: {
        Row: {
          kind: Database["public"]["Enums"]["client_file_kind"] | null
          office_id: string | null
          qtd_ausente: number | null
          qtd_legado_html: number | null
          qtd_ok_pdf: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_lexos_kpis: {
        Row: {
          cases_closed: number | null
          cases_in_progress: number | null
          ref_date: string | null
          total_cases: number | null
          total_clients: number | null
          total_documents: number | null
          total_generated_docs: number | null
        }
        Relationships: []
      }
      vw_lexos_risks: {
        Row: {
          description: string | null
          object_name: unknown
          risk_type: string | null
          severity: string | null
        }
        Relationships: []
      }
      vw_lexos_timeline: {
        Row: {
          case_id: string | null
          case_title: string | null
          changed_at: string | null
          changed_by: string | null
          changed_by_email: string | null
          client_id: string | null
          document_id: string | null
          generated_doc_id: string | null
          item_type: string | null
          kind: string | null
          log_id: string | null
          new_status: string | null
          old_status: string | null
        }
        Relationships: []
      }
      vw_lexos_timeline_plus: {
        Row: {
          case_id: string | null
          case_title: string | null
          changed_at: string | null
          changed_by: string | null
          changed_by_email: string | null
          client_id: string | null
          document_id: string | null
          generated_doc_id: string | null
          item_type: string | null
          kind: string | null
          log_id: string | null
          new_status: string | null
          old_status: string | null
        }
        Relationships: []
      }
      vw_mv_deadline_alerts_dashboard_secure: {
        Row: {
          avg_delay_from_notify_seconds: number | null
          avg_time_to_send_seconds: number | null
          office_id: string | null
          pending_due: number | null
          sla_violations: number | null
          total_failed: number | null
          total_pending: number | null
          total_sent: number | null
          total_sent_late: number | null
        }
        Relationships: []
      }
      vw_my_recent_creations: {
        Row: {
          action: string | null
          actor_user_id: string | null
          after_data: Json | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: string | null
          office_id: string | null
          record_id: string | null
          table_name: string | null
        }
        Insert: {
          action?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string | null
          office_id?: string | null
          record_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string | null
          actor_user_id?: string | null
          after_data?: Json | null
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string | null
          office_id?: string | null
          record_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_office_institutional_data: {
        Row: {
          address_city: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip_code: string | null
          cnpj: string | null
          contact_email: string | null
          contact_phone: string | null
          full_address: string | null
          id: string | null
          instagram_handle: string | null
          logo_storage_bucket: string | null
          logo_storage_path: string | null
          metadata: Json | null
          office_name: string | null
          responsible_lawyer_name: string | null
          responsible_lawyer_oab_number: string | null
          responsible_lawyer_oab_uf: string | null
          signature_storage_bucket: string | null
          signature_storage_path: string | null
          slug: string | null
          website_url: string | null
        }
        Insert: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          full_address?: never
          id?: string | null
          instagram_handle?: string | null
          logo_storage_bucket?: string | null
          logo_storage_path?: string | null
          metadata?: Json | null
          office_name?: string | null
          responsible_lawyer_name?: string | null
          responsible_lawyer_oab_number?: string | null
          responsible_lawyer_oab_uf?: string | null
          signature_storage_bucket?: string | null
          signature_storage_path?: string | null
          slug?: string | null
          website_url?: string | null
        }
        Update: {
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          full_address?: never
          id?: string | null
          instagram_handle?: string | null
          logo_storage_bucket?: string | null
          logo_storage_path?: string | null
          metadata?: Json | null
          office_name?: string | null
          responsible_lawyer_name?: string | null
          responsible_lawyer_oab_number?: string | null
          responsible_lawyer_oab_uf?: string | null
          signature_storage_bucket?: string | null
          signature_storage_path?: string | null
          slug?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      vw_precedent_source_health: {
        Row: {
          enabled: boolean | null
          failed_jobs: number | null
          id: string | null
          last_check: string | null
          source_url: string | null
          success_jobs: number | null
        }
        Relationships: []
      }
      vw_security_events_recent: {
        Row: {
          created_at: string | null
          description: string | null
          details: Json | null
          event_type: string | null
          id: number | null
          office_id: string | null
          office_name: string | null
          source: string | null
          user_id: string | null
        }
        Relationships: []
      }
      vw_templates_catalog: {
        Row: {
          category: string | null
          code: string | null
          created_at: string | null
          id: string | null
          is_default: boolean | null
          name: string | null
          office_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code?: string | null
          created_at?: string | null
          id?: string | null
          is_default?: boolean | null
          name?: string | null
          office_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code?: string | null
          created_at?: string | null
          id?: string | null
          is_default?: boolean | null
          name?: string | null
          office_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "mv_backup_core_monthly"
            referencedColumns: ["office_id"]
          },
          {
            foreignKeyName: "document_templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "vw_office_institutional_data"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _col_exists: { Args: { p_col: string; p_tbl: unknown }; Returns: boolean }
      accept_office_invite: { Args: { p_token: string }; Returns: Json }
      add_business_days: {
        Args: { p_days: number; p_office: string; p_start: string }
        Returns: string
      }
      archive_client: {
        Args: { p_client_id: string; p_reason?: string }
        Returns: undefined
      }
      assign_plaud_asset: {
        Args: {
          p_asset_id: string
          p_assigned_to: string
          p_office_visible?: boolean
        }
        Returns: undefined
      }
      backfill_generated_docs_documents: { Args: never; Returns: undefined }
      block_actions_if_not_onboarded: { Args: never; Returns: undefined }
      can_for_document_type: {
        Args: { p_action: string; p_type_id: string }
        Returns: boolean
      }
      can_for_generated_doc_type: {
        Args: { p_action: string; p_type_id: string }
        Returns: boolean
      }
      cancel_job: { Args: { p_job_id: string }; Returns: boolean }
      case_all_stages: {
        Args: never
        Returns: {
          stage: string
        }[]
      }
      case_belongs_to_current_office: {
        Args: { p_case_id: string }
        Returns: boolean
      }
      case_next_stages_from: {
        Args: { p_from_stage: string }
        Returns: {
          to_stage: string
        }[]
      }
      case_next_statuses_for_case: {
        Args: { p_case_id: string }
        Returns: {
          to_status: string
        }[]
      }
      case_next_statuses_from: {
        Args: { p_from_status: string }
        Returns: {
          to_status: string
        }[]
      }
      claim_next_kit_job: {
        Args: never
        Returns: {
          attempts: number
          client_id: string | null
          created_at: string
          created_by: string | null
          error_code: string | null
          error_message: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          office_id: string | null
          requested_codes: string[]
          requested_codes_key: string
          status: string
          step: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "kit_generation_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clone_global_templates_to_my_office: { Args: never; Returns: number }
      clone_template_for_edit: {
        Args: { p_template_id: string }
        Returns: string
      }
      complete_onboarding_step: { Args: { p_step: string }; Returns: undefined }
      create_initial_client_docs:
        | { Args: { p_client_id: string }; Returns: undefined }
        | {
            Args: {
              p_client_id: string
              p_office_id: string
              p_templates: string[]
            }
            Returns: undefined
          }
        | {
            Args: { p_client_id: string; p_templates: string[] }
            Returns: undefined
          }
      create_kit_job_after_signature: {
        Args: { p_client_id: string; p_office_id: string }
        Returns: string
      }
      current_office_id: { Args: never; Returns: string }
      current_office_role: { Args: never; Returns: string }
      current_uid: { Args: never; Returns: string }
      delete_case_cascade: { Args: { p_case_id: string }; Returns: Json }
      delete_client: { Args: { p_client_id: string }; Returns: undefined }
      delete_client_cascade: { Args: { p_client_id: string }; Returns: Json }
      doc_next_statuses_from: {
        Args: { p_from_status: string }
        Returns: {
          to_status: string
        }[]
      }
      duplicate_template: { Args: { p_template_id: string }; Returns: string }
      enqueue_ai_fill_job: {
        Args: { p_case_id: string; p_input?: Json; p_template_id: string }
        Returns: string
      }
      enqueue_check_source_jobs: { Args: { p_limit?: number }; Returns: number }
      enqueue_integration_job: {
        Args: { p_kind: string; p_payload?: Json; p_provider: string }
        Returns: string
      }
      enqueue_render_job: {
        Args: {
          p_format: string
          p_generated_document_id: string
          p_payload?: Json
        }
        Returns: string
      }
      enqueue_sync_source_jobs: {
        Args: { p_court?: string; p_kind?: string; p_limit?: number }
        Returns: number
      }
      enqueue_sync_stj_sumulas_jobs: {
        Args: { p_limit?: number }
        Returns: number
      }
      ensure_case_tasks_for_stage: {
        Args: { p_case_id: string; p_stage: string }
        Returns: undefined
      }
      finalize_analysis_subject: {
        Args: { p_case_id: string; p_office_id: string; p_subject: string }
        Returns: Json
      }
      finalize_subject: {
        Args: {
          p_case_id?: string
          p_office_id: string
          p_snapshot?: Json
          p_subject: string
        }
        Returns: {
          case_id: string
          created_by: string
          finished_at: string
          id: string
          office_id: string
          status: string
          subject: string
        }[]
      }
      get_active_office_for_user: { Args: never; Returns: string }
      get_agenda_assignees_range: {
        Args: {
          p_from: string
          p_include_done?: boolean
          p_office_id: string
          p_to: string
        }
        Returns: {
          assigned_to: string
          total: number
        }[]
      }
      get_agenda_conflicts: {
        Args: {
          p_assigned_to?: string
          p_from: string
          p_office_id: string
          p_to: string
        }
        Returns: {
          a_end: string
          a_id: string
          a_kind: string
          a_start: string
          a_status: string
          a_title: string
          assigned_to: string
          b_end: string
          b_id: string
          b_kind: string
          b_start: string
          b_status: string
          b_title: string
          overlap_minutes: number
        }[]
      }
      get_agenda_month_bundle:
        | {
            Args: {
              p_assigned_to?: string
              p_include_conflicts?: boolean
              p_include_done?: boolean
              p_month_local: string
              p_office_id: string
              p_timezone?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_assigned_to?: string
              p_include_conflicts?: boolean
              p_include_done?: boolean
              p_month_local: string
              p_office_id: string
            }
            Returns: Json
          }
      get_agenda_overdue_items: {
        Args: {
          p_assigned_to?: string
          p_days_back?: number
          p_limit?: number
          p_office_id: string
          p_offset?: number
        }
        Returns: {
          assigned_to: string
          case_id: string
          client_id: string
          created_by: string
          id: string
          kind: string
          overdue_days: number
          overdue_minutes: number
          priority: string
          start_at: string
          status: string
          title: string
          visibility: string
        }[]
      }
      get_agenda_overdue_kpis: {
        Args: {
          p_assigned_to?: string
          p_days_back?: number
          p_office_id: string
        }
        Returns: Json
      }
      get_agenda_range:
        | {
            Args: {
              p_assigned_to?: string
              p_from: string
              p_include_done?: boolean
              p_office_id: string
              p_timezone?: string
              p_to: string
            }
            Returns: {
              all_day: boolean
              assigned_to: string
              case_id: string
              case_title: string
              client_id: string
              client_name: string
              created_at: string
              end_time: string
              id: string
              kind: string
              local_date: string
              local_time: string
              location: string
              meeting_provider: string
              meeting_url: string
              notes: string
              priority: string
              status: string
              title: string
              updated_at: string
            }[]
          }
        | {
            Args: {
              p_assigned_to?: string
              p_from: string
              p_include_done?: boolean
              p_office_id: string
              p_to: string
            }
            Returns: {
              all_day: boolean
              assigned_to: string
              case_id: string
              client_id: string
              created_by: string
              end_at: string
              id: string
              kind: string
              local_date: string
              local_end_time: string
              local_time: string
              notes: string
              office_id: string
              priority: string
              start_at: string
              status: string
              title: string
              visibility: string
            }[]
          }
      get_agenda_week_bundle: {
        Args: {
          p_assigned_to?: string
          p_include_conflicts?: boolean
          p_include_done?: boolean
          p_office_id: string
          p_week_start_local: string
        }
        Returns: Json
      }
      get_assistant_context: {
        Args: { p_case_id?: string; p_client_id?: string }
        Returns: Json
      }
      get_auth_user_email: { Args: { p_user_id: string }; Returns: string }
      get_case_payments: {
        Args: { p_case_id: string }
        Returns: {
          billing_type: string
          created_at: string
          due_date: string
          id: string
          paid_at: string
          status: string
          value: number
        }[]
      }
      get_financial_kpis: {
        Args: never
        Returns: {
          conversion_rate_percent: number
          paid_charges: number
          ticket_medio: number
          total_canceled: number
          total_charges: number
          total_overdue: number
          total_paid: number
          total_pending: number
        }[]
      }
      get_financial_monthly: {
        Args: never
        Returns: {
          month: string | null
          total_charges: number | null
          total_overdue: number | null
          total_paid: number | null
          total_pending: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vw_financial_monthly"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_active_office: {
        Args: never
        Returns: {
          office_id: string
          office_name: string
        }[]
      }
      get_my_case_role: { Args: { p_case_id: string }; Returns: string }
      get_nija_quota_status: { Args: { p_office_id?: string }; Returns: Json }
      get_nija_usage: { Args: { p_office_id: string }; Returns: Json }
      get_notifications: {
        Args: {
          p_limit?: number
          p_office_id: string
          p_offset?: number
          p_only_unread?: boolean
        }
        Returns: {
          body: string
          created_at: string
          href: string
          id: string
          kind: string
          read_at: string
          severity: string
          source_id: string
          source_table: string
          title: string
        }[]
      }
      get_office_branding_json: { Args: { p_office_id: string }; Returns: Json }
      get_office_branding_json_by_slug: {
        Args: { p_slug: string }
        Returns: Json
      }
      get_office_header_block: {
        Args: { p_office_id: string }
        Returns: string
      }
      get_office_invite_public: {
        Args: { p_token: string }
        Returns: {
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
      get_office_settings: {
        Args: { p_office_id: string }
        Returns: {
          precedents_limit: number
          prefer_curated: boolean
          videos_limit: number
        }[]
      }
      get_office_ui_settings: {
        Args: { p_office_id: string }
        Returns: {
          accent: string
          office_id: string
          sidebar_logo_scale: number
          ui_density: string
          ui_font: string
          ui_scale: number
          updated_at: string
        }[]
      }
      get_or_create_chat_thread: {
        Args: {
          p_case_id?: string
          p_client_id?: string
          p_route?: string
          p_scope?: string
        }
        Returns: string
      }
      get_pending_jobs_count: { Args: never; Returns: number }
      get_plaud_inbox: {
        Args: { p_mode: string; p_office_id: string }
        Returns: {
          assigned_to: string | null
          audio_url: string | null
          case_id: string | null
          created_at: string
          created_at_source: string | null
          created_by: string | null
          duration: number | null
          external_id: string
          id: string
          is_office_visible: boolean
          language: string | null
          linked_at: string | null
          linked_by: string | null
          occurred_at: string | null
          office_id: string
          raw: Json
          received_at: string | null
          source: string
          summary: string | null
          title: string | null
          transcript: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "plaud_assets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_template_code_from_name: { Args: { p_name: string }; Returns: string }
      get_video_chapters: {
        Args: { p_video_id: string }
        Returns: {
          end_seconds: number
          id: string
          start_seconds: number
          title: string
        }[]
      }
      hard_delete_client: { Args: { p_client_id: string }; Returns: Json }
      has_office_role:
        | { Args: { p_office_id: string; p_roles: string[] }; Returns: boolean }
        | { Args: { required_role: string }; Returns: boolean }
      increment_nija_counter: { Args: { p_office_id: string }; Returns: Json }
      init_office_onboarding_steps: {
        Args: { p_office_id: string }
        Returns: undefined
      }
      is_case_paid: { Args: { p_case_id: string }; Returns: boolean }
      is_office_admin: { Args: { p_office_id: string }; Returns: boolean }
      is_office_member: { Args: { p_office_id: string }; Returns: boolean }
      is_valid_cnj: { Args: { p: string }; Returns: boolean }
      kit_job_mark_error: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_job_id: string
          p_step: string
        }
        Returns: undefined
      }
      kit_job_mark_ok: {
        Args: { p_job_id: string; p_step?: string }
        Returns: undefined
      }
      kit_jobs_claim_one: {
        Args: never
        Returns: {
          attempts: number
          client_id: string | null
          created_at: string
          created_by: string | null
          error_code: string | null
          error_message: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          office_id: string | null
          requested_codes: string[]
          requested_codes_key: string
          status: string
          step: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "kit_generation_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      kit_jobs_requeue_stuck: { Args: { p_minutes?: number }; Returns: number }
      knowledge_stats_apply_snapshot: {
        Args: { p_snapshot_id: string }
        Returns: Json
      }
      lexos_active_office_id: { Args: never; Returns: string }
      lexos_assert_admin:
        | { Args: never; Returns: undefined }
        | { Args: { p_office_id: string }; Returns: boolean }
      lexos_audit_db_snapshot: { Args: { p_office_id: string }; Returns: Json }
      lexos_audit_health: { Args: { p_office_id: string }; Returns: Json }
      lexos_audit_kit_pdf_all: { Args: never; Returns: Json }
      lexos_audit_matrix_access: {
        Args: { p_office_id: string }
        Returns: Json
      }
      lexos_audit_save_full_snapshot: {
        Args: {
          p_edge_manifest: Json
          p_frontend_manifest: Json
          p_mode?: string
          p_office_id: string
        }
        Returns: string
      }
      lexos_can_access_case: { Args: { p_case_id: string }; Returns: boolean }
      lexos_cleanup_old_alerts: { Args: { p_days?: number }; Returns: number }
      lexos_cleanup_orphan_documents: { Args: never; Returns: number }
      lexos_codes_key: { Args: { p_codes: string[] }; Returns: string }
      lexos_col_exists: {
        Args: { p_col: string; p_rel: unknown }
        Returns: boolean
      }
      lexos_create_initial_client_docs: {
        Args: { p_client_id: string }
        Returns: undefined
      }
      lexos_create_notification: {
        Args: {
          p_body: string
          p_dedupe_key: string
          p_href: string
          p_kind: string
          p_office_id: string
          p_severity: string
          p_source_id: string
          p_source_table: string
          p_title: string
          p_user_id: string
        }
        Returns: undefined
      }
      lexos_cron_schedule: {
        Args: { p_command: string; p_schedule: string }
        Returns: number
      }
      lexos_cron_set_active: {
        Args: { job_ids: number[]; p_active: boolean }
        Returns: string
      }
      lexos_cron_unschedule: { Args: { job_ids: number[] }; Returns: string }
      lexos_debug_client_kit: { Args: { p_client_id: string }; Returns: Json }
      lexos_delete_client_soft: {
        Args: { p_client_id: string }
        Returns: undefined
      }
      lexos_diag_generated_docs: {
        Args: never
        Returns: {
          columns: Json
          has_document_id: boolean
          null_document_id: number
          tbl: string
          total_rows: number
          triggers_count: number
        }[]
      }
      lexos_generate_document: {
        Args: { p_case_id: string; p_text_base: string }
        Returns: string
      }
      lexos_get_audit_logs: {
        Args: { p_limit?: number; p_office_id?: string; p_offset?: number }
        Returns: {
          action: string | null
          actor_role: string | null
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: string | null
          metadata: Json | null
          office_id: string | null
          office_name: string | null
          record_id: string | null
          table_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vw_audit_logs_full"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lexos_get_audit_trail: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_record_id: string
          p_table_name: string
        }
        Returns: {
          action: string | null
          actor_role: string | null
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: string | null
          metadata: Json | null
          office_id: string | null
          office_name: string | null
          record_id: string | null
          table_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vw_audit_logs_full"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lexos_get_case_documents: {
        Args: { p_case_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          case_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          extracted_text: string | null
          file_size: number | null
          filename: string | null
          id: string | null
          is_locked: boolean | null
          kind: Database["public"]["Enums"]["doc_kind"] | null
          locked_at: string | null
          locked_by: string | null
          metadata: Json | null
          mime_type: string | null
          office_id: string | null
          signed_at: string | null
          signed_by: string | null
          storage_bucket: string | null
          storage_path: string | null
          type_id: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vw_case_documents"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lexos_get_case_generated_docs: {
        Args: { p_case_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          case_id: string | null
          content: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          document_id: string | null
          file_path: string | null
          filename: string | null
          id: string | null
          kind: Database["public"]["Enums"]["doc_kind"] | null
          metadata: Json | null
          mime_type: string | null
          office_id: string | null
          source_template_id: string | null
          title: string | null
          version: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vw_case_generated_docs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lexos_get_case_status_history: {
        Args: { p_case_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          actor_user_id: string | null
          case_id: string | null
          created_at: string | null
          from_status: string | null
          id: string | null
          metadata: Json | null
          office_id: string | null
          reason: string | null
          to_status: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vw_case_status_history"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lexos_get_chat_context: {
        Args: { p_case_id: string; p_office_id: string; p_user_id: string }
        Returns: Json
      }
      lexos_get_cron_jobs_status: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobid: number
          last_run_duration: string
          last_run_end: string
          last_run_message: string
          last_run_start: string
          last_run_status: string
          schedule: string
        }[]
      }
      lexos_get_dashboard_overview: {
        Args: { p_office_id: string }
        Returns: Json
      }
      lexos_get_db_connection_stats: { Args: never; Returns: Json }
      lexos_get_document_audited: { Args: { p_id: string }; Returns: Json }
      lexos_get_kpis: {
        Args: never
        Returns: {
          cases_closed: number | null
          cases_in_progress: number | null
          ref_date: string | null
          total_cases: number | null
          total_clients: number | null
          total_documents: number | null
          total_generated_docs: number | null
        }
        SetofOptions: {
          from: "*"
          to: "vw_lexos_kpis"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lexos_get_my_recent_actions: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          action: string | null
          actor_role: string | null
          actor_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: string | null
          metadata: Json | null
          office_id: string | null
          office_name: string | null
          record_id: string | null
          table_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vw_audit_logs_full"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lexos_get_my_recent_creations: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          action: string | null
          actor_user_id: string | null
          after_data: Json | null
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: string | null
          office_id: string | null
          record_id: string | null
          table_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vw_my_recent_creations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lexos_get_nija_sessions: {
        Args: {
          p_case_id?: string
          p_engine?: string
          p_limit?: number
          p_office_id: string
          p_offset?: number
        }
        Returns: {
          acting_side: string | null
          analysis_result: Json | null
          attachments: Json
          case_id: string | null
          client_name: string | null
          cnj_number: string | null
          created_at: string
          created_by: string
          document_ids: Json | null
          document_names: Json | null
          documents_hash: string | null
          extraction_result: Json | null
          id: string
          input_summary: string | null
          mode: string
          office_id: string
          opponent_name: string | null
          output_alerts: Json
          output_checklist: Json
          output_draft: string | null
          status: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "nija_sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lexos_get_notifications: {
        Args: { p_limit?: number; p_offset?: number; p_only_unread?: boolean }
        Returns: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          kind: string
          metadata: Json
          office_id: string
          read_at: string | null
          title: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lexos_get_security_events: {
        Args: {
          p_event_type?: string
          p_limit?: number
          p_office_id?: string
          p_offset?: number
          p_source?: string
        }
        Returns: {
          created_at: string | null
          description: string | null
          details: Json | null
          event_type: string | null
          id: number | null
          office_id: string | null
          office_name: string | null
          source: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vw_security_events_recent"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lexos_get_subject_tree: { Args: never; Returns: Json }
      lexos_get_template_tags: {
        Args: { p_template_id: string }
        Returns: {
          created_at: string
          created_by: string
          id: string
          office_id: string
          tag: string
          template_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "template_tags"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lexos_get_top_queries:
        | {
            Args: never
            Returns: {
              pid: number
              query_snippet: string
              runtime: string
              state: string
              wait_event: string
            }[]
          }
        | {
            Args: { p_limit?: number }
            Returns: {
              pid: number
              query_snippet: string
              runtime: unknown
              state: string
              wait_event: string
            }[]
          }
      lexos_healthcheck: {
        Args: never
        Returns: {
          details: Json
          item: string
          qtd: number
          status: string
        }[]
      }
      lexos_healthcheck_and_notify: { Args: never; Returns: undefined }
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
      lexos_is_active_member: {
        Args: { p_office_id: string }
        Returns: boolean
      }
      lexos_is_admin: { Args: { p_office_id: string }; Returns: boolean }
      lexos_is_member: { Args: { p_office_id: string }; Returns: boolean }
      lexos_is_office_member: {
        Args: { p_office_id: string }
        Returns: boolean
      }
      lexos_is_owner: { Args: { p_office_id: string }; Returns: boolean }
      lexos_is_owner_or_admin: {
        Args: { p_office_id: string }
        Returns: boolean
      }
      lexos_jwt_office_id: { Args: never; Returns: string }
      lexos_list_office_members: {
        Args: { p_office_id: string }
        Returns: {
          created_at: string
          role: Database["public"]["Enums"]["office_role"]
          user_id: string
        }[]
      }
      lexos_list_pending_alerts: {
        Args: { p_limit?: number }
        Returns: {
          alert_id: string
          case_id: string
          channel: string
          deadline_id: string
          due_at: string
          notify_at: string
          office_id: string
          priority: string
          title: string
        }[]
      }
      lexos_log_function_event: {
        Args: {
          p_description?: string
          p_details?: Json
          p_event_type: string
          p_function_name: string
          p_office_id?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      lexos_log_read: {
        Args: { p_office_id: string; p_row_pk: string; p_table: string }
        Returns: undefined
      }
      lexos_log_security_event: {
        Args: {
          p_description?: string
          p_details?: Json
          p_event_type: string
          p_office_id?: string
          p_source: string
          p_user_id?: string
        }
        Returns: undefined
      }
      lexos_map_deadline_status_to_agenda: {
        Args: { p_status: string }
        Returns: string
      }
      lexos_mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      lexos_meeting_provider: { Args: { p_url: string }; Returns: string }
      lexos_my_role: { Args: { p_office_id: string }; Returns: string }
      lexos_next_states_for_case: {
        Args: { p_case_id: string }
        Returns: {
          sort_order: number
          to_state_code: string
          to_state_id: string
          to_state_name: string
        }[]
      }
      lexos_nija_create_case: {
        Args: {
          p_client_id: string
          p_side: Database["public"]["Enums"]["case_side"]
          p_stage?: string
          p_subject_id?: string
          p_title: string
        }
        Returns: string
      }
      lexos_nija_healthcheck: { Args: never; Returns: Json }
      lexos_nija_insert_analysis: {
        Args: {
          p_analysis: Json
          p_analysis_key: string
          p_case_id?: string
          p_documents_hash: string
          p_session_id?: string
        }
        Returns: string
      }
      lexos_nija_insert_piece: {
        Args: {
          p_case_id: string
          p_documents_hash: string
          p_piece: Json
          p_piece_type: string
        }
        Returns: string
      }
      lexos_nija_log_event: {
        Args: {
          p_action: string
          p_case_id?: string
          p_duration_ms?: number
          p_error?: Json
          p_level: string
          p_office_id?: string
          p_payload?: Json
          p_result?: Json
          p_session_id?: string
          p_source: string
        }
        Returns: string
      }
      lexos_nija_update_case_metadata: {
        Args: { p_case_id: string; p_patch: Json }
        Returns: undefined
      }
      lexos_norm_codes_key: { Args: { codes: string[] }; Returns: string }
      lexos_normalize_role: {
        Args: { p_role: string }
        Returns: Database["public"]["Enums"]["office_role"]
      }
      lexos_notify_agenda_window: {
        Args: { p_item_id: string; p_window: string }
        Returns: undefined
      }
      lexos_notify_deadline_d_window: {
        Args: { p_item_id: string; p_window: string }
        Returns: undefined
      }
      lexos_notify_overdue_daily: { Args: never; Returns: undefined }
      lexos_policy_simulate: {
        Args: {
          p_case_id?: string
          p_office_id: string
          p_role: string
          p_user_id?: string
        }
        Returns: Json
      }
      lexos_precedents_claim_jobs: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          finished_at: string | null
          id: string
          job_type: string
          last_error: string | null
          payload: Json
          source_id: string | null
          started_at: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "legal_precedent_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      lexos_precedents_enqueue_due_jobs: {
        Args: { p_limit_sources?: number }
        Returns: {
          enqueued: number
        }[]
      }
      lexos_precedents_finish_job: {
        Args: { p_job_id: string; p_last_error?: string; p_success: boolean }
        Returns: undefined
      }
      lexos_precedents_touch_source_run: {
        Args: { p_source_id: string }
        Returns: undefined
      }
      lexos_process_alert_queue_cron_safe: { Args: never; Returns: undefined }
      lexos_process_deadline_alerts:
        | { Args: never; Returns: undefined }
        | { Args: { p_limit?: number }; Returns: Json }
      lexos_process_deadline_alerts_cron_safe: {
        Args: never
        Returns: undefined
      }
      lexos_process_precedents_worker_cron_safe: {
        Args: never
        Returns: undefined
      }
      lexos_process_sla_notify_queue: {
        Args: never
        Returns: {
          alert_id: string
          deadline_id: string
          delay_seconds: number
          first_sent_at: string
          notify_at: string
          office_id: string
        }[]
      }
      lexos_promote_release: {
        Args: { p_office_id: string; p_snapshot_id: string; p_target?: string }
        Returns: Json
      }
      lexos_quota_consume: {
        Args: { p_amount?: number; p_kind: string }
        Returns: Json
      }
      lexos_remove_member: {
        Args: { p_office_id: string; p_user_id: string }
        Returns: Json
      }
      lexos_request_uid: { Args: never; Returns: string }
      lexos_resolve_template: {
        Args: { p_subject_id: string }
        Returns: {
          branch_id: string | null
          content: string
          created_at: string
          id: string
          is_active: boolean
          subject_id: string | null
          title: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "legal_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lexos_run_daily_agenda_notifications: { Args: never; Returns: undefined }
      lexos_run_daily_deadline_notifications: {
        Args: never
        Returns: undefined
      }
      lexos_safe_count: {
        Args: { p_table_name: string; p_where?: string }
        Returns: number
      }
      lexos_save_legal_precedent: { Args: { p: Json }; Returns: string }
      lexos_set_case_state: {
        Args: { p_case_id: string; p_note?: string; p_to_state_code: string }
        Returns: undefined
      }
      lexos_set_member_role: {
        Args: { p_new_role: string; p_office_id: string; p_user_id: string }
        Returns: Json
      }
      lexos_suggest_subject: { Args: { p_text: string }; Returns: string }
      lexos_telemetry_log: {
        Args: {
          p_duration_ms?: number
          p_kind: string
          p_office_id: string
          p_payload: Json
          p_route?: string
        }
        Returns: string
      }
      lexos_transition_case_state: {
        Args: { p_case_id: string; p_note?: string; p_to_state_id: string }
        Returns: string
      }
      lexos_update_case_status: {
        Args: { p_case_id: string; p_new_status: string; p_reason?: string }
        Returns: {
          area: string | null
          client_id: string
          cnj_number: string | null
          cnj_validated_at: string | null
          comarca: string | null
          court_name: string | null
          created_at: string
          created_by: string
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
          office_id: string
          opponent_doc: string | null
          opponent_name: string | null
          side: Database["public"]["Enums"]["case_side"]
          stage: string
          state_id: string | null
          status: string
          subject_id: string | null
          subtype: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lexos_user_in_office: { Args: { p_office_id: string }; Returns: boolean }
      lexos_user_office_ids: { Args: never; Returns: string[] }
      link_plaud_asset_to_case: {
        Args: { p_asset_id: string; p_case_id: string }
        Returns: undefined
      }
      list_office_plans: {
        Args: never
        Returns: {
          code: string
          name: string
          nija_monthly_limit: number
        }[]
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity: string
          p_entity_id: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      log_case_event: {
        Args: {
          p_case_id: string
          p_event_type: string
          p_payload?: Json
          p_title: string
        }
        Returns: undefined
      }
      log_document_access: {
        Args: { p_action: string; p_document_id: string; p_metadata?: Json }
        Returns: undefined
      }
      log_document_event: {
        Args: {
          p_document_id: string
          p_event_type: string
          p_message?: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      log_document_generation: {
        Args: { p_case_id: string; p_data: Json; p_template_id: string }
        Returns: undefined
      }
      log_knowledge_run: {
        Args: {
          p_case_id: string
          p_office_id: string
          p_precedents_count: number
          p_run_source: string
          p_settings: Json
          p_subject: string
          p_used_query: string
          p_videos_count: number
        }
        Returns: undefined
      }
      log_nija_quota_alert: {
        Args: { p_alert_type: string }
        Returns: undefined
      }
      log_nija_usage: {
        Args: { p_case_id: string; p_module: string }
        Returns: undefined
      }
      make_precedent_code: {
        Args: {
          p_court: string
          p_kind: Database["public"]["Enums"]["precedent_kind"]
          p_number: string
        }
        Returns: string
      }
      map_user_friendly_error: { Args: { p_code: string }; Returns: string }
      mark_all_notifications_read: {
        Args: { p_office_id: string }
        Returns: undefined
      }
      mark_document_signed: {
        Args: { p_document_id: string }
        Returns: undefined
      }
      mark_kit_job_done: {
        Args: { p_job_id: string; p_note?: string }
        Returns: undefined
      }
      mark_kit_job_error: {
        Args: { p_error: string; p_job_id: string; p_worker?: string }
        Returns: undefined
      }
      mark_notification_read: { Args: { p_id: string }; Returns: undefined }
      my_office_id: { Args: never; Returns: string }
      nija_month_usage: {
        Args: { p_month: string; p_office_id: string }
        Returns: number
      }
      notify_nija_quota_webhook: {
        Args: { p_alert_type: string }
        Returns: undefined
      }
      omni_trace_log: {
        Args: {
          p_asset_id: string
          p_case_id: string
          p_decision: string
          p_input_hash?: string
          p_metadata?: Json
          p_office_id: string
          p_rationale?: Json
          p_source: string
          p_summary?: string
          p_title?: string
        }
        Returns: string
      }
      persist_knowledge_snapshot: {
        Args: {
          p_case_id: string
          p_office_id: string
          p_precedents: Json
          p_settings: Json
          p_subject: string
          p_used_query: string
          p_videos: Json
        }
        Returns: undefined
      }
      promote_suggestion_to_precedent: {
        Args: {
          p_status?: Database["public"]["Enums"]["precedent_status"]
          p_suggestion_id: string
        }
        Returns: string
      }
      purge_old_audit_events: {
        Args: { p_months?: number }
        Returns: undefined
      }
      recommend_knowledge: {
        Args: {
          p_case_id?: string
          p_force_refresh?: boolean
          p_office_id: string
          p_subject: string
        }
        Returns: {
          cached: boolean
          cached_at: string
          precedents: Json
          trilha: Json
          used_query: string
          videos: Json
        }[]
      }
      recommend_knowledge_advanced: {
        Args: {
          p_case_id?: string
          p_force_refresh?: boolean
          p_office_id: string
          p_precedents_limit?: number
          p_prefer_curated?: boolean
          p_subject: string
          p_videos_limit?: number
        }
        Returns: {
          cached: boolean
          precedents: Json
          used_query: string
          videos: Json
        }[]
      }
      recommend_knowledge_ranked: {
        Args: {
          p_case_id: string
          p_force_refresh?: boolean
          p_office_id: string
          p_subject: string
        }
        Returns: Json[]
      }
      recommend_knowledge_uncached: {
        Args: {
          p_case_id?: string
          p_force_refresh?: boolean
          p_office_id: string
          p_subject: string
        }
        Returns: {
          cached: boolean
          cached_at: string
          precedents: Json
          trilha: Json
          used_query: string
          videos: Json
        }[]
      }
      recommend_videos: {
        Args: { p_case_id: string; p_limit?: number }
        Returns: {
          area: string
          duracao_seconds: number
          id: string
          office_id: string
          score: number
          tags: string[]
          tipo: string
          titulo: string
          url: string
        }[]
      }
      reenable_all_sources: { Args: never; Returns: number }
      refresh_knowledge: {
        Args: {
          p_case_id?: string
          p_office_id: string
          p_precedents_limit?: number
          p_prefer_curated?: boolean
          p_subject: string
          p_videos_limit?: number
        }
        Returns: {
          cached: boolean
          precedents: Json
          used_query: string
          videos: Json
        }[]
      }
      refresh_lexos_schema_audit_findings: { Args: never; Returns: undefined }
      render_template_preview: {
        Args: { p_data: Json; p_template_id: string }
        Returns: string
      }
      request_document_signature:
        | { Args: { p_document_id: string }; Returns: string }
        | {
            Args: { p_document_id: string; p_provider?: string }
            Returns: string
          }
      restore_document_version: {
        Args: { p_document_id: string; p_version_no: number }
        Returns: undefined
      }
      restore_soft_deleted_document: {
        Args: { p_document_id: string }
        Returns: undefined
      }
      retry_failed_check_source_jobs: {
        Args: { p_limit?: number }
        Returns: number
      }
      retry_failed_sync_source_jobs: {
        Args: { p_limit?: number }
        Returns: number
      }
      retry_single_job: { Args: { p_job_id: string }; Returns: boolean }
      rpc_link_client_file_to_requirement: {
        Args: { p_file_id: string; p_req_id: string; p_status: string }
        Returns: undefined
      }
      run_lexos_healthcheck: { Args: never; Returns: Json }
      run_nija_with_quota: {
        Args: { p_case_id: string; p_module: string }
        Returns: Json
      }
      save_precedent_suggestion:
        | {
            Args: {
              p_case_id: string
              p_confidence?: number
              p_court: string
              p_kind: string
              p_number: string
              p_source_url?: string
              p_text_full: string
              p_title: string
            }
            Returns: string
          }
        | {
            Args: {
              p_case_id: string
              p_court: string
              p_kind: Database["public"]["Enums"]["precedent_kind"]
              p_number: string
              p_office_id: string
              p_rationale?: string
              p_source_url?: string
              p_text_full?: string
              p_title?: string
              p_year?: number
            }
            Returns: string
          }
      search_legal_precedents: {
        Args: {
          p_kinds?: string[]
          p_limit?: number
          p_office_id: string
          p_only_curated?: boolean
          p_query: string
          p_tribunal?: string
        }
        Returns: Json[]
      }
      search_legal_precedents_ranked: {
        Args: {
          p_limit?: number
          p_office_id: string
          p_prefer_curated?: boolean
          p_query: string
        }
        Returns: {
          ementa: string
          link: string
          ref_code: string
          score: number
          tags: string[]
          tese: string
          tipo: string
          titulo: string
          tribunal: string
        }[]
      }
      search_precedents:
        | {
            Args: {
              p_area?: string
              p_keywords?: string[]
              p_limit?: number
              p_query?: string
            }
            Returns: {
              area: string
              ementa: string
              id: string
              link_oficial: string
              numero: string
              office_id: string
              palavras_chave: string[]
              tipo: string
              titulo: string
              tribunal: string
            }[]
          }
        | {
            Args: { p_limit?: number; p_office_id: string; p_query: string }
            Returns: {
              court: string
              id: string
              ref_code: string
              score: number
              summary: string
              thesis: string
              title: string
            }[]
          }
      seed_client_kit_requirements: {
        Args: {
          p_client_id: string
          p_is_company?: boolean
          p_office_id: string
        }
        Returns: number
      }
      set_my_office_plan: { Args: { p_plan_code: string }; Returns: undefined }
      sign_generated_document: {
        Args: {
          p_generated_document_id: string
          p_metadata?: Json
          p_signature_base64: string
          p_signed_hash: string
          p_signer_doc: string
          p_signer_name: string
          p_signer_type: string
        }
        Returns: string
      }
      soft_delete_document: {
        Args: { p_document_id: string; p_reason?: string }
        Returns: undefined
      }
      sua_funcao_exemplo: { Args: never; Returns: undefined }
      sync_stj_sumulas_first_load: { Args: never; Returns: undefined }
      template_missing_vars: {
        Args: { p_data: Json; p_template_id: string }
        Returns: {
          var: string
        }[]
      }
      template_vars: {
        Args: { p_template_id: string }
        Returns: {
          var: string
        }[]
      }
      title_case_br: { Args: { input: string }; Returns: string }
      upsert_google_calendar_connection: {
        Args: {
          p_access_token: string
          p_calendar_id: string
          p_office_id: string
          p_refresh_token: string
          p_scopes: string[]
          p_token_expires_at: string
        }
        Returns: Json
      }
      upsert_legal_precedent: {
        Args: {
          p_checksum_text?: string
          p_court: string
          p_kind: Database["public"]["Enums"]["precedent_kind"]
          p_number: string
          p_source_kind?: Database["public"]["Enums"]["precedent_source_kind"]
          p_source_url?: string
          p_status?: Database["public"]["Enums"]["precedent_status"]
          p_text_full?: string
          p_title?: string
          p_year?: number
        }
        Returns: string
      }
      worker_lock_release: { Args: never; Returns: undefined }
      worker_lock_try: {
        Args: { p_lock_duration_seconds?: number }
        Returns: boolean
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
      doc_kind:
        | "PROCURACAO"
        | "DECLARACAO"
        | "CONTRATO"
        | "PECA"
        | "ANEXO"
        | "PROCESSO_PDF"
        | "OUTRO"
      office_role: "OWNER" | "ADMIN" | "MEMBER"
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
      doc_kind: [
        "PROCURACAO",
        "DECLARACAO",
        "CONTRATO",
        "PECA",
        "ANEXO",
        "PROCESSO_PDF",
        "OUTRO",
      ],
      office_role: ["OWNER", "ADMIN", "MEMBER"],
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
    },
  },
} as const
