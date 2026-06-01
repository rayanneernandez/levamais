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
      access_profiles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      adjustment_verification_codes: {
        Row: {
          adjustment_data: Json
          client_id: string
          code: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          network_id: string
          used: boolean | null
          used_at: string | null
        }
        Insert: {
          adjustment_data: Json
          client_id: string
          code: string
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          network_id: string
          used?: boolean | null
          used_at?: string | null
        }
        Update: {
          adjustment_data?: Json
          client_id?: string
          code?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          network_id?: string
          used?: boolean | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adjustment_verification_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adjustment_verification_codes_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      anomalies: {
        Row: {
          alert_id: string
          anomaly_type: Database["public"]["Enums"]["anomaly_type"]
          client_id: string
          created_at: string
          details: Json | null
          detected_at: string
          fraud_score: number
          id: string
          network_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["anomaly_severity"]
          status: Database["public"]["Enums"]["anomaly_status"]
          store_id: string | null
          suggested_actions: string[] | null
          summary: string
          updated_at: string
        }
        Insert: {
          alert_id: string
          anomaly_type: Database["public"]["Enums"]["anomaly_type"]
          client_id: string
          created_at?: string
          details?: Json | null
          detected_at?: string
          fraud_score: number
          id?: string
          network_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: Database["public"]["Enums"]["anomaly_severity"]
          status?: Database["public"]["Enums"]["anomaly_status"]
          store_id?: string | null
          suggested_actions?: string[] | null
          summary: string
          updated_at?: string
        }
        Update: {
          alert_id?: string
          anomaly_type?: Database["public"]["Enums"]["anomaly_type"]
          client_id?: string
          created_at?: string
          details?: Json | null
          detected_at?: string
          fraud_score?: number
          id?: string
          network_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["anomaly_severity"]
          status?: Database["public"]["Enums"]["anomaly_status"]
          store_id?: string | null
          suggested_actions?: string[] | null
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomalies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomalies_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomalies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      anomaly_history: {
        Row: {
          action_by: string
          action_type: string
          anomaly_id: string
          created_at: string
          id: string
          metadata: Json | null
          notes: string | null
        }
        Insert: {
          action_by: string
          action_type: string
          anomaly_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
        }
        Update: {
          action_by?: string
          action_type?: string
          anomaly_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_history_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "anomalies"
            referencedColumns: ["id"]
          },
        ]
      }
      anomaly_rules: {
        Row: {
          anomaly_id: string
          confidence: number
          created_at: string
          id: string
          rule_code: string
          rule_name: string
          triggered_at: string
        }
        Insert: {
          anomaly_id: string
          confidence: number
          created_at?: string
          id?: string
          rule_code: string
          rule_name: string
          triggered_at?: string
        }
        Update: {
          anomaly_id?: string
          confidence?: number
          created_at?: string
          id?: string
          rule_code?: string
          rule_name?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_rules_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "anomalies"
            referencedColumns: ["id"]
          },
        ]
      }
      anomaly_transactions: {
        Row: {
          anomaly_id: string
          created_at: string
          id: string
          transaction_id: string
        }
        Insert: {
          anomaly_id: string
          created_at?: string
          id?: string
          transaction_id: string
        }
        Update: {
          anomaly_id?: string
          created_at?: string
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_transactions_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "anomalies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomaly_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      api_cache: {
        Row: {
          cache_key: string
          cache_value: Json
          created_at: string
          expires_at: string
          id: string
          updated_at: string
        }
        Insert: {
          cache_key: string
          cache_value: Json
          created_at?: string
          expires_at: string
          id?: string
          updated_at?: string
        }
        Update: {
          cache_key?: string
          cache_value?: Json
          created_at?: string
          expires_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_integrations: {
        Row: {
          config: Json | null
          created_at: string
          created_by: string | null
          credentials: Json | null
          description: string | null
          id: string
          last_used_at: string | null
          name: string
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          created_by?: string | null
          credentials?: Json | null
          description?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          created_by?: string | null
          credentials?: Json | null
          description?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          api_key: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          key_type: string
          last_used_at: string | null
          network_id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          key_type?: string
          last_used_at?: string | null
          network_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          key_type?: string
          last_used_at?: string | null
          network_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      api_message_templates: {
        Row: {
          available_tags: string[] | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          message_key: string
          message_template: string
          message_title: string
          updated_at: string
        }
        Insert: {
          available_tags?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          message_key: string
          message_template: string
          message_title: string
          updated_at?: string
        }
        Update: {
          available_tags?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          message_key?: string
          message_template?: string
          message_title?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          api_key: string
          created_at: string
          endpoint: string
          id: string
          request_count: number
          window_start: string
        }
        Insert: {
          api_key: string
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      api_usage_configs: {
        Row: {
          config_type: string
          created_at: string
          id: string
          integration_id: string | null
          is_active: boolean
          updated_at: string
        }
        Insert: {
          config_type: string
          created_at?: string
          id?: string
          integration_id?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          config_type?: string
          created_at?: string
          id?: string
          integration_id?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_configs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "api_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_charges: {
        Row: {
          amount: number
          asaas_charge_id: string
          bank_slip_url: string | null
          billing_type: string | null
          charge_type: string
          confirmed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          invoice_url: string | null
          is_penalty: boolean | null
          network_id: string
          order_id: string | null
          original_contract_end_date: string | null
          payment_date: string | null
          payment_method: string | null
          penalty_percentage: number | null
          pix_qrcode: string | null
          status: string | null
          subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          asaas_charge_id: string
          bank_slip_url?: string | null
          billing_type?: string | null
          charge_type: string
          confirmed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          invoice_url?: string | null
          is_penalty?: boolean | null
          network_id: string
          order_id?: string | null
          original_contract_end_date?: string | null
          payment_date?: string | null
          payment_method?: string | null
          penalty_percentage?: number | null
          pix_qrcode?: string | null
          status?: string | null
          subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          asaas_charge_id?: string
          bank_slip_url?: string | null
          billing_type?: string | null
          charge_type?: string
          confirmed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          invoice_url?: string | null
          is_penalty?: boolean | null
          network_id?: string
          order_id?: string | null
          original_contract_end_date?: string | null
          payment_date?: string | null
          payment_method?: string | null
          penalty_percentage?: number | null
          pix_qrcode?: string | null
          status?: string | null
          subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_charges_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_charges_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_charges_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "network_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_config: {
        Row: {
          api_key_production: string | null
          api_key_sandbox: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_sandbox: boolean | null
          last_test_at: string | null
          last_test_status: string | null
          updated_at: string | null
          webhook_token: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key_production?: string | null
          api_key_sandbox?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_sandbox?: boolean | null
          last_test_at?: string | null
          last_test_status?: string | null
          updated_at?: string | null
          webhook_token?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key_production?: string | null
          api_key_sandbox?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_sandbox?: boolean | null
          last_test_at?: string | null
          last_test_status?: string | null
          updated_at?: string | null
          webhook_token?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          created_at: string | null
          customer_id: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          payment_id: string | null
          processed: boolean | null
          subscription_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          payment_id?: string | null
          processed?: boolean | null
          subscription_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed?: boolean | null
          subscription_id?: string | null
        }
        Relationships: []
      }
      asaas_webhooks: {
        Row: {
          asaas_charge_id: string | null
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean | null
          processed_at: string | null
        }
        Insert: {
          asaas_charge_id?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          processed?: boolean | null
          processed_at?: string | null
        }
        Update: {
          asaas_charge_id?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean | null
          processed_at?: string | null
        }
        Relationships: []
      }
      attendant_points: {
        Row: {
          attendant_id: string
          created_at: string
          id: string
          network_id: string
          total_points: number
          updated_at: string
        }
        Insert: {
          attendant_id: string
          created_at?: string
          id?: string
          network_id: string
          total_points?: number
          updated_at?: string
        }
        Update: {
          attendant_id?: string
          created_at?: string
          id?: string
          network_id?: string
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendant_points_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      attendant_points_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          multiplier_15_days: number
          multiplier_30_days: number
          multiplier_7_days: number
          network_id: string
          points_per_client: number
          redemption_notification_email: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          multiplier_15_days?: number
          multiplier_30_days?: number
          multiplier_7_days?: number
          network_id: string
          points_per_client?: number
          redemption_notification_email?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          multiplier_15_days?: number
          multiplier_30_days?: number
          multiplier_7_days?: number
          network_id?: string
          points_per_client?: number
          redemption_notification_email?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendant_points_rules_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: true
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      attendant_points_transactions: {
        Row: {
          attendant_id: string
          client_id: string | null
          created_at: string
          description: string | null
          id: string
          multiplier_applied: number
          network_id: string
          points_earned: number
          transaction_type: string
        }
        Insert: {
          attendant_id: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          multiplier_applied?: number
          network_id: string
          points_earned: number
          transaction_type: string
        }
        Update: {
          attendant_id?: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          multiplier_applied?: number
          network_id?: string
          points_earned?: number
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendant_points_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendant_points_transactions_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      attendant_redemptions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attendant_id: string
          created_at: string
          delivered_at: string | null
          id: string
          network_id: string
          notes: string | null
          points_spent: number
          reward_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attendant_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          network_id: string
          notes?: string | null
          points_spent: number
          reward_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attendant_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          network_id?: string
          notes?: string | null
          points_spent?: number
          reward_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendant_redemptions_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendant_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "attendant_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      attendant_rewards: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          network_id: string
          points_cost: number
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          network_id: string
          points_cost: number
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          network_id?: string
          points_cost?: number
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendant_rewards_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      balance_adjustments: {
        Row: {
          adjusted_by: string
          adjustment_type: string
          amount: number
          client_id: string
          created_at: string
          id: string
          network_id: string
          reason: string
        }
        Insert: {
          adjusted_by: string
          adjustment_type: string
          amount: number
          client_id: string
          created_at?: string
          id?: string
          network_id: string
          reason: string
        }
        Update: {
          adjusted_by?: string
          adjustment_type?: string
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          network_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_adjustments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_adjustments_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_clients: {
        Row: {
          blocked_at: string
          blocked_by: string
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          justification: string
          network_id: string
          reason: string
          unblock_justification: string | null
          unblocked_at: string | null
          unblocked_by: string | null
          updated_at: string
        }
        Insert: {
          blocked_at?: string
          blocked_by: string
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          justification: string
          network_id: string
          reason: string
          unblock_justification?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          updated_at?: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          justification?: string
          network_id?: string
          reason?: string
          unblock_justification?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_clients_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_internal_verification_codes: {
        Row: {
          budget_id: string
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          ip_address: string | null
          used: boolean
          used_at: string | null
        }
        Insert: {
          budget_id: string
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          used?: boolean
          used_at?: string | null
        }
        Update: {
          budget_id?: string
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          used?: boolean
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_internal_verification_codes_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          budget_id: string
          created_at: string
          discount_amount: number | null
          discount_type: string | null
          id: string
          product_service_id: string
          quantity: number
          total_value: number
          unit_value: number
          unit_value_with_discount: number | null
        }
        Insert: {
          budget_id: string
          created_at?: string
          discount_amount?: number | null
          discount_type?: string | null
          id?: string
          product_service_id: string
          quantity?: number
          total_value: number
          unit_value: number
          unit_value_with_discount?: number | null
        }
        Update: {
          budget_id?: string
          created_at?: string
          discount_amount?: number | null
          discount_type?: string | null
          id?: string
          product_service_id?: string
          quantity?: number
          total_value?: number
          unit_value?: number
          unit_value_with_discount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_product_service_id_fkey"
            columns: ["product_service_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_verification_codes: {
        Row: {
          budget_id: string
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          ip_address: string | null
          phone: string | null
          used: boolean
          used_at: string | null
        }
        Insert: {
          budget_id: string
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          phone?: string | null
          used?: boolean
          used_at?: string | null
        }
        Update: {
          budget_id?: string
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          phone?: string | null
          used?: boolean
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_verification_codes_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          approval_audit_pdf_url: string | null
          approval_document_hash: string | null
          approval_ip: string | null
          approval_latitude: number | null
          approval_longitude: number | null
          approval_signature: string | null
          approval_token: string | null
          approval_user_agent: string | null
          approved_at: string | null
          approved_by_cpf: string | null
          approved_by_email: string | null
          approved_by_name: string | null
          approved_by_position: string | null
          billing_day: number | null
          billing_type: string | null
          bisw_approval_document_hash: string | null
          bisw_approval_ip: string | null
          bisw_approval_latitude: number | null
          bisw_approval_longitude: number | null
          bisw_approval_signature: string | null
          bisw_approval_user_agent: string | null
          bisw_approved_at: string | null
          bisw_approved_by_cpf: string | null
          bisw_approved_by_email: string | null
          bisw_approved_by_name: string | null
          bisw_approved_by_position: string | null
          budget_number: string
          cnpjs: string[] | null
          contract_duration_months: number | null
          created_at: string
          created_by: string
          decline_reason: string | null
          declined_at: string | null
          expected_closing_date: string | null
          expires_at: string
          financial_contact_email: string | null
          financial_contact_name: string | null
          financial_contact_phone: string | null
          financial_email: string | null
          freight_value: number | null
          id: string
          internal_approval_document_hash: string | null
          internal_approval_ip: string | null
          internal_approval_latitude: number | null
          internal_approval_longitude: number | null
          internal_approval_user_agent: string | null
          internal_approved_at: string | null
          internal_approved_by: string | null
          internal_approved_by_cpf: string | null
          internal_approved_by_email: string | null
          internal_approved_by_name: string | null
          lead_id: string | null
          main_billing_cnpj: string | null
          network_id: string | null
          observations: string | null
          payment_due_days: number | null
          payment_type: string | null
          poc_days: number | null
          products_first_payment_date: string | null
          products_installments: number | null
          products_installments_count: number | null
          products_payment_method: string | null
          products_total: number | null
          requester_email: string
          requester_name: string
          requester_phone: string
          seller_id: string
          services_first_payment_date: string | null
          services_installments: number | null
          services_payment_method: string | null
          services_total: number | null
          status: string
          temperature: string | null
          total_value: number
          unique_services_installments_count: number | null
          updated_at: string
        }
        Insert: {
          approval_audit_pdf_url?: string | null
          approval_document_hash?: string | null
          approval_ip?: string | null
          approval_latitude?: number | null
          approval_longitude?: number | null
          approval_signature?: string | null
          approval_token?: string | null
          approval_user_agent?: string | null
          approved_at?: string | null
          approved_by_cpf?: string | null
          approved_by_email?: string | null
          approved_by_name?: string | null
          approved_by_position?: string | null
          billing_day?: number | null
          billing_type?: string | null
          bisw_approval_document_hash?: string | null
          bisw_approval_ip?: string | null
          bisw_approval_latitude?: number | null
          bisw_approval_longitude?: number | null
          bisw_approval_signature?: string | null
          bisw_approval_user_agent?: string | null
          bisw_approved_at?: string | null
          bisw_approved_by_cpf?: string | null
          bisw_approved_by_email?: string | null
          bisw_approved_by_name?: string | null
          bisw_approved_by_position?: string | null
          budget_number: string
          cnpjs?: string[] | null
          contract_duration_months?: number | null
          created_at?: string
          created_by: string
          decline_reason?: string | null
          declined_at?: string | null
          expected_closing_date?: string | null
          expires_at: string
          financial_contact_email?: string | null
          financial_contact_name?: string | null
          financial_contact_phone?: string | null
          financial_email?: string | null
          freight_value?: number | null
          id?: string
          internal_approval_document_hash?: string | null
          internal_approval_ip?: string | null
          internal_approval_latitude?: number | null
          internal_approval_longitude?: number | null
          internal_approval_user_agent?: string | null
          internal_approved_at?: string | null
          internal_approved_by?: string | null
          internal_approved_by_cpf?: string | null
          internal_approved_by_email?: string | null
          internal_approved_by_name?: string | null
          lead_id?: string | null
          main_billing_cnpj?: string | null
          network_id?: string | null
          observations?: string | null
          payment_due_days?: number | null
          payment_type?: string | null
          poc_days?: number | null
          products_first_payment_date?: string | null
          products_installments?: number | null
          products_installments_count?: number | null
          products_payment_method?: string | null
          products_total?: number | null
          requester_email: string
          requester_name: string
          requester_phone: string
          seller_id: string
          services_first_payment_date?: string | null
          services_installments?: number | null
          services_payment_method?: string | null
          services_total?: number | null
          status?: string
          temperature?: string | null
          total_value?: number
          unique_services_installments_count?: number | null
          updated_at?: string
        }
        Update: {
          approval_audit_pdf_url?: string | null
          approval_document_hash?: string | null
          approval_ip?: string | null
          approval_latitude?: number | null
          approval_longitude?: number | null
          approval_signature?: string | null
          approval_token?: string | null
          approval_user_agent?: string | null
          approved_at?: string | null
          approved_by_cpf?: string | null
          approved_by_email?: string | null
          approved_by_name?: string | null
          approved_by_position?: string | null
          billing_day?: number | null
          billing_type?: string | null
          bisw_approval_document_hash?: string | null
          bisw_approval_ip?: string | null
          bisw_approval_latitude?: number | null
          bisw_approval_longitude?: number | null
          bisw_approval_signature?: string | null
          bisw_approval_user_agent?: string | null
          bisw_approved_at?: string | null
          bisw_approved_by_cpf?: string | null
          bisw_approved_by_email?: string | null
          bisw_approved_by_name?: string | null
          bisw_approved_by_position?: string | null
          budget_number?: string
          cnpjs?: string[] | null
          contract_duration_months?: number | null
          created_at?: string
          created_by?: string
          decline_reason?: string | null
          declined_at?: string | null
          expected_closing_date?: string | null
          expires_at?: string
          financial_contact_email?: string | null
          financial_contact_name?: string | null
          financial_contact_phone?: string | null
          financial_email?: string | null
          freight_value?: number | null
          id?: string
          internal_approval_document_hash?: string | null
          internal_approval_ip?: string | null
          internal_approval_latitude?: number | null
          internal_approval_longitude?: number | null
          internal_approval_user_agent?: string | null
          internal_approved_at?: string | null
          internal_approved_by?: string | null
          internal_approved_by_cpf?: string | null
          internal_approved_by_email?: string | null
          internal_approved_by_name?: string | null
          lead_id?: string | null
          main_billing_cnpj?: string | null
          network_id?: string | null
          observations?: string | null
          payment_due_days?: number | null
          payment_type?: string | null
          poc_days?: number | null
          products_first_payment_date?: string | null
          products_installments?: number | null
          products_installments_count?: number | null
          products_payment_method?: string | null
          products_total?: number | null
          requester_email?: string
          requester_name?: string
          requester_phone?: string
          seller_id?: string
          services_first_payment_date?: string | null
          services_installments?: number | null
          services_payment_method?: string | null
          services_total?: number | null
          status?: string
          temperature?: string | null
          total_value?: number
          unique_services_installments_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_stores: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          store_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          store_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_stores_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "loyalty_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      client_login_verification_codes: {
        Row: {
          code: string
          cpf: string
          created_at: string
          email: string
          expires_at: string
          id: string
          ip_address: string | null
          used: boolean
          used_at: string | null
        }
        Insert: {
          code: string
          cpf: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          used?: boolean
          used_at?: string | null
        }
        Update: {
          code?: string
          cpf?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          used?: boolean
          used_at?: string | null
        }
        Relationships: []
      }
      client_notification_recipients: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_read: boolean
          notification_id: string
          read_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          notification_id: string
          read_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          notification_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_notification_recipients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "client_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notifications: {
        Row: {
          created_at: string
          created_by: string
          id: string
          message: string
          network_id: string
          read_count: number
          sent_count: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          message: string
          network_id: string
          read_count?: number
          sent_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          network_id?: string
          read_count?: number
          sent_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notifications_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      client_referrals: {
        Row: {
          bonus_applied: boolean | null
          bonus_type: string
          created_at: string | null
          id: string
          network_id: string
          referred_bonus_amount: number
          referred_client_id: string
          referrer_bonus_amount: number
          referrer_client_id: string
        }
        Insert: {
          bonus_applied?: boolean | null
          bonus_type: string
          created_at?: string | null
          id?: string
          network_id: string
          referred_bonus_amount: number
          referred_client_id: string
          referrer_bonus_amount: number
          referrer_client_id: string
        }
        Update: {
          bonus_applied?: boolean | null
          bonus_type?: string
          created_at?: string | null
          id?: string
          network_id?: string
          referred_bonus_amount?: number
          referred_client_id?: string
          referrer_bonus_amount?: number
          referrer_client_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_referrals_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_referrals_referred_client_id_fkey"
            columns: ["referred_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_referrals_referrer_client_id_fkey"
            columns: ["referrer_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_retention_commitments: {
        Row: {
          client_id: string
          commitment_months: number
          created_at: string
          expiration_email_sent: boolean
          expires_at: string
          id: string
          loyalty_type: string
          multiplier_applied: number
          network_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          commitment_months: number
          created_at?: string
          expiration_email_sent?: boolean
          expires_at: string
          id?: string
          loyalty_type: string
          multiplier_applied: number
          network_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          commitment_months?: number
          created_at?: string
          expiration_email_sent?: boolean
          expires_at?: string
          id?: string
          loyalty_type?: string
          multiplier_applied?: number
          network_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_retention_commitments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_retention_commitments_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      client_subscriptions_one: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          can_cancel: boolean | null
          cancelled_at: string | null
          card_last_digits: string | null
          client_id: string | null
          created_at: string | null
          id: string
          minimum_period_months: number | null
          monthly_value: number | null
          network_id: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          can_cancel?: boolean | null
          cancelled_at?: string | null
          card_last_digits?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          minimum_period_months?: number | null
          monthly_value?: number | null
          network_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          can_cancel?: boolean | null
          cancelled_at?: string | null
          card_last_digits?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          minimum_period_months?: number | null
          monthly_value?: number | null
          network_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_one_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_one_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_country: string
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          auto_redemption_disable_days: number | null
          auto_redemption_disable_mode: string | null
          auto_redemption_disable_scheduled_at: string | null
          auto_redemption_enabled: boolean
          birth_date: string | null
          codigo: string | null
          cpf: string
          created_at: string
          email: string | null
          email_validated: boolean | null
          favorite_network_changed_at: string | null
          favorite_network_id: string | null
          full_name: string | null
          id: string
          is_one_member: boolean | null
          is_validated: boolean | null
          network_id: string | null
          one_member_since: string | null
          phone: string | null
          phone_validated: boolean | null
          referred_by_user_id: string | null
          registered_at_store_id: string | null
          registered_by_attendant_id: string | null
          retention_card_first_shown_at: string | null
          retention_decision_made_at: string | null
          retention_decision_type: string | null
          total_points: number | null
          tutorial_completed: boolean | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          auto_redemption_disable_days?: number | null
          auto_redemption_disable_mode?: string | null
          auto_redemption_disable_scheduled_at?: string | null
          auto_redemption_enabled?: boolean
          birth_date?: string | null
          codigo?: string | null
          cpf: string
          created_at?: string
          email?: string | null
          email_validated?: boolean | null
          favorite_network_changed_at?: string | null
          favorite_network_id?: string | null
          full_name?: string | null
          id?: string
          is_one_member?: boolean | null
          is_validated?: boolean | null
          network_id?: string | null
          one_member_since?: string | null
          phone?: string | null
          phone_validated?: boolean | null
          referred_by_user_id?: string | null
          registered_at_store_id?: string | null
          registered_by_attendant_id?: string | null
          retention_card_first_shown_at?: string | null
          retention_decision_made_at?: string | null
          retention_decision_type?: string | null
          total_points?: number | null
          tutorial_completed?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          auto_redemption_disable_days?: number | null
          auto_redemption_disable_mode?: string | null
          auto_redemption_disable_scheduled_at?: string | null
          auto_redemption_enabled?: boolean
          birth_date?: string | null
          codigo?: string | null
          cpf?: string
          created_at?: string
          email?: string | null
          email_validated?: boolean | null
          favorite_network_changed_at?: string | null
          favorite_network_id?: string | null
          full_name?: string | null
          id?: string
          is_one_member?: boolean | null
          is_validated?: boolean | null
          network_id?: string | null
          one_member_since?: string | null
          phone?: string | null
          phone_validated?: boolean | null
          referred_by_user_id?: string | null
          registered_at_store_id?: string | null
          registered_by_attendant_id?: string | null
          retention_card_first_shown_at?: string | null
          retention_decision_made_at?: string | null
          retention_decision_type?: string | null
          total_points?: number | null
          tutorial_completed?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_favorite_network_id_fkey"
            columns: ["favorite_network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_registered_at_store_id_fkey"
            columns: ["registered_at_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_success_checkins: {
        Row: {
          action_items: string | null
          active_clients: number | null
          active_stores: number | null
          checkin_date: string
          checkin_type: string
          client_satisfaction: number | null
          created_at: string
          description: string | null
          id: string
          insights: string | null
          observations: string | null
          performed_by: string | null
          project_id: string
          scheduled_for: string | null
          status: string
          total_transactions: number | null
          transaction_volume: number | null
          updated_at: string
        }
        Insert: {
          action_items?: string | null
          active_clients?: number | null
          active_stores?: number | null
          checkin_date: string
          checkin_type: string
          client_satisfaction?: number | null
          created_at?: string
          description?: string | null
          id?: string
          insights?: string | null
          observations?: string | null
          performed_by?: string | null
          project_id: string
          scheduled_for?: string | null
          status?: string
          total_transactions?: number | null
          transaction_volume?: number | null
          updated_at?: string
        }
        Update: {
          action_items?: string | null
          active_clients?: number | null
          active_stores?: number | null
          checkin_date?: string
          checkin_type?: string
          client_satisfaction?: number | null
          created_at?: string
          description?: string | null
          id?: string
          insights?: string | null
          observations?: string | null
          performed_by?: string | null
          project_id?: string
          scheduled_for?: string | null
          status?: string
          total_transactions?: number | null
          transaction_volume?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_success_checkins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          budget_id: string | null
          created_at: string
          email_subject: string | null
          email_to: string
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          resend_email_id: string | null
        }
        Insert: {
          budget_id?: string | null
          created_at?: string
          email_subject?: string | null
          email_to: string
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          resend_email_id?: string | null
        }
        Update: {
          budget_id?: string | null
          created_at?: string
          email_subject?: string | null
          email_to?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          resend_email_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      expo_push_tokens: {
        Row: {
          client_id: string
          created_at: string
          device_name: string | null
          expo_token: string
          id: string
          is_active: boolean
          last_used_at: string | null
          platform: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          device_name?: string | null
          expo_token: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          platform?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          device_name?: string | null
          expo_token?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          platform?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expo_push_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      external_api_tokens: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          network_id: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          network_id: string
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          network_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_api_tokens_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_differential_config: {
        Row: {
          created_at: string
          differential_percentage: number
          exclude_from_loyalty: boolean
          id: string
          is_active: boolean
          network_id: string
          product_code: string
          product_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          differential_percentage?: number
          exclude_from_loyalty?: boolean
          id?: string
          is_active?: boolean
          network_id: string
          product_code: string
          product_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          differential_percentage?: number
          exclude_from_loyalty?: boolean
          id?: string
          is_active?: boolean
          network_id?: string
          product_code?: string
          product_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_differential_config_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_price_imports: {
        Row: {
          error_log: Json | null
          failed_rows: number
          file_name: string
          id: string
          import_date: string
          imported_by: string
          status: string
          successful_rows: number
          total_rows: number
        }
        Insert: {
          error_log?: Json | null
          failed_rows: number
          file_name: string
          id?: string
          import_date?: string
          imported_by: string
          status?: string
          successful_rows: number
          total_rows: number
        }
        Update: {
          error_log?: Json | null
          failed_rows?: number
          file_name?: string
          id?: string
          import_date?: string
          imported_by?: string
          status?: string
          successful_rows?: number
          total_rows?: number
        }
        Relationships: []
      }
      fuel_prices: {
        Row: {
          bairro: string | null
          bandeira: string | null
          cep: string | null
          cidade: string | null
          cnpj: string
          complemento: string | null
          created_at: string
          data_coleta: string
          endereco: string | null
          estado: string | null
          id: string
          import_id: string | null
          municipio: string | null
          nome_fantasia: string | null
          numero: string | null
          preco_revenda: number | null
          produto: string
          razao_social: string | null
          unidade_medida: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          bandeira?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj: string
          complemento?: string | null
          created_at?: string
          data_coleta: string
          endereco?: string | null
          estado?: string | null
          id?: string
          import_id?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          preco_revenda?: number | null
          produto: string
          razao_social?: string | null
          unidade_medida?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          bandeira?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string
          complemento?: string | null
          created_at?: string
          data_coleta?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          import_id?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          preco_revenda?: number | null
          produto?: string
          razao_social?: string | null
          unidade_medida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_prices_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "fuel_price_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_product_points_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          network_id: string
          points_per_liter: number
          product_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          network_id: string
          points_per_liter?: number
          product_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          network_id?: string
          points_per_liter?: number
          product_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_product_points_config_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_promotions: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_date: string
          fuel_config_id: string
          id: string
          is_active: boolean | null
          network_id: string
          original_percentage: number
          promotion_name: string
          promotion_percentage: number
          start_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_date: string
          fuel_config_id: string
          id?: string
          is_active?: boolean | null
          network_id: string
          original_percentage: number
          promotion_name: string
          promotion_percentage: number
          start_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_date?: string
          fuel_config_id?: string
          id?: string
          is_active?: boolean | null
          network_id?: string
          original_percentage?: number
          promotion_name?: string
          promotion_percentage?: number
          start_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_promotions_fuel_config_id_fkey"
            columns: ["fuel_config_id"]
            isOneToOne: false
            referencedRelation: "fuel_differential_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_promotions_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          notes: string | null
          phone: string | null
          source: string
          status: string
          temperature: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          temperature?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string
          status?: string
          temperature?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      license_audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string
          created_at: string
          field_name: string
          id: string
          network_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by: string
          created_at?: string
          field_name: string
          id?: string
          network_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string
          created_at?: string
          field_name?: string
          id?: string
          network_id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_audit_logs_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_campaigns: {
        Row: {
          action_type: string
          cashback_multiplier: number
          created_at: string
          end_date: string
          end_time: string
          id: string
          is_active: boolean
          name: string
          network_id: string
          points_multiplier: number | null
          start_date: string
          start_time: string
          updated_at: string
        }
        Insert: {
          action_type?: string
          cashback_multiplier?: number
          created_at?: string
          end_date: string
          end_time: string
          id?: string
          is_active?: boolean
          name: string
          network_id: string
          points_multiplier?: number | null
          start_date: string
          start_time: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          cashback_multiplier?: number
          created_at?: string
          end_date?: string
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          network_id?: string
          points_multiplier?: number | null
          start_date?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashback_campaigns_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_articles: {
        Row: {
          category_id: string
          content: string
          created_at: string
          id: string
          is_published: boolean
          order_index: number
          title: string
          updated_at: string
          video_file_path: string | null
          video_url: string | null
        }
        Insert: {
          category_id: string
          content: string
          created_at?: string
          id?: string
          is_published?: boolean
          order_index?: number
          title: string
          updated_at?: string
          video_file_path?: string | null
          video_url?: string | null
        }
        Update: {
          category_id?: string
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          order_index?: number
          title?: string
          updated_at?: string
          video_file_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "manual_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          order_index: number
          portal_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          order_index?: number
          portal_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          order_index?: number
          portal_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          campaign_name: string
          campaign_type: string
          completed_at: string | null
          cost_per_message: number | null
          created_at: string
          created_by: string
          failed_count: number
          id: string
          message_content: string
          network_id: string
          sent_at: string | null
          sent_count: number
          status: string
          total_cost: number | null
          total_recipients: number
        }
        Insert: {
          campaign_name: string
          campaign_type: string
          completed_at?: string | null
          cost_per_message?: number | null
          created_at?: string
          created_by: string
          failed_count?: number
          id?: string
          message_content: string
          network_id: string
          sent_at?: string | null
          sent_count?: number
          status?: string
          total_cost?: number | null
          total_recipients?: number
        }
        Update: {
          campaign_name?: string
          campaign_type?: string
          completed_at?: string | null
          cost_per_message?: number | null
          created_at?: string
          created_by?: string
          failed_count?: number
          id?: string
          message_content?: string
          network_id?: string
          sent_at?: string | null
          sent_count?: number
          status?: string
          total_cost?: number | null
          total_recipients?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_message_templates: {
        Row: {
          auto_send_enabled: boolean | null
          channel: string
          created_at: string | null
          id: string
          is_active: boolean | null
          message_content: string
          network_id: string
          subject: string | null
          template_type: string
          updated_at: string | null
        }
        Insert: {
          auto_send_enabled?: boolean | null
          channel: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_content: string
          network_id: string
          subject?: string | null
          template_type: string
          updated_at?: string | null
        }
        Update: {
          auto_send_enabled?: boolean | null
          channel?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_content?: string
          network_id?: string
          subject?: string | null
          template_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_message_templates_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          asaas_charge_id: string | null
          created_at: string | null
          delivered_at: string | null
          id: string
          items: Json
          network_id: string
          notes: string | null
          order_number: string
          paid_at: string | null
          payment_method: string | null
          payment_status: string | null
          shipped_at: string | null
          shipping_address: Json
          shipping_fee: number | null
          status: string | null
          total_amount: number
          tracking_code: string | null
          updated_at: string | null
        }
        Insert: {
          asaas_charge_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          items: Json
          network_id: string
          notes?: string | null
          order_number: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shipped_at?: string | null
          shipping_address: Json
          shipping_fee?: number | null
          status?: string | null
          total_amount: number
          tracking_code?: string | null
          updated_at?: string | null
        }
        Update: {
          asaas_charge_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          items?: Json
          network_id?: string
          notes?: string | null
          order_number?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_fee?: number | null
          status?: string | null
          total_amount?: number
          tracking_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_products: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          price: number
          specifications: Json | null
          stock_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          price: number
          specifications?: Json | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          price?: number
          specifications?: Json | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      network_one_commission_config: {
        Row: {
          commission_type: string | null
          commission_value: number
          created_at: string | null
          id: string
          network_id: string | null
          payment_day_offset: number | null
          updated_at: string | null
        }
        Insert: {
          commission_type?: string | null
          commission_value: number
          created_at?: string | null
          id?: string
          network_id?: string | null
          payment_day_offset?: number | null
          updated_at?: string | null
        }
        Update: {
          commission_type?: string | null
          commission_value?: number
          created_at?: string | null
          id?: string
          network_id?: string | null
          payment_day_offset?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_one_commission_config_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: true
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      network_retention_config: {
        Row: {
          cashback_multiplier_12_months: number
          cashback_multiplier_6_months: number
          cashback_multiplier_9_months: number
          created_at: string
          id: string
          is_active: boolean
          network_id: string
          points_multiplier_12_months: number
          points_multiplier_6_months: number
          points_multiplier_9_months: number
          updated_at: string
        }
        Insert: {
          cashback_multiplier_12_months?: number
          cashback_multiplier_6_months?: number
          cashback_multiplier_9_months?: number
          created_at?: string
          id?: string
          is_active?: boolean
          network_id: string
          points_multiplier_12_months?: number
          points_multiplier_6_months?: number
          points_multiplier_9_months?: number
          updated_at?: string
        }
        Update: {
          cashback_multiplier_12_months?: number
          cashback_multiplier_6_months?: number
          cashback_multiplier_9_months?: number
          created_at?: string
          id?: string
          is_active?: boolean
          network_id?: string
          points_multiplier_12_months?: number
          points_multiplier_6_months?: number
          points_multiplier_9_months?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_retention_config_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: true
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      network_subscriptions: {
        Row: {
          asaas_subscription_id: string | null
          cancellation_date: string | null
          cancellation_reason: string | null
          created_at: string | null
          id: string
          network_id: string
          next_billing_date: string | null
          plan_id: string
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          asaas_subscription_id?: string | null
          cancellation_date?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          id?: string
          network_id: string
          next_billing_date?: string | null
          plan_id: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          asaas_subscription_id?: string | null
          cancellation_date?: string | null
          cancellation_reason?: string | null
          created_at?: string | null
          id?: string
          network_id?: string
          next_billing_date?: string | null
          plan_id?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_subscriptions_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "upgrade_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      networks: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          ai_credits_limit: number | null
          ai_credits_price: number | null
          ai_credits_used: number | null
          billing_day: number | null
          billing_type: string | null
          birthday_bonus_validity_amount: number | null
          birthday_bonus_validity_unit: string | null
          cancellation_penalty_percentage: number | null
          cnpj: string | null
          cnpjs: string[] | null
          commercial_contact_email: string | null
          commercial_contact_name: string | null
          commercial_contact_phone: string | null
          contract_duration_months: number | null
          contract_end_date: string | null
          contract_start_date: string | null
          contract_status: string | null
          created_at: string
          created_by: string
          email: string | null
          email_marketing_limit: number | null
          email_marketing_price: number | null
          email_marketing_used: number | null
          financial_contact_email: string | null
          financial_contact_name: string | null
          financial_contact_phone: string | null
          fuel_analysis_enabled: boolean | null
          fuel_analysis_price: number | null
          fuel_analysis_scope: string | null
          id: string
          implantado: boolean | null
          location_estado: string | null
          loyalty_type: string | null
          main_billing_cnpj: string | null
          max_stores: number | null
          monthly_fee: number | null
          name: string
          one_enabled: boolean
          permissions_enabled: boolean | null
          phone: string | null
          poc_days: number | null
          points_expiration_alert_days: number | null
          points_expiration_days: number | null
          referral_bonus_referred: number | null
          referral_bonus_referrer: number | null
          referral_bonus_type: string | null
          referral_enabled: boolean | null
          referral_max_uses: number
          renewal_12_months_multiplier: number | null
          renewal_6_months_multiplier: number | null
          renewal_9_months_multiplier: number | null
          reseller_id: string | null
          retention_cashback_multiplier_12_months: number | null
          retention_cashback_multiplier_6_months: number | null
          retention_cashback_multiplier_9_months: number | null
          retention_is_active: boolean | null
          retention_points_multiplier_12_months: number | null
          retention_points_multiplier_6_months: number | null
          retention_points_multiplier_9_months: number | null
          signup_bonus_validity_amount: number | null
          signup_bonus_validity_unit: string | null
          sms_marketing_limit: number | null
          sms_marketing_price: number | null
          sms_marketing_used: number | null
          status: Database["public"]["Enums"]["status"]
          support_whatsapp: string | null
          support_whatsapp_message: string | null
          technical_contact_email: string | null
          technical_contact_name: string | null
          technical_contact_phone: string | null
          total_licenses: number
          updated_at: string
          valor_implantacao: number | null
          whatsapp_marketing_limit: number | null
          whatsapp_marketing_price: number | null
          whatsapp_marketing_used: number | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          ai_credits_limit?: number | null
          ai_credits_price?: number | null
          ai_credits_used?: number | null
          billing_day?: number | null
          billing_type?: string | null
          birthday_bonus_validity_amount?: number | null
          birthday_bonus_validity_unit?: string | null
          cancellation_penalty_percentage?: number | null
          cnpj?: string | null
          cnpjs?: string[] | null
          commercial_contact_email?: string | null
          commercial_contact_name?: string | null
          commercial_contact_phone?: string | null
          contract_duration_months?: number | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_status?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          email_marketing_limit?: number | null
          email_marketing_price?: number | null
          email_marketing_used?: number | null
          financial_contact_email?: string | null
          financial_contact_name?: string | null
          financial_contact_phone?: string | null
          fuel_analysis_enabled?: boolean | null
          fuel_analysis_price?: number | null
          fuel_analysis_scope?: string | null
          id?: string
          implantado?: boolean | null
          location_estado?: string | null
          loyalty_type?: string | null
          main_billing_cnpj?: string | null
          max_stores?: number | null
          monthly_fee?: number | null
          name: string
          one_enabled?: boolean
          permissions_enabled?: boolean | null
          phone?: string | null
          poc_days?: number | null
          points_expiration_alert_days?: number | null
          points_expiration_days?: number | null
          referral_bonus_referred?: number | null
          referral_bonus_referrer?: number | null
          referral_bonus_type?: string | null
          referral_enabled?: boolean | null
          referral_max_uses?: number
          renewal_12_months_multiplier?: number | null
          renewal_6_months_multiplier?: number | null
          renewal_9_months_multiplier?: number | null
          reseller_id?: string | null
          retention_cashback_multiplier_12_months?: number | null
          retention_cashback_multiplier_6_months?: number | null
          retention_cashback_multiplier_9_months?: number | null
          retention_is_active?: boolean | null
          retention_points_multiplier_12_months?: number | null
          retention_points_multiplier_6_months?: number | null
          retention_points_multiplier_9_months?: number | null
          signup_bonus_validity_amount?: number | null
          signup_bonus_validity_unit?: string | null
          sms_marketing_limit?: number | null
          sms_marketing_price?: number | null
          sms_marketing_used?: number | null
          status?: Database["public"]["Enums"]["status"]
          support_whatsapp?: string | null
          support_whatsapp_message?: string | null
          technical_contact_email?: string | null
          technical_contact_name?: string | null
          technical_contact_phone?: string | null
          total_licenses?: number
          updated_at?: string
          valor_implantacao?: number | null
          whatsapp_marketing_limit?: number | null
          whatsapp_marketing_price?: number | null
          whatsapp_marketing_used?: number | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          ai_credits_limit?: number | null
          ai_credits_price?: number | null
          ai_credits_used?: number | null
          billing_day?: number | null
          billing_type?: string | null
          birthday_bonus_validity_amount?: number | null
          birthday_bonus_validity_unit?: string | null
          cancellation_penalty_percentage?: number | null
          cnpj?: string | null
          cnpjs?: string[] | null
          commercial_contact_email?: string | null
          commercial_contact_name?: string | null
          commercial_contact_phone?: string | null
          contract_duration_months?: number | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_status?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          email_marketing_limit?: number | null
          email_marketing_price?: number | null
          email_marketing_used?: number | null
          financial_contact_email?: string | null
          financial_contact_name?: string | null
          financial_contact_phone?: string | null
          fuel_analysis_enabled?: boolean | null
          fuel_analysis_price?: number | null
          fuel_analysis_scope?: string | null
          id?: string
          implantado?: boolean | null
          location_estado?: string | null
          loyalty_type?: string | null
          main_billing_cnpj?: string | null
          max_stores?: number | null
          monthly_fee?: number | null
          name?: string
          one_enabled?: boolean
          permissions_enabled?: boolean | null
          phone?: string | null
          poc_days?: number | null
          points_expiration_alert_days?: number | null
          points_expiration_days?: number | null
          referral_bonus_referred?: number | null
          referral_bonus_referrer?: number | null
          referral_bonus_type?: string | null
          referral_enabled?: boolean | null
          referral_max_uses?: number
          renewal_12_months_multiplier?: number | null
          renewal_6_months_multiplier?: number | null
          renewal_9_months_multiplier?: number | null
          reseller_id?: string | null
          retention_cashback_multiplier_12_months?: number | null
          retention_cashback_multiplier_6_months?: number | null
          retention_cashback_multiplier_9_months?: number | null
          retention_is_active?: boolean | null
          retention_points_multiplier_12_months?: number | null
          retention_points_multiplier_6_months?: number | null
          retention_points_multiplier_9_months?: number | null
          signup_bonus_validity_amount?: number | null
          signup_bonus_validity_unit?: string | null
          sms_marketing_limit?: number | null
          sms_marketing_price?: number | null
          sms_marketing_used?: number | null
          status?: Database["public"]["Enums"]["status"]
          support_whatsapp?: string | null
          support_whatsapp_message?: string | null
          technical_contact_email?: string | null
          technical_contact_name?: string | null
          technical_contact_phone?: string | null
          total_licenses?: number
          updated_at?: string
          valor_implantacao?: number | null
          whatsapp_marketing_limit?: number | null
          whatsapp_marketing_price?: number | null
          whatsapp_marketing_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "networks_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_auto_reply_rules: {
        Row: {
          auto_reply_message: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          network_id: string
          require_comment: boolean
          stars: number
          updated_at: string
        }
        Insert: {
          auto_reply_message: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          network_id: string
          require_comment?: boolean
          stars: number
          updated_at?: string
        }
        Update: {
          auto_reply_message?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          network_id?: string
          require_comment?: boolean
          stars?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_auto_reply_rules_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_rating_rewards_applied: {
        Row: {
          applied_at: string
          client_id: string
          id: string
          network_id: string
          rating_id: string
          reward_type: string
          reward_value: number
          transaction_id: string | null
        }
        Insert: {
          applied_at?: string
          client_id: string
          id?: string
          network_id: string
          rating_id: string
          reward_type: string
          reward_value: number
          transaction_id?: string | null
        }
        Update: {
          applied_at?: string
          client_id?: string
          id?: string
          network_id?: string
          rating_id?: string
          reward_type?: string
          reward_value?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nps_rating_rewards_applied_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_rating_rewards_applied_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_rating_rewards_applied_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: true
            referencedRelation: "transaction_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_rating_rewards_config: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          min_stars: number | null
          network_id: string
          reward_type: string
          reward_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          min_stars?: number | null
          network_id: string
          reward_type: string
          reward_value: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          min_stars?: number | null
          network_id?: string
          reward_type?: string
          reward_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_rating_rewards_config_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: true
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      one_card_numbers: {
        Row: {
          card_number: string
          client_id: string
          created_at: string
          id: string
          issued_at: string
          updated_at: string
        }
        Insert: {
          card_number: string
          client_id: string
          created_at?: string
          id?: string
          issued_at?: string
          updated_at?: string
        }
        Update: {
          card_number?: string
          client_id?: string
          created_at?: string
          id?: string
          issued_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_card_numbers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      one_operational_costs: {
        Row: {
          card_fee_percentage: number
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          other_costs_fixed_value: number | null
          other_costs_percentage: number
          other_costs_type: string | null
          tax_percentage: number
          updated_at: string
        }
        Insert: {
          card_fee_percentage?: number
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          other_costs_fixed_value?: number | null
          other_costs_percentage?: number
          other_costs_type?: string | null
          tax_percentage?: number
          updated_at?: string
        }
        Update: {
          card_fee_percentage?: number
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          other_costs_fixed_value?: number | null
          other_costs_percentage?: number
          other_costs_type?: string | null
          tax_percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      one_promotion_client_redemptions: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          period_end: string
          period_start: string
          promotion_id: string | null
          redemptions_count: number | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          period_end: string
          period_start: string
          promotion_id?: string | null
          redemptions_count?: number | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          promotion_id?: string | null
          redemptions_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "one_promotion_client_redemptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_promotion_client_redemptions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "one_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      one_promotion_products: {
        Row: {
          created_at: string | null
          discount_percentage: number | null
          discount_value: number | null
          id: string
          is_reward: boolean | null
          product_code: string
          product_name: string | null
          promotion_id: string | null
          quantity_required: number | null
        }
        Insert: {
          created_at?: string | null
          discount_percentage?: number | null
          discount_value?: number | null
          id?: string
          is_reward?: boolean | null
          product_code: string
          product_name?: string | null
          promotion_id?: string | null
          quantity_required?: number | null
        }
        Update: {
          created_at?: string | null
          discount_percentage?: number | null
          discount_value?: number | null
          id?: string
          is_reward?: boolean | null
          product_code?: string
          product_name?: string | null
          promotion_id?: string | null
          quantity_required?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "one_promotion_products_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "one_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      one_promotion_redemptions: {
        Row: {
          benefit_value: number | null
          client_id: string | null
          id: string
          metadata: Json | null
          promotion_id: string | null
          redeemed_at: string | null
          status: string | null
          store_id: string | null
        }
        Insert: {
          benefit_value?: number | null
          client_id?: string | null
          id?: string
          metadata?: Json | null
          promotion_id?: string | null
          redeemed_at?: string | null
          status?: string | null
          store_id?: string | null
        }
        Update: {
          benefit_value?: number | null
          client_id?: string | null
          id?: string
          metadata?: Json | null
          promotion_id?: string | null
          redeemed_at?: string | null
          status?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "one_promotion_redemptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_promotion_redemptions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "one_promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_promotion_redemptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      one_promotion_stores: {
        Row: {
          created_at: string | null
          id: string
          promotion_id: string | null
          store_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          promotion_id?: string | null
          store_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          promotion_id?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "one_promotion_stores_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "one_promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_promotion_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      one_promotions: {
        Row: {
          buy_quantity: number | null
          combo_price: number | null
          created_at: string | null
          current_redemptions: number | null
          description: string | null
          discount_percentage: number | null
          end_date: string
          end_time: string | null
          get_quantity: number | null
          id: string
          is_active: boolean | null
          location_type: string | null
          max_redemptions: number | null
          max_redemptions_per_client: number | null
          name: string
          network_id: string | null
          promotion_type: string
          redemption_period_months: number | null
          redemption_period_type: string | null
          rules: Json
          start_date: string
          start_time: string | null
          updated_at: string | null
        }
        Insert: {
          buy_quantity?: number | null
          combo_price?: number | null
          created_at?: string | null
          current_redemptions?: number | null
          description?: string | null
          discount_percentage?: number | null
          end_date: string
          end_time?: string | null
          get_quantity?: number | null
          id?: string
          is_active?: boolean | null
          location_type?: string | null
          max_redemptions?: number | null
          max_redemptions_per_client?: number | null
          name: string
          network_id?: string | null
          promotion_type: string
          redemption_period_months?: number | null
          redemption_period_type?: string | null
          rules: Json
          start_date: string
          start_time?: string | null
          updated_at?: string | null
        }
        Update: {
          buy_quantity?: number | null
          combo_price?: number | null
          created_at?: string | null
          current_redemptions?: number | null
          description?: string | null
          discount_percentage?: number | null
          end_date?: string
          end_time?: string | null
          get_quantity?: number | null
          id?: string
          is_active?: boolean | null
          location_type?: string | null
          max_redemptions?: number | null
          max_redemptions_per_client?: number | null
          name?: string
          network_id?: string | null
          promotion_type?: string
          redemption_period_months?: number | null
          redemption_period_type?: string | null
          rules?: Json
          start_date?: string
          start_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "one_promotions_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_network_transfers: {
        Row: {
          client_id: string
          created_at: string | null
          from_network_id: string
          id: string
          processed_at: string | null
          requested_at: string
          scheduled_for: string
          status: string
          to_network_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          from_network_id: string
          id?: string
          processed_at?: string | null
          requested_at?: string
          scheduled_for: string
          status?: string
          to_network_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          from_network_id?: string
          id?: string
          processed_at?: string | null
          requested_at?: string
          scheduled_for?: string
          status?: string
          to_network_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_network_transfers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_network_transfers_from_network_id_fkey"
            columns: ["from_network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_network_transfers_to_network_id_fkey"
            columns: ["to_network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      product_mappings: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          network_id: string
          normalized_product_code: string
          normalized_product_name: string
          original_product_code: string
          original_product_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          network_id: string
          normalized_product_code: string
          normalized_product_name: string
          original_product_code: string
          original_product_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          network_id?: string
          normalized_product_code?: string
          normalized_product_name?: string
          original_product_code?: string
          original_product_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_mappings_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      product_service_categories: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      products_services: {
        Row: {
          category_id: string | null
          code: string
          cost_value: number | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_recurring: boolean | null
          name: string
          sale_value: number
          type: string
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          code: string
          cost_value?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_recurring?: boolean | null
          name: string
          sale_value: number
          type: string
          unit_of_measure: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          code?: string
          cost_value?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_recurring?: boolean | null
          name?: string
          sale_value?: number
          type?: string
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_permissions: {
        Row: {
          created_at: string
          id: string
          menu_id: string
          permissions: Database["public"]["Enums"]["permission_type"][]
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_id: string
          permissions?: Database["public"]["Enums"]["permission_type"][]
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_id?: string
          permissions?: Database["public"]["Enums"]["permission_type"][]
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_permissions_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "system_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_profile_id: string | null
          cpf: string | null
          created_at: string
          email: string | null
          force_password_change: boolean
          full_name: string
          id: string
          is_budget_approver: boolean | null
          is_commercial: boolean | null
          is_seller: boolean | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          access_profile_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          force_password_change?: boolean
          full_name: string
          id: string
          is_budget_approver?: boolean | null
          is_commercial?: boolean | null
          is_seller?: boolean | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          access_profile_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          force_password_change?: boolean
          full_name?: string
          id?: string
          is_budget_approver?: boolean | null
          is_commercial?: boolean | null
          is_seller?: boolean | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_access_profile_id_fkey"
            columns: ["access_profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_checklist_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          project_id: string
          store_id: string | null
          template_id: string | null
          template_item_id: string | null
          updated_at: string | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          project_id: string
          store_id?: string | null
          template_id?: string | null
          template_item_id?: string | null
          updated_at?: string | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          store_id?: string | null
          template_id?: string | null
          template_item_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_checklist_progress_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_checklist_progress_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "project_checklist_template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      project_checklist_template_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          order_index: number
          template_id: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          order_index: number
          template_id?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          order_index?: number
          template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_checklist_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_meetings: {
        Row: {
          attendees: string[] | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_time: string | null
          id: string
          location: string | null
          meeting_date: string
          meeting_link: string | null
          meeting_type: string | null
          notes: string | null
          project_id: string
          start_time: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          attendees?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_date: string
          meeting_link?: string | null
          meeting_type?: string | null
          notes?: string | null
          project_id: string
          start_time: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          attendees?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          meeting_link?: string | null
          meeting_type?: string | null
          notes?: string | null
          project_id?: string
          start_time?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          notes: string | null
          priority: string | null
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          notes?: string | null
          priority?: string | null
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget_value: number
          created_at: string
          created_by: string | null
          deadline: string
          description: string | null
          id: string
          name: string
          network_id: string | null
          progress: number
          project_number: string | null
          start_date: string
          status: string
          updated_at: string
          view_preference: string | null
        }
        Insert: {
          budget_value?: number
          created_at?: string
          created_by?: string | null
          deadline: string
          description?: string | null
          id?: string
          name: string
          network_id?: string | null
          progress?: number
          project_number?: string | null
          start_date: string
          status?: string
          updated_at?: string
          view_preference?: string | null
        }
        Update: {
          budget_value?: number
          created_at?: string
          created_by?: string | null
          deadline?: string
          description?: string | null
          id?: string
          name?: string
          network_id?: string | null
          progress?: number
          project_number?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          view_preference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          client_id: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          last_used_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          client_id: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          client_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_commission_rules: {
        Row: {
          after_three_months_percentage: number
          created_at: string
          end_date: string | null
          first_three_months_percentage: number
          id: string
          is_active: boolean
          rule_name: string
          start_date: string
          updated_at: string
        }
        Insert: {
          after_three_months_percentage?: number
          created_at?: string
          end_date?: string | null
          first_three_months_percentage?: number
          id?: string
          is_active?: boolean
          rule_name: string
          start_date: string
          updated_at?: string
        }
        Update: {
          after_three_months_percentage?: number
          created_at?: string
          end_date?: string | null
          first_three_months_percentage?: number
          id?: string
          is_active?: boolean
          rule_name?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      reseller_commissions: {
        Row: {
          client_id: string
          commission_amount: number
          commission_month: string
          commission_percentage: number
          created_at: string
          id: string
          monthly_fee: number
          network_id: string
          paid_at: string | null
          reseller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          commission_amount: number
          commission_month: string
          commission_percentage: number
          created_at?: string
          id?: string
          monthly_fee: number
          network_id: string
          paid_at?: string | null
          reseller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          commission_amount?: number
          commission_month?: string
          commission_percentage?: number
          created_at?: string
          id?: string
          monthly_fee?: number
          network_id?: string
          paid_at?: string | null
          reseller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_commissions_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_commissions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          cnpj: string
          company_name: string
          created_at: string
          email: string
          financial_contact_email: string | null
          financial_contact_name: string | null
          financial_contact_phone: string | null
          id: string
          is_active: boolean
          owner_name: string
          phone: string
          razao_social: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          cnpj: string
          company_name: string
          created_at?: string
          email: string
          financial_contact_email?: string | null
          financial_contact_name?: string | null
          financial_contact_phone?: string | null
          id?: string
          is_active?: boolean
          owner_name: string
          phone: string
          razao_social: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          cnpj?: string
          company_name?: string
          created_at?: string
          email?: string
          financial_contact_email?: string | null
          financial_contact_name?: string | null
          financial_contact_phone?: string | null
          id?: string
          is_active?: boolean
          owner_name?: string
          phone?: string
          razao_social?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          phone: string
          provider: string
          raw_request: Json | null
          raw_response: string | null
          sent_by: string | null
          sms_code: string | null
          status: string | null
          success: boolean | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          phone: string
          provider?: string
          raw_request?: Json | null
          raw_response?: string | null
          sent_by?: string | null
          sms_code?: string | null
          status?: string | null
          success?: boolean | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          phone?: string
          provider?: string
          raw_request?: Json | null
          raw_response?: string | null
          sent_by?: string | null
          sms_code?: string | null
          status?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      store_access_profiles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          network_id: string
          permissions: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          network_id: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          network_id?: string
          permissions?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_access_profiles_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      store_manager_tags: {
        Row: {
          created_at: string | null
          id: string
          store_manager_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          store_manager_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          store_manager_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_manager_tags_store_manager_id_fkey"
            columns: ["store_manager_id"]
            isOneToOne: false
            referencedRelation: "store_managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_manager_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "user_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      store_managers: {
        Row: {
          access_profile_id: string | null
          attendant_code: string | null
          codigo_funcionario_pdv: string | null
          created_at: string
          deactivated_at: string | null
          deactivated_by: string | null
          id: string
          is_active: boolean
          is_attendant: boolean | null
          must_change_password: boolean | null
          network_id: string
          store_id: string | null
          tutorial_completed: boolean | null
          user_id: string
          user_reference_code: string | null
        }
        Insert: {
          access_profile_id?: string | null
          attendant_code?: string | null
          codigo_funcionario_pdv?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          id?: string
          is_active?: boolean
          is_attendant?: boolean | null
          must_change_password?: boolean | null
          network_id: string
          store_id?: string | null
          tutorial_completed?: boolean | null
          user_id: string
          user_reference_code?: string | null
        }
        Update: {
          access_profile_id?: string | null
          attendant_code?: string | null
          codigo_funcionario_pdv?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          id?: string
          is_active?: boolean
          is_attendant?: boolean | null
          must_change_password?: boolean | null
          network_id?: string
          store_id?: string | null
          tutorial_completed?: boolean | null
          user_id?: string
          user_reference_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_managers_access_profile_id_fkey"
            columns: ["access_profile_id"]
            isOneToOne: false
            referencedRelation: "store_access_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_managers_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_managers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_pdv_references: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_physical_pdv: boolean
          network_id: string
          pdv_reference_code: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_physical_pdv?: boolean
          network_id: string
          pdv_reference_code: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_physical_pdv?: boolean
          network_id?: string
          pdv_reference_code?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_pdv_references_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_pdv_references_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_product_cost_history: {
        Row: {
          average_cost: number | null
          created_at: string | null
          id: string
          new_cost: number
          previous_cost: number | null
          product_id: string
          quantity_purchased: number | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          average_cost?: number | null
          created_at?: string | null
          id?: string
          new_cost: number
          previous_cost?: number | null
          product_id: string
          quantity_purchased?: number | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          average_cost?: number | null
          created_at?: string | null
          id?: string
          new_cost?: number
          previous_cost?: number | null
          product_id?: string
          quantity_purchased?: number | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_cost_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_product_stock_movements: {
        Row: {
          created_at: string | null
          id: string
          movement_type: string
          new_stock: number
          observation: string | null
          previous_stock: number
          product_id: string
          quantity: number
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          movement_type: string
          new_stock: number
          observation?: string | null
          previous_stock: number
          product_id: string
          quantity: number
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          movement_type?: string
          new_stock?: number
          observation?: string | null
          previous_stock?: number
          product_id?: string
          quantity?: number
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_products: {
        Row: {
          barcode: string | null
          cashback_value: number | null
          cost: number | null
          created_at: string | null
          id: string
          internal_code: string
          is_active: boolean | null
          is_redemption_product: boolean | null
          min_stock: number | null
          name: string
          network_id: string
          points_value: number | null
          price: number
          stock: number | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          cashback_value?: number | null
          cost?: number | null
          created_at?: string | null
          id?: string
          internal_code: string
          is_active?: boolean | null
          is_redemption_product?: boolean | null
          min_stock?: number | null
          name: string
          network_id: string
          points_value?: number | null
          price: number
          stock?: number | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          cashback_value?: number | null
          cost?: number | null
          created_at?: string | null
          id?: string
          internal_code?: string
          is_active?: boolean | null
          is_redemption_product?: boolean | null
          min_stock?: number | null
          name?: string
          network_id?: string
          points_value?: number | null
          price?: number
          stock?: number | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_products_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          birthday_bonus_cashback: number | null
          birthday_bonus_points: number | null
          block_accumulation_cashback_limit: number | null
          block_accumulation_duration_amount: number | null
          block_accumulation_duration_unit: string | null
          block_accumulation_period_quantity: number | null
          block_accumulation_points_duration_amount: number | null
          block_accumulation_points_duration_unit: string | null
          block_accumulation_points_limit: number | null
          block_accumulation_points_period_quantity: number | null
          cashback_fixed_value: number | null
          cashback_percentage: number | null
          cashback_type: string | null
          cnpj: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          enable_cashback_accumulation_block: boolean | null
          enable_points_accumulation_block: boolean | null
          exclude_fuel_from_loyalty: boolean
          flag: string | null
          fuel_display_name: string | null
          id: string
          is_manual_mode: boolean | null
          loyalty_type: Database["public"]["Enums"]["loyalty_type"]
          max_redeem_cashback: number | null
          max_redeem_points: number | null
          max_redemption_sale_percentage: number | null
          max_redemptions_24h: number
          min_redeem_cashback: number | null
          min_redeem_points: number | null
          name: string
          network_id: string
          nome_fantasia: string | null
          points_per_real: number | null
          points_validity_days: number | null
          razao_social: string | null
          real_per_point: number | null
          redemption_accumulation_type: Database["public"]["Enums"]["redemption_accumulation_type"]
          redemption_time_delay_enabled: boolean | null
          redemption_time_delay_unit: string | null
          redemption_time_delay_value: number | null
          services: string[] | null
          signup_bonus_cashback: number | null
          signup_bonus_points: number | null
          status: Database["public"]["Enums"]["status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          birthday_bonus_cashback?: number | null
          birthday_bonus_points?: number | null
          block_accumulation_cashback_limit?: number | null
          block_accumulation_duration_amount?: number | null
          block_accumulation_duration_unit?: string | null
          block_accumulation_period_quantity?: number | null
          block_accumulation_points_duration_amount?: number | null
          block_accumulation_points_duration_unit?: string | null
          block_accumulation_points_limit?: number | null
          block_accumulation_points_period_quantity?: number | null
          cashback_fixed_value?: number | null
          cashback_percentage?: number | null
          cashback_type?: string | null
          cnpj: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          enable_cashback_accumulation_block?: boolean | null
          enable_points_accumulation_block?: boolean | null
          exclude_fuel_from_loyalty?: boolean
          flag?: string | null
          fuel_display_name?: string | null
          id?: string
          is_manual_mode?: boolean | null
          loyalty_type?: Database["public"]["Enums"]["loyalty_type"]
          max_redeem_cashback?: number | null
          max_redeem_points?: number | null
          max_redemption_sale_percentage?: number | null
          max_redemptions_24h?: number
          min_redeem_cashback?: number | null
          min_redeem_points?: number | null
          name: string
          network_id: string
          nome_fantasia?: string | null
          points_per_real?: number | null
          points_validity_days?: number | null
          razao_social?: string | null
          real_per_point?: number | null
          redemption_accumulation_type?: Database["public"]["Enums"]["redemption_accumulation_type"]
          redemption_time_delay_enabled?: boolean | null
          redemption_time_delay_unit?: string | null
          redemption_time_delay_value?: number | null
          services?: string[] | null
          signup_bonus_cashback?: number | null
          signup_bonus_points?: number | null
          status?: Database["public"]["Enums"]["status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          birthday_bonus_cashback?: number | null
          birthday_bonus_points?: number | null
          block_accumulation_cashback_limit?: number | null
          block_accumulation_duration_amount?: number | null
          block_accumulation_duration_unit?: string | null
          block_accumulation_period_quantity?: number | null
          block_accumulation_points_duration_amount?: number | null
          block_accumulation_points_duration_unit?: string | null
          block_accumulation_points_limit?: number | null
          block_accumulation_points_period_quantity?: number | null
          cashback_fixed_value?: number | null
          cashback_percentage?: number | null
          cashback_type?: string | null
          cnpj?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          enable_cashback_accumulation_block?: boolean | null
          enable_points_accumulation_block?: boolean | null
          exclude_fuel_from_loyalty?: boolean
          flag?: string | null
          fuel_display_name?: string | null
          id?: string
          is_manual_mode?: boolean | null
          loyalty_type?: Database["public"]["Enums"]["loyalty_type"]
          max_redeem_cashback?: number | null
          max_redeem_points?: number | null
          max_redemption_sale_percentage?: number | null
          max_redemptions_24h?: number
          min_redeem_cashback?: number | null
          min_redeem_points?: number | null
          name?: string
          network_id?: string
          nome_fantasia?: string | null
          points_per_real?: number | null
          points_validity_days?: number | null
          razao_social?: string | null
          real_per_point?: number | null
          redemption_accumulation_type?: Database["public"]["Enums"]["redemption_accumulation_type"]
          redemption_time_delay_enabled?: boolean | null
          redemption_time_delay_unit?: string | null
          redemption_time_delay_value?: number | null
          services?: string[] | null
          signup_bonus_cashback?: number | null
          signup_bonus_points?: number | null
          status?: Database["public"]["Enums"]["status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          attachments: string[] | null
          created_at: string
          created_by_user_id: string | null
          description: string
          id: string
          network_id: string | null
          priority: string
          requester_email: string
          requester_name: string
          requester_phone: string | null
          source: string
          status: string
          ticket_number: string
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: string[] | null
          created_at?: string
          created_by_user_id?: string | null
          description: string
          id?: string
          network_id?: string | null
          priority: string
          requester_email: string
          requester_name: string
          requester_phone?: string | null
          source: string
          status?: string
          ticket_number: string
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: string[] | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          id?: string
          network_id?: string | null
          priority?: string
          requester_email?: string
          requester_name?: string
          requester_phone?: string | null
          source?: string
          status?: string
          ticket_number?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      system_menus: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          route: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          route?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          route?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "system_menus_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "system_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_ratings: {
        Row: {
          client_id: string
          comment: string | null
          created_at: string
          id: string
          network_id: string
          rating: number
          replied_by: string | null
          reply_at: string | null
          store_id: string
          store_reply: string | null
          transaction_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          network_id: string
          rating: number
          replied_by?: string | null
          reply_at?: string | null
          store_id: string
          store_reply?: string | null
          transaction_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          network_id?: string
          rating?: number
          replied_by?: string | null
          reply_at?: string | null
          store_id?: string
          store_reply?: string | null
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_ratings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_ratings_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_ratings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_ratings_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          client_id: string
          codigo_colaborador: string | null
          codigo_produto: string | null
          created_at: string
          description: string | null
          id: string
          is_manual_entry: boolean | null
          is_one_promotion: boolean | null
          nfce_access_key: string | null
          nfce_cnpj: string | null
          nfce_emitter_name: string | null
          nome_colaborador: string | null
          one_promotion_id: string | null
          points: number
          store_id: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          client_id: string
          codigo_colaborador?: string | null
          codigo_produto?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_manual_entry?: boolean | null
          is_one_promotion?: boolean | null
          nfce_access_key?: string | null
          nfce_cnpj?: string | null
          nfce_emitter_name?: string | null
          nome_colaborador?: string | null
          one_promotion_id?: string | null
          points: number
          store_id: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          client_id?: string
          codigo_colaborador?: string | null
          codigo_produto?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_manual_entry?: boolean | null
          is_one_promotion?: boolean | null
          nfce_access_key?: string | null
          nfce_cnpj?: string | null
          nfce_emitter_name?: string | null
          nome_colaborador?: string | null
          one_promotion_id?: string | null
          points?: number
          store_id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_one_promotion_id_fkey"
            columns: ["one_promotion_id"]
            isOneToOne: false
            referencedRelation: "one_promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      upgrade_plans: {
        Row: {
          benefits: Json | null
          billing_cycle: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          highlight_badge: string | null
          id: string
          is_active: boolean | null
          monthly_value: number
          name: string
          plan_type: string
          quantity: number
          updated_at: string | null
        }
        Insert: {
          benefits?: Json | null
          billing_cycle?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          highlight_badge?: string | null
          id?: string
          is_active?: boolean | null
          monthly_value: number
          name: string
          plan_type: string
          quantity?: number
          updated_at?: string | null
        }
        Update: {
          benefits?: Json | null
          billing_cycle?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          highlight_badge?: string | null
          id?: string
          is_active?: boolean | null
          monthly_value?: number
          name?: string
          plan_type?: string
          quantity?: number
          updated_at?: string | null
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
      user_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          network_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          network_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          network_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_tags_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      vapid_keys: {
        Row: {
          created_at: string | null
          id: string
          private_key: string
          public_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          private_key: string
          public_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          private_key?: string
          public_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      webposto_transactions: {
        Row: {
          client_id: string | null
          codigo_colaborador: string | null
          codigo_empresa: string
          codigo_venda: string
          codigo_voucher: string
          created_at: string
          data_venda: string
          id: string
          id_transacao: string
          metadata: Json | null
          network_id: string
          nome_colaborador: string | null
          pagamentos: Json | null
          produtos: Json
          status: string
          store_id: string
          tipo_codigo: string
          updated_at: string
          valor_cashback: number | null
          valor_desconto_unitario: number | null
          valor_venda: number | null
        }
        Insert: {
          client_id?: string | null
          codigo_colaborador?: string | null
          codigo_empresa: string
          codigo_venda: string
          codigo_voucher: string
          created_at?: string
          data_venda: string
          id?: string
          id_transacao: string
          metadata?: Json | null
          network_id: string
          nome_colaborador?: string | null
          pagamentos?: Json | null
          produtos: Json
          status?: string
          store_id: string
          tipo_codigo: string
          updated_at?: string
          valor_cashback?: number | null
          valor_desconto_unitario?: number | null
          valor_venda?: number | null
        }
        Update: {
          client_id?: string | null
          codigo_colaborador?: string | null
          codigo_empresa?: string
          codigo_venda?: string
          codigo_voucher?: string
          created_at?: string
          data_venda?: string
          id?: string
          id_transacao?: string
          metadata?: Json | null
          network_id?: string
          nome_colaborador?: string | null
          pagamentos?: Json | null
          produtos?: Json
          status?: string
          store_id?: string
          tipo_codigo?: string
          updated_at?: string
          valor_cashback?: number | null
          valor_desconto_unitario?: number | null
          valor_venda?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webposto_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webposto_transactions_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webposto_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_history: {
        Row: {
          body_text: string | null
          client_id: string | null
          created_at: string | null
          direction: string
          id: string
          media_url: string | null
          message_type: string
          metadata: Json | null
          network_id: string
          phone: string
          timestamp: string | null
          wa_id: string
          wamid: string | null
        }
        Insert: {
          body_text?: string | null
          client_id?: string | null
          created_at?: string | null
          direction: string
          id?: string
          media_url?: string | null
          message_type: string
          metadata?: Json | null
          network_id: string
          phone: string
          timestamp?: string | null
          wa_id: string
          wamid?: string | null
        }
        Update: {
          body_text?: string | null
          client_id?: string | null
          created_at?: string | null
          direction?: string
          id?: string
          media_url?: string | null
          message_type?: string
          metadata?: Json | null
          network_id?: string
          phone?: string
          timestamp?: string | null
          wa_id?: string
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_history_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_queue: {
        Row: {
          campaign_id: string | null
          client_id: string | null
          conversation_window_checked: boolean | null
          cost: number | null
          created_at: string | null
          error_message: string | null
          failed_at: string | null
          has_active_window: boolean | null
          id: string
          is_promotional: boolean | null
          max_retries: number | null
          media_type: string | null
          media_url: string | null
          message_text: string | null
          message_type: string
          metadata: Json | null
          network_id: string
          original_message_text: string | null
          phone: string
          priority: number | null
          retry_count: number | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          store_id: string | null
          template_id: string | null
          template_name: string | null
          template_params: Json | null
          template_sent_at: string | null
          updated_at: string | null
          waiting_for_template_reply: boolean | null
          wamid: string | null
        }
        Insert: {
          campaign_id?: string | null
          client_id?: string | null
          conversation_window_checked?: boolean | null
          cost?: number | null
          created_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          has_active_window?: boolean | null
          id?: string
          is_promotional?: boolean | null
          max_retries?: number | null
          media_type?: string | null
          media_url?: string | null
          message_text?: string | null
          message_type: string
          metadata?: Json | null
          network_id: string
          original_message_text?: string | null
          phone: string
          priority?: number | null
          retry_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          store_id?: string | null
          template_id?: string | null
          template_name?: string | null
          template_params?: Json | null
          template_sent_at?: string | null
          updated_at?: string | null
          waiting_for_template_reply?: boolean | null
          wamid?: string | null
        }
        Update: {
          campaign_id?: string | null
          client_id?: string | null
          conversation_window_checked?: boolean | null
          cost?: number | null
          created_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          has_active_window?: boolean | null
          id?: string
          is_promotional?: boolean | null
          max_retries?: number | null
          media_type?: string | null
          media_url?: string | null
          message_text?: string | null
          message_type?: string
          metadata?: Json | null
          network_id?: string
          original_message_text?: string | null
          phone?: string
          priority?: number | null
          retry_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          store_id?: string | null
          template_id?: string | null
          template_name?: string | null
          template_params?: Json | null
          template_sent_at?: string | null
          updated_at?: string | null
          waiting_for_template_reply?: boolean | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_queue_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_queue_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_network_settings: {
        Row: {
          auto_send_template: boolean | null
          created_at: string | null
          default_template_language: string | null
          default_template_name: string | null
          department_id: string | null
          id: string
          network_id: string
          updated_at: string | null
        }
        Insert: {
          auto_send_template?: boolean | null
          created_at?: string | null
          default_template_language?: string | null
          default_template_name?: string | null
          department_id?: string | null
          id?: string
          network_id: string
          updated_at?: string | null
        }
        Update: {
          auto_send_template?: boolean | null
          created_at?: string | null
          default_template_language?: string | null
          default_template_name?: string | null
          department_id?: string | null
          id?: string
          network_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_network_settings_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: true
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_rate_limits: {
        Row: {
          created_at: string | null
          id: string
          max_messages_per_day: number | null
          max_messages_per_hour: number | null
          max_messages_per_minute: number | null
          messages_sent: number | null
          network_id: string
          updated_at: string | null
          window_start: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_messages_per_day?: number | null
          max_messages_per_hour?: number | null
          max_messages_per_minute?: number | null
          messages_sent?: number | null
          network_id: string
          updated_at?: string | null
          window_start: string
        }
        Update: {
          created_at?: string | null
          id?: string
          max_messages_per_day?: number | null
          max_messages_per_hour?: number | null
          max_messages_per_minute?: number | null
          messages_sent?: number | null
          network_id?: string
          updated_at?: string | null
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_rate_limits_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_send_logs: {
        Row: {
          api_response: Json | null
          body_text: string | null
          cost: number | null
          created_at: string | null
          direction: string
          error_details: string | null
          id: string
          message_type: string
          network_id: string
          phone: string
          queue_id: string | null
          status: string
          template_name: string | null
          wamid: string | null
        }
        Insert: {
          api_response?: Json | null
          body_text?: string | null
          cost?: number | null
          created_at?: string | null
          direction: string
          error_details?: string | null
          id?: string
          message_type: string
          network_id: string
          phone: string
          queue_id?: string | null
          status: string
          template_name?: string | null
          wamid?: string | null
        }
        Update: {
          api_response?: Json | null
          body_text?: string | null
          cost?: number | null
          created_at?: string | null
          direction?: string
          error_details?: string | null
          id?: string
          message_type?: string
          network_id?: string
          phone?: string
          queue_id?: string | null
          status?: string
          template_name?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_send_logs_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_send_logs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_message_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body_text: string
          buttons: Json | null
          created_at: string | null
          footer_text: string | null
          header_type: string | null
          id: string
          is_active: boolean | null
          language: string
          network_id: string
          parameters_count: number | null
          status: string
          template_category: string
          template_name: string
          updated_at: string | null
        }
        Insert: {
          body_text: string
          buttons?: Json | null
          created_at?: string | null
          footer_text?: string | null
          header_type?: string | null
          id?: string
          is_active?: boolean | null
          language?: string
          network_id: string
          parameters_count?: number | null
          status?: string
          template_category: string
          template_name: string
          updated_at?: string | null
        }
        Update: {
          body_text?: string
          buttons?: Json | null
          created_at?: string | null
          footer_text?: string | null
          header_type?: string | null
          id?: string
          is_active?: boolean | null
          language?: string
          network_id?: string
          parameters_count?: number | null
          status?: string
          template_category?: string
          template_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "networks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fuel_prices_analysis: {
        Row: {
          bairro: string | null
          bandeira: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string | null
          data_coleta: string | null
          endereco: string | null
          estado: string | null
          id: string | null
          import_id: string | null
          municipio: string | null
          nome_fantasia: string | null
          numero: string | null
          preco_revenda: number | null
          produto: string | null
          razao_social: string | null
          unidade_medida: string | null
          updated_at: string | null
        }
        Insert: {
          bairro?: string | null
          bandeira?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string | null
          data_coleta?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string | null
          import_id?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          preco_revenda?: number | null
          produto?: string | null
          razao_social?: string | null
          unidade_medida?: string | null
          updated_at?: string | null
        }
        Update: {
          bairro?: string | null
          bandeira?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string | null
          data_coleta?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string | null
          import_id?: string | null
          municipio?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          preco_revenda?: number | null
          produto?: string | null
          razao_social?: string | null
          unidade_medida?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_prices_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "fuel_price_imports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_change_favorite_network: {
        Args: { client_uuid: string }
        Returns: boolean
      }
      cleanup_expired_adjustment_codes: { Args: never; Returns: undefined }
      cleanup_expired_cache: { Args: never; Returns: undefined }
      cleanup_expired_login_codes: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      client_can_view_notification: {
        Args: { _notification_id: string }
        Returns: boolean
      }
      create_client_notification: {
        Args: {
          p_client_id: string
          p_created_by?: string
          p_message: string
          p_network_id: string
          p_title: string
        }
        Returns: string
      }
      generate_api_key: {
        Args: { key_type_param?: string; network_uuid: string }
        Returns: string
      }
      generate_approval_token: { Args: never; Returns: string }
      generate_attendant_code: {
        Args: { p_network_id: string }
        Returns: string
      }
      generate_budget_number: { Args: never; Returns: string }
      generate_product_service_code: {
        Args: { item_type: string }
        Returns: string
      }
      generate_project_number: { Args: never; Returns: string }
      get_cache: { Args: { key: string }; Returns: Json }
      get_client_active_retention_multiplier: {
        Args: { client_uuid: string; network_uuid: string }
        Returns: number
      }
      get_client_full_access_networks: {
        Args: { client_uuid: string }
        Returns: {
          network_uuid: string
        }[]
      }
      get_client_referral_count: {
        Args: { client_uuid: string }
        Returns: number
      }
      get_commitment_expiration_date: {
        Args: { client_uuid: string }
        Returns: string
      }
      get_user_network_id: { Args: { _user_id: string }; Returns: string }
      has_active_conversation_window: {
        Args: { p_network_id: string; p_phone: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_whatsapp_rate_limit: {
        Args: { p_network_id: string; p_window_start: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_budget_approver: { Args: { _user_id: string }; Returns: boolean }
      is_reseller_for_email: { Args: { _email: string }; Returns: boolean }
      normalize_product_name: {
        Args: { product_name: string }
        Returns: string
      }
      set_cache: {
        Args: { key: string; ttl_seconds?: number; value: Json }
        Returns: undefined
      }
    }
    Enums: {
      anomaly_severity: "low" | "medium" | "high" | "critical"
      anomaly_status:
        | "pending"
        | "investigating"
        | "resolved"
        | "false_positive"
        | "blocked"
      anomaly_type:
        | "frequency_spike"
        | "unusual_amount"
        | "velocity_pattern"
        | "time_pattern"
        | "geographic_anomaly"
        | "redemption_pattern"
        | "multiple_stores"
        | "suspicious_behavior"
      app_role: "admin" | "store_manager" | "client" | "network_manager"
      loyalty_type: "points" | "cashback"
      permission_type: "read" | "create" | "update" | "delete" | "export"
      redemption_accumulation_type: "none" | "full" | "difference"
      status: "active" | "inactive" | "suspended" | "negotiation"
      transaction_type: "accumulation" | "redemption"
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
      anomaly_severity: ["low", "medium", "high", "critical"],
      anomaly_status: [
        "pending",
        "investigating",
        "resolved",
        "false_positive",
        "blocked",
      ],
      anomaly_type: [
        "frequency_spike",
        "unusual_amount",
        "velocity_pattern",
        "time_pattern",
        "geographic_anomaly",
        "redemption_pattern",
        "multiple_stores",
        "suspicious_behavior",
      ],
      app_role: ["admin", "store_manager", "client", "network_manager"],
      loyalty_type: ["points", "cashback"],
      permission_type: ["read", "create", "update", "delete", "export"],
      redemption_accumulation_type: ["none", "full", "difference"],
      status: ["active", "inactive", "suspended", "negotiation"],
      transaction_type: ["accumulation", "redemption"],
    },
  },
} as const
