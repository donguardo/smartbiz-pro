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
      account_deletions: {
        Row: {
          deleted_on: string
          id: string
          user_hash: string
        }
        Insert: {
          deleted_on?: string
          id?: string
          user_hash: string
        }
        Update: {
          deleted_on?: string
          id?: string
          user_hash?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          actor_role: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          shop_id: string
          summary: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          shop_id: string
          summary: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          shop_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          created_at: string
          detail: string | null
          environment: string
          event_type: string
          id: string
          paddle_event_id: string | null
          paddle_subscription_id: string | null
          shop_id: string | null
          sync_status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          environment: string
          event_type: string
          id?: string
          paddle_event_id?: string | null
          paddle_subscription_id?: string | null
          shop_id?: string | null
          sync_status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          environment?: string
          event_type?: string
          id?: string
          paddle_event_id?: string | null
          paddle_subscription_id?: string | null
          shop_id?: string | null
          sync_status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      bizbot_runs: {
        Row: {
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          user_id?: string
        }
        Relationships: []
      }
      business_accounts: {
        Row: {
          created_at: string
          id: string
          owner_user_id: string
          stripe_customer_id: string | null
          trial_started_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_user_id: string
          stripe_customer_id?: string | null
          trial_started_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_user_id?: string
          stripe_customer_id?: string | null
          trial_started_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: Json
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: Json
          thread_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: Json
          thread_id?: string
          user_id?: string
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
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          anonymized_at: string | null
          consent_at: string | null
          created_at: string
          created_by: string
          id: string
          mobile: string | null
          name: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          consent_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          mobile?: string | null
          name: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          consent_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          mobile?: string | null
          name?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_tips: {
        Row: {
          created_at: string
          feedback: number | null
          id: string
          language: string
          shop_id: string
          tip_date: string
          tip_text: string
        }
        Insert: {
          created_at?: string
          feedback?: number | null
          id?: string
          language: string
          shop_id: string
          tip_date: string
          tip_text: string
        }
        Update: {
          created_at?: string
          feedback?: number | null
          id?: string
          language?: string
          shop_id?: string
          tip_date?: string
          tip_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_tips_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string
          date: string
          id: string
          note: string | null
          receipt_file: string | null
          shop_id: string
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by: string
          date?: string
          id?: string
          note?: string | null
          receipt_file?: string | null
          shop_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          note?: string | null
          receipt_file?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      image_generation_access_state: {
        Row: {
          blocked: boolean
          id: string
          message: string | null
          status: number | null
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          id?: string
          message?: string | null
          status?: number | null
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          id?: string
          message?: string | null
          status?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          ai_menu_builder: boolean
          ai_menu_runs_per_day: number
          animated_pages: number | null
          basic_pdf_max_pages: number | null
          brand_ads: boolean
          label: string
          max_skus: number | null
          max_stores: number | null
          ml_smart_reorder: boolean
          monthly_price_php: number
          plan: string
          stripe_lookup_key: string | null
          stripe_price_id: string | null
          support_level: string
          updated_at: string
        }
        Insert: {
          ai_menu_builder?: boolean
          ai_menu_runs_per_day?: number
          animated_pages?: number | null
          basic_pdf_max_pages?: number | null
          brand_ads?: boolean
          label: string
          max_skus?: number | null
          max_stores?: number | null
          ml_smart_reorder?: boolean
          monthly_price_php: number
          plan: string
          stripe_lookup_key?: string | null
          stripe_price_id?: string | null
          support_level?: string
          updated_at?: string
        }
        Update: {
          ai_menu_builder?: boolean
          ai_menu_runs_per_day?: number
          animated_pages?: number | null
          basic_pdf_max_pages?: number | null
          brand_ads?: boolean
          label?: string
          max_skus?: number | null
          max_stores?: number | null
          ml_smart_reorder?: boolean
          monthly_price_php?: number
          plan?: string
          stripe_lookup_key?: string | null
          stripe_price_id?: string | null
          support_level?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          archived_at: string | null
          category: string
          cost: number | null
          created_at: string
          id: string
          name: string
          photo_path: string | null
          price: number
          reorder_level: number
          shop_id: string | null
          sku: string
          stock: number
          stock_qty: number
          track_stock: boolean
          unit: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category?: string
          cost?: number | null
          created_at?: string
          id?: string
          name: string
          photo_path?: string | null
          price?: number
          reorder_level?: number
          shop_id?: string | null
          sku?: string
          stock?: number
          stock_qty?: number
          track_stock?: boolean
          unit?: string
          user_id?: string
        }
        Update: {
          archived_at?: string | null
          category?: string
          cost?: number | null
          created_at?: string
          id?: string
          name?: string
          photo_path?: string | null
          price?: number
          reorder_level?: number
          shop_id?: string | null
          sku?: string
          stock?: number
          stock_qty?: number
          track_stock?: boolean
          unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_name: string
          created_at: string
          full_name: string | null
          id: string
          language: string
          shop_id: string | null
        }
        Insert: {
          business_name?: string
          created_at?: string
          full_name?: string | null
          id: string
          language?: string
          shop_id?: string | null
        }
        Update: {
          business_name?: string
          created_at?: string
          full_name?: string | null
          id?: string
          language?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          product_name: string
          qty: number
          shop_id: string
          unit: string
          unit_cost: number | null
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          product_name: string
          qty: number
          shop_id: string
          unit: string
          unit_cost?: number | null
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          qty?: number
          shop_id?: string
          unit?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string | null
          received_at: string | null
          shop_id: string
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          received_at?: string | null
          shop_id: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          received_at?: string | null
          shop_id?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      refresh_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          job: string
          shops_processed: number
          started_at: string
          status: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job?: string
          shops_processed?: number
          started_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job?: string
          shops_processed?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          category: string
          cost: number
          created_at: string
          id: string
          name: string
          price: number
          product_id: string | null
          qty: number
          quantity: number | null
          sale_id: string
          shop_id: string | null
          user_id: string
        }
        Insert: {
          category?: string
          cost?: number
          created_at?: string
          id?: string
          name: string
          price: number
          product_id?: string | null
          qty: number
          quantity?: number | null
          sale_id: string
          shop_id?: string | null
          user_id?: string
        }
        Update: {
          category?: string
          cost?: number
          created_at?: string
          id?: string
          name?: string
          price?: number
          product_id?: string | null
          qty?: number
          quantity?: number | null
          sale_id?: string
          shop_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_tendered: number | null
          cashier_id: string | null
          client_sale_id: string | null
          cost_total: number
          created_at: string
          customer_id: string | null
          id: string
          payment_method: string
          receipt_no: string
          shop_id: string | null
          status: Database["public"]["Enums"]["sale_status"]
          synced_at: string | null
          total: number
          user_id: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_tendered?: number | null
          cashier_id?: string | null
          client_sale_id?: string | null
          cost_total?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          payment_method: string
          receipt_no: string
          shop_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          synced_at?: string | null
          total: number
          user_id?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_tendered?: number | null
          cashier_id?: string | null
          client_sale_id?: string | null
          cost_total?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          payment_method?: string
          receipt_no?: string
          shop_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          synced_at?: string | null
          total?: number
          user_id?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_forecasts: {
        Row: {
          computed_at: string
          expected_sales: number
          forecast_date: string
          high: number
          low: number
          shop_id: string
        }
        Insert: {
          computed_at?: string
          expected_sales?: number
          forecast_date: string
          high?: number
          low?: number
          shop_id: string
        }
        Update: {
          computed_at?: string
          expected_sales?: number
          forecast_date?: string
          high?: number
          low?: number
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_forecasts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          created_at: string
          created_by: string
          id: string
          period: Database["public"]["Enums"]["goal_period"]
          shop_id: string
          starts_on: string
          target_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          period: Database["public"]["Enums"]["goal_period"]
          shop_id: string
          starts_on?: string
          target_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          period?: Database["public"]["Enums"]["goal_period"]
          shop_id?: string
          starts_on?: string
          target_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_goals_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_documents: {
        Row: {
          created_at: string
          expiry_date: string | null
          file_path: string
          file_size: number
          id: string
          mime_type: string
          shop_id: string
          title: string
          type: Database["public"]["Enums"]["document_type"]
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          shop_id: string
          title: string
          type: Database["public"]["Enums"]["document_type"]
          uploaded_by: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          shop_id?: string
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_documents_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          used_at: string | null
        }
        Insert: {
          code?: string
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_invites_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["shop_role"]
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_members_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          allow_cashier_products: boolean
          business_account_id: string | null
          business_categories: string[]
          business_type: string | null
          created_at: string
          id: string
          language: string
          logo_url: string | null
          low_stock_alerts: boolean
          mobile: string | null
          name: string
          owner_name: string | null
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          allow_cashier_products?: boolean
          business_account_id?: string | null
          business_categories?: string[]
          business_type?: string | null
          created_at?: string
          id?: string
          language?: string
          logo_url?: string | null
          low_stock_alerts?: boolean
          mobile?: string | null
          name?: string
          owner_name?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_cashier_products?: boolean
          business_account_id?: string | null
          business_categories?: string[]
          business_type?: string | null
          created_at?: string
          id?: string
          language?: string
          logo_url?: string | null
          low_stock_alerts?: boolean
          mobile?: string | null
          name?: string
          owner_name?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shops_business_account_id_fkey"
            columns: ["business_account_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alerts: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_name: string
          read_at: string | null
          shop_id: string
          stock_at: number
          threshold: number
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          read_at?: string | null
          shop_id: string
          stock_at: number
          threshold: number
          unit: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          read_at?: string | null
          shop_id?: string
          stock_at?: number
          threshold?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          actor_name: string
          created_at: string
          created_by: string
          id: string
          kind: string
          product_id: string
          product_name: string
          qty_change: number
          reason: string
          shop_id: string
          stock_after: number
          stock_before: number
        }
        Insert: {
          actor_name: string
          created_at?: string
          created_by: string
          id?: string
          kind: string
          product_id: string
          product_name: string
          qty_change: number
          reason: string
          shop_id: string
          stock_after: number
          stock_before: number
        }
        Update: {
          actor_name?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          product_id?: string
          product_name?: string
          qty_change?: number
          reason?: string
          shop_id?: string
          stock_after?: number
          stock_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          account_id: string | null
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          past_due_since: string | null
          pending_plan: string | null
          pending_plan_at: string | null
          plan: string
          price_id: string
          product_id: string
          provider: string
          shop_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          past_due_since?: string | null
          pending_plan?: string | null
          pending_plan_at?: string | null
          plan?: string
          price_id: string
          product_id: string
          provider?: string
          shop_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          past_due_since?: string | null
          pending_plan?: string | null
          pending_plan_at?: string | null
          plan?: string
          price_id?: string
          product_id?: string
          provider?: string
          shop_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_pending_plan_fkey"
            columns: ["pending_plan"]
            isOneToOne: false
            referencedRelation: "plan_limits"
            referencedColumns: ["plan"]
          },
          {
            foreignKeyName: "subscriptions_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "plan_limits"
            referencedColumns: ["plan"]
          },
          {
            foreignKeyName: "subscriptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          cost_price: number
          product_id: string
          shop_id: string
          supplier_id: string
        }
        Insert: {
          cost_price?: number
          product_id: string
          shop_id: string
          supplier_id: string
        }
        Update: {
          cost_price?: number
          product_id?: string
          shop_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          mobile: string | null
          name: string
          notes: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          mobile?: string | null
          name: string
          notes?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          mobile?: string | null
          name?: string
          notes?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      translations: {
        Row: {
          key: string
          lang: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          lang: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          lang?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      user_theme_prefs: {
        Row: {
          business_theme: string
          custom_colors: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_theme?: string
          custom_colors?: Json | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          business_theme?: string
          custom_colors?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_opportunities: {
        Row: {
          best_days: Json
          best_products: Json
          computed_at: string
          fastest_growing_product: Json | null
          shop_id: string
          summary_en: string
          summary_tl: string
          week_start: string
        }
        Insert: {
          best_days?: Json
          best_products?: Json
          computed_at?: string
          fastest_growing_product?: Json | null
          shop_id: string
          summary_en: string
          summary_tl: string
          week_start: string
        }
        Update: {
          best_days?: Json
          best_products?: Json
          computed_at?: string
          fastest_growing_product?: Json | null
          shop_id?: string
          summary_en?: string
          summary_tl?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_opportunities_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_shop_invite: { Args: { _code: string }; Returns: string }
      account_on_trial: { Args: { _account: string }; Returns: boolean }
      account_paid_subscription: {
        Args: { _account: string }
        Returns: {
          account_id: string | null
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          past_due_since: string | null
          pending_plan: string | null
          pending_plan_at: string | null
          plan: string
          price_id: string
          product_id: string
          provider: string
          shop_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_stock: {
        Args: {
          _kind: string
          _product_id: string
          _qty: number
          _reason: string
        }
        Returns: number
      }
      admin_account_deletions: {
        Args: never
        Returns: {
          deleted_on: string
          deletions: number
        }[]
      }
      admin_platform_totals: {
        Args: never
        Returns: {
          sales_count: number
          sales_total: number
          shops: number
          users: number
        }[]
      }
      admin_refresh_runs: {
        Args: never
        Returns: {
          error: string
          finished_at: string
          id: string
          job: string
          shops_processed: number
          started_at: string
          status: string
        }[]
      }
      admin_shop_list: {
        Args: never
        Returns: {
          created_at: string
          owner_email: string
          shop_id: string
          shop_name: string
          staff_count: number
        }[]
      }
      admin_signups_by_day: {
        Args: never
        Returns: {
          day: string
          signups: number
        }[]
      }
      anonymize_customer: { Args: { _customer_id: string }; Returns: undefined }
      assert_platform_admin_mfa: { Args: never; Returns: undefined }
      bizbot_begin_run: { Args: never; Returns: undefined }
      can_edit_products: { Args: { _shop_id: string }; Returns: boolean }
      cancel_shop_invite: { Args: { _invite_id: string }; Returns: undefined }
      create_reorder_from_alerts: {
        Args: { _alert_ids: string[]; _supplier_id?: string }
        Returns: string
      }
      create_shop_customer: {
        Args: { _consented: boolean; _mobile: string; _name: string }
        Returns: string
      }
      create_shop_invite: {
        Args: { _email: string }
        Returns: {
          code: string
          expires_at: string
          invite_id: string
        }[]
      }
      current_shop_id: { Args: never; Returns: string }
      current_shop_id_raw: { Args: never; Returns: string }
      decrement_stock: {
        Args: { _product_id: string; _qty: number }
        Returns: undefined
      }
      delete_account_data: {
        Args: { _user_hash: string; _user_id: string }
        Returns: {
          file_path: string
        }[]
      }
      ensure_business_account: {
        Args: { _since?: string; _user: string }
        Returns: string
      }
      ensure_my_shop: {
        Args: { _business_name?: string }
        Returns: {
          role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
        }[]
      }
      forecast_sales: {
        Args: { _days: number; _shop_id: string }
        Returns: {
          expected_sales: number
          forecast_date: string
          high: number
          low: number
        }[]
      }
      get_account_deletion_scope: {
        Args: never
        Returns: {
          member_role: Database["public"]["Enums"]["shop_role"]
          sole_owner: boolean
        }[]
      }
      get_billing_link_check: {
        Args: never
        Returns: {
          env_ok: boolean
          other_env_count: number
          paddle_subscription_id: string
          payments_env: string
          shop_id: string
          shop_ok: boolean
          subscription_env: string
          subscription_shop_id: string
          subscription_status: string
        }[]
      }
      get_cashier_today_summary: {
        Args: never
        Returns: {
          sale_count: number
          today_total: number
        }[]
      }
      get_masked_customers: {
        Args: never
        Returns: {
          id: string
          mobile: string
          name: string
        }[]
      }
      get_my_plan: {
        Args: never
        Returns: {
          ai_menu_builder: boolean
          ai_menu_runs_per_day: number
          animated_pages: number
          basic_pdf_max_pages: number
          brand_ads: boolean
          is_account_owner: boolean
          label: string
          max_skus: number
          max_stores: number
          ml_smart_reorder: boolean
          monthly_price_php: number
          on_trial: boolean
          pending_plan: string
          pending_plan_at: string
          plan: string
          shops_in_account: number
          support_level: string
          trial_ends_at: string
        }[]
      }
      get_my_shop_context: {
        Args: never
        Returns: {
          member_role: Database["public"]["Enums"]["shop_role"]
          shop_id: string
          shop_name: string
        }[]
      }
      get_my_usage: {
        Args: never
        Returns: {
          active_products: number
          at_limit: boolean
          max_skus: number
          near_limit: boolean
          plan: string
        }[]
      }
      get_payments_env: { Args: never; Returns: string }
      get_product_settings: {
        Args: never
        Returns: {
          allow_cashier_products: boolean
          can_edit: boolean
        }[]
      }
      get_shop_billing: {
        Args: { _env: string }
        Returns: {
          cancel_at_period_end: boolean
          env: string
          has_access: boolean
          is_owner: boolean
          period_end: string
          state: string
          trial_ends_at: string
        }[]
      }
      get_shop_products: {
        Args: never
        Returns: {
          category: string
          cost: number
          created_at: string
          id: string
          name: string
          price: number
          reorder_level: number
          shop_id: string
          sku: string
          stock: number
        }[]
      }
      get_shop_products_v2: {
        Args: never
        Returns: {
          archived_at: string
          category: string
          cost: number
          created_at: string
          id: string
          name: string
          photo_path: string
          price: number
          reorder_level: number
          shop_id: string
          sku: string
          stock: number
          track_stock: boolean
          unit: string
        }[]
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_shop_member: { Args: { _shop_id: string }; Returns: boolean }
      is_shop_owner: { Args: { _shop_id: string }; Returns: boolean }
      payments_env: { Args: never; Returns: string }
      plan_for_lookup_key: { Args: { _key: string }; Returns: string }
      receive_purchase_order: {
        Args: { _order_id: string }
        Returns: undefined
      }
      record_sale: {
        Args: {
          _accept_price_change?: boolean
          _amount_tendered: number
          _client_created_at?: string
          _client_sale_id?: string
          _customer_id: string
          _expected_total?: number
          _items: Json
          _payment_method: string
        }
        Returns: {
          receipt_no: string
          sale_id: string
        }[]
      }
      refresh_all_forecasts: { Args: never; Returns: undefined }
      remove_product: { Args: { _id: string }; Returns: string }
      remove_shop_cashier: { Args: { _member_id: string }; Returns: undefined }
      seed_sample_store: { Args: never; Returns: undefined }
      shop_has_access: { Args: { _shop_id: string }; Returns: boolean }
      shop_has_access_unchecked: {
        Args: { _shop_id: string }
        Returns: boolean
      }
      shop_has_smart_reorder: { Args: { _shop_id: string }; Returns: boolean }
      shop_plan: { Args: { _shop_id: string }; Returns: string }
      shop_plan_unchecked: { Args: { _shop_id: string }; Returns: string }
      shop_shows_brand_ads: { Args: { _shop_id: string }; Returns: boolean }
      subscription_is_paid: {
        Args: { _s: Database["public"]["Tables"]["subscriptions"]["Row"] }
        Returns: boolean
      }
      update_product: { Args: { _data: Json; _id: string }; Returns: undefined }
      void_sale: { Args: { _sale_id: string }; Returns: undefined }
    }
    Enums: {
      document_type: "permit" | "receipt" | "contract" | "other"
      expense_category:
        | "rent"
        | "electricity"
        | "water"
        | "internet"
        | "salaries"
        | "supplies"
        | "transport"
        | "other"
      goal_period: "daily" | "weekly" | "monthly"
      sale_status: "completed" | "voided" | "refunded"
      shop_role: "owner" | "cashier"
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
      document_type: ["permit", "receipt", "contract", "other"],
      expense_category: [
        "rent",
        "electricity",
        "water",
        "internet",
        "salaries",
        "supplies",
        "transport",
        "other",
      ],
      goal_period: ["daily", "weekly", "monthly"],
      sale_status: ["completed", "voided", "refunded"],
      shop_role: ["owner", "cashier"],
    },
  },
} as const
