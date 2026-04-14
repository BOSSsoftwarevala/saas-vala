// CSV Export Service for Lead Generation
import { leadGenerationDB } from './database.service';
import type { Lead, OutreachMessage, Campaign } from '@/types/lead-generation';

export class ExportService {
  /**
   * Export leads to CSV
   */
  async exportLeadsToCSV(filters?: {
    status?: string;
    lead_score?: string;
    source?: string;
    city?: string;
    country?: string;
  }): Promise<string> {
    try {
      const leads = await leadGenerationDB.getLeads(filters);
      
      const headers = [
        'ID',
        'Business Name',
        'Phone',
        'Email',
        'Website',
        'Rating',
        'Reviews',
        'Address',
        'City',
        'Country',
        'Business Type',
        'Source',
        'Lead Score',
        'Score Value',
        'Status',
        'Email Status',
        'Email Verified',
        'Is Duplicate',
        'Tags',
        'Notes',
        'Created At',
        'Updated At',
      ];
      
      const rows = leads.map(lead => [
        lead.id,
        lead.business_name,
        lead.phone || '',
        lead.email || '',
        lead.website || '',
        lead.rating || '',
        lead.reviews_count || '',
        lead.address || '',
        lead.city || '',
        lead.country || '',
        lead.business_type || '',
        lead.source,
        lead.lead_score,
        lead.lead_score_value,
        lead.status,
        lead.email_status,
        lead.email_verified,
        lead.is_duplicate,
        lead.tags.join('; '),
        lead.notes || '',
        lead.created_at,
        lead.updated_at,
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      
      return csvContent;
    } catch (error) {
      console.error('Error exporting leads to CSV:', error);
      return '';
    }
  }

  /**
   * Export campaigns to CSV
   */
  async exportCampaignsToCSV(): Promise<string> {
    try {
      const campaigns = await leadGenerationDB.getCampaigns();
      
      const headers = [
        'ID',
        'Name',
        'Description',
        'Keywords',
        'Target City',
        'Target Country',
        'Target Business Types',
        'Status',
        'Total Leads',
        'Contacted Leads',
        'Interested Leads',
        'Converted Leads',
        'Created At',
        'Updated At',
        'Last Run At',
      ];
      
      const rows = campaigns.map(campaign => [
        campaign.id,
        campaign.name,
        campaign.description || '',
        campaign.keywords.join('; '),
        campaign.target_city || '',
        campaign.target_country || '',
        campaign.target_business_types.join('; '),
        campaign.status,
        campaign.total_leads,
        campaign.contacted_leads,
        campaign.interested_leads,
        campaign.converted_leads,
        campaign.created_at,
        campaign.updated_at,
        campaign.last_run_at || '',
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      
      return csvContent;
    } catch (error) {
      console.error('Error exporting campaigns to CSV:', error);
      return '';
    }
  }

  /**
   * Export outreach messages to CSV
   */
  async exportOutreachMessagesToCSV(leadId?: string, campaignId?: string): Promise<string> {
    try {
      const messages = await leadGenerationDB.getOutreachMessages(leadId, campaignId);
      
      const headers = [
        'ID',
        'Lead ID',
        'Campaign ID',
        'Channel',
        'Template',
        'Personalized Content',
        'Status',
        'Sent At',
        'Opened At',
        'Replied At',
        'Error Message',
        'Follow Up Sequence',
        'Created At',
      ];
      
      const rows = messages.map(message => [
        message.id,
        message.lead_id,
        message.campaign_id || '',
        message.channel,
        message.template,
        message.personalized_content || '',
        message.status,
        message.sent_at || '',
        message.opened_at || '',
        message.replied_at || '',
        message.error_message || '',
        message.follow_up_sequence,
        message.created_at,
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      
      return csvContent;
    } catch (error) {
      console.error('Error exporting outreach messages to CSV:', error);
      return '';
    }
  }

  /**
   * Export analytics to CSV
   */
  async exportAnalyticsToCSV(startDate?: string, endDate?: string): Promise<string> {
    try {
      const metrics = await leadGenerationDB.getAnalyticsMetrics(startDate, endDate);
      
      const headers = [
        'ID',
        'Date',
        'Total Leads',
        'New Leads',
        'Contacted Leads',
        'Interested Leads',
        'Converted Leads',
        'Email Sent',
        'Email Opened',
        'Email Replied',
        'WhatsApp Sent',
        'Revenue',
        'Conversion Rate',
        'Created At',
      ];
      
      const rows = metrics.map(metric => [
        metric.id,
        metric.metric_date,
        metric.total_leads,
        metric.new_leads,
        metric.contacted_leads,
        metric.interested_leads,
        metric.converted_leads,
        metric.email_sent,
        metric.email_opened,
        metric.email_replied,
        metric.whatsapp_sent,
        metric.revenue,
        metric.conversion_rate,
        metric.created_at,
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      
      return csvContent;
    } catch (error) {
      console.error('Error exporting analytics to CSV:', error);
      return '';
    }
  }

  /**
   * Export duplicate report to CSV
   */
  async exportDuplicateReportToCSV(): Promise<string> {
    try {
      const { duplicateDetectionService } = await import('./duplicate-detection.service');
      const csv = await duplicateDetectionService.exportDuplicateReport();
      return csv;
    } catch (error) {
      console.error('Error exporting duplicate report to CSV:', error);
      return '';
    }
  }

  /**
   * Download CSV file
   */
  downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Export and download leads
   */
  async exportAndDownloadLeads(filters?: {
    status?: string;
    lead_score?: string;
    source?: string;
    city?: string;
    country?: string;
  }): Promise<void> {
    const csv = await this.exportLeadsToCSV(filters);
    if (csv) {
      const timestamp = new Date().toISOString().split('T')[0];
      this.downloadCSV(csv, `leads_export_${timestamp}.csv`);
    }
  }

  /**
   * Export and download campaigns
   */
  async exportAndDownloadCampaigns(): Promise<void> {
    const csv = await this.exportCampaignsToCSV();
    if (csv) {
      const timestamp = new Date().toISOString().split('T')[0];
      this.downloadCSV(csv, `campaigns_export_${timestamp}.csv`);
    }
  }

  /**
   * Export and download outreach messages
   */
  async exportAndDownloadOutreachMessages(leadId?: string, campaignId?: string): Promise<void> {
    const csv = await this.exportOutreachMessagesToCSV(leadId, campaignId);
    if (csv) {
      const timestamp = new Date().toISOString().split('T')[0];
      this.downloadCSV(csv, `outreach_messages_export_${timestamp}.csv`);
    }
  }

  /**
   * Export and download analytics
   */
  async exportAndDownloadAnalytics(startDate?: string, endDate?: string): Promise<void> {
    const csv = await this.exportAnalyticsToCSV(startDate, endDate);
    if (csv) {
      const timestamp = new Date().toISOString().split('T')[0];
      this.downloadCSV(csv, `analytics_export_${timestamp}.csv`);
    }
  }

  /**
   * Export and download duplicate report
   */
  async exportAndDownloadDuplicateReport(): Promise<void> {
    const csv = await this.exportDuplicateReportToCSV();
    if (csv) {
      const timestamp = new Date().toISOString().split('T')[0];
      this.downloadCSV(csv, `duplicate_report_${timestamp}.csv`);
    }
  }

  /**
   * Export to JSON
   */
  async exportLeadsToJSON(filters?: {
    status?: string;
    lead_score?: string;
    source?: string;
    city?: string;
    country?: string;
  }): Promise<string> {
    try {
      const leads = await leadGenerationDB.getLeads(filters);
      return JSON.stringify(leads, null, 2);
    } catch (error) {
      console.error('Error exporting leads to JSON:', error);
      return '';
    }
  }

  /**
   * Download JSON file
   */
  downloadJSON(jsonContent: string, filename: string): void {
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Export and download leads as JSON
   */
  async exportAndDownloadLeadsAsJSON(filters?: {
    status?: string;
    lead_score?: string;
    source?: string;
    city?: string;
    country?: string;
  }): Promise<void> {
    const json = await this.exportLeadsToJSON(filters);
    if (json) {
      const timestamp = new Date().toISOString().split('T')[0];
      this.downloadJSON(json, `leads_export_${timestamp}.json`);
    }
  }
}

export const exportService = new ExportService();
