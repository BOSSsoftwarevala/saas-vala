// Module 10: Analytics Dashboard Service
import { leadGenerationDB } from './database.service';
import type {
  AnalyticsConfig,
  AnalyticsMetrics,
} from '@/types/lead-generation';

export class AnalyticsService {
  /**
   * Get analytics metrics for a date range
   */
  async getAnalytics(config: AnalyticsConfig): Promise<{
    total_leads: number;
    new_leads: number;
    contacted_leads: number;
    interested_leads: number;
    converted_leads: number;
    email_sent: number;
    email_opened: number;
    email_replied: number;
    whatsapp_sent: number;
    revenue: number;
    conversion_rate: number;
    lead_score_distribution: {
      hot: number;
      warm: number;
      cold: number;
    };
    source_distribution: {
      maps: number;
      website: number;
      linkedin: number;
      social: number;
    };
    trend_data: {
      date: string;
      leads: number;
      conversions: number;
    }[];
  }> {
    try {
      const startDate = config.startDate || this.getDefaultStartDate(config.dateRange);
      const endDate = config.endDate || new Date().toISOString().split('T')[0];
      
      // Get leads for the date range
      const leads = await leadGenerationDB.getLeads();
      const filteredLeads = leads.filter(lead => {
        const leadDate = new Date(lead.created_at).toISOString().split('T')[0];
        return leadDate >= startDate && leadDate <= endDate;
      });
      
      // Calculate basic metrics
      const totalLeads = filteredLeads.length;
      const newLeads = filteredLeads.filter(l => l.status === 'new').length;
      const contactedLeads = filteredLeads.filter(l => l.status === 'contacted').length;
      const interestedLeads = filteredLeads.filter(l => l.status === 'interested').length;
      const convertedLeads = filteredLeads.filter(l => l.status === 'converted').length;
      
      // Get outreach messages
      const allMessages = await leadGenerationDB.getOutreachMessages();
      const filteredMessages = allMessages.filter(msg => {
        if (!msg.sent_at) return false;
        const msgDate = new Date(msg.sent_at).toISOString().split('T')[0];
        return msgDate >= startDate && msgDate <= endDate;
      });
      
      const emailSent = filteredMessages.filter(m => m.channel === 'email').length;
      const emailOpened = filteredMessages.filter(m => m.status === 'opened').length;
      const emailReplied = filteredMessages.filter(m => m.status === 'replied').length;
      const whatsappSent = filteredMessages.filter(m => m.channel === 'whatsapp').length;
      
      // Calculate conversion rate
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
      
      // Lead score distribution
      const hotLeads = filteredLeads.filter(l => l.lead_score === 'hot').length;
      const warmLeads = filteredLeads.filter(l => l.lead_score === 'warm').length;
      const coldLeads = filteredLeads.filter(l => l.lead_score === 'cold').length;
      
      // Source distribution
      const mapsLeads = filteredLeads.filter(l => l.source === 'maps').length;
      const websiteLeads = filteredLeads.filter(l => l.source === 'website').length;
      const linkedinLeads = filteredLeads.filter(l => l.source === 'linkedin').length;
      const socialLeads = filteredLeads.filter(l => l.source === 'social').length;
      
      // Get trend data
      const trendData = await this.getTrendData(startDate, endDate);
      
      return {
        total_leads: totalLeads,
        new_leads: newLeads,
        contacted_leads: contactedLeads,
        interested_leads: interestedLeads,
        converted_leads: convertedLeads,
        email_sent: emailSent,
        email_opened: emailOpened,
        email_replied: emailReplied,
        whatsapp_sent: whatsappSent,
        revenue: 0, // Placeholder - would calculate from actual revenue data
        conversion_rate: Math.round(conversionRate),
        lead_score_distribution: {
          hot: hotLeads,
          warm: warmLeads,
          cold: coldLeads,
        },
        source_distribution: {
          maps: mapsLeads,
          website: websiteLeads,
          linkedin: linkedinLeads,
          social: socialLeads,
        },
        trend_data: trendData,
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      return {
        total_leads: 0,
        new_leads: 0,
        contacted_leads: 0,
        interested_leads: 0,
        converted_leads: 0,
        email_sent: 0,
        email_opened: 0,
        email_replied: 0,
        whatsapp_sent: 0,
        revenue: 0,
        conversion_rate: 0,
        lead_score_distribution: {
          hot: 0,
          warm: 0,
          cold: 0,
        },
        source_distribution: {
          maps: 0,
          website: 0,
          linkedin: 0,
          social: 0,
        },
        trend_data: [],
      };
    }
  }

  /**
   * Get default start date based on date range
   */
  private getDefaultStartDate(dateRange: '7d' | '30d' | '90d' | 'custom'): string {
    const now = new Date();
    
    switch (dateRange) {
      case '7d':
        now.setDate(now.getDate() - 7);
        break;
      case '30d':
        now.setDate(now.getDate() - 30);
        break;
      case '90d':
        now.setDate(now.getDate() - 90);
        break;
      default:
        now.setDate(now.getDate() - 30);
    }
    
    return now.toISOString().split('T')[0];
  }

  /**
   * Get trend data for charts
   */
  private async getTrendData(startDate: string, endDate: string): Promise<{
    date: string;
    leads: number;
    conversions: number;
  }[]> {
    try {
      const leads = await leadGenerationDB.getLeads();
      
      // Group leads by date
      const leadsByDate: { [key: string]: number } = {};
      const conversionsByDate: { [key: string]: number } = {};
      
      for (const lead of leads) {
        const leadDate = new Date(lead.created_at).toISOString().split('T')[0];
        
        if (leadDate >= startDate && leadDate <= endDate) {
          leadsByDate[leadDate] = (leadsByDate[leadDate] || 0) + 1;
          
          if (lead.status === 'converted') {
            conversionsByDate[leadDate] = (conversionsByDate[leadDate] || 0) + 1;
          }
        }
      }
      
      // Generate trend data for all dates in range
      const trendData: { date: string; leads: number; conversions: number }[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];
        trendData.push({
          date: dateStr,
          leads: leadsByDate[dateStr] || 0,
          conversions: conversionsByDate[dateStr] || 0,
        });
      }
      
      return trendData;
    } catch (error) {
      console.error('Error getting trend data:', error);
      return [];
    }
  }

