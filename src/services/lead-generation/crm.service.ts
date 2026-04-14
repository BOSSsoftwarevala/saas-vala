// Module 9: CRM Pipeline Service
import { leadGenerationDB } from './database.service';
import type {
  CRMStage,
  CRMLead,
  LeadActivity,
  Lead,
} from '@/types/lead-generation';

export class CRMService {
  private defaultStages: CRMStage[] = [
    { name: 'new', order: 1, color: '#gray' },
    { name: 'contacted', order: 2, color: '#blue' },
    { name: 'interested', order: 3, color: '#yellow' },
    { name: 'converted', order: 4, color: '#green' },
    { name: 'lost', order: 5, color: '#red' },
  ];

  /**
   * Get all CRM stages
   */
  getStages(): CRMStage[] {
    return this.defaultStages;
  }

  /**
   * Get lead with CRM data
   */
  async getCRMLead(leadId: string): Promise<CRMLead | null> {
    try {
      const lead = await leadGenerationDB.getLeadById(leadId);
      
      if (!lead) return null;
      
      const activities = await leadGenerationDB.getLeadActivities(leadId);
      
      const stage = this.determineStage(lead);
      
      return {
        lead,
        stage,
        activities,
        next_action: this.determineNextAction(lead, stage),
        next_action_date: this.calculateNextActionDate(lead, stage),
      };
    } catch (error) {
      console.error('Error getting CRM lead:', error);
      return null;
    }
  }

  /**
   * Determine CRM stage based on lead status
   */
  private determineStage(lead: Lead): string {
    return lead.status || 'new';
  }

  /**
   * Determine next action for lead
   */
  private determineNextAction(lead: Lead, stage: string): string | undefined {
    switch (stage) {
      case 'new':
        return 'Send initial outreach';
      case 'contacted':
        return 'Follow up in 3 days';
      case 'interested':
        return 'Schedule demo call';
      case 'converted':
        return 'Onboarding and support';
      case 'lost':
        return 'Re-engagement campaign';
      default:
        return undefined;
    }
  }

  /**
   * Calculate next action date
   */
  private calculateNextActionDate(lead: Lead, stage: string): string | undefined {
    const now = new Date();
    
    switch (stage) {
      case 'new':
        now.setDate(now.getDate() + 1);
        return now.toISOString();
      case 'contacted':
        now.setDate(now.getDate() + 3);
        return now.toISOString();
      case 'interested':
        now.setDate(now.getDate() + 2);
        return now.toISOString();
      default:
        return undefined;
    }
  }

  /**
   * Update lead stage
   */
  async updateLeadStage(leadId: string, stage: string): Promise<Lead | null> {
    try {
      return await leadGenerationDB.updateLead(leadId, {
        status: stage as Lead['status'],
      });
    } catch (error) {
      console.error('Error updating lead stage:', error);
      return null;
    }
  }

  /**
   * Add activity to lead
   */
  async addActivity(leadId: string, activity: Partial<LeadActivity>): Promise<LeadActivity | null> {
    try {
      const activityData: Partial<LeadActivity> = {
        ...activity,
        lead_id: leadId,
        created_by: activity.created_by || 'system',
      };
      
      return await leadGenerationDB.createLeadActivity(activityData);
    } catch (error) {
      console.error('Error adding activity:', error);
      return null;
    }
  }

  /**
   * Get all leads with CRM data
   */
  async getAllCRMLeads(filters?: {
    stage?: string;
    limit?: number;
    offset?: number;
  }): Promise<CRMLead[]> {
    try {
      const leads = await leadGenerationDB.getLeads({
        status: filters?.stage,
        limit: filters?.limit,
        offset: filters?.offset,
      });
      
      const crmLeads: CRMLead[] = [];
      
      for (const lead of leads) {
        const crmLead = await this.getCRMLead(lead.id);
        if (crmLead) {
          crmLeads.push(crmLead);
        }
      }
      
      return crmLeads;
    } catch (error) {
      console.error('Error getting all CRM leads:', error);
      return [];
    }
  }

  /**
   * Get pipeline statistics
   */
  async getPipelineStatistics(): Promise<{
    total_leads: number;
    stages: {
      [key: string]: {
        count: number;
        percentage: number;
      };
    };
    conversion_rate: number;
    avg_time_in_stage: {
      [key: string]: number;
    };
  }> {
    try {
      const leads = await leadGenerationDB.getLeads();
      
      const stages: { [key: string]: { count: number; percentage: number } } = {};
      const stageCounts: { [key: string]: number } = {};
      
      // Count leads by stage
      for (const lead of leads) {
        const stage = lead.status || 'new';
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      }
      
      // Calculate percentages
      for (const stage of this.defaultStages) {
        const count = stageCounts[stage.name] || 0;
        const percentage = leads.length > 0 ? (count / leads.length) * 100 : 0;
        stages[stage.name] = { count, percentage: Math.round(percentage) };
      }
      
      // Calculate conversion rate (new to converted)
      const newLeads = stageCounts['new'] || 0;
      const convertedLeads = stageCounts['converted'] || 0;
      const conversionRate = newLeads > 0 ? (convertedLeads / newLeads) * 100 : 0;
      
      // Calculate average time in stage (placeholder)
      const avgTimeInStage: { [key: string]: number } = {};
      for (const stage of this.defaultStages) {
        avgTimeInStage[stage.name] = Math.floor(Math.random() * 10) + 1; // Placeholder
      }
      
      return {
        total_leads: leads.length,
        stages,
        conversion_rate: Math.round(conversionRate),
        avg_time_in_stage: avgTimeInStage,
      };
    } catch (error) {
      console.error('Error getting pipeline statistics:', error);
      return {
        total_leads: 0,
        stages: {},
        conversion_rate: 0,
        avg_time_in_stage: {},
      };
    }
  }

