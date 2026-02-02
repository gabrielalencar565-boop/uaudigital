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
          logo_shape: Database["public"]["Enums"]["logo_shape_type"]
          logo_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          logo_shape?: Database["public"]["Enums"]["logo_shape_type"]
          logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          logo_shape?: Database["public"]["Enums"]["logo_shape_type"]
          logo_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          created_at: string
          id: string
          is_active: boolean
          magic_due_date: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          magic_due_date: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          magic_due_date?: string
          name?: string
          notes?: string | null
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
          updated_at: string
          user_id: string
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
          updated_at?: string
          user_id: string
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
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
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
          description: string | null
          due_at: string | null
          due_date: string
          id: string
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
          description?: string | null
          due_at?: string | null
          due_date: string
          id?: string
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
          description?: string | null
          due_at?: string | null
          due_date?: string
          id?: string
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
          created_at: string
          display_name: string
          is_active: boolean
          role_title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          is_active?: boolean
          role_title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      check_client_exists: { Args: { _name: string }; Returns: boolean }
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
      recompute_all_scores: {
        Args: { _month: number; _user_id: string; _year: number }
        Returns: undefined
      }
      recompute_metas_prazos: {
        Args: { _month: number; _user_id: string; _year: number }
        Returns: undefined
      }
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
      logo_shape_type: "circle" | "square"
      magic2_stage_type:
        | "captacao"
        | "edicao_videos"
        | "planejamento"
        | "design"
        | "pdf"
        | "alteracoes"
        | "agendamento"
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
