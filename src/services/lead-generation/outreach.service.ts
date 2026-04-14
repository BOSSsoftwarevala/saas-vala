// Module 8: Auto Outreach System Service
import { leadGenerationDB } from './database.service';
import type {
  OutreachConfig,
  OutreachResult,
  OutreachMessage,
  Lead,
} from '@/types/lead-generation';

export class OutreachService {
  private rateLimitDelay = 2000; // 2 seconds between requests
  private maxRetries = 3;
  private isRunning = false;
  private stopSignal = false;

  /**
   * Send outreach message to a lead
   */
  async sendOutreach(leadId: string, config: OutreachConfig): Promise<OutreachResult> {
    try {
      const lead = await leadGenerationDB.getLeadById(leadId);
      
      if (!lead) {
        return {
          lead_id: leadId,
          message_id: '',
          status: 'failed',
          error: 'Lead not found',
        };
      }
      
      // Personalize the template
      const personalizedContent = config.personalizationEnabled
        ? this.personalizeTemplate(config.template, lead)
        : config.template;
      
      // Create outreach message record
      const messageData: Partial<OutreachMessage> = {
        lead_id: leadId,
        channel: config.channel,
        template: config.template,
        personalized_content: personalizedContent,
        status: 'pending',
        follow_up_sequence: 0,
      };
      
      const message = await leadGenerationDB.createOutreachMessage(messageData);
      
      if (!message) {
        return {
          lead_id: leadId,
          message_id: '',
          status: 'failed',
          error: 'Failed to create message record',
        };
      }
      
      // Send the message based on channel
      let sendSuccess = false;
      let errorMessage: string | undefined;
      
      switch (config.channel) {
        case 'email':
          sendSuccess = await this.sendEmail(lead, personalizedContent);
          break;
        case 'whatsapp':
          sendSuccess = await this.sendWhatsApp(lead, personalizedContent);
          break;
        case 'linkedin':
          sendSuccess = await this.sendLinkedIn(lead, personalizedContent);
          break;
        default:
          errorMessage = 'Unsupported channel';
      }
      
      // Update message status
      const updateData: Partial<OutreachMessage> = {
        status: sendSuccess ? 'sent' : 'failed',
        sent_at: sendSuccess ? new Date().toISOString() : undefined,
        error_message: errorMessage,
      };
      
      await leadGenerationDB.updateOutreachMessage(message.id, updateData);
      
      // Update lead status
      if (sendSuccess) {
        await leadGenerationDB.updateLead(leadId, {
          status: 'contacted',
        });
      }
      
      return {
        lead_id: leadId,
        message_id: message.id,
        status: sendSuccess ? 'sent' : 'failed',
        error: errorMessage,
      };
    } catch (error) {
      console.error('Error sending outreach:', error);
      return {
        lead_id: leadId,
        message_id: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Personalize template with lead data
   */
  private personalizeTemplate(template: string, lead: Lead): string {
    let personalized = template;
    
    // Replace placeholders with lead data
    personalized = personalized.replace(/\{business_name\}/g, lead.business_name || '');
    personalized = personalized.replace(/\{name\}/g, lead.business_name || '');
    personalized = personalized.replace(/\{city\}/g, lead.city || '');
    personalized = personalized.replace(/\{country\}/g, lead.country || '');
    personalized = personalized.replace(/\{website\}/g, lead.website || '');
    personalized = personalized.replace(/\{phone\}/g, lead.phone || '');
    personalized = personalized.replace(/\{rating\}/g, lead.rating?.toString() || '');
    personalized = personalized.replace(/\{reviews\}/g, lead.reviews_count?.toString() || '');
    
    return personalized;
  }

  /**
   * Send email
   */
  private async sendEmail(lead: Lead, content: string): Promise<boolean> {
    try {
      if (!lead.email) {
        console.error('No email address for lead');
        return false;
      }
      
      // Placeholder for email sending logic
      // In production, this would:
      // 1. Use SendGrid, Mailgun, or AWS SES
      // 2. Send personalized email
      // 3. Track delivery and opens
      // 4. Handle bounces and complaints
      
      await this.delay(500); // Simulate email sending
      return true; // Simulated success
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  /**
   * Send WhatsApp message
   */
  private async sendWhatsApp(lead: Lead, content: string): Promise<boolean> {
    try {
      if (!lead.phone) {
        console.error('No phone number for lead');
        return false;
      }
      
      // Placeholder for WhatsApp sending logic
      // In production, this would:
      // 1. Use WhatsApp Business API
      // 2. Send personalized message
      // 3. Track delivery status
      // 4. Handle errors and retries
      
      await this.delay(500); // Simulate WhatsApp sending
      return true; // Simulated success
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      return false;
    }
  }

  /**
   * Send LinkedIn message
   */
  private async sendLinkedIn(lead: Lead, content: string): Promise<boolean> {
    try {
      // Placeholder for LinkedIn message sending logic
      // In production, this would:
      // 1. Use LinkedIn API or automation tool
      // 2. Send personalized message
      // 3. Track delivery status
      // 4. Handle rate limits and errors
      
      await this.delay(500); // Simulate LinkedIn sending
      return true; // Simulated success
    } catch (error) {
      console.error('Error sending LinkedIn:', error);
      return false;
    }
  }

  /**
   * Bulk send outreach to multiple leads
   */
  async bulkSendOutreach(leadIds: string[], config: OutreachConfig): Promise<OutreachResult[]> {
    const results: OutreachResult[] = [];
    
    for (const leadId of leadIds) {
      if (this.stopSignal) break;
      
      try {
        const result = await this.sendOutreach(leadId, config);
        results.push(result);
        
        // Rate limiting
        await this.delay(this.rateLimitDelay);
      } catch (error) {
        console.error(`Error sending outreach to lead ${leadId}:`, error);
        results.push({
          lead_id: leadId,
          message_id: '',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return results;
  }

  /**
   * Schedule follow-up messages
   */
  async scheduleFollowUp(leadId: string, config: OutreachConfig, days: number[]): Promise<void> {
    try {
      for (const day of days) {
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + day);
        
        // In production, this would:
        // 1. Use a job scheduler (like Bull, Agenda, or cron)
        // 2. Schedule follow-up message
        // 3. Track scheduled follow-ups
        // 4. Handle rescheduling and cancellations
        
        console.log(`Follow-up scheduled for lead ${leadId} in ${day} days`);
      }
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
    }
  }

  /**
   * Send follow-up message
   */
  async sendFollowUp(messageId: string, template: string): Promise<boolean> {
    try {
      const message = await leadGenerationDB.getOutreachMessages(undefined, undefined)
        .then(msgs => msgs.find(m => m.id === messageId));
      
      if (!message) {
        console.error('Message not found');
        return false;
      }
      
      const lead = await leadGenerationDB.getLeadById(message.lead_id);
      
      if (!lead) {
        console.error('Lead not found');
        return false;
      }
      
      const personalizedContent = this.personalizeTemplate(template, lead);
      
      // Send the follow-up message
      let sendSuccess = false;
      
      switch (message.channel) {
        case 'email':
          sendSuccess = await this.sendEmail(lead, personalizedContent);
          break;
        case 'whatsapp':
          sendSuccess = await this.sendWhatsApp(lead, personalizedContent);
          break;
        case 'linkedin':
          sendSuccess = await this.sendLinkedIn(lead, personalizedContent);
          break;
      }
      
      // Update message record
      await leadGenerationDB.updateOutreachMessage(messageId, {
        template,
        personalized_content: personalizedContent,
        status: sendSuccess ? 'sent' : 'failed',
        sent_at: sendSuccess ? new Date().toISOString() : undefined,
        follow_up_sequence: message.follow_up_sequence + 1,
      });
      
      return sendSuccess;
    } catch (error) {
      console.error('Error sending follow-up:', error);
      return false;
    }
  }

  /**
   * Track message opens
   */
  async trackMessageOpen(messageId: string): Promise<void> {
    try {
      await leadGenerationDB.updateOutreachMessage(messageId, {
        status: 'opened',
        opened_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error tracking message open:', error);
    }
  }

  /**
   * Track message replies
   */
  async trackMessageReply(messageId: string): Promise<void> {
    try {
      await leadGenerationDB.updateOutreachMessage(messageId, {
        status: 'replied',
        replied_at: new Date().toISOString(),
      });
      
      // Update lead status to interested
      const message = await leadGenerationDB.getOutreachMessages(undefined, undefined)
        .then(msgs => msgs.find(m => m.id === messageId));
      
      if (message) {
        await leadGenerationDB.updateLead(message.lead_id, {
          status: 'interested',
        });
      }
    } catch (error) {
      console.error('Error tracking message reply:', error);
    }
  }

  /**
   * Get outreach statistics for a campaign
   */
  async getOutreachStatistics(campaignId?: string): Promise<{
    total_sent: number;
    total_opened: number;
    total_replied: number;
    total_failed: number;
    open_rate: number;
    reply_rate: number;
  }> {
    try {
      const messages = await leadGenerationDB.getOutreachMessages(undefined, campaignId);
      
      const totalSent = messages.filter(m => m.status === 'sent').length;
      const totalOpened = messages.filter(m => m.status === 'opened').length;
      const totalReplied = messages.filter(m => m.status === 'replied').length;
      const totalFailed = messages.filter(m => m.status === 'failed').length;
      
      const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
      const replyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;
      
      return {
        total_sent: totalSent,
        total_opened: totalOpened,
        total_replied: totalReplied,
        total_failed: totalFailed,
        open_rate: Math.round(openRate),
        reply_rate: Math.round(replyRate),
      };
    } catch (error) {
      console.error('Error getting outreach statistics:', error);
      return {
        total_sent: 0,
        total_opened: 0,
        total_replied: 0,
        total_failed: 0,
        open_rate: 0,
        reply_rate: 0,
      };
    }
  }

  /**
   * Run complete outreach workflow
   */
  async runOutreachWorkflow(
    leadIds: string[],
    config: OutreachConfig,
    scheduleFollowUps: boolean = false
  ): Promise<{
    total_leads: number;
    sent: number;
    failed: number;
    follow_ups_scheduled: number;
  }> {
    if (this.isRunning) {
      throw new Error('Outreach workflow is already running');
    }
    
    this.isRunning = true;
    this.stopSignal = false;
    
    try {
      const results = await this.bulkSendOutreach(leadIds, config);
      
      const sent = results.filter(r => r.status === 'sent').length;
      const failed = results.filter(r => r.status === 'failed').length;
      
      let followUpsScheduled = 0;
      
      if (scheduleFollowUps && config.followUpDays && config.followUpDays.length > 0) {
        for (const result of results) {
          if (result.status === 'sent') {
            await this.scheduleFollowUp(result.lead_id, config, config.followUpDays);
            followUpsScheduled++;
          }
        }
      }
      
      return {
        total_leads: leadIds.length,
        sent,
        failed,
        follow_ups_scheduled: followUpsScheduled,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop the outreach workflow
   */
  stopOutreach(): void {
    this.stopSignal = true;
  }

  /**
   * Check if outreach is currently running
   */
  isOutreachRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Utility function for delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries = this.maxRetries
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      
      const delay = Math.pow(2, this.maxRetries - retries) * 1000;
      await this.delay(delay);
      
      return this.retryWithBackoff(fn, retries - 1);
    }
  }
}

export const outreachService = new OutreachService();
