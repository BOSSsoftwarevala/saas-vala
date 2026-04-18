// Lead Generation Database Service
import { supabase as db } from '@/lib/supabase';
import type {
  Lead,
  Campaign,
  OutreachMessage,
  EmailVerification,
  SEOAnalysis,
  APIIntegration,
  LeadActivity,
  AnalyticsMetrics,
} from '@/types/lead-generation';

export class LeadGenerationDBService {
  // Leads CRUD operations
  async createLead(lead: Partial<Lead>): Promise<Lead | null> {
    try {
      const { data, error } = await db
        .from('leads')
        .insert({
          ...lead,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as Lead;
    } catch (error) {
      console.error('Error creating lead:', error);
      return null;
    }
  }

  async getLeads(filters?: {
    status?: string;
    lead_score?: string;
    source?: string;
    city?: string;
    country?: string;
    limit?: number;
    offset?: number;
  }): Promise<Lead[]> {
    try {
      let query = db.from('leads').select('*').order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.lead_score) {
        query = query.eq('lead_score', filters.lead_score);
      }
      if (filters?.source) {
        query = query.eq('source', filters.source);
      }
      if (filters?.city) {
        query = query.eq('city', filters.city);
      }
      if (filters?.country) {
        query = query.eq('country', filters.country);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Lead[];
    } catch (error) {
      console.error('Error fetching leads:', error);
      return [];
    }
  }

  async getLeadById(id: string): Promise<Lead | null> {
    try {
      const { data, error } = await db
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Lead;
    } catch (error) {
      console.error('Error fetching lead:', error);
      return null;
    }
  }

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead | null> {
    try {
      const { data, error } = await db
        .from('leads')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Lead;
    } catch (error) {
      console.error('Error updating lead:', error);
      return null;
    }
  }

  async deleteLead(id: string): Promise<boolean> {
    try {
      const { error } = await db.from('leads').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting lead:', error);
      return false;
    }
  }

  async checkDuplicateLead(email?: string, phone?: string, website?: string): Promise<boolean> {
    try {
      const { data, error } = await db.rpc('check_duplicate_lead', {
        p_email: email || null,
        p_phone: phone || null,
        p_website: website || null,
      });

      if (error) throw error;
      return data as boolean;
    } catch (error) {
      console.error('Error checking duplicate lead:', error);
      return false;
    }
  }

  // Campaigns CRUD operations
  async createCampaign(campaign: Partial<Campaign>): Promise<Campaign | null> {
    try {
      const { data, error } = await db
        .from('campaigns')
        .insert({
          ...campaign,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as Campaign;
    } catch (error) {
      console.error('Error creating campaign:', error);
      return null;
    }
  }

  async getCampaigns(filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Campaign[]> {
    try {
      let query = db
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Campaign[];
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      return [];
    }
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | null> {
    try {
      const { data, error } = await db
        .from('campaigns')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Campaign;
    } catch (error) {
      console.error('Error updating campaign:', error);
      return null;
    }
  }

  // Outreach messages CRUD operations
  async createOutreachMessage(message: Partial<OutreachMessage>): Promise<OutreachMessage | null> {
    try {
      const { data, error } = await db
        .from('outreach_messages')
        .insert({
          ...message,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as OutreachMessage;
    } catch (error) {
      console.error('Error creating outreach message:', error);
      return null;
    }
  }

  async getOutreachMessages(leadId?: string, campaignId?: string): Promise<OutreachMessage[]> {
    try {
      let query = db
        .from('outreach_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (leadId) {
        query = query.eq('lead_id', leadId);
      }
      if (campaignId) {
        query = query.eq('campaign_id', campaignId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as OutreachMessage[];
    } catch (error) {
      console.error('Error fetching outreach messages:', error);
      return [];
    }
  }

  async updateOutreachMessage(id: string, updates: Partial<OutreachMessage>): Promise<OutreachMessage | null> {
    try {
      const { data, error } = await db
        .from('outreach_messages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as OutreachMessage;
    } catch (error) {
      console.error('Error updating outreach message:', error);
      return null;
    }
  }

  // Email verification operations
  async createEmailVerification(verification: Partial<EmailVerification>): Promise<EmailVerification | null> {
    try {
      const { data, error } = await db
        .from('email_verifications')
        .insert({
          ...verification,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as EmailVerification;
    } catch (error) {
      console.error('Error creating email verification:', error);
      return null;
    }
  }

  async getEmailVerification(email: string): Promise<EmailVerification | null> {
    try {
      const { data, error } = await db
        .from('email_verifications')
        .select('*')
        .eq('email', email)
        .single();

      if (error) throw error;
      return data as EmailVerification;
    } catch (error) {
      console.error('Error fetching email verification:', error);
      return null;
    }
  }

  async updateEmailVerification(email: string, updates: Partial<EmailVerification>): Promise<EmailVerification | null> {
    try {
      const { data, error } = await db
        .from('email_verifications')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email)
        .select()
        .single();

      if (error) throw error;
      return data as EmailVerification;
    } catch (error) {
      console.error('Error updating email verification:', error);
      return null;
    }
  }

  // SEO analysis operations
  async createSEOAnalysis(analysis: Partial<SEOAnalysis>): Promise<SEOAnalysis | null> {
    try {
      const { data, error } = await db
        .from('seo_analysis')
        .insert({
          ...analysis,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as SEOAnalysis;
    } catch (error) {
      console.error('Error creating SEO analysis:', error);
      return null;
    }
  }

  async getSEOAnalysis(leadId?: string, keyword?: string): Promise<SEOAnalysis[]> {
    try {
      let query = db
        .from('seo_analysis')
        .select('*')
        .order('created_at', { ascending: false });

      if (leadId) {
        query = query.eq('lead_id', leadId);
      }
      if (keyword) {
        query = query.eq('keyword', keyword);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SEOAnalysis[];
    } catch (error) {
      console.error('Error fetching SEO analysis:', error);
      return [];
    }
  }

  // API integrations operations
  async createAPIIntegration(integration: Partial<APIIntegration>): Promise<APIIntegration | null> {
    try {
      const { data, error } = await db
        .from('api_integrations')
        .insert({
          ...integration,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as APIIntegration;
    } catch (error) {
      console.error('Error creating API integration:', error);
      return null;
    }
  }

  async getAPIIntegrations(provider?: string): Promise<APIIntegration[]> {
    try {
      let query = db
        .from('api_integrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (provider) {
        query = query.eq('provider', provider);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as APIIntegration[];
    } catch (error) {
      console.error('Error fetching API integrations:', error);
      return [];
    }
  }

  async updateAPIIntegration(id: string, updates: Partial<APIIntegration>): Promise<APIIntegration | null> {
    try {
      const { data, error } = await db
        .from('api_integrations')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as APIIntegration;
    } catch (error) {
      console.error('Error updating API integration:', error);
      return null;
    }
  }

  async incrementAPIRequests(provider: string): Promise<void> {
    try {
      const integration = await this.getAPIIntegrations(provider);
      if (integration && integration.length > 0) {
        await this.updateAPIIntegration(integration[0].id, {
          requests_today: integration[0].requests_today + 1,
          last_used_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error incrementing API requests:', error);
    }
  }

  // Lead activities operations
  async createLeadActivity(activity: Partial<LeadActivity>): Promise<LeadActivity | null> {
    try {
      const { data, error } = await db
        .from('lead_activities')
        .insert({
          ...activity,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as LeadActivity;
    } catch (error) {
      console.error('Error creating lead activity:', error);
      return null;
    }
  }

  async getLeadActivities(leadId: string): Promise<LeadActivity[]> {
    try {
      const { data, error } = await db
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as LeadActivity[];
    } catch (error) {
      console.error('Error fetching lead activities:', error);
      return [];
    }
  }

  // Analytics metrics operations
  async createAnalyticsMetrics(metrics: Partial<AnalyticsMetrics>): Promise<AnalyticsMetrics | null> {
    try {
      const { data, error } = await db
        .from('analytics_metrics')
        .insert({
          ...metrics,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as AnalyticsMetrics;
    } catch (error) {
      console.error('Error creating analytics metrics:', error);
      return null;
    }
  }

  async getAnalyticsMetrics(startDate?: string, endDate?: string): Promise<AnalyticsMetrics[]> {
    try {
      let query = db
        .from('analytics_metrics')
        .select('*')
        .order('metric_date', { ascending: false });

      if (startDate) {
        query = query.gte('metric_date', startDate);
      }
      if (endDate) {
        query = query.lte('metric_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AnalyticsMetrics[];
    } catch (error) {
      console.error('Error fetching analytics metrics:', error);
      return [];
    }
  }

  async updateAnalyticsMetrics(date: string, updates: Partial<AnalyticsMetrics>): Promise<AnalyticsMetrics | null> {
    try {
      const { data, error } = await db
        .from('analytics_metrics')
        .update(updates)
        .eq('metric_date', date)
        .select()
        .single();

      if (error) throw error;
      return data as AnalyticsMetrics;
    } catch (error) {
      console.error('Error updating analytics metrics:', error);
      return null;
    }
  }

  // Bulk operations
  async bulkCreateLeads(leads: Partial<Lead>[]): Promise<Lead[]> {
    try {
      const leadsWithTimestamps = leads.map(lead => ({
        ...lead,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await db
        .from('leads')
        .insert(leadsWithTimestamps)
        .select();

      if (error) throw error;
      return (data || []) as Lead[];
    } catch (error) {
      console.error('Error bulk creating leads:', error);
      return [];
    }
  }

  async exportLeadsToCSV(filters?: {
    status?: string;
    lead_score?: string;
    source?: string;
  }): Promise<string> {
    try {
      const leads = await this.getLeads(filters);
      
      const headers = [
        'Business Name',
        'Phone',
        'Email',
        'Website',
        'Rating',
        'Reviews',
        'Address',
        'City',
        'Country',
        'Source',
        'Lead Score',
        'Status',
        'Email Status',
        'Created At',
      ];

      const rows = leads.map(lead => [
        lead.business_name,
        lead.phone || '',
        lead.email || '',
        lead.website || '',
        lead.rating || '',
        lead.reviews_count || '',
        lead.address || '',
        lead.city || '',
        lead.country || '',
        lead.source,
        lead.lead_score,
        lead.status,
        lead.email_status,
        lead.created_at,
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      return csvContent;
    } catch (error) {
      console.error('Error exporting leads to CSV:', error);
      return '';
    }
  }
}

export const leadGenerationDB = new LeadGenerationDBService();