  /**
   * Move lead to next stage
   */
  async moveToNextStage(leadId: string): Promise<Lead | null> {
    try {
      const crmLead = await this.getCRMLead(leadId);
      
      if (!crmLead) return null;
      
      const currentStageIndex = this.defaultStages.findIndex(s => s.name === crmLead.stage);
      
      if (currentStageIndex === -1 || currentStageIndex === this.defaultStages.length - 1) {
        return null;
      }
      
      const nextStage = this.defaultStages[currentStageIndex + 1];
      
      // Add activity for stage change
      await this.addActivity(leadId, {
        activity_type: 'note',
        description: `Moved from ${crmLead.stage} to ${nextStage.name}`,
      });
      
      return await this.updateLeadStage(leadId, nextStage.name);
    } catch (error) {
      console.error('Error moving lead to next stage:', error);
      return null;
    }
  }

  /**
   * Move lead to previous stage
   */
  async moveToPreviousStage(leadId: string): Promise<Lead | null> {
    try {
      const crmLead = await this.getCRMLead(leadId);
      
      if (!crmLead) return null;
      
      const currentStageIndex = this.defaultStages.findIndex(s => s.name === crmLead.stage);
      
      if (currentStageIndex <= 0) {
        return null;
      }
      
      const previousStage = this.defaultStages[currentStageIndex - 1];
      
      // Add activity for stage change
      await this.addActivity(leadId, {
        activity_type: 'note',
        description: `Moved from ${crmLead.stage} to ${previousStage.name}`,
      });
      
      return await this.updateLeadStage(leadId, previousStage.name);
    } catch (error) {
      console.error('Error moving lead to previous stage:', error);
      return null;
    }
  }

  /**
   * Schedule follow-up for lead
   */
  async scheduleFollowUp(leadId: string, date: string, description: string): Promise<void> {
    try {
      // Add activity as a task
      await this.addActivity(leadId, {
        activity_type: 'task',
        description: `Follow-up: ${description} (Scheduled: ${new Date(date).toLocaleDateString()})`,
      });
      
      // In production, this would:
      // 1. Use a job scheduler
      // 2. Schedule reminder notification
      // 3. Send email/notification at scheduled time
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
    }
  }

  /**
   * Get leads that need follow-up
   */
  async getLeadsNeedingFollowUp(): Promise<CRMLead[]> {
    try {
      const leads = await leadGenerationDB.getLeads({
        status: 'contacted',
      });
      
      const crmLeads: CRMLead[] = [];
      
      for (const lead of leads) {
        const crmLead = await this.getCRMLead(lead.id);
        
        if (crmLead && crmLead.next_action_date) {
          const nextActionDate = new Date(crmLead.next_action_date);
          const now = new Date();
          
          // Check if follow-up is due (within 24 hours)
          const diffHours = Math.abs(nextActionDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          
          if (diffHours <= 24) {
            crmLeads.push(crmLead);
          }
        }
      }
      
      return crmLeads;
    } catch (error) {
      console.error('Error getting leads needing follow-up:', error);
      return [];
    }
  }

  /**
   * Add note to lead
   */
  async addNote(leadId: string, note: string, createdBy?: string): Promise<LeadActivity | null> {
    return await this.addActivity(leadId, {
      activity_type: 'note',
      description: note,
      created_by: createdBy,
    });
  }

  /**
   * Log call with lead
   */
  async logCall(leadId: string, description: string, createdBy?: string): Promise<LeadActivity | null> {
    return await this.addActivity(leadId, {
      activity_type: 'call',
      description,
      created_by: createdBy,
    });
  }

  /**
   * Log email with lead
   */
  async logEmail(leadId: string, description: string, createdBy?: string): Promise<LeadActivity | null> {
    return await this.addActivity(leadId, {
      activity_type: 'email',
      description,
      created_by: createdBy,
    });
  }

  /**
   * Schedule meeting with lead
   */
  async scheduleMeeting(leadId: string, date: string, description: string, createdBy?: string): Promise<LeadActivity | null> {
    const activity = await this.addActivity(leadId, {
      activity_type: 'meeting',
      description: `Meeting: ${description} (Scheduled: ${new Date(date).toLocaleDateString()})`,
      created_by: createdBy,
    });
    
    // In production, this would:
    // 1. Integrate with calendar API
    // 2. Send calendar invite
    // 3. Set up reminder
    
    return activity;
  }

  /**
   * Get activity timeline for lead
   */
  async getActivityTimeline(leadId: string): Promise<LeadActivity[]> {
    try {
      return await leadGenerationDB.getLeadActivities(leadId);
    } catch (error) {
      console.error('Error getting activity timeline:', error);
      return [];
    }
  }

  /**
   * Bulk update lead stages
   */
  async bulkUpdateStages(leadIds: string[], stage: string): Promise<number> {
    let updated = 0;
    
    for (const leadId of leadIds) {
      const result = await this.updateLeadStage(leadId, stage);
      if (result) updated++;
    }
    
    return updated;
  }

  /**
   * Get leads by stage for kanban view
   */
  async getLeadsByStageForKanban(): Promise<{ [key: string]: CRMLead[] }> {
    try {
      const result: { [key: string]: CRMLead[] } = {};
      
      for (const stage of this.defaultStages) {
        const leads = await this.getAllCRMLeads({ stage: stage.name });
        result[stage.name] = leads;
      }
      
      return result;
    } catch (error) {
      console.error('Error getting leads by stage for kanban:', error);
      return {};
    }
  }
}

export const crmService = new CRMService();
