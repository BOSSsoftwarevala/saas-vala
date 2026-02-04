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
      ai_usage: {
        Row: {
          cost: number | null
          created_at: string | null
          endpoint: string | null
          id: string
          model: string
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
          session_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string
        }
        Relationships: []
      }
      apks: {
        Row: {
          changelog: string | null
          created_at: string | null
          created_by: string | null
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
          changelog?: string | null
          created_at?: string | null
          created_by?: string | null
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
          changelog?: string | null
          created_at?: string | null
          created_by?: string | null
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
      products: {
        Row: {
          category_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          features: Json | null
          id: string
          meta: Json | null
          name: string
          price: number | null
          slug: string
          status: Database["public"]["Enums"]["product_status"] | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          meta?: Json | null
          name: string
          price?: number | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"] | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          meta?: Json | null
          name?: string
          price?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"] | null
          updated_at?: string | null
          version?: string | null
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
      servers: {
        Row: {
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
          runtime: Database["public"]["Enums"]["server_runtime"] | null
          ssl_status: string | null
          status: Database["public"]["Enums"]["server_status"] | null
          subdomain: string | null
          updated_at: string | null
          uptime_percent: number | null
        }
        Insert: {
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
          runtime?: Database["public"]["Enums"]["server_runtime"] | null
          ssl_status?: string | null
          status?: Database["public"]["Enums"]["server_status"] | null
          subdomain?: string | null
          updated_at?: string | null
          uptime_percent?: number | null
        }
        Update: {
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
          runtime?: Database["public"]["Enums"]["server_runtime"] | null
          ssl_status?: string | null
          status?: Database["public"]["Enums"]["server_status"] | null
          subdomain?: string | null
          updated_at?: string | null
          uptime_percent?: number | null
        }
        Relationships: []
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
          created_at: string
          device_name: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          last_active_at: string | null
          location: string | null
          os: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string | null
          location?: string | null
          os?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string | null
          location?: string | null
          os?: string | null
          user_id?: string
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
      [_ in never]: never
    }
    Functions: {
      generate_invoice_number: { Args: never; Returns: string }
      generate_license_key: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
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
      category_level: "master" | "sub" | "micro" | "nano"
      demo_status: "active" | "expired" | "disabled"
      deploy_status:
        | "queued"
        | "building"
        | "success"
        | "failed"
        | "cancelled"
        | "rolled_back"
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
      key_status: ["active", "expired", "suspended", "revoked"],
      key_type: ["lifetime", "yearly", "monthly", "trial"],
      lead_source: ["website", "referral", "social", "ads", "organic", "other"],
      lead_status: ["new", "contacted", "qualified", "converted", "lost"],
      message_type: ["text", "voice", "image"],
      product_status: ["active", "suspended", "archived", "draft"],
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