  /**
   * Get daily analytics for a specific date
   */
  async getDailyAnalytics(date: string): Promise<AnalyticsMetrics | null> {
    try {
      const metrics = await leadGenerationDB.getAnalyticsMetrics(date, date);
      
      if (metrics.length > 0) {
        return metrics[0];
      }
      
      // If no metrics exist, calculate from leads
      const leads = await leadGenerationDB.getLeads();
      const filteredLeads = leads.filter(lead => {
        const leadDate = new Date(lead.created_at).toISOString().split('T')[0];
        return leadDate === date;
      });
      
      const newLeads = filteredLeads.length;
      const contactedLeads = filteredLeads.filter(l => l.status === 'contacted').length;
      const interestedLeads = filteredLeads.filter(l => l.status === 'interested').length;
      const convertedLeads = filteredLeads.filter(l => l.status === 'converted').length;
      
      const messages = await leadGenerationDB.getOutreachMessages();
      const filteredMessages = messages.filter(msg => {
        if (!msg.sent_at) return false;
        const msgDate = new Date(msg.sent_at).toISOString().split('T')[0];
        return msgDate === date;
      });
      
      const emailSent = filteredMessages.filter(m => m.channel === 'email').length;
      const emailOpened = filteredMessages.filter(m => m.status === 'opened').length;
      const emailReplied = filteredMessages.filter(m => m.status === 'replied').length;
      const whatsappSent = filteredMessages.filter(m => m.channel === 'whatsapp').length;
      
      const conversionRate = newLeads > 0 ? (convertedLeads / newLeads) * 100 : 0;
      
      const analyticsData: Partial<AnalyticsMetrics> = {
        metric_date: date,
        total_leads: leads.length,
        new_leads: newLeads,
        contacted_leads: contactedLeads,
        interested_leads: interestedLeads,
        converted_leads: convertedLeads,
        email_sent: emailSent,
        email_opened: emailOpened,
        email_replied: emailReplied,
        whatsapp_sent: whatsappSent,
        revenue: 0,
        conversion_rate: Math.round(conversionRate),
      };
      
      return await leadGenerationDB.createAnalyticsMetrics(analyticsData);
    } catch (error) {
      console.error('Error getting daily analytics:', error);
      return null;
    }
  }

