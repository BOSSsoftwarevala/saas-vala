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
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      ai_costs: {
        Row: {
          billed: boolean | null
          billed_at: string | null
          cost: number | null
          created_at: string | null
          currency: string | null
          id: string
          input_tokens: number | null
          model_id: string | null
          output_tokens: number | null
          request_id: string | null
          user_id: string
        }
        Insert: {
          billed?: boolean | null
          billed_at?: string | null
          cost?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          input_tokens?: number | null
          model_id?: string | null
          output_tokens?: number | null
          request_id?: string | null
          user_id: string
        }
        Update: {
          billed?: boolean | null
          billed_at?: string | null
          cost?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          input_tokens?: number | null
          model_id?: string | null
          output_tokens?: number | null
          request_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_costs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_costs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ai_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_errors: {
        Row: {
          context: Json | null
          created_at: string | null
          error_code: string | null
          error_message: string
          error_type: string | null
          id: string
          model_id: string | null
          request_id: string | null
          resolved: boolean | null
          resolved_at: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          error_code?: string | null
          error_message: string
          error_type?: string | null
          id?: string
          model_id?: string | null
          request_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string
          error_type?: string | null
          id?: string
          model_id?: string | null
          request_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_models: {
        Row: {
          capabilities: Json | null
          created_at: string | null
          description: string | null
          id: string
          input_cost_per_1k: number | null
          is_active: boolean | null
          is_default: boolean | null
          max_tokens: number | null
          model_id: string
          name: string
          output_cost_per_1k: number | null
          provider: string
          updated_at: string | null
        }
        Insert: {
          capabilities?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          input_cost_per_1k?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          max_tokens?: number | null
          model_id: string
          name: string
          output_cost_per_1k?: number | null
          provider: string
          updated_at?: string | null
        }
        Update: {
          capabilities?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          input_cost_per_1k?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          max_tokens?: number | null
          model_id?: string
          name?: string
          output_cost_per_1k?: number | null
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_quotas: {
        Row: {
          created_at: string | null
          daily_limit: number | null
          daily_used: number | null
          id: string
          last_reset_daily: string | null
          last_reset_monthly: string | null
          monthly_limit: number | null
          monthly_used: number | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_limit?: number | null
          daily_used?: number | null
          id?: string
          last_reset_daily?: string | null
          last_reset_monthly?: string | null
          monthly_limit?: number | null
          monthly_used?: number | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_limit?: number | null
          daily_used?: number | null
          id?: string
          last_reset_daily?: string | null
          last_reset_monthly?: string | null
          monthly_limit?: number | null
          monthly_used?: number | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_requests: {
        Row: {
          created_at: string | null
          id: string
          model: string
          prompt: string
          prompt_tokens: number | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          model: string
          prompt: string
          prompt_tokens?: number | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          model?: string
          prompt?: string
          prompt_tokens?: number | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_responses: {
        Row: {
          completion_tokens: number | null
          created_at: string | null
          error_message: string | null
          id: string
          latency_ms: number | null
          request_id: string
          response: string | null
          status: string | null
          total_tokens: number | null
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          request_id: string
          response?: string | null
          status?: string | null
          total_tokens?: number | null
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          request_id?: string
          response?: string | null
          status?: string | null
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "ai_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          cost: number | null
          created_at: string | null
          endpoint: string | null
          id: string
          model: string
          product_id: string | null
          session_id: string | null
          tokens_input: number | null
          tokens_output: number | null
          user_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          endpoint?: string | null
          id?: string
          model: string
          product_id?: string | null
          session_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          endpoint?: string | null
          id?: string
          model?: string
          product_id?: string | null
          session_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      apk_downloads: {
        Row: {
          blocked_reason: string | null
          created_at: string
          device_info: Json | null
          download_ip: string | null
          id: string
          is_blocked: boolean | null
          is_verified: boolean | null
          license_key: string
          product_id: string
          transaction_id: string | null
          user_id: string
          verification_attempts: number | null
        }
        Insert: {
          blocked_reason?: string | null
          created_at?: string
          device_info?: Json | null
          download_ip?: string | null
          id?: string
          is_blocked?: boolean | null
          is_verified?: boolean | null
          license_key: string
          product_id: string
          transaction_id?: string | null
          user_id: string
          verification_attempts?: number | null
        }
        Update: {
          blocked_reason?: string | null
          created_at?: string
          device_info?: Json | null
          download_ip?: string | null
          id?: string
          is_blocked?: boolean | null
          is_verified?: boolean | null
          license_key?: string
          product_id?: string
          transaction_id?: string | null
          user_id?: string
          verification_attempts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "apk_downloads_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      apk_versions: {
        Row: {
          apk_id: string
          checksum: string | null
          created_at: string | null
          created_by: string | null
          file_path: string | null
          file_size: number | null
          id: string
          is_stable: boolean | null
          release_notes: string | null
          version_code: number
          version_name: string
        }
        Insert: {
          apk_id: string
          checksum?: string | null
          created_at?: string | null
          created_by?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_stable?: boolean | null
          release_notes?: string | null
          version_code: number
          version_name: string
        }
        Update: {
          apk_id?: string
          checksum?: string | null
          created_at?: string | null
          created_by?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          is_stable?: boolean | null
          release_notes?: string | null
          version_code?: number
          version_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "apk_versions_apk_id_fkey"
            columns: ["apk_id"]
            isOneToOne: false
            referencedRelation: "apks"
            referencedColumns: ["id"]
          },
        ]
      }
      apks: {
        Row: {
          architecture: string | null
          changelog: string | null
          created_at: string | null
          created_by: string | null
          current_version_id: string | null
          download_count: number | null
          file_size: number | null
          file_url: string | null
          id: string
          min_sdk: number | null
          product_id: string
          status: Database["public"]["Enums"]["apk_status"] | null
          target_sdk: number | null
          updated_at: string | null
          version: string
        }
        Insert: {
          architecture?: string | null
          changelog?: string | null
          created_at?: string | null
          created_by?: string | null
          current_version_id?: string | null
          download_count?: number | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          min_sdk?: number | null
          product_id: string
          status?: Database["public"]["Enums"]["apk_status"] | null
          target_sdk?: number | null
          updated_at?: string | null
          version: string
        }
        Update: {
          architecture?: string | null
          changelog?: string | null
          created_at?: string | null
          created_by?: string | null
          current_version_id?: string | null
          download_count?: number | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          min_sdk?: number | null
          product_id?: string
          status?: Database["public"]["Enums"]["apk_status"] | null
          target_sdk?: number | null
          updated_at?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "apks_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "apk_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auto_software_queue: {
        Row: {
          ai_generated_description: string | null
          ai_generated_meta: Json | null
          apk_url: string | null
          build_logs: string | null
          created_at: string
          features: Json
          id: string
          marketplace_id: string | null
          published_at: string | null
          scheduled_date: string | null
          software_name: string
          software_type: string
          status: string | null
          target_industry: string
          tech_stack: Json | null
        }
        Insert: {
          ai_generated_description?: string | null
          ai_generated_meta?: Json | null
          apk_url?: string | null
          build_logs?: string | null
          created_at?: string
          features?: Json
          id?: string
          marketplace_id?: string | null
          published_at?: string | null
          scheduled_date?: string | null
          software_name: string
          software_type: string
          status?: string | null
          target_industry: string
          tech_stack?: Json | null
        }
        Update: {
          ai_generated_description?: string | null
          ai_generated_meta?: Json | null
          apk_url?: string | null
          build_logs?: string | null
          created_at?: string
          features?: Json
          id?: string
          marketplace_id?: string | null
          published_at?: string | null
          scheduled_date?: string | null
          software_name?: string
          software_type?: string
          status?: string | null
          target_industry?: string
          tech_stack?: Json | null
        }
        Relationships: []
      }
      backup_logs: {
        Row: {
          backup_type: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          file_path: string | null
          file_size: number | null
          id: string
          server_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["backup_status"] | null
        }
        Insert: {
          backup_type?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          server_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["backup_status"] | null
        }
        Update: {
          backup_type?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          server_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["backup_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_logs_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_tracker: {
        Row: {
          alert_sent_1_day: boolean | null
          alert_sent_4_days: boolean | null
          amount: number
          auto_pay: boolean | null
          billing_cycle: string | null
          created_at: string
          currency: string | null
          id: string
          next_due_date: string
          notes: string | null
          provider: string | null
          service_name: string
          service_type: string
          status: string | null
          updated_at: string
        }
        Insert: {
          alert_sent_1_day?: boolean | null
          alert_sent_4_days?: boolean | null
          amount: number
          auto_pay?: boolean | null
          billing_cycle?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          next_due_date: string
          notes?: string | null
          provider?: string | null
          service_name: string
          service_type: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          alert_sent_1_day?: boolean | null
          alert_sent_4_days?: boolean | null
          amount?: number
          auto_pay?: boolean | null
          billing_cycle?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          next_due_date?: string
          notes?: string | null
          provider?: string | null
          service_name?: string
          service_type?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bulk_upload_queue: {
        Row: {
          attempts: number | null
          catalog_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number | null
          priority: number | null
          scheduled_at: string | null
          started_at: string | null
          status: string | null
          upload_type: string
        }
        Insert: {
          attempts?: number | null
          catalog_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          upload_type: string
        }
        Update: {
          attempts?: number | null
          catalog_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          priority?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          upload_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_upload_queue_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "source_code_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          level: Database["public"]["Enums"]["category_level"]
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          level: Database["public"]["Enums"]["category_level"]
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          level?: Database["public"]["Enums"]["category_level"]
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      client_requests: {
        Row: {
          ai_action_taken: string | null
          ai_response: string | null
          client_email: string | null
          client_id: string | null
          client_name: string
          completed_at: string | null
          created_at: string
          estimated_cost: number | null
          id: string
          priority: string | null
          request_details: string
          request_type: string
          status: string | null
          updated_at: string
        }
        Insert: {
          ai_action_taken?: string | null
          ai_response?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name: string
          completed_at?: string | null
          created_at?: string
          estimated_cost?: number | null
          id?: string
          priority?: string | null
          request_details: string
          request_type: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          ai_action_taken?: string | null
          ai_response?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          completed_at?: string | null
          created_at?: string
          estimated_cost?: number | null
          id?: string
          priority?: string | null
          request_details?: string
          request_type?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      debug_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          module: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          module: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          module?: string
          user_id?: string | null
        }
        Relationships: []
      }
      demos: {
        Row: {
          access_count: number | null
          created_at: string | null
          created_by: string | null
          credentials: Json | null
          expires_at: string | null
          id: string
          name: string
          product_id: string
          status: Database["public"]["Enums"]["demo_status"] | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          access_count?: number | null
          created_at?: string | null
          created_by?: string | null
          credentials?: Json | null
          expires_at?: string | null
          id?: string
          name: string
          product_id: string
          status?: Database["public"]["Enums"]["demo_status"] | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          access_count?: number | null
          created_at?: string | null
          created_by?: string | null
          credentials?: Json | null
          expires_at?: string | null
          id?: string
          name?: string
          product_id?: string
          status?: Database["public"]["Enums"]["demo_status"] | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      deployment_logs: {
        Row: {
          deployment_id: string | null
          id: string
          log_level: string | null
          message: string
          timestamp: string | null
        }
        Insert: {
          deployment_id?: string | null
          id?: string
          log_level?: string | null
          message: string
          timestamp?: string | null
        }
        Update: {
          deployment_id?: string | null
          id?: string
          log_level?: string | null
          message?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deployment_logs_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      deployments: {
        Row: {
          branch: string | null
          build_logs: string | null
          commit_message: string | null
          commit_sha: string | null
          completed_at: string | null
          created_at: string | null
          deployed_url: string | null
          duration_seconds: number | null
          id: string
          server_id: string
          status: Database["public"]["Enums"]["deploy_status"] | null
          triggered_by: string | null
        }
        Insert: {
          branch?: string | null
          build_logs?: string | null
          commit_message?: string | null
          commit_sha?: string | null
          completed_at?: string | null
          created_at?: string | null
          deployed_url?: string | null
          duration_seconds?: number | null
          id?: string
          server_id: string
          status?: Database["public"]["Enums"]["deploy_status"] | null
          triggered_by?: string | null
        }
        Update: {
          branch?: string | null
          build_logs?: string | null
          commit_message?: string | null
          commit_sha?: string | null
          completed_at?: string | null
          created_at?: string | null
          deployed_url?: string | null
          duration_seconds?: number | null
          id?: string
          server_id?: string
          status?: Database["public"]["Enums"]["deploy_status"] | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deployments_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      dns_records: {
        Row: {
          created_at: string | null
          domain_id: string | null
          id: string
          name: string
          priority: number | null
          record_type: string
          ttl: number | null
          updated_at: string | null
          value: string
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain_id?: string | null
          id?: string
          name: string
          priority?: number | null
          record_type?: string
          ttl?: number | null
          updated_at?: string | null
          value: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain_id?: string | null
          id?: string
          name?: string
          priority?: number | null
          record_type?: string
          ttl?: number | null
          updated_at?: string | null
          value?: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dns_records_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          created_at: string | null
          created_by: string | null
          dns_verified: boolean | null
          dns_verified_at: string | null
          domain_name: string
          domain_type: string
          id: string
          is_primary: boolean | null
          product_id: string | null
          server_id: string | null
          ssl_auto_renew: boolean | null
          ssl_expiry_at: string | null
          ssl_status: string | null
          status: Database["public"]["Enums"]["domain_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          dns_verified?: boolean | null
          dns_verified_at?: string | null
          domain_name: string
          domain_type?: string
          id?: string
          is_primary?: boolean | null
          product_id?: string | null
          server_id?: string | null
          ssl_auto_renew?: boolean | null
          ssl_expiry_at?: string | null
          ssl_status?: string | null
          status?: Database["public"]["Enums"]["domain_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          dns_verified?: boolean | null
          dns_verified_at?: string | null
          domain_name?: string
          domain_type?: string
          id?: string
          is_primary?: boolean | null
          product_id?: string | null
          server_id?: string | null
          ssl_auto_renew?: boolean | null
          ssl_expiry_at?: string | null
          ssl_status?: string | null
          status?: Database["public"]["Enums"]["domain_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domains_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domains_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string | null
          error_message: string
          error_type: string
          id: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          stack_trace: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          error_message: string
          error_type: string
          id?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          error_message?: string
          error_type?: string
          id?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      git_connections: {
        Row: {
          auto_deploy: boolean | null
          branch: string | null
          created_at: string | null
          created_by: string | null
          deploy_token: string | null
          id: string
          last_commit_message: string | null
          last_commit_sha: string | null
          last_sync_at: string | null
          provider: Database["public"]["Enums"]["git_provider"]
          repository_name: string | null
          repository_url: string
          server_id: string | null
          status: string | null
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          auto_deploy?: boolean | null
          branch?: string | null
          created_at?: string | null
          created_by?: string | null
          deploy_token?: string | null
          id?: string
          last_commit_message?: string | null
          last_commit_sha?: string | null
          last_sync_at?: string | null
          provider?: Database["public"]["Enums"]["git_provider"]
          repository_name?: string | null
          repository_url: string
          server_id?: string | null
          status?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          auto_deploy?: boolean | null
          branch?: string | null
          created_at?: string | null
          created_by?: string | null
          deploy_token?: string | null
          id?: string
          last_commit_message?: string | null
          last_commit_sha?: string | null
          last_sync_at?: string | null
          provider?: Database["public"]["Enums"]["git_provider"]
          repository_name?: string | null
          repository_url?: string
          server_id?: string | null
          status?: string | null
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "git_connections_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      health_checks: {
        Row: {
          apk_status: string | null
          created_at: string | null
          demo_status: string | null
          id: string
          last_checked_at: string | null
          license_status: string | null
          overall_status: string | null
          product_id: string
          server_status: string | null
          updated_at: string | null
        }
        Insert: {
          apk_status?: string | null
          created_at?: string | null
          demo_status?: string | null
          id?: string
          last_checked_at?: string | null
          license_status?: string | null
          overall_status?: string | null
          product_id: string
          server_status?: string | null
          updated_at?: string | null
        }
        Update: {
          apk_status?: string | null
          created_at?: string | null
          demo_status?: string | null
          id?: string
          last_checked_at?: string | null
          license_status?: string | null
          overall_status?: string | null
          product_id?: string
          server_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_checks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_otp_codes: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invoice_id: string
          otp_code: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invoice_id: string
          otp_code: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invoice_id?: string
          otp_code?: string
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_otp_codes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_otp_codes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          currency: string | null
          customer_address: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          discount_amount: number | null
          discount_percent: number | null
          due_date: string | null
          id: string
          invoice_number: string
          items: Json
          notes: string | null
          otp_verified: boolean | null
          otp_verified_at: string | null
          signature_data: string | null
          signed_at: string | null
          signer_ip: string | null
          status: string | null
          subtotal: number
          tax_amount: number | null
          tax_percent: number | null
          terms: string | null
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          customer_address?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          due_date?: string | null
          id?: string
          invoice_number: string
          items?: Json
          notes?: string | null
          otp_verified?: boolean | null
          otp_verified_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          tax_percent?: number | null
          terms?: string | null
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          customer_address?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          items?: Json
          notes?: string | null
          otp_verified?: boolean | null
          otp_verified_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          signer_ip?: string | null
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          tax_percent?: number | null
          terms?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          company: string | null
          converted_at: string | null
          created_at: string | null
          email: string | null
          id: string
          meta: Json | null
          name: string
          notes: string | null
          phone: string | null
          product_id: string | null
          source: Database["public"]["Enums"]["lead_source"] | null
          status: Database["public"]["Enums"]["lead_status"] | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          company?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          meta?: Json | null
          name: string
          notes?: string | null
          phone?: string | null
          product_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          company?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          meta?: Json | null
          name?: string
          notes?: string | null
          phone?: string | null
          product_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"] | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      license_keys: {
        Row: {
          activated_at: string | null
          activated_devices: number | null
          created_at: string | null
          created_by: string | null
          device_id: string | null
          expires_at: string | null
          id: string
          key_type: Database["public"]["Enums"]["key_type"]
          last_validated_at: string | null
          license_key: string
          max_devices: number | null
          meta: Json | null
          notes: string | null
          owner_email: string | null
          owner_name: string | null
          product_id: string
          status: Database["public"]["Enums"]["key_status"] | null
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          activated_devices?: number | null
          created_at?: string | null
          created_by?: string | null
          device_id?: string | null
          expires_at?: string | null
          id?: string
          key_type?: Database["public"]["Enums"]["key_type"]
          last_validated_at?: string | null
          license_key: string
          max_devices?: number | null
          meta?: Json | null
          notes?: string | null
          owner_email?: string | null
          owner_name?: string | null
          product_id: string
          status?: Database["public"]["Enums"]["key_status"] | null
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          activated_devices?: number | null
          created_at?: string | null
          created_by?: string | null
          device_id?: string | null
          expires_at?: string | null
          id?: string
          key_type?: Database["public"]["Enums"]["key_type"]
          last_validated_at?: string | null
          license_key?: string
          max_devices?: number | null
          meta?: Json | null
          notes?: string | null
          owner_email?: string | null
          owner_name?: string | null
          product_id?: string
          status?: Database["public"]["Enums"]["key_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_keys_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          is_featured: boolean | null
          price: number
          product_id: string
          seller_id: string
          status: string | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          price?: number
          product_id: string
          seller_id: string
          status?: string | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          price?: number
          product_id?: string
          seller_id?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          amount: number
          buyer_id: string
          completed_at: string | null
          created_at: string | null
          currency: string | null
          id: string
          license_key_id: string | null
          listing_id: string | null
          payment_method: string | null
          seller_id: string
          status: string | null
          transaction_id: string | null
        }
        Insert: {
          amount: number
          buyer_id: string
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          license_key_id?: string | null
          listing_id?: string | null
          payment_method?: string | null
          seller_id: string
          status?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          license_key_id?: string | null
          listing_id?: string | null
          payment_method?: string | null
          seller_id?: string
          status?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_license_key_id_fkey"
            columns: ["license_key_id"]
            isOneToOne: false
            referencedRelation: "license_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_payouts: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          payment_details: Json | null
          processed_at: string | null
          seller_id: string
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          payment_details?: Json | null
          processed_at?: string | null
          seller_id: string
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          payment_details?: Json | null
          processed_at?: string | null
          seller_id?: string
          status?: string | null
        }
        Relationships: []
      }
      marketplace_reviews: {
        Row: {
          created_at: string | null
          id: string
          is_verified: boolean | null
          listing_id: string
          order_id: string
          rating: number
          review_text: string | null
          reviewer_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          listing_id: string
          order_id: string
          rating: number
          review_text?: string | null
          reviewer_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          listing_id?: string
          order_id?: string
          rating?: number
          review_text?: string | null
          reviewer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          read_at: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          read_at?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          module: string
          name: string
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          module: string
          name: string
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          billing_period: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          limits: Json | null
          name: string
          price: number | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          billing_period?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          name: string
          price?: number | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          billing_period?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          name?: string
          price?: number | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          apk_url: string | null
          business_type: string | null
          category_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          demo_url: string | null
          deploy_status: string | null
          description: string | null
          download_count: number | null
          features: Json | null
          git_default_branch: string | null
          git_repo_name: string | null
          git_repo_url: string | null
          icon_path: string | null
          id: string
          is_apk: boolean | null
          live_url: string | null
          marketplace_visible: boolean | null
          meta: Json | null
          name: string
          price: number | null
          product_code: string
          short_description: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"] | null
          thumbnail_url: string | null
          updated_at: string | null
          version: string | null
          visibility: string | null
        }
        Insert: {
          apk_url?: string | null
          business_type?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          demo_url?: string | null
          deploy_status?: string | null
          description?: string | null
          download_count?: number | null
          features?: Json | null
          git_default_branch?: string | null
          git_repo_name?: string | null
          git_repo_url?: string | null
          icon_path?: string | null
          id?: string
          is_apk?: boolean | null
          live_url?: string | null
          marketplace_visible?: boolean | null
          meta?: Json | null
          name: string
          price?: number | null
          product_code?: string
          short_description?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"] | null
          thumbnail_url?: string | null
          updated_at?: string | null
          version?: string | null
          visibility?: string | null
        }
        Update: {
          apk_url?: string | null
          business_type?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          demo_url?: string | null
          deploy_status?: string | null
          description?: string | null
          download_count?: number | null
          features?: Json | null
          git_default_branch?: string | null
          git_repo_name?: string | null
          git_repo_url?: string | null
          icon_path?: string | null
          id?: string
          is_apk?: boolean | null
          live_url?: string | null
          marketplace_visible?: boolean | null
          meta?: Json | null
          name?: string
          price?: number | null
          product_code?: string
          short_description?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"] | null
          thumbnail_url?: string | null
          updated_at?: string | null
          version?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          blocked_until: string | null
          created_at: string | null
          endpoint: string
          id: string
          max_requests: number | null
          requests_count: number | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
          window_seconds: number | null
          window_start: string | null
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string | null
          endpoint: string
          id?: string
          max_requests?: number | null
          requests_count?: number | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          window_seconds?: number | null
          window_start?: string | null
        }
        Update: {
          blocked_until?: string | null
          created_at?: string | null
          endpoint?: string
          id?: string
          max_requests?: number | null
          requests_count?: number | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          window_seconds?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      resellers: {
        Row: {
          commission_percent: number | null
          company_name: string | null
          created_at: string | null
          credit_limit: number | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          meta: Json | null
          total_commission: number | null
          total_sales: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          commission_percent?: number | null
          company_name?: string | null
          created_at?: string | null
          credit_limit?: number | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          meta?: Json | null
          total_commission?: number | null
          total_sales?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          commission_percent?: number | null
          company_name?: string | null
          created_at?: string | null
          credit_limit?: number | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          meta?: Json | null
          total_commission?: number | null
          total_sales?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      role_permission_map: {
        Row: {
          created_at: string | null
          granted: boolean | null
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string | null
          granted?: boolean | null
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string | null
          granted?: boolean | null
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permission_map_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_backlinks: {
        Row: {
          ai_generated: boolean | null
          anchor_text: string | null
          backlink_type: string | null
          backlink_url: string
          created_at: string
          domain_authority: number | null
          id: string
          last_checked_at: string | null
          product_id: string | null
          source_type: string | null
          status: string | null
          target_url: string
        }
        Insert: {
          ai_generated?: boolean | null
          anchor_text?: string | null
          backlink_type?: string | null
          backlink_url: string
          created_at?: string
          domain_authority?: number | null
          id?: string
          last_checked_at?: string | null
          product_id?: string | null
          source_type?: string | null
          status?: string | null
          target_url: string
        }
        Update: {
          ai_generated?: boolean | null
          anchor_text?: string | null
          backlink_type?: string | null
          backlink_url?: string
          created_at?: string
          domain_authority?: number | null
          id?: string
          last_checked_at?: string | null
          product_id?: string | null
          source_type?: string | null
          status?: string | null
          target_url?: string
        }
        Relationships: []
      }
      seo_data: {
        Row: {
          canonical_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          keywords: string[] | null
          meta_description: string | null
          og_image: string | null
          product_id: string | null
          robots: string | null
          structured_data: Json | null
          title: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          og_image?: string | null
          product_id?: string | null
          robots?: string | null
          structured_data?: Json | null
          title?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          canonical_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          og_image?: string | null
          product_id?: string | null
          robots?: string | null
          structured_data?: Json | null
          title?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_data_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      server_auto_rules: {
        Row: {
          auto_backup: boolean | null
          auto_deploy: boolean | null
          auto_health_check: boolean | null
          auto_restart: boolean | null
          auto_ssl_renewal: boolean | null
          backup_schedule: string | null
          created_at: string | null
          health_check_interval: number | null
          id: string
          max_restart_attempts: number | null
          restart_on_failure: boolean | null
          server_id: string | null
          updated_at: string | null
        }
        Insert: {
          auto_backup?: boolean | null
          auto_deploy?: boolean | null
          auto_health_check?: boolean | null
          auto_restart?: boolean | null
          auto_ssl_renewal?: boolean | null
          backup_schedule?: string | null
          created_at?: string | null
          health_check_interval?: number | null
          id?: string
          max_restart_attempts?: number | null
          restart_on_failure?: boolean | null
          server_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_backup?: boolean | null
          auto_deploy?: boolean | null
          auto_health_check?: boolean | null
          auto_restart?: boolean | null
          auto_ssl_renewal?: boolean | null
          backup_schedule?: string | null
          created_at?: string | null
          health_check_interval?: number | null
          id?: string
          max_restart_attempts?: number | null
          restart_on_failure?: boolean | null
          server_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_auto_rules_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: true
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_events: {
        Row: {
          created_at: string | null
          description: string | null
          event_type: Database["public"]["Enums"]["server_event_type"]
          id: string
          meta: Json | null
          resolved: boolean | null
          resolved_at: string | null
          server_id: string | null
          severity: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_type: Database["public"]["Enums"]["server_event_type"]
          id?: string
          meta?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          server_id?: string | null
          severity?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_type?: Database["public"]["Enums"]["server_event_type"]
          id?: string
          meta?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          server_id?: string | null
          severity?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_events_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          agent_token: string | null
          agent_url: string | null
          auto_deploy: boolean | null
          created_at: string | null
          created_by: string | null
          custom_domain: string | null
          env_vars: Json | null
          git_branch: string | null
          git_repo: string | null
          health_status: string | null
          id: string
          last_deploy_at: string | null
          last_deploy_commit: string | null
          last_deploy_message: string | null
          name: string
          product_id: string | null
          runtime: Database["public"]["Enums"]["server_runtime"] | null
          server_type: string | null
          ssl_status: string | null
          status: Database["public"]["Enums"]["server_status"] | null
          subdomain: string | null
          updated_at: string | null
          uptime_percent: number | null
        }
        Insert: {
          agent_token?: string | null
          agent_url?: string | null
          auto_deploy?: boolean | null
          created_at?: string | null
          created_by?: string | null
          custom_domain?: string | null
          env_vars?: Json | null
          git_branch?: string | null
          git_repo?: string | null
          health_status?: string | null
          id?: string
          last_deploy_at?: string | null
          last_deploy_commit?: string | null
          last_deploy_message?: string | null
          name: string
          product_id?: string | null
          runtime?: Database["public"]["Enums"]["server_runtime"] | null
          server_type?: string | null
          ssl_status?: string | null
          status?: Database["public"]["Enums"]["server_status"] | null
          subdomain?: string | null
          updated_at?: string | null
          uptime_percent?: number | null
        }
        Update: {
          agent_token?: string | null
          agent_url?: string | null
          auto_deploy?: boolean | null
          created_at?: string | null
          created_by?: string | null
          custom_domain?: string | null
          env_vars?: Json | null
          git_branch?: string | null
          git_repo?: string | null
          health_status?: string | null
          id?: string
          last_deploy_at?: string | null
          last_deploy_commit?: string | null
          last_deploy_message?: string | null
          name?: string
          product_id?: string | null
          runtime?: Database["public"]["Enums"]["server_runtime"] | null
          server_type?: string | null
          ssl_status?: string | null
          status?: Database["public"]["Enums"]["server_status"] | null
          subdomain?: string | null
          updated_at?: string | null
          uptime_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "servers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      source_code_catalog: {
        Row: {
          ai_description: string | null
          ai_generated_readme: string | null
          analysis_logs: string | null
          analyzed_at: string | null
          complexity_score: number | null
          created_at: string
          detected_features: Json | null
          file_path: string | null
          file_size: number | null
          github_account: string | null
          github_repo_url: string | null
          id: string
          is_on_marketplace: boolean | null
          listed_at: string | null
          marketplace_listing_id: string | null
          marketplace_price: number | null
          project_name: string
          project_type: string | null
          sales_count: number | null
          slug: string | null
          status: string | null
          target_industry: string | null
          tech_stack: Json | null
          updated_at: string
          uploaded_at: string | null
          uploaded_to_github: boolean | null
          vala_name: string | null
        }
        Insert: {
          ai_description?: string | null
          ai_generated_readme?: string | null
          analysis_logs?: string | null
          analyzed_at?: string | null
          complexity_score?: number | null
          created_at?: string
          detected_features?: Json | null
          file_path?: string | null
          file_size?: number | null
          github_account?: string | null
          github_repo_url?: string | null
          id?: string
          is_on_marketplace?: boolean | null
          listed_at?: string | null
          marketplace_listing_id?: string | null
          marketplace_price?: number | null
          project_name: string
          project_type?: string | null
          sales_count?: number | null
          slug?: string | null
          status?: string | null
          target_industry?: string | null
          tech_stack?: Json | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_to_github?: boolean | null
          vala_name?: string | null
        }
        Update: {
          ai_description?: string | null
          ai_generated_readme?: string | null
          analysis_logs?: string | null
          analyzed_at?: string | null
          complexity_score?: number | null
          created_at?: string
          detected_features?: Json | null
          file_path?: string | null
          file_size?: number | null
          github_account?: string | null
          github_repo_url?: string | null
          id?: string
          is_on_marketplace?: boolean | null
          listed_at?: string | null
          marketplace_listing_id?: string | null
          marketplace_price?: number | null
          project_name?: string
          project_type?: string | null
          sales_count?: number | null
          slug?: string | null
          status?: string | null
          target_industry?: string | null
          tech_stack?: Json | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_to_github?: boolean | null
          vala_name?: string | null
        }
        Relationships: []
      }
      ssl_logs: {
        Row: {
          action: string
          created_at: string | null
          domain_id: string | null
          error_message: string | null
          expires_at: string | null
          id: string
          issued_at: string | null
          provider: string | null
          status: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          domain_id?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          provider?: string | null
          status?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          domain_id?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          provider?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ssl_logs_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          billing_cycle: string | null
          cancelled_at: string | null
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_name: string
          product_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          billing_cycle?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_name: string
          product_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          billing_cycle?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_name?: string
          product_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      support_audit_logs: {
        Row: {
          action: string
          actor_id: string
          actor_type: string
          created_at: string | null
          details: Json | null
          id: string
          ip_hash: string | null
          message_id: string | null
          ticket_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          actor_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_hash?: string | null
          message_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          actor_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_hash?: string | null
          message_id?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_audit_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_audit_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_audit_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string | null
          created_at: string | null
          delivered_at: string | null
          id: string
          is_internal_note: boolean | null
          media_url: string | null
          message_type: Database["public"]["Enums"]["message_type"] | null
          read_at: string | null
          sender_id: string
          sender_type: string
          ticket_id: string
          voice_duration: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          is_internal_note?: boolean | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type"] | null
          read_at?: string | null
          sender_id: string
          sender_type: string
          ticket_id: string
          voice_duration?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          is_internal_note?: boolean | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type"] | null
          read_at?: string | null
          sender_id?: string
          sender_type?: string
          ticket_id?: string
          voice_duration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_staff_id: string | null
          created_at: string | null
          id: string
          ip_hash: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_status"] | null
          ticket_number: string
          updated_at: string | null
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          assigned_staff_id?: string | null
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"] | null
          ticket_number: string
          updated_at?: string | null
          user_email: string
          user_id: string
          user_name: string
        }
        Update: {
          assigned_staff_id?: string | null
          created_at?: string | null
          id?: string
          ip_hash?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"] | null
          ticket_number?: string
          updated_at?: string | null
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      system_health_snapshots: {
        Row: {
          approvals_queued: number | null
          auto_actions_taken: number | null
          created_at: string
          details: Json | null
          id: string
          issues_detected: number | null
          metrics: Json | null
          snapshot_type: string
          status: string
        }
        Insert: {
          approvals_queued?: number | null
          auto_actions_taken?: number | null
          created_at?: string
          details?: Json | null
          id?: string
          issues_detected?: number | null
          metrics?: Json | null
          snapshot_type: string
          status?: string
        }
        Update: {
          approvals_queued?: number | null
          auto_actions_taken?: number | null
          created_at?: string
          details?: Json | null
          id?: string
          issues_detected?: number | null
          metrics?: Json | null
          snapshot_type?: string
          status?: string
        }
        Relationships: []
      }
      system_monitor_queue: {
        Row: {
          action_payload: Json | null
          ai_confidence: number | null
          approved_at: string | null
          approved_by: string | null
          auto_approved: boolean | null
          created_at: string
          effect: string
          error_message: string | null
          executed_at: string | null
          id: string
          monitor_type: string
          reason: string
          risk_level: string
          source_module: string | null
          status: string
          target_entity_id: string | null
          target_entity_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_payload?: Json | null
          ai_confidence?: number | null
          approved_at?: string | null
          approved_by?: string | null
          auto_approved?: boolean | null
          created_at?: string
          effect: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          monitor_type: string
          reason: string
          risk_level?: string
          source_module?: string | null
          status?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_payload?: Json | null
          ai_confidence?: number | null
          approved_at?: string | null
          approved_by?: string | null
          auto_approved?: boolean | null
          created_at?: string
          effect?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          monitor_type?: string
          reason?: string
          risk_level?: string
          source_module?: string | null
          status?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          max_products: number | null
          max_servers: number | null
          max_users: number | null
          name: string
          owner_id: string
          plan_id: string | null
          settings: Json | null
          slug: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_products?: number | null
          max_servers?: number | null
          max_users?: number | null
          name: string
          owner_id: string
          plan_id?: string | null
          settings?: Json | null
          slug: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_products?: number | null
          max_servers?: number | null
          max_users?: number | null
          name?: string
          owner_id?: string
          plan_id?: string | null
          settings?: Json | null
          slug?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          meta: Json | null
          reference_id: string | null
          reference_type: string | null
          status: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          meta?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          meta?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type?: Database["public"]["Enums"]["transaction_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_metrics: {
        Row: {
          id: string
          metadata: Json | null
          metric_type: string
          metric_value: number
          recorded_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_value?: number
          recorded_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_value?: number
          recorded_at?: string | null
          user_id?: string | null
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
      user_sessions: {
        Row: {
          browser: string | null
          consent_given_at: string | null
          created_at: string
          device_name: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          last_active_at: string | null
          location: string | null
          location_consent: boolean | null
          os: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          consent_given_at?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string | null
          location?: string | null
          location_consent?: boolean | null
          os?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          consent_given_at?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string | null
          location?: string | null
          location_consent?: boolean | null
          os?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_violations: {
        Row: {
          blocked_at: string | null
          created_at: string
          details: Json | null
          email: string
          fine_amount: number
          id: string
          is_blocked: boolean
          last_violation_at: string | null
          total_fines_paid: number
          updated_at: string
          user_id: string
          violation_count: number
          violation_type: string
        }
        Insert: {
          blocked_at?: string | null
          created_at?: string
          details?: Json | null
          email: string
          fine_amount?: number
          id?: string
          is_blocked?: boolean
          last_violation_at?: string | null
          total_fines_paid?: number
          updated_at?: string
          user_id: string
          violation_count?: number
          violation_type?: string
        }
        Update: {
          blocked_at?: string | null
          created_at?: string
          details?: Json | null
          email?: string
          fine_amount?: number
          id?: string
          is_blocked?: boolean
          last_violation_at?: string | null
          total_fines_paid?: number
          updated_at?: string
          user_id?: string
          violation_count?: number
          violation_type?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number | null
          created_at: string | null
          currency: string | null
          id: string
          is_locked: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          is_locked?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          is_locked?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      invoices_secure: {
        Row: {
          created_at: string | null
          currency: string | null
          customer_address: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number | null
          discount_percent: number | null
          due_date: string | null
          id: string | null
          invoice_number: string | null
          items: Json | null
          notes: string | null
          otp_verified: boolean | null
          otp_verified_at: string | null
          signature_data: string | null
          signed_at: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_percent: number | null
          terms: string | null
          total_amount: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          customer_address?: never
          customer_email?: never
          customer_name?: never
          customer_phone?: never
          discount_amount?: number | null
          discount_percent?: number | null
          due_date?: string | null
          id?: string | null
          invoice_number?: string | null
          items?: Json | null
          notes?: string | null
          otp_verified?: boolean | null
          otp_verified_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          terms?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          customer_address?: never
          customer_email?: never
          customer_name?: never
          customer_phone?: never
          discount_amount?: number | null
          discount_percent?: number | null
          due_date?: string | null
          id?: string | null
          invoice_number?: string | null
          items?: Json | null
          notes?: string | null
          otp_verified?: boolean | null
          otp_verified_at?: string | null
          signature_data?: string | null
          signed_at?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          terms?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      support_tickets_secure: {
        Row: {
          assigned_staff_id: string | null
          created_at: string | null
          id: string | null
          ip_hash: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_status"] | null
          ticket_number: string | null
          updated_at: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          assigned_staff_id?: string | null
          created_at?: string | null
          id?: string | null
          ip_hash?: never
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"] | null
          ticket_number?: string | null
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          assigned_staff_id?: string | null
          created_at?: string | null
          id?: string | null
          ip_hash?: never
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"] | null
          ticket_number?: string | null
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      user_sessions_secure: {
        Row: {
          browser: string | null
          consent_given_at: string | null
          created_at: string | null
          device_name: string | null
          device_type: string | null
          id: string | null
          ip_address: string | null
          is_current: boolean | null
          last_active_at: string | null
          location: string | null
          location_consent: boolean | null
          os: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          consent_given_at?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          id?: string | null
          ip_address?: never
          is_current?: boolean | null
          last_active_at?: string | null
          location?: never
          location_consent?: boolean | null
          os?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          consent_given_at?: string | null
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          id?: string | null
          ip_address?: never
          is_current?: boolean | null
          last_active_at?: string | null
          location?: never
          location_consent?: boolean | null
          os?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_invoice_number: { Args: never; Returns: string }
      generate_license_key: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_location_consent: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_activity: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_id: string
          p_entity_type: string
        }
        Returns: string
      }
      update_product_health: {
        Args: { p_product_id: string }
        Returns: undefined
      }
    }
    Enums: {
      apk_status: "published" | "draft" | "deprecated"
      app_role: "super_admin" | "reseller"
      audit_action:
        | "create"
        | "read"
        | "update"
        | "delete"
        | "login"
        | "logout"
        | "suspend"
        | "activate"
      backup_status: "pending" | "running" | "success" | "failed"
      category_level: "master" | "sub" | "micro" | "nano"
      demo_status: "active" | "expired" | "disabled"
      deploy_status:
        | "queued"
        | "building"
        | "success"
        | "failed"
        | "cancelled"
        | "rolled_back"
      domain_status: "pending" | "active" | "failed" | "expired"
      git_provider: "github" | "gitlab" | "bitbucket"
      key_status: "active" | "expired" | "suspended" | "revoked"
      key_type: "lifetime" | "yearly" | "monthly" | "trial"
      lead_source:
        | "website"
        | "referral"
        | "social"
        | "ads"
        | "organic"
        | "other"
      lead_status: "new" | "contacted" | "qualified" | "converted" | "lost"
      message_type: "text" | "voice" | "image"
      product_status: "active" | "suspended" | "archived" | "draft"
      server_event_type:
        | "restart"
        | "deploy"
        | "backup"
        | "ssl_renewal"
        | "health_check"
        | "error"
      server_runtime:
        | "nodejs18"
        | "nodejs20"
        | "php82"
        | "php83"
        | "python311"
        | "python312"
      server_status: "deploying" | "live" | "failed" | "stopped" | "suspended"
      support_status: "pending" | "open" | "resolved" | "escalated"
      transaction_status: "pending" | "completed" | "failed" | "cancelled"
      transaction_type: "credit" | "debit" | "refund" | "adjustment"
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
      apk_status: ["published", "draft", "deprecated"],
      app_role: ["super_admin", "reseller"],
      audit_action: [
        "create",
        "read",
        "update",
        "delete",
        "login",
        "logout",
        "suspend",
        "activate",
      ],
      backup_status: ["pending", "running", "success", "failed"],
      category_level: ["master", "sub", "micro", "nano"],
      demo_status: ["active", "expired", "disabled"],
      deploy_status: [
        "queued",
        "building",
        "success",
        "failed",
        "cancelled",
        "rolled_back",
      ],
      domain_status: ["pending", "active", "failed", "expired"],
      git_provider: ["github", "gitlab", "bitbucket"],
      key_status: ["active", "expired", "suspended", "revoked"],
      key_type: ["lifetime", "yearly", "monthly", "trial"],
      lead_source: ["website", "referral", "social", "ads", "organic", "other"],
      lead_status: ["new", "contacted", "qualified", "converted", "lost"],
      message_type: ["text", "voice", "image"],
      product_status: ["active", "suspended", "archived", "draft"],
      server_event_type: [
        "restart",
        "deploy",
        "backup",
        "ssl_renewal",
        "health_check",
        "error",
      ],
      server_runtime: [
        "nodejs18",
        "nodejs20",
        "php82",
        "php83",
        "python311",
        "python312",
      ],
      server_status: ["deploying", "live", "failed", "stopped", "suspended"],
      support_status: ["pending", "open", "resolved", "escalated"],
      transaction_status: ["pending", "completed", "failed", "cancelled"],
      transaction_type: ["credit", "debit", "refund", "adjustment"],
    },
  },
} as const
