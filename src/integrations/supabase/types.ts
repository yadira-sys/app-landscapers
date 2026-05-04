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
      asignaciones: {
        Row: {
          activo: boolean
          created_at: string
          dias_semana: string[]
          id: string
          jardin_id: string
          jardinero_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          dias_semana?: string[]
          id?: string
          jardin_id: string
          jardinero_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          dias_semana?: string[]
          id?: string
          jardin_id?: string
          jardinero_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignaciones_jardin_id_fkey"
            columns: ["jardin_id"]
            isOneToOne: false
            referencedRelation: "jardines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_jardinero_id_fkey"
            columns: ["jardinero_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_attempts: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          reason: string | null
          success: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          reason?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          reason?: string | null
          success?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      compras: {
        Row: {
          created_at: string
          descripcion: string
          estado_cobro: string
          exportado_holded: boolean
          fecha: string
          foto_factura_url: string | null
          id: string
          importe: number | null
          jardin_id: string
          registrado_por: string
          tipo_gasto: Database["public"]["Enums"]["tipo_gasto"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion: string
          estado_cobro?: string
          exportado_holded?: boolean
          fecha?: string
          foto_factura_url?: string | null
          id?: string
          importe?: number | null
          jardin_id: string
          registrado_por: string
          tipo_gasto?: Database["public"]["Enums"]["tipo_gasto"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          estado_cobro?: string
          exportado_holded?: boolean
          fecha?: string
          foto_factura_url?: string | null
          id?: string
          importe?: number | null
          jardin_id?: string
          registrado_por?: string
          tipo_gasto?: Database["public"]["Enums"]["tipo_gasto"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compras_jardin_id_fkey"
            columns: ["jardin_id"]
            isOneToOne: false
            referencedRelation: "jardines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidencias: {
        Row: {
          created_at: string
          descripcion: string
          estado: Database["public"]["Enums"]["estado_incidencia"]
          foto_url: string | null
          id: string
          jardin_id: string
          jardinero_id: string
          notas_resolucion: string | null
          updated_at: string
          urgencia: Database["public"]["Enums"]["urgencia_level"]
        }
        Insert: {
          created_at?: string
          descripcion: string
          estado?: Database["public"]["Enums"]["estado_incidencia"]
          foto_url?: string | null
          id?: string
          jardin_id: string
          jardinero_id: string
          notas_resolucion?: string | null
          updated_at?: string
          urgencia?: Database["public"]["Enums"]["urgencia_level"]
        }
        Update: {
          created_at?: string
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_incidencia"]
          foto_url?: string | null
          id?: string
          jardin_id?: string
          jardinero_id?: string
          notas_resolucion?: string | null
          updated_at?: string
          urgencia?: Database["public"]["Enums"]["urgencia_level"]
        }
        Relationships: [
          {
            foreignKeyName: "incidencias_jardin_id_fkey"
            columns: ["jardin_id"]
            isOneToOne: false
            referencedRelation: "jardines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_jardinero_id_fkey"
            columns: ["jardinero_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jardines: {
        Row: {
          activo: boolean
          admin_only: boolean
          created_at: string
          descripcion: string | null
          direccion: string | null
          holded_project_id: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          admin_only?: boolean
          created_at?: string
          descripcion?: string | null
          direccion?: string | null
          holded_project_id?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          admin_only?: boolean
          created_at?: string
          descripcion?: string | null
          direccion?: string | null
          holded_project_id?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      jornadas: {
        Row: {
          created_at: string
          descripcion: string | null
          duracion_minutos: number | null
          entrada_at: string
          estado: Database["public"]["Enums"]["estado_registro"]
          exportado_holded: boolean
          fecha: string
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          jardin_id: string
          jardinero_id: string
          salida_at: string | null
          total_horas: number | null
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          duracion_minutos?: number | null
          entrada_at?: string
          estado?: Database["public"]["Enums"]["estado_registro"]
          exportado_holded?: boolean
          fecha?: string
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          jardin_id: string
          jardinero_id: string
          salida_at?: string | null
          total_horas?: number | null
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          duracion_minutos?: number | null
          entrada_at?: string
          estado?: Database["public"]["Enums"]["estado_registro"]
          exportado_holded?: boolean
          fecha?: string
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          jardin_id?: string
          jardinero_id?: string
          salida_at?: string | null
          total_horas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jornadas_jardin_id_fkey"
            columns: ["jardin_id"]
            isOneToOne: false
            referencedRelation: "jardines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornadas_jardinero_id_fkey"
            columns: ["jardinero_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_login_attempts: {
        Row: {
          attempted_at: string
          ip: string
        }
        Insert: {
          attempted_at?: string
          ip: string
        }
        Update: {
          attempted_at?: string
          ip?: string
        }
        Relationships: []
      }
      presupuestos: {
        Row: {
          cliente: string | null
          created_at: string
          estado: string
          fecha_envio: string | null
          id: string
          importe: number | null
          nombre: string
          notas: string | null
          notion_url: string | null
          responsable_id: string | null
          updated_at: string
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          estado?: string
          fecha_envio?: string | null
          id?: string
          importe?: number | null
          nombre: string
          notas?: string | null
          notion_url?: string | null
          responsable_id?: string | null
          updated_at?: string
        }
        Update: {
          cliente?: string | null
          created_at?: string
          estado?: string
          fecha_envio?: string | null
          id?: string
          importe?: number | null
          nombre?: string
          notas?: string | null
          notion_url?: string | null
          responsable_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presupuestos_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          pin: string | null
          pin_hash: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          pin?: string | null
          pin_hash?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          pin?: string | null
          pin_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_change_log: {
        Row: {
          actor_id: string | null
          changed_at: string
          from_role: string | null
          id: string
          target_user_id: string | null
          to_role: string | null
        }
        Insert: {
          actor_id?: string | null
          changed_at?: string
          from_role?: string | null
          id?: string
          target_user_id?: string | null
          to_role?: string | null
        }
        Update: {
          actor_id?: string | null
          changed_at?: string
          from_role?: string | null
          id?: string
          target_user_id?: string | null
          to_role?: string | null
        }
        Relationships: []
      }
      tareas: {
        Row: {
          asignado_a: string | null
          cliente: string | null
          created_at: string
          estado: string
          fecha_limite: string | null
          id: string
          nombre: string
          notas: string | null
          notion_id: string | null
          notion_url: string | null
          prioridad: string | null
          updated_at: string
        }
        Insert: {
          asignado_a?: string | null
          cliente?: string | null
          created_at?: string
          estado?: string
          fecha_limite?: string | null
          id?: string
          nombre: string
          notas?: string | null
          notion_id?: string | null
          notion_url?: string | null
          prioridad?: string | null
          updated_at?: string
        }
        Update: {
          asignado_a?: string | null
          cliente?: string | null
          created_at?: string
          estado?: string
          fecha_limite?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          notion_id?: string | null
          notion_url?: string | null
          prioridad?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tareas_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trabajos_extras: {
        Row: {
          con_desplazamiento: boolean
          created_at: string
          descripcion: string
          estado: Database["public"]["Enums"]["estado_registro"]
          exportado_holded: boolean
          fecha: string
          foto_url: string | null
          fotos_urls: string[] | null
          horas: number | null
          id: string
          importe: number | null
          jardin_id: string
          km_desplazamiento: number | null
          notas_revision: string | null
          tipo: Database["public"]["Enums"]["tipo_trabajo_extra"]
          updated_at: string
          usuario_id: string
        }
        Insert: {
          con_desplazamiento?: boolean
          created_at?: string
          descripcion: string
          estado?: Database["public"]["Enums"]["estado_registro"]
          exportado_holded?: boolean
          fecha?: string
          foto_url?: string | null
          fotos_urls?: string[] | null
          horas?: number | null
          id?: string
          importe?: number | null
          jardin_id: string
          km_desplazamiento?: number | null
          notas_revision?: string | null
          tipo?: Database["public"]["Enums"]["tipo_trabajo_extra"]
          updated_at?: string
          usuario_id: string
        }
        Update: {
          con_desplazamiento?: boolean
          created_at?: string
          descripcion?: string
          estado?: Database["public"]["Enums"]["estado_registro"]
          exportado_holded?: boolean
          fecha?: string
          foto_url?: string | null
          fotos_urls?: string[] | null
          horas?: number | null
          id?: string
          importe?: number | null
          jardin_id?: string
          km_desplazamiento?: number | null
          notas_revision?: string | null
          tipo?: Database["public"]["Enums"]["tipo_trabajo_extra"]
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trabajos_extras_jardin_id_fkey"
            columns: ["jardin_id"]
            isOneToOne: false
            referencedRelation: "jardines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trabajos_extras_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      is_staff: { Args: never; Returns: boolean }
      is_team_lead: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "dueno" | "admin" | "encargado" | "jardinero"
      estado_incidencia: "abierta" | "en_proceso" | "resuelta"
      estado_registro: "pendiente" | "aprobado" | "rechazado"
      tipo_gasto:
        | "combustible"
        | "herramientas"
        | "material"
        | "comida"
        | "otro"
      tipo_trabajo_extra:
        | "reparacion_urgente"
        | "material_adicional"
        | "fuera_horario"
        | "otro"
      urgencia_level: "baja" | "media" | "alta"
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
      app_role: ["dueno", "admin", "encargado", "jardinero"],
      estado_incidencia: ["abierta", "en_proceso", "resuelta"],
      estado_registro: ["pendiente", "aprobado", "rechazado"],
      tipo_gasto: ["combustible", "herramientas", "material", "comida", "otro"],
      tipo_trabajo_extra: [
        "reparacion_urgente",
        "material_adicional",
        "fuera_horario",
        "otro",
      ],
      urgencia_level: ["baja", "media", "alta"],
    },
  },
} as const
