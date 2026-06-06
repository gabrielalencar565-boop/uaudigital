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
      access_requests: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          id: string
          note: string | null
          requested_at: string
          status: Database["public"]["Enums"]["access_request_status"]
          user_id: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["access_request_status"]
          user_id: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["access_request_status"]
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: number
          login_bg_images: Json
          login_bg_object_fit: string
          login_bg_opacity: number
          login_bg_position_x: number
          login_bg_position_y: number
          login_bg_zoom: number
          logo_shape: Database["public"]["Enums"]["logo_shape_type"]
          logo_url: string | null
          sidebar_logo_dark_url: string | null
          sidebar_logo_url: string | null
          updated_at: string
          updated_by: string | null
          workspace_name: string
        }
        Insert: {
          id?: number
          login_bg_images?: Json
          login_bg_object_fit?: string
          login_bg_opacity?: number
          login_bg_position_x?: number
          login_bg_position_y?: number
          login_bg_zoom?: number
          logo_shape?: Database["public"]["Enums"]["logo_shape_type"]
          logo_url?: string | null
          sidebar_logo_dark_url?: string | null
          sidebar_logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_name?: string
        }
        Update: {
          id?: number
          login_bg_images?: Json
          login_bg_object_fit?: string
          login_bg_opacity?: number
          login_bg_position_x?: number
          login_bg_position_y?: number
          login_bg_zoom?: number
          logo_shape?: Database["public"]["Enums"]["logo_shape_type"]
          logo_url?: string | null
          sidebar_logo_dark_url?: string | null
          sidebar_logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
          workspace_name?: string
        }
        Relationships: []
      }
      cleaning_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cleaning_completions: {
        Row: {
          completed_at: string
          completed_by: string
          completed_date: string
          id: string
          schedule_id: string
        }
        Insert: {
          completed_at?: string
          completed_by: string
          completed_date: string
          id?: string
          schedule_id: string
        }
        Update: {
          completed_at?: string
          completed_by?: string
          completed_date?: string
          id?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_completions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "cleaning_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_schedules: {
        Row: {
          category_id: string
          created_at: string
          day_of_week: number
          due_time: string | null
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          day_of_week: number
          due_time?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          day_of_week?: number
          due_time?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_schedules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cleaning_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      client_cycle_stages: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          cycle_id: string
          id: string
          stage: Database["public"]["Enums"]["stage_type"]
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          cycle_id: string
          id?: string
          stage: Database["public"]["Enums"]["stage_type"]
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          cycle_id?: string
          id?: string
          stage?: Database["public"]["Enums"]["stage_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_cycle_stages_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "client_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_cycles: {
        Row: {
          client_id: string
          created_at: string
          due_date: string
          id: string
          is_active: boolean
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date: string
          id?: string
          is_active?: boolean
          month: number
          updated_at?: string
          year: number
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string
          id?: string
          is_active?: boolean
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_squads: {
        Row: {
          client_id: string
          created_at: string
          id: string
          squad_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          squad_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          squad_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_squads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_squads_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_stages: {
        Row: {
          client_id: string
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          stage: Database["public"]["Enums"]["stage_type"]
          updated_at: string
        }
        Insert: {
          client_id: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          stage: Database["public"]["Enums"]["stage_type"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          stage?: Database["public"]["Enums"]["stage_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_stages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          appears_in_financial: boolean
          contract_start: string
          created_at: string
          end_reason: string | null
          ended_at: string | null
          has_goals: boolean
          id: string
          is_active: boolean
          is_freelancer_sentinel: boolean
          magic_due_date: string
          manager_id: string | null
          monthly_value: number
          name: string
          notes: string | null
          participates_magic: boolean
          participates_ranking: boolean
          paused_from: string | null
          plan_name: string | null
          resumed_from: string | null
          services: string[]
          updated_at: string
        }
        Insert: {
          appears_in_financial?: boolean
          contract_start?: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          has_goals?: boolean
          id?: string
          is_active?: boolean
          is_freelancer_sentinel?: boolean
          magic_due_date: string
          manager_id?: string | null
          monthly_value?: number
          name: string
          notes?: string | null
          participates_magic?: boolean
          participates_ranking?: boolean
          paused_from?: string | null
          plan_name?: string | null
          resumed_from?: string | null
          services?: string[]
          updated_at?: string
        }
        Update: {
          appears_in_financial?: boolean
          contract_start?: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          has_goals?: boolean
          id?: string
          is_active?: boolean
          is_freelancer_sentinel?: boolean
          magic_due_date?: string
          manager_id?: string | null
          monthly_value?: number
          name?: string
          notes?: string | null
          participates_magic?: boolean
          participates_ranking?: boolean
          paused_from?: string | null
          plan_name?: string | null
          resumed_from?: string | null
          services?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      financial_clients: {
        Row: {
          cnpj: string | null
          contract_months: number
          contract_start: string
          created_at: string
          due_day: number | null
          end_reason: string | null
          ended_at: string | null
          id: string
          is_active: boolean
          monthly_value: number
          name: string
          notes: string | null
          paused_from: string | null
          resumed_from: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          contract_months?: number
          contract_start?: string
          created_at?: string
          due_day?: number | null
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean
          monthly_value?: number
          name: string
          notes?: string | null
          paused_from?: string | null
          resumed_from?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          contract_months?: number
          contract_start?: string
          created_at?: string
          due_day?: number | null
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean
          monthly_value?: number
          name?: string
          notes?: string | null
          paused_from?: string | null
          resumed_from?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financial_credit_cards: {
        Row: {
          brand: string | null
          closing_day: number
          created_at: string
          due_day: number
          id: string
          is_active: boolean
          last_digits: string | null
          name: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          closing_day?: number
          created_at?: string
          due_day?: number
          id?: string
          is_active?: boolean
          last_digits?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          closing_day?: number
          created_at?: string
          due_day?: number
          id?: string
          is_active?: boolean
          last_digits?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          credit_card_id: string | null
          description: string
          due_day: number | null
          id: string
          installment_current: number | null
          installment_total: number | null
          is_recurring: boolean
          month: number
          notes: string | null
          paid_at: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          credit_card_id?: string | null
          description: string
          due_day?: number | null
          id?: string
          installment_current?: number | null
          installment_total?: number | null
          is_recurring?: boolean
          month: number
          notes?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          credit_card_id?: string | null
          description?: string
          due_day?: number | null
          id?: string
          installment_current?: number | null
          installment_total?: number | null
          is_recurring?: boolean
          month?: number
          notes?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_expenses_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "financial_credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_goals: {
        Row: {
          created_at: string
          expense_limit: number
          id: string
          month: number | null
          notes: string | null
          revenue_goal: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          expense_limit?: number
          id?: string
          month?: number | null
          notes?: string | null
          revenue_goal?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          expense_limit?: number
          id?: string
          month?: number | null
          notes?: string | null
          revenue_goal?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      financial_opening_balances: {
        Row: {
          amount: number
          created_at: string
          id: string
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          month: number
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      financial_revenues: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          id: string
          month: number
          notes: string | null
          paid_at: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_revenues_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "financial_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          date: string
          description: string
          id: string
          notes: string | null
          source: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          description: string
          id?: string
          notes?: string | null
          source?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          notes?: string | null
          source?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      health_score_tokens: {
        Row: {
          client_id: string
          created_at: string
          id: string
          month: number
          slug: string | null
          token: string
          used_at: string | null
          year: number
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          month: number
          slug?: string | null
          token?: string
          used_at?: string | null
          year: number
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          month?: number
          slug?: string | null
          token?: string
          used_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "health_score_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      health_scores: {
        Row: {
          alinhamento_estrategico: number
          client_id: string
          comentario_alinhamento: string | null
          comentario_comunicacao: string | null
          comentario_qualidade: string | null
          comentario_resultado: string | null
          comentario_satisfacao: string | null
          comunicacao_atendimento: number
          created_at: string
          evaluated_by: string
          id: string
          month: number
          qualidade_entregas: number
          resultado_percebido: number
          satisfacao_geral: number
          updated_at: string
          year: number
        }
        Insert: {
          alinhamento_estrategico?: number
          client_id: string
          comentario_alinhamento?: string | null
          comentario_comunicacao?: string | null
          comentario_qualidade?: string | null
          comentario_resultado?: string | null
          comentario_satisfacao?: string | null
          comunicacao_atendimento?: number
          created_at?: string
          evaluated_by: string
          id?: string
          month: number
          qualidade_entregas?: number
          resultado_percebido?: number
          satisfacao_geral?: number
          updated_at?: string
          year: number
        }
        Update: {
          alinhamento_estrategico?: number
          client_id?: string
          comentario_alinhamento?: string | null
          comentario_comunicacao?: string | null
          comentario_qualidade?: string | null
          comentario_resultado?: string | null
          comentario_satisfacao?: string | null
          comunicacao_atendimento?: number
          created_at?: string
          evaluated_by?: string
          id?: string
          month?: number
          qualidade_entregas?: number
          resultado_percebido?: number
          satisfacao_geral?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "health_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_dates: {
        Row: {
          color: string
          created_at: string
          created_by: string
          day_of_month: number
          icon: string
          id: string
          is_active: boolean
          is_recurring: boolean
          specific_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          day_of_month?: number
          icon?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          specific_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          day_of_month?: number
          icon?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          specific_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      magic2_client_links: {
        Row: {
          agenda_client_id: string
          created_at: string
          id: string
          magic2_client_id: string
        }
        Insert: {
          agenda_client_id: string
          created_at?: string
          id?: string
          magic2_client_id: string
        }
        Update: {
          agenda_client_id?: string
          created_at?: string
          id?: string
          magic2_client_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic2_client_links_agenda_client_id_fkey"
            columns: ["agenda_client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic2_client_links_magic2_client_id_fkey"
            columns: ["magic2_client_id"]
            isOneToOne: true
            referencedRelation: "magic2_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      magic2_clients: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      magic2_cycle_stages: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          cycle_id: string
          id: string
          stage: Database["public"]["Enums"]["magic2_stage_type"]
          updated_at: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          cycle_id: string
          id?: string
          stage: Database["public"]["Enums"]["magic2_stage_type"]
          updated_at?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          cycle_id?: string
          id?: string
          stage?: Database["public"]["Enums"]["magic2_stage_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic2_cycle_stages_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "magic2_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      magic2_cycles: {
        Row: {
          client_id: string
          created_at: string
          due_date: string
          id: string
          is_active: boolean
          month: number
          updated_at: string
          year: number
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date: string
          id?: string
          is_active?: boolean
          month: number
          updated_at?: string
          year: number
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string
          id?: string
          is_active?: boolean
          month?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "magic2_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "magic2_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      mrr_movements: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          month: number
          type: string
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          month: number
          type: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          month?: number
          type?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          id: string
          notification_key: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_key: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_key?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_scores: {
        Row: {
          ambiente_organizado: number
          aprendizado_continuo: number
          comprometimento: number
          created_at: string
          created_by: string
          id: string
          metas_prazos: number
          month: number
          padrao_qualidade_uau: number
          squad_destaque: number
          updated_at: string
          user_id: string
          video_destaque: number
          year: number
        }
        Insert: {
          ambiente_organizado?: number
          aprendizado_continuo?: number
          comprometimento?: number
          created_at?: string
          created_by: string
          id?: string
          metas_prazos?: number
          month: number
          padrao_qualidade_uau?: number
          squad_destaque?: number
          updated_at?: string
          user_id: string
          video_destaque?: number
          year: number
        }
        Update: {
          ambiente_organizado?: number
          aprendizado_continuo?: number
          comprometimento?: number
          created_at?: string
          created_by?: string
          id?: string
          metas_prazos?: number
          month?: number
          padrao_qualidade_uau?: number
          squad_destaque?: number
          updated_at?: string
          user_id?: string
          video_destaque?: number
          year?: number
        }
        Relationships: []
      }
      pm_activity_log: {
        Row: {
          action: string
          created_at: string
          created_by: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          created_at?: string
          created_by: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      pm_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          order_index: number
          public_url: string | null
          storage_path: string
          subtask_id: string | null
          task_id: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          order_index?: number
          public_url?: string | null
          storage_path: string
          subtask_id?: string | null
          task_id?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          order_index?: number
          public_url?: string | null
          storage_path?: string
          subtask_id?: string | null
          task_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_attachments_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "pm_subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          image_description: string | null
          image_url: string | null
          link_image: string | null
          link_title: string | null
          link_url: string | null
          subtask_id: string | null
          task_id: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          image_description?: string | null
          image_url?: string | null
          link_image?: string | null
          link_title?: string | null
          link_url?: string | null
          subtask_id?: string | null
          task_id?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          image_description?: string | null
          image_url?: string | null
          link_image?: string | null
          link_title?: string | null
          link_url?: string | null
          subtask_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_comments_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "pm_subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_cronograma_feedback: {
        Row: {
          created_at: string
          feedback_text: string | null
          id: string
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pm_pdf_settings: {
        Row: {
          accent_color: string
          agency_logo_url: string | null
          agency_name: string
          agenda_layout: string
          background_color: string
          background_image_url: string | null
          blocks_enabled: Json
          blocks_order: Json
          card_caption_font_size: number
          card_date_font_size: number
          card_font_size: number
          card_image_width_pct: number
          card_proportion: string
          carousel_caption_font_size: number
          carousel_cols: number
          carousel_date_font_size: number
          carousel_image_height_pct: number
          carousel_rows: number
          carousel_title_font_size: number
          cover_logo_url: string | null
          footer_contact: string
          footer_contact_font_size: number
          footer_subtitle_font_size: number
          footer_text: string
          footer_title_font_size: number
          id: string
          layout_overrides: Json
          margin_size: number
          show_caption_on_card: boolean
          show_time_on_card: boolean
          subtitle_color: string
          subtitle_font_size: number
          title_color: string
          title_font_size: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent_color?: string
          agency_logo_url?: string | null
          agency_name?: string
          agenda_layout?: string
          background_color?: string
          background_image_url?: string | null
          blocks_enabled?: Json
          blocks_order?: Json
          card_caption_font_size?: number
          card_date_font_size?: number
          card_font_size?: number
          card_image_width_pct?: number
          card_proportion?: string
          carousel_caption_font_size?: number
          carousel_cols?: number
          carousel_date_font_size?: number
          carousel_image_height_pct?: number
          carousel_rows?: number
          carousel_title_font_size?: number
          cover_logo_url?: string | null
          footer_contact?: string
          footer_contact_font_size?: number
          footer_subtitle_font_size?: number
          footer_text?: string
          footer_title_font_size?: number
          id?: string
          layout_overrides?: Json
          margin_size?: number
          show_caption_on_card?: boolean
          show_time_on_card?: boolean
          subtitle_color?: string
          subtitle_font_size?: number
          title_color?: string
          title_font_size?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent_color?: string
          agency_logo_url?: string | null
          agency_name?: string
          agenda_layout?: string
          background_color?: string
          background_image_url?: string | null
          blocks_enabled?: Json
          blocks_order?: Json
          card_caption_font_size?: number
          card_date_font_size?: number
          card_font_size?: number
          card_image_width_pct?: number
          card_proportion?: string
          carousel_caption_font_size?: number
          carousel_cols?: number
          carousel_date_font_size?: number
          carousel_image_height_pct?: number
          carousel_rows?: number
          carousel_title_font_size?: number
          cover_logo_url?: string | null
          footer_contact?: string
          footer_contact_font_size?: number
          footer_subtitle_font_size?: number
          footer_text?: string
          footer_title_font_size?: number
          id?: string
          layout_overrides?: Json
          margin_size?: number
          show_caption_on_card?: boolean
          show_time_on_card?: boolean
          subtitle_color?: string
          subtitle_font_size?: number
          title_color?: string
          title_font_size?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pm_projects: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          month_ref: string | null
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          month_ref?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          month_ref?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_stage_flows: {
        Row: {
          created_at: string
          created_by: string
          flow_config: Json
          id: string
          is_default: boolean
          name: string
          stage_assignees: Json | null
          transition_dates: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          flow_config?: Json
          id?: string
          is_default?: boolean
          name: string
          stage_assignees?: Json | null
          transition_dates?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          flow_config?: Json
          id?: string
          is_default?: boolean
          name?: string
          stage_assignees?: Json | null
          transition_dates?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      pm_subtasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_required: boolean
          order_index: number
          stage: Database["public"]["Enums"]["pm_stage"]
          status: Database["public"]["Enums"]["pm_subtask_status"]
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_required?: boolean
          order_index?: number
          stage?: Database["public"]["Enums"]["pm_stage"]
          status?: Database["public"]["Enums"]["pm_subtask_status"]
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_required?: boolean
          order_index?: number
          stage?: Database["public"]["Enums"]["pm_stage"]
          status?: Database["public"]["Enums"]["pm_subtask_status"]
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_tags: {
        Row: {
          color_key: string
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          color_key?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          color_key?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pm_tasks: {
        Row: {
          assignee_id: string | null
          caption: string | null
          client_id: string
          cover_url: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_draft: boolean
          is_extra_demand: boolean
          origin_task_id: string | null
          parent_task_id: string | null
          periodic_stage_key: string | null
          post_type: string | null
          posting_date: string | null
          posting_time: string | null
          priority: Database["public"]["Enums"]["pm_priority"]
          project_id: string | null
          revision_notes: Json | null
          stage_current: Database["public"]["Enums"]["pm_stage"]
          start_date: string | null
          status_global: Database["public"]["Enums"]["pm_status"]
          tags: string[] | null
          title: string
          updated_at: string
          watchers: string[] | null
        }
        Insert: {
          assignee_id?: string | null
          caption?: string | null
          client_id: string
          cover_url?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_draft?: boolean
          is_extra_demand?: boolean
          origin_task_id?: string | null
          parent_task_id?: string | null
          periodic_stage_key?: string | null
          post_type?: string | null
          posting_date?: string | null
          posting_time?: string | null
          priority?: Database["public"]["Enums"]["pm_priority"]
          project_id?: string | null
          revision_notes?: Json | null
          stage_current?: Database["public"]["Enums"]["pm_stage"]
          start_date?: string | null
          status_global?: Database["public"]["Enums"]["pm_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
          watchers?: string[] | null
        }
        Update: {
          assignee_id?: string | null
          caption?: string | null
          client_id?: string
          cover_url?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_draft?: boolean
          is_extra_demand?: boolean
          origin_task_id?: string | null
          parent_task_id?: string | null
          periodic_stage_key?: string | null
          post_type?: string | null
          posting_date?: string | null
          posting_time?: string | null
          priority?: Database["public"]["Enums"]["pm_priority"]
          project_id?: string | null
          revision_notes?: Json | null
          stage_current?: Database["public"]["Enums"]["pm_stage"]
          start_date?: string | null
          status_global?: Database["public"]["Enums"]["pm_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
          watchers?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_origin_task_id_fkey"
            columns: ["origin_task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          role_title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          role_title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          role_title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_levels: {
        Row: {
          created_at: string
          exclusive_reward: string | null
          icon: string | null
          id: string
          level_number: number
          name: string
          updated_at: string
          xp_required: number
        }
        Insert: {
          created_at?: string
          exclusive_reward?: string | null
          icon?: string | null
          id?: string
          level_number: number
          name: string
          updated_at?: string
          xp_required: number
        }
        Update: {
          created_at?: string
          exclusive_reward?: string | null
          icon?: string | null
          id?: string
          level_number?: number
          name?: string
          updated_at?: string
          xp_required?: number
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          delivered_at: string | null
          id: string
          notes: string | null
          reward_id: string
          status: Database["public"]["Enums"]["reward_redemption_status"]
          updated_at: string
          user_id: string
          xp_spent: number
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          delivered_at?: string | null
          id?: string
          notes?: string | null
          reward_id: string
          status?: Database["public"]["Enums"]["reward_redemption_status"]
          updated_at?: string
          user_id: string
          xp_spent: number
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          delivered_at?: string | null
          id?: string
          notes?: string | null
          reward_id?: string
          status?: Database["public"]["Enums"]["reward_redemption_status"]
          updated_at?: string
          user_id?: string
          xp_spent?: number
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_exclusive: boolean
          min_level: number
          name: string
          order_index: number
          updated_at: string
          xp_cost: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_exclusive?: boolean
          min_level?: number
          name: string
          order_index?: number
          updated_at?: string
          xp_cost: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_exclusive?: boolean
          min_level?: number
          name?: string
          order_index?: number
          updated_at?: string
          xp_cost?: number
        }
        Relationships: []
      }
      scoring_config: {
        Row: {
          base_points: number
          color_key: string | null
          extra_demand_multiplier: number
          id: string
          label: string
          late_penalty: number
          stage: string
          updated_at: string
          updated_by: string | null
          uses_quantity: boolean
        }
        Insert: {
          base_points?: number
          color_key?: string | null
          extra_demand_multiplier?: number
          id?: string
          label: string
          late_penalty?: number
          stage: string
          updated_at?: string
          updated_by?: string | null
          uses_quantity?: boolean
        }
        Update: {
          base_points?: number
          color_key?: string | null
          extra_demand_multiplier?: number
          id?: string
          label?: string
          late_penalty?: number
          stage?: string
          updated_at?: string
          updated_by?: string | null
          uses_quantity?: boolean
        }
        Relationships: []
      }
      squad_members: {
        Row: {
          created_at: string
          id: string
          squad_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          squad_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          squad_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          color: string
          created_at: string
          created_by: string
          icon: string
          id: string
          leader_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          icon?: string
          id?: string
          leader_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          icon?: string
          id?: string
          leader_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_activity_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: string | null
          old_value: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      task_assignees: {
        Row: {
          added_by: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_deadline_overrides: {
        Row: {
          created_at: string
          created_by: string
          id: string
          override_points: number
          reason: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          override_points: number
          reason?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          override_points?: number
          reason?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_user_id: string
          client_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          due_at: string | null
          due_date: string
          id: string
          is_extra_demand: boolean
          late_penalty_value: number | null
          point_value: number | null
          quantity: number
          stage: Database["public"]["Enums"]["stage_type"]
          status: Database["public"]["Enums"]["task_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          assigned_user_id: string
          client_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_at?: string | null
          due_date: string
          id?: string
          is_extra_demand?: boolean
          late_penalty_value?: number | null
          point_value?: number | null
          quantity?: number
          stage: Database["public"]["Enums"]["stage_type"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_at?: string | null
          due_date?: string
          id?: string
          is_extra_demand?: boolean
          late_penalty_value?: number | null
          point_value?: number | null
          quantity?: number
          stage?: Database["public"]["Enums"]["stage_type"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          display_name: string
          is_active: boolean
          role_title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          display_name: string
          is_active?: boolean
          role_title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string
          is_active?: boolean
          role_title?: string
          updated_at?: string
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
      user_xp_events: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          reason: string
          source_id: string | null
          source_type: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason: string
          source_id?: string | null
          source_type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          source_id?: string | null
          source_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      xp_criteria: {
        Row: {
          category: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          xp_value: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          xp_value?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          xp_value?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      check_client_exists: { Args: { _name: string }; Returns: boolean }
      client_status_at: {
        Args: { p_client: string; p_month: number; p_year: number }
        Returns: string
      }
      get_performance_month_totals: {
        Args: { _year: number }
        Returns: {
          month: number
          total: number
          user_id: string
        }[]
      }
      get_performance_year_summary: {
        Args: { _year: number }
        Returns: {
          avg_month: number
          high_months: number
          total_year: number
          user_id: string
        }[]
      }
      get_user_xp_summary: {
        Args: { _user_id: string }
        Returns: {
          available: number
          current_level: number
          current_level_name: string
          next_level: number
          next_level_name: string
          next_level_xp: number
          total_earned: number
          total_spent: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_users_admin: {
        Args: never
        Returns: {
          access_request_id: string
          access_status: Database["public"]["Enums"]["access_request_status"]
          avatar_url: string
          decided_at: string
          decided_by: string
          display_name: string
          email: string
          is_active: boolean
          requested_at: string
          role_title: string
          user_id: string
        }[]
      }
      magic2_ensure_client_link: {
        Args: { _agenda_client_id: string }
        Returns: string
      }
      magic2_seed_year: { Args: { _year: number }; Returns: undefined }
      pm_recalc_tag_points: {
        Args: { _pm_task_id: string }
        Returns: undefined
      }
      pm_resync_correction: {
        Args: { _completed_stage: string; _pm_task_id: string }
        Returns: undefined
      }
      pm_sync_stage_completion:
        | {
            Args: {
              _completed_stage: string
              _pm_task_id: string
              _user_id?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _completed_stage: string
              _pm_task_id: string
              _scoring_user_ids?: string[]
              _user_id?: string
            }
            Returns: undefined
          }
      recompute_all_scores: {
        Args: { _month: number; _user_id: string; _year: number }
        Returns: undefined
      }
      recompute_metas_prazos: {
        Args: { _month: number; _user_id: string; _year: number }
        Returns: undefined
      }
      snapshot_unscored_tasks: { Args: never; Returns: number }
      toggle_stage_tasks_checklist: {
        Args: {
          _client_id: string
          _month: number
          _stage: Database["public"]["Enums"]["stage_type"]
          _year: number
        }
        Returns: {
          affected_tasks: number
          new_status: Database["public"]["Enums"]["task_status"]
          stage_completed: boolean
        }[]
      }
    }
    Enums: {
      access_request_status: "pending" | "approved" | "rejected"
      app_role: "admin" | "collaborator" | "planner"
      expense_category:
        | "administrativa"
        | "operacional"
        | "financeira"
        | "comercial"
      logo_shape_type: "circle" | "square"
      magic2_stage_type:
        | "captacao"
        | "edicao_videos"
        | "planejamento"
        | "design"
        | "pdf"
        | "alteracoes"
        | "agendamento"
      pm_priority: "baixa" | "media" | "alta" | "urgente"
      pm_stage:
        | "planejamento"
        | "roteiro"
        | "captacao"
        | "edicao"
        | "design"
        | "revisao"
        | "entrega"
        | "edicao_videos"
        | "pdf"
        | "alteracoes"
        | "agendamento"
      pm_status:
        | "backlog"
        | "em_andamento"
        | "em_aprovacao"
        | "concluido"
        | "pausado"
        | "cancelado"
      pm_subtask_status:
        | "nao_iniciado"
        | "em_producao"
        | "aguardando"
        | "em_revisao"
        | "aprovado"
        | "concluido"
        | "bloqueado"
      reward_redemption_status:
        | "pendente"
        | "aprovado"
        | "recusado"
        | "entregue"
      stage_type:
        | "captacao"
        | "edicao_videos"
        | "planejamento"
        | "design"
        | "revisao"
        | "pdf"
        | "entrega"
        | "alteracoes"
        | "agendamento"
      task_status: "pendente" | "em_andamento" | "concluido"
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
      access_request_status: ["pending", "approved", "rejected"],
      app_role: ["admin", "collaborator", "planner"],
      expense_category: [
        "administrativa",
        "operacional",
        "financeira",
        "comercial",
      ],
      logo_shape_type: ["circle", "square"],
      magic2_stage_type: [
        "captacao",
        "edicao_videos",
        "planejamento",
        "design",
        "pdf",
        "alteracoes",
        "agendamento",
      ],
      pm_priority: ["baixa", "media", "alta", "urgente"],
      pm_stage: [
        "planejamento",
        "roteiro",
        "captacao",
        "edicao",
        "design",
        "revisao",
        "entrega",
        "edicao_videos",
        "pdf",
        "alteracoes",
        "agendamento",
      ],
      pm_status: [
        "backlog",
        "em_andamento",
        "em_aprovacao",
        "concluido",
        "pausado",
        "cancelado",
      ],
      pm_subtask_status: [
        "nao_iniciado",
        "em_producao",
        "aguardando",
        "em_revisao",
        "aprovado",
        "concluido",
        "bloqueado",
      ],
      reward_redemption_status: [
        "pendente",
        "aprovado",
        "recusado",
        "entregue",
      ],
      stage_type: [
        "captacao",
        "edicao_videos",
        "planejamento",
        "design",
        "revisao",
        "pdf",
        "entrega",
        "alteracoes",
        "agendamento",
      ],
      task_status: ["pendente", "em_andamento", "concluido"],
    },
  },
} as const
