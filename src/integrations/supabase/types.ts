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
      appointment_services: {
        Row: {
          appointment_id: string
          company_id: string
          end_at: string
          id: string
          name: string
          price: number
          professional_id: string | null
          service_id: string | null
          start_at: string
        }
        Insert: {
          appointment_id: string
          company_id: string
          end_at: string
          id?: string
          name: string
          price?: number
          professional_id?: string | null
          service_id?: string | null
          start_at: string
        }
        Update: {
          appointment_id?: string
          company_id?: string
          end_at?: string
          id?: string
          name?: string
          price?: number
          professional_id?: string | null
          service_id?: string | null
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_services_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          cancel_reason: string | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          end_at: string
          id: string
          is_fit_in: boolean
          notes: string | null
          professional_id: string | null
          recurrence_group: string | null
          source: string
          start_at: string
          status: Database["public"]["Enums"]["appt_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          end_at: string
          id?: string
          is_fit_in?: boolean
          notes?: string | null
          professional_id?: string | null
          recurrence_group?: string | null
          source?: string
          start_at: string
          status?: Database["public"]["Enums"]["appt_status"]
          total_price?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          end_at?: string
          id?: string
          is_fit_in?: boolean
          notes?: string | null
          professional_id?: string | null
          recurrence_group?: string | null
          source?: string
          start_at?: string
          status?: Database["public"]["Enums"]["appt_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string
          created_at: string
          data: Json | null
          entity: string
          entity_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          data?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          data?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          method_kind: string
          register_id: string
          sale_id: string | null
          type: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          method_kind?: string
          register_id: string
          sale_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          method_kind?: string
          register_id?: string
          sale_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string
          counted_cash: number | null
          difference: number | null
          expected_cash: number | null
          id: string
          justification: string | null
          name: string
          opened_at: string
          opened_by: string | null
          opening_balance: number
          shared: boolean
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          counted_cash?: number | null
          difference?: number | null
          expected_cash?: number | null
          id?: string
          justification?: string | null
          name?: string
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          shared?: boolean
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          counted_cash?: number | null
          difference?: number | null
          expected_cash?: number | null
          id?: string
          justification?: string | null
          name?: string
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          shared?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          birth_date: string | null
          company_id: string
          consent_marketing: boolean
          consent_reminders: boolean
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          preferred_professional_id: string | null
          return_reminder_days: number | null
          whatsapp: string | null
        }
        Insert: {
          birth_date?: string | null
          company_id: string
          consent_marketing?: boolean
          consent_reminders?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          preferred_professional_id?: string | null
          return_reminder_days?: number | null
          whatsapp?: string | null
        }
        Update: {
          birth_date?: string | null
          company_id?: string
          consent_marketing?: boolean
          consent_reminders?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          preferred_professional_id?: string | null
          return_reminder_days?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_preferred_professional_id_fkey"
            columns: ["preferred_professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      closing_entries: {
        Row: {
          amount: number
          closing_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          method: string | null
          occurred_at: string
          reason: string | null
        }
        Insert: {
          amount: number
          closing_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          method?: string | null
          occurred_at?: string
          reason?: string | null
        }
        Update: {
          amount?: number
          closing_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          method?: string | null
          occurred_at?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closing_entries_closing_id_fkey"
            columns: ["closing_id"]
            isOneToOne: false
            referencedRelation: "weekly_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closing_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          base_amount: number
          company_id: string
          created_at: string
          fixed_amount: number
          id: string
          paid_at: string | null
          professional_id: string
          rate_pct: number
          rule: Json
          sale_id: string
          sale_item_id: string
          status: string
        }
        Insert: {
          amount: number
          base_amount: number
          company_id: string
          created_at?: string
          fixed_amount?: number
          id?: string
          paid_at?: string | null
          professional_id: string
          rate_pct?: number
          rule?: Json
          sale_id: string
          sale_item_id: string
          status?: string
        }
        Update: {
          amount?: number
          base_amount?: number
          company_id?: string
          created_at?: string
          fixed_amount?: number
          id?: string
          paid_at?: string | null
          professional_id?: string
          rate_pct?: number
          rule?: Json
          sale_id?: string
          sale_item_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          accent_color: string | null
          address: string | null
          closing_time: string
          closing_weekday: number
          created_at: string
          id: string
          name: string
          opening_time: string
          phone: string | null
          slot_minutes: number
          slug: string
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          closing_time?: string
          closing_weekday?: number
          created_at?: string
          id?: string
          name: string
          opening_time?: string
          phone?: string | null
          slot_minutes?: number
          slug: string
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          closing_time?: string
          closing_weekday?: number
          created_at?: string
          id?: string
          name?: string
          opening_time?: string
          phone?: string | null
          slot_minutes?: number
          slug?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          professional_id: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          professional_id?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          professional_id?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          amount: number
          category: string
          company_id: string
          created_at: string
          description: string
          due_date: string
          id: string
          paid_at: string | null
          sale_id: string | null
          sale_payment_id: string | null
          status: string
          type: string
        }
        Insert: {
          amount: number
          category?: string
          company_id: string
          created_at?: string
          description: string
          due_date: string
          id?: string
          paid_at?: string | null
          sale_id?: string | null
          sale_payment_id?: string | null
          status?: string
          type: string
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          paid_at?: string | null
          sale_id?: string | null
          sale_payment_id?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_sale_payment_id_fkey"
            columns: ["sale_payment_id"]
            isOneToOne: true
            referencedRelation: "sale_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          anticipation_pct: number
          company_id: string
          fee_fixed: number
          fee_pct: number
          id: string
          installment_fee_pct: number
          kind: string
          name: string
          receive_days: number
        }
        Insert: {
          active?: boolean
          anticipation_pct?: number
          company_id: string
          fee_fixed?: number
          fee_pct?: number
          id?: string
          installment_fee_pct?: number
          kind?: string
          name: string
          receive_days?: number
        }
        Update: {
          active?: boolean
          anticipation_pct?: number
          company_id?: string
          fee_fixed?: number
          fee_pct?: number
          id?: string
          installment_fee_pct?: number
          kind?: string
          name?: string
          receive_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string | null
          commission_pct: number | null
          company_id: string
          cost: number
          created_at: string
          expiry_date: string | null
          id: string
          kind: string
          min_quantity: number
          name: string
          price: number
          quantity: number
          sku: string | null
          supplier: string | null
          unit: string | null
        }
        Insert: {
          active?: boolean
          category?: string | null
          commission_pct?: number | null
          company_id: string
          cost?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          kind?: string
          min_quantity?: number
          name: string
          price?: number
          quantity?: number
          sku?: string | null
          supplier?: string | null
          unit?: string | null
        }
        Update: {
          active?: boolean
          category?: string | null
          commission_pct?: number | null
          company_id?: string
          cost?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          kind?: string
          min_quantity?: number
          name?: string
          price?: number
          quantity?: number
          sku?: string | null
          supplier?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          color: string | null
          company_id: string
          created_at: string
          default_commission_pct: number
          email: string | null
          id: string
          monthly_goal: number | null
          name: string
          online_booking: boolean
          phone: string | null
          photo_url: string | null
          work_hours: Json
        }
        Insert: {
          active?: boolean
          color?: string | null
          company_id: string
          created_at?: string
          default_commission_pct?: number
          email?: string | null
          id?: string
          monthly_goal?: number | null
          name: string
          online_booking?: boolean
          phone?: string | null
          photo_url?: string | null
          work_hours?: Json
        }
        Update: {
          active?: boolean
          color?: string | null
          company_id?: string
          created_at?: string
          default_commission_pct?: number
          email?: string | null
          id?: string
          monthly_goal?: number | null
          name?: string
          online_booking?: boolean
          phone?: string | null
          photo_url?: string | null
          work_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      resources: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          type: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          type: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          company_id: string
          description: string
          discount: number
          id: string
          kind: string
          product_id: string | null
          professional_id: string | null
          quantity: number
          sale_id: string
          service_id: string | null
          total: number
          unit_price: number
        }
        Insert: {
          company_id: string
          description: string
          discount?: number
          id?: string
          kind: string
          product_id?: string | null
          professional_id?: string | null
          quantity?: number
          sale_id: string
          service_id?: string | null
          total: number
          unit_price: number
        }
        Update: {
          company_id?: string
          description?: string
          discount?: number
          id?: string
          kind?: string
          product_id?: string | null
          professional_id?: string | null
          quantity?: number
          sale_id?: string
          service_id?: string | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          company_id: string
          expected_date: string | null
          fee_amount: number
          id: string
          installments: number
          method_kind: string
          method_name: string
          net_amount: number
          payment_method_id: string | null
          sale_id: string
        }
        Insert: {
          amount: number
          company_id: string
          expected_date?: string | null
          fee_amount?: number
          id?: string
          installments?: number
          method_kind: string
          method_name: string
          net_amount: number
          payment_method_id?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          expected_date?: string | null
          fee_amount?: number
          id?: string
          installments?: number
          method_kind?: string
          method_name?: string
          net_amount?: number
          payment_method_id?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          discount: number
          fees: number
          id: string
          net: number
          refund_reason: string | null
          register_id: string | null
          status: string
          subtotal: number
          tip: number
          total: number
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          discount?: number
          fees?: number
          id?: string
          net: number
          refund_reason?: string | null
          register_id?: string | null
          status?: string
          subtotal: number
          tip?: number
          total: number
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          discount?: number
          fees?: number
          id?: string
          net?: number
          refund_reason?: string | null
          register_id?: string | null
          status?: string
          subtotal?: number
          tip?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_register_id_fkey"
            columns: ["register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_segments: {
        Row: {
          active: boolean
          appointment_id: string | null
          appointment_service_id: string | null
          company_id: string
          end_at: string
          id: string
          kind: string
          label: string | null
          occupies_professional: boolean
          period: unknown
          professional_id: string | null
          resource_id: string | null
          start_at: string
        }
        Insert: {
          active?: boolean
          appointment_id?: string | null
          appointment_service_id?: string | null
          company_id: string
          end_at: string
          id?: string
          kind?: string
          label?: string | null
          occupies_professional?: boolean
          period?: unknown
          professional_id?: string | null
          resource_id?: string | null
          start_at: string
        }
        Update: {
          active?: boolean
          appointment_id?: string | null
          appointment_service_id?: string | null
          company_id?: string
          end_at?: string
          id?: string
          kind?: string
          label?: string | null
          occupies_professional?: boolean
          period?: unknown
          professional_id?: string | null
          resource_id?: string | null
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_segments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_segments_appointment_service_id_fkey"
            columns: ["appointment_service_id"]
            isOneToOne: false
            referencedRelation: "appointment_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_segments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_segments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_segments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      service_professionals: {
        Row: {
          commission_fixed: number | null
          commission_pct: number | null
          company_id: string
          id: string
          professional_id: string
          service_id: string
        }
        Insert: {
          commission_fixed?: number | null
          commission_pct?: number | null
          company_id: string
          id?: string
          professional_id: string
          service_id: string
        }
        Update: {
          commission_fixed?: number | null
          commission_pct?: number | null
          company_id?: string
          id?: string
          professional_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_professionals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_professionals_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_professionals_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_steps: {
        Row: {
          company_id: string
          duration_min: number
          id: string
          name: string
          occupies_professional: boolean
          position: number
          resource_type: string | null
          service_id: string
        }
        Insert: {
          company_id: string
          duration_min: number
          id?: string
          name: string
          occupies_professional?: boolean
          position?: number
          resource_type?: string | null
          service_id: string
        }
        Update: {
          company_id?: string
          duration_min?: number
          id?: string
          name?: string
          occupies_professional?: boolean
          position?: number
          resource_type?: string | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_steps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_steps_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_supplies: {
        Row: {
          company_id: string
          id: string
          product_id: string
          quantity: number
          service_id: string
        }
        Insert: {
          company_id: string
          id?: string
          product_id: string
          quantity: number
          service_id: string
        }
        Update: {
          company_id?: string
          id?: string
          product_id?: string
          quantity?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_supplies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_supplies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_supplies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          buffer_after_min: number
          category: string | null
          commission_fixed: number | null
          commission_pct: number | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          online_booking: boolean
          price: number
          prof_share_pct: number | null
        }
        Insert: {
          active?: boolean
          buffer_after_min?: number
          category?: string | null
          commission_fixed?: number | null
          commission_pct?: number | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          online_booking?: boolean
          price?: number
          prof_share_pct?: number | null
        }
        Update: {
          active?: boolean
          buffer_after_min?: number
          category?: string | null
          commission_fixed?: number | null
          commission_pct?: number | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          online_booking?: boolean
          price?: number
          prof_share_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          reason: string | null
          sale_id: string | null
          type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          sale_id?: string | null
          type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          sale_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          amount: number
          client_id: string | null
          client_name: string | null
          closing_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          discount: number
          est_amount: number
          id: string
          idempotency_key: string | null
          method_kind: string
          method_name: string | null
          notes: string | null
          payment_method_id: string | null
          performed_at: string
          prof_amount: number
          prof_pct: number
          professional_id: string
          reversed_by: string | null
          reversed_reason: string | null
          service_id: string | null
          service_name: string
          status: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          client_name?: string | null
          closing_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          discount?: number
          est_amount?: number
          id?: string
          idempotency_key?: string | null
          method_kind?: string
          method_name?: string | null
          notes?: string | null
          payment_method_id?: string | null
          performed_at?: string
          prof_amount?: number
          prof_pct?: number
          professional_id: string
          reversed_by?: string | null
          reversed_reason?: string | null
          service_id?: string | null
          service_name: string
          status?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          client_name?: string | null
          closing_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          discount?: number
          est_amount?: number
          id?: string
          idempotency_key?: string | null
          method_kind?: string
          method_name?: string | null
          notes?: string | null
          payment_method_id?: string | null
          performed_at?: string
          prof_amount?: number
          prof_pct?: number
          professional_id?: string
          reversed_by?: string | null
          reversed_reason?: string | null
          service_id?: string | null
          service_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_closing_id_fkey"
            columns: ["closing_id"]
            isOneToOne: false
            referencedRelation: "weekly_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          client_name: string
          company_id: string
          created_at: string
          id: string
          notes: string | null
          phone: string | null
          preferred_date: string | null
          professional_id: string | null
          service_id: string | null
          status: string
        }
        Insert: {
          client_name: string
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          phone?: string | null
          preferred_date?: string | null
          professional_id?: string | null
          service_id?: string | null
          status?: string
        }
        Update: {
          client_name?: string
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          phone?: string | null
          preferred_date?: string | null
          professional_id?: string | null
          service_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_closings: {
        Row: {
          adjustments_total: number
          advances_total: number
          approved_at: string | null
          approved_by: string | null
          card: number
          cash: number
          company_id: string
          created_at: string
          created_by: string | null
          discounts: number
          dispute_reason: string | null
          est_total: number
          gross: number
          id: string
          other: number
          paid_total: number
          period_end: string
          period_start: string
          pix: number
          prof_total: number
          professional_id: string
          services_count: number
          status: string
        }
        Insert: {
          adjustments_total?: number
          advances_total?: number
          approved_at?: string | null
          approved_by?: string | null
          card?: number
          cash?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          discounts?: number
          dispute_reason?: string | null
          est_total?: number
          gross?: number
          id?: string
          other?: number
          paid_total?: number
          period_end: string
          period_start: string
          pix?: number
          prof_total?: number
          professional_id: string
          services_count?: number
          status?: string
        }
        Update: {
          adjustments_total?: number
          advances_total?: number
          approved_at?: string | null
          approved_by?: string | null
          card?: number
          cash?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          discounts?: number
          dispute_reason?: string | null
          est_total?: number
          gross?: number
          id?: string
          other?: number
          paid_total?: number
          period_end?: string
          period_start?: string
          pix?: number
          prof_total?: number
          professional_id?: string
          services_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_closings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_closings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _tenant_policies: {
        Args: { _t: string; _write_roles: string }
        Returns: undefined
      }
      add_closing_entry: {
        Args: {
          _amount: number
          _id: string
          _key?: string
          _kind: string
          _method: string
          _reason: string
        }
        Returns: undefined
      }
      book_appointment: { Args: { p: Json }; Returns: string }
      close_cash_register: {
        Args: { _counted: number; _id: string; _justification: string }
        Returns: Json
      }
      closing_balance: {
        Args: { c: Database["public"]["Tables"]["weekly_closings"]["Row"] }
        Returns: number
      }
      create_company: {
        Args: { _name: string; _slug: string }
        Returns: string
      }
      has_crole: {
        Args: {
          _company: string
          _roles: Database["public"]["Enums"]["member_role"][]
        }
        Returns: boolean
      }
      is_member: { Args: { _company: string }; Returns: boolean }
      my_professional_id: { Args: { _company: string }; Returns: string }
      open_closing: {
        Args: {
          _company: string
          _end: string
          _professional: string
          _start: string
        }
        Returns: string
      }
      recalc_closing: { Args: { _id: string }; Returns: undefined }
      record_sale: { Args: { p: Json }; Returns: string }
      refund_sale: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      reschedule_appointment: {
        Args: { _id: string; p: Json }
        Returns: undefined
      }
      set_appointment_status: {
        Args: {
          _id: string
          _reason?: string
          _status: Database["public"]["Enums"]["appt_status"]
        }
        Returns: undefined
      }
      set_closing_status: {
        Args: { _id: string; _reason?: string; _status: string }
        Returns: undefined
      }
    }
    Enums: {
      appt_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      member_role: "admin" | "manager" | "receptionist" | "professional"
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
    Enums: {
      appt_status: [
        "scheduled",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      member_role: ["admin", "manager", "receptionist", "professional"],
    },
  },
} as const
