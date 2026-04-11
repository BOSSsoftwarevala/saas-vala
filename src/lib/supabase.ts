import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types for real enterprise features
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          role: 'super_admin' | 'admin' | 'user';
          permissions: {
            canCreateProduct: boolean;
            canDeployServer: boolean;
            canGenerateKey: boolean;
            canViewLogs: boolean;
            canManageSecurity: boolean;
            canManageUsers: boolean;
            canViewAnalytics: boolean;
            canManageSystem: boolean;
          };
          timezone: string;
          status: 'active' | 'deleted' | 'archived';
          deleted_at?: string;
          deleted_by?: string;
          delete_reason?: string;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at' | 'version'>;
        Update: Partial<Database['public']['Tables']['users']['Row']>;
      };
      products: {
        Row: {
          id: string;
          name: string;
          description: string;
          price: number;
          category: string;
          tags: string[];
          status: 'active' | 'deleted' | 'archived';
          deleted_at?: string;
          deleted_by?: string;
          delete_reason?: string;
          created_at: string;
          updated_at: string;
          version: number;
          current_version: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at' | 'version'>;
        Update: Partial<Database['public']['Tables']['products']['Row']>;
      };
      product_versions: {
        Row: {
          id: string;
          product_id: string;
          version: string;
          description: string;
          changelog: string;
          is_active: boolean;
          deployed_at?: string;
          created_at: string;
          created_by: string;
          metadata: Record<string, any>;
        };
        Insert: Omit<Database['public']['Tables']['product_versions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['product_versions']['Row']>;
      };
      api_keys: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          name: string;
          key_hash: string;
          permissions: string[];
          expires_at?: string;
          last_used?: string;
          usage_count: number;
          status: 'active' | 'deleted' | 'archived';
          deleted_at?: string;
          deleted_by?: string;
          delete_reason?: string;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: Omit<Database['public']['Tables']['api_keys']['Row'], 'id' | 'created_at' | 'updated_at' | 'version'>;
        Update: Partial<Database['public']['Tables']['api_keys']['Row']>;
      };
      feature_flags: {
        Row: {
          id: string;
          name: string;
          description: string;
          enabled: boolean;
          rollout_percentage: number;
          conditions: Record<string, any>[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['feature_flags']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['feature_flags']['Row']>;
      };
      jobs: {
        Row: {
          id: string;
          type: 'deploy' | 'key_generation' | 'backup' | 'cleanup' | 'analytics' | 'custom';
          priority: 'low' | 'medium' | 'high' | 'urgent';
          status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
          payload: Record<string, any>;
          result?: Record<string, any>;
          error?: string;
          created_at: string;
          started_at?: string;
          completed_at?: string;
          retry_count: number;
          max_retries: number;
          delay?: number;
          timeout?: number;
          created_by?: string;
        };
        Insert: Omit<Database['public']['Tables']['jobs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['jobs']['Row']>;
      };
      analytics_events: {
        Row: {
          id: string;
          type: string;
          category: 'product' | 'user' | 'system' | 'security' | 'api';
          action: string;
          user_id?: string;
          product_id?: string;
          metadata: Record<string, any>;
          timestamp: string;
          value?: number;
        };
        Insert: Omit<Database['public']['Tables']['analytics_events']['Row'], 'id' | 'timestamp'>;
        Update: Partial<Database['public']['Tables']['analytics_events']['Row']>;
      };
      webhooks: {
        Row: {
          id: string;
          name: string;
          url: string;
          events: string[];
          secret?: string;
          active: boolean;
          retry_config: {
            maxRetries: number;
            retryDelay: number;
            backoffMultiplier: number;
          };
          headers: Record<string, string>;
          created_at: string;
          created_by: string;
          last_triggered?: string;
          success_count: number;
          failure_count: number;
        };
        Insert: Omit<Database['public']['Tables']['webhooks']['Row'], 'id' | 'created_at' | 'success_count' | 'failure_count'>;
        Update: Partial<Database['public']['Tables']['webhooks']['Row']>;
      };
      webhook_deliveries: {
        Row: {
          id: string;
          webhook_id: string;
          event_id: string;
          status: 'pending' | 'delivered' | 'failed' | 'retrying';
          status_code?: number;
          response?: string;
          attempt: number;
          max_attempts: number;
          next_retry_at?: string;
          delivered_at?: string;
          created_at: string;
          error?: string;
        };
        Insert: Omit<Database['public']['Tables']['webhook_deliveries']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['webhook_deliveries']['Row']>;
      };
      audit_logs: {
        Row: {
          id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          user_id: string;
          timestamp: string;
          timezone: string;
          metadata: Record<string, any>;
          ip_address?: string;
          user_agent?: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'timestamp'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Row']>;
      };
      maintenance_schedules: {
        Row: {
          id: string;
          name: string;
          description: string;
          start_time: string;
          end_time: string;
          services: string[];
          notify_users: boolean;
          notification_lead_time: number;
          recurring: {
            type: 'daily' | 'weekly' | 'monthly';
            interval?: number;
            days_of_week?: number[];
            day_of_month?: number;
          } | null;
          created_at: string;
          created_by: string;
          active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['maintenance_schedules']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['maintenance_schedules']['Row']>;
      };
    };
  };
}

// Real database functions for enterprise features
export class EnterpriseDatabase {
  static async createUser(userData: Database['public']['Tables']['users']['Insert']) {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getUserById(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('status', 'active')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async updateUserPermissions(userId: string, permissions: Database['public']['Tables']['users']['Row']['permissions']) {
    const { data, error } = await supabase
      .from('users')
      .update({ 
        permissions, 
        updated_at: new Date().toISOString(),
        version: supabase.sql('version + 1')
      })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async createProduct(productData: Database['public']['Tables']['products']['Insert']) {
    const { data, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async softDeleteEntity(table: keyof Database['public']['Tables'], id: string, deletedBy: string, reason?: string) {
    const { data, error } = await supabase
      .from(table)
      .update({ 
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        delete_reason: reason,
        updated_at: new Date().toISOString(),
        version: supabase.sql('version + 1')
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async createJob(jobData: Database['public']['Tables']['jobs']['Insert']) {
    const { data, error } = await supabase
      .from('jobs')
      .insert(jobData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getNextJobs(limit: number = 5) {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }

  static async updateJobStatus(jobId: string, status: Database['public']['Tables']['jobs']['Row']['status'], result?: any, error?: string) {
    const updateData: any = { 
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'running') {
      updateData.started_at = new Date().toISOString();
    } else if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
      if (result) updateData.result = result;
      if (error) updateData.error = error;
    }

    const { data, error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async trackEvent(eventData: Database['public']['Tables']['analytics_events']['Insert']) {
    const { data, error } = await supabase
      .from('analytics_events')
      .insert({
        ...eventData,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getFeatureFlag(name: string) {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('name', name)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async createWebhook(webhookData: Database['public']['Tables']['webhooks']['Insert']) {
    const { data, error } = await supabase
      .from('webhooks')
      .insert(webhookData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async createAuditLog(auditData: Database['public']['Tables']['audit_logs']['Insert']) {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert({
        ...auditData,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getActiveMaintenanceSchedules() {
    const { data, error } = await supabase
      .from('maintenance_schedules')
      .select('*')
      .eq('active', true)
      .order('start_time', { ascending: true });
    
    if (error) throw error;
    return data;
  }
}

export default supabase;