  /**
   * Update daily analytics
   */
  async updateDailyAnalytics(date: string): Promise<AnalyticsMetrics | null> {
    try {
      const analytics = await this.getDailyAnalytics(date);
      
      if (!analytics) return null;
      
      return await leadGenerationDB.updateAnalyticsMetrics(date, analytics);
    } catch (error) {
      console.error('Error updating daily analytics:', error);
      return null;
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    avg_response_time: number;
    avg_conversion_time: number;
    top_performing_sources: {
      source: string;
      leads: number;
      conversions: number;
      conversion_rate: number;
    }[];
    top_performing_campaigns: {
      campaign_id: string;
      campaign_name: string;
      leads: number;
      conversions: number;
      conversion_rate: number;
    }[];
  }> {
    try {
      // Placeholder for performance metrics
      // In production, this would:
      // 1. Calculate average response time
      // 2. Calculate average conversion time
      // 3. Get top performing sources
      // 4. Get top performing campaigns
      
      return {
        avg_response_time: 24, // hours
        avg_conversion_time: 72, // hours
        top_performing_sources: [
          { source: 'maps', leads: 100, conversions: 20, conversion_rate: 20 },
          { source: 'website', leads: 80, conversions: 15, conversion_rate: 18.75 },
          { source: 'linkedin', leads: 50, conversions: 10, conversion_rate: 20 },
        ],
        top_performing_campaigns: [],
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return {
        avg_response_time: 0,
        avg_conversion_time: 0,
        top_performing_sources: [],
        top_performing_campaigns: [],
      };
    }
  }

  /**
   * Get funnel analytics
   */
  async getFunnelAnalytics(): Promise<{
    stage: string;
    count: number;
    percentage: number;
    drop_off: number;
  }[]> {
    try {
      const leads = await leadGenerationDB.getLeads();
      
      const stages = [
        { name: 'new', label: 'New Leads' },
        { name: 'contacted', label: 'Contacted' },
        { name: 'interested', label: 'Interested' },
        { name: 'converted', label: 'Converted' },
      ];
      
      const funnelData: {
        stage: string;
        count: number;
        percentage: number;
        drop_off: number;
      }[] = [];
      
      let previousCount = leads.length;
      
      for (const stage of stages) {
        const count = leads.filter(l => l.status === stage.name).length;
        const percentage = leads.length > 0 ? (count / leads.length) * 100 : 0;
        const dropOff = previousCount > 0 ? ((previousCount - count) / previousCount) * 100 : 0;
        
        funnelData.push({
          stage: stage.label,
          count,
          percentage: Math.round(percentage),
          drop_off: Math.round(dropOff),
        });
        
        previousCount = count;
      }
      
      return funnelData;
    } catch (error) {
      console.error('Error getting funnel analytics:', error);
      return [];
    }
  }

  /**
   * Get ROI metrics
   */
  async getROIMetrics(): Promise<{
    total_investment: number;
    total_revenue: number;
    roi: number;
    cost_per_lead: number;
    revenue_per_lead: number;
  }> {
    try {
      // Placeholder for ROI metrics
      // In production, this would:
      // 1. Calculate total investment (ads, tools, etc.)
      // 2. Calculate total revenue from conversions
      // 3. Calculate ROI
      // 4. Calculate cost per lead
      // 5. Calculate revenue per lead
      
      const leads = await leadGenerationDB.getLeads();
      const convertedLeads = leads.filter(l => l.status === 'converted').length;
      
      return {
        total_investment: 1000,
        total_revenue: 5000,
        roi: 400,
        cost_per_lead: leads.length > 0 ? 1000 / leads.length : 0,
        revenue_per_lead: convertedLeads > 0 ? 5000 / convertedLeads : 0,
      };
    } catch (error) {
      console.error('Error getting ROI metrics:', error);
      return {
        total_investment: 0,
        total_revenue: 0,
        roi: 0,
        cost_per_lead: 0,
        revenue_per_lead: 0,
      };
    }
  }

  /**
   * Generate analytics report
   */
  async generateReport(config: AnalyticsConfig): Promise<{
    summary: string;
    metrics: any;
    recommendations: string[];
  }> {
    try {
      const analytics = await this.getAnalytics(config);
      
      const summary = `Total leads: ${analytics.total_leads}, Conversions: ${analytics.converted_leads}, Conversion rate: ${analytics.conversion_rate}%`;
      
      const recommendations: string[] = [];
      
      if (analytics.conversion_rate < 10) {
        recommendations.push('Improve outreach strategy to increase conversion rate');
      }
      
      if (analytics.email_opened < analytics.email_sent * 0.3) {
        recommendations.push('Optimize email subject lines to improve open rates');
      }
      
      if (analytics.lead_score_distribution.cold > analytics.lead_score_distribution.hot) {
        recommendations.push('Focus on lead quality to improve scoring');
      }
      
      return {
        summary,
        metrics: analytics,
        recommendations,
      };
    } catch (error) {
      console.error('Error generating report:', error);
      return {
        summary: 'Error generating report',
        metrics: {},
        recommendations: [],
      };
    }
  }

  /**
   * Export analytics data to CSV
   */
  async exportToCSV(config: AnalyticsConfig): Promise<string> {
    try {
      const analytics = await this.getAnalytics(config);
      
      const headers = [
        'Date',
        'Total Leads',
        'New Leads',
        'Contacted',
        'Interested',
        'Converted',
        'Email Sent',
        'Email Opened',
        'Email Replied',
        'WhatsApp Sent',
        'Conversion Rate',
      ];
      
      const rows = analytics.trend_data.map(trend => [
        trend.date,
        trend.leads,
        analytics.new_leads,
        analytics.contacted_leads,
        analytics.interested_leads,
        analytics.converted_leads,
        analytics.email_sent,
        analytics.email_opened,
        analytics.email_replied,
        analytics.whatsapp_sent,
        analytics.conversion_rate,
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');
      
      return csvContent;
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      return '';
    }
  }
}

export const analyticsService = new AnalyticsService();
