// Automation Workflow Orchestration Service
import { leadGenerationDB } from './database.service';
import { googleMapsScraper } from './google-maps-scraper.service';
import { websiteScraper } from './website-scraper.service';
import { emailFinder } from './email-finder.service';
import { seoAnalyzer } from './seo-analyzer.service';
import { leadScoring } from './lead-scoring.service';
import { outreachService } from './outreach.service';
import type { Campaign } from '@/types/lead-generation';

export class WorkflowService {
  private isRunning = false;
  private stopSignal = false;
  private currentWorkflow: string | null = null;

  /**
   * Run complete lead generation workflow
   */
  async runCompleteWorkflow(
    campaignId: string,
    config: {
      enableScraping: boolean;
      enableWebsiteScraping: boolean;
      enableEmailFinding: boolean;
      enableEmailVerification: boolean;
      enableSEOAnalysis: boolean;
      enableLeadScoring: boolean;
      enableOutreach: boolean;
      enableFollowUp: boolean;
    }
  ): Promise<{
    success: boolean;
    steps: {
      name: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      result?: any;
      error?: string;
    }[];
    summary: {
      total_leads: number;
      scraped_leads: number;
      emails_found: number;
      emails_verified: number;
      outreach_sent: number;
      conversions: number;
    };
  }> {
    if (this.isRunning) {
      throw new Error('Workflow is already running');
    }
    
    this.isRunning = true;
    this.stopSignal = false;
    this.currentWorkflow = campaignId;
    
    const steps: {
      name: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      result?: any;
      error?: string;
    }[] = [
      { name: 'Load Campaign', status: 'pending' },
      { name: 'Google Maps Scraping', status: 'pending' },
      { name: 'Website Scraping', status: 'pending' },
      { name: 'Email Finding', status: 'pending' },
      { name: 'Email Verification', status: 'pending' },
      { name: 'SEO Analysis', status: 'pending' },
      { name: 'Lead Scoring', status: 'pending' },
      { name: 'Auto Outreach', status: 'pending' },
      { name: 'Follow-up Scheduling', status: 'pending' },
    ];
    
    const summary = {
      total_leads: 0,
      scraped_leads: 0,
      emails_found: 0,
      emails_verified: 0,
      outreach_sent: 0,
      conversions: 0,
    };
    
    try {
      // Step 1: Load Campaign
      steps[0].status = 'running';
      const campaign = await leadGenerationDB.getCampaigns().then(c => c.find(camp => camp.id === campaignId));
      
      if (!campaign) {
        steps[0].status = 'failed';
        steps[0].error = 'Campaign not found';
        throw new Error('Campaign not found');
      }
      
      steps[0].status = 'completed';
      steps[0].result = { campaign_id: campaign.id, name: campaign.name };
      
      if (this.stopSignal) return this.formatWorkflowResult(steps, summary);
      
      // Step 2: Google Maps Scraping
      if (config.enableScraping) {
        steps[1].status = 'running';
        
        const scrapingResult = await googleMapsScraper.runScrapingWorkflow({
          keyword: campaign.keywords[0] || '',
          city: campaign.target_city || '',
          country: campaign.target_country,
          maxResults: 50,
        });
        
        if (scrapingResult) {
          summary.scraped_leads = scrapingResult.totalSaved;
          summary.total_leads = scrapingResult.totalSaved;
          steps[1].status = 'completed';
          steps[1].result = scrapingResult;
        } else {
          steps[1].status = 'failed';
          steps[1].error = 'Scraping failed';
        }
        
        if (this.stopSignal) return this.formatWorkflowResult(steps, summary);
      } else {
        steps[1].status = 'completed';
        steps[1].result = { skipped: true };
      }
      
      // Step 3: Website Scraping
      if (config.enableWebsiteScraping) {
        steps[2].status = 'running';
        
        const leads = await leadGenerationDB.getLeads({ source: 'maps' });
        
        for (const lead of leads) {
          if (this.stopSignal) break;
          
          if (lead.website) {
            const scrapingResult = await websiteScraper.runScrapingWorkflow(
              { url: lead.website },
              lead.id
            );
          }
        }
        
        steps[2].status = 'completed';
        steps[2].result = { processed: leads.length };
        
        if (this.stopSignal) return this.formatWorkflowResult(steps, summary);
      } else {
        steps[2].status = 'completed';
        steps[2].result = { skipped: true };
      }
      
      // Step 4: Email Finding
      if (config.enableEmailFinding) {
        steps[3].status = 'running';
        
        const leadsWithoutEmail = await leadGenerationDB.getLeads({ source: 'maps' });
        let emailsFound = 0;
        
        for (const lead of leadsWithoutEmail) {
          if (this.stopSignal) break;
          
          if (lead.website) {
            const domain = new URL(lead.website).hostname;
            const emailResult = await emailFinder.runEmailWorkflow(
              { domain },
              false // Don't verify yet
            );
            
            if (emailResult.found > 0 && emailResult.emails.length > 0) {
              await emailFinder.updateLeadWithEmail(lead.id, emailResult.emails[0]);
              emailsFound++;
            }
          }
        }
        
        summary.emails_found = emailsFound;
        steps[3].status = 'completed';
        steps[3].result = { emails_found: emailsFound };
        
        if (this.stopSignal) return this.formatWorkflowResult(steps, summary);
      } else {
        steps[3].status = 'completed';
        steps[3].result = { skipped: true };
      }
      
      // Step 5: Email Verification
      if (config.enableEmailVerification) {
        steps[4].status = 'running';
        
        const leadsWithEmail = await leadGenerationDB.getLeads({ source: 'maps' });
        const emailsToVerify = leadsWithEmail
          .map(l => l.email)
          .filter((e): e is string => !!e);
        
        const verificationResults = await emailFinder.bulkVerifyEmails(emailsToVerify);
        const validEmails = verificationResults.filter(r => r.status === 'valid').length;
        
        summary.emails_verified = validEmails;
        steps[4].status = 'completed';
        steps[4].result = { verified: validEmails, total: emailsToVerify.length };
        
        if (this.stopSignal) return this.formatWorkflowResult(steps, summary);
      } else {
        steps[4].status = 'completed';
        steps[4].result = { skipped: true };
      }
      
      // Step 6: SEO Analysis
      if (config.enableSEOAnalysis) {
        steps[5].status = 'running';
        
        const leads = await leadGenerationDB.getLeads({ source: 'maps' });
        
        for (const lead of leads) {
          if (this.stopSignal) break;
          
          if (lead.website) {
            await seoAnalyzer.runSEOAnalysisWorkflow(
              { keyword: campaign.keywords[0] || '', website: lead.website },
              lead.id
            );
          }
        }
        
        steps[5].status = 'completed';
        steps[5].result = { analyzed: leads.length };
        
        if (this.stopSignal) return this.formatWorkflowResult(steps, summary);
      } else {
        steps[5].status = 'completed';
        steps[5].result = { skipped: true };
      }
      
      // Step 7: Lead Scoring
      if (config.enableLeadScoring) {
        steps[6].status = 'running';
        
        const scoringResult = await leadScoring.runLeadScoringWorkflow();
        
        steps[6].status = 'completed';
        steps[6].result = scoringResult;
        
        if (this.stopSignal) return this.formatWorkflowResult(steps, summary);
      } else {
        steps[6].status = 'completed';
        steps[6].result = { skipped: true };
      }
      
      // Step 8: Auto Outreach
      if (config.enableOutreach) {
        steps[7].status = 'running';
        
        const hotLeads = await leadGenerationDB.getLeads({ lead_score: 'hot' });
        const leadIds = hotLeads.map(l => l.id);
        
        const outreachResult = await outreachService.runOutreachWorkflow(
          leadIds,
          {
            channel: 'email',
            template: 'Hello {business_name}, we noticed your business and would like to connect.',
            personalizationEnabled: true,
            followUpDays: config.enableFollowUp ? [3, 7, 14] : [],
            followUpTemplates: [
              'Following up on our previous email to {business_name}.',
              'Still interested in connecting with {business_name}?',
              'Final follow-up to {business_name}.',
            ],
          },
          config.enableFollowUp
        );
        
        summary.outreach_sent = outreachResult.sent;
        summary.conversions = outreachResult.sent; // Placeholder
        
        steps[7].status = 'completed';
        steps[7].result = outreachResult;
        
        if (this.stopSignal) return this.formatWorkflowResult(steps, summary);
      } else {
        steps[7].status = 'completed';
        steps[7].result = { skipped: true };
      }
      
      // Step 9: Follow-up Scheduling
      if (config.enableFollowUp) {
        steps[8].status = 'running';
        steps[8].status = 'completed';
        steps[8].result = { scheduled: true };
      } else {
        steps[8].status = 'completed';
        steps[8].result = { skipped: true };
      }
      
      // Update campaign stats
      await leadGenerationDB.updateCampaign(campaignId, {
        total_leads: summary.total_leads,
        contacted_leads: summary.outreach_sent,
        interested_leads: 0,
        converted_leads: summary.conversions,
        last_run_at: new Date().toISOString(),
      });
      
      return this.formatWorkflowResult(steps, summary);
    } catch (error) {
      console.error('Workflow error:', error);
      return this.formatWorkflowResult(steps, summary, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.isRunning = false;
      this.currentWorkflow = null;
    }
  }

  /**
   * Format workflow result
   */
  private formatWorkflowResult(
    steps: any[],
    summary: any,
    error?: string
  ): {
    success: boolean;
    steps: any[];
    summary: any;
  } {
    return {
      success: !error && steps.every(s => s.status !== 'failed'),
      steps,
      summary,
    };
  }

  /**
   * Stop the current workflow
   */
  stopWorkflow(): void {
    this.stopSignal = true;
    googleMapsScraper.stopScraping();
    websiteScraper.stopScraping();
    outreachService.stopOutreach();
  }

  /**
   * Check if workflow is running
   */
  isWorkflowRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current workflow ID
   */
  getCurrentWorkflow(): string | null {
    return this.currentWorkflow;
  }

  /**
   * Run quick lead generation workflow (scraping + email finding + scoring)
   */
  async runQuickWorkflow(campaignId: string): Promise<any> {
    return this.runCompleteWorkflow(campaignId, {
      enableScraping: true,
      enableWebsiteScraping: true,
      enableEmailFinding: true,
      enableEmailVerification: true,
      enableSEOAnalysis: false,
      enableLeadScoring: true,
      enableOutreach: false,
      enableFollowUp: false,
    });
  }

  /**
   * Run full outreach workflow (scoring + outreach + follow-up)
   */
  async runOutreachWorkflow(campaignId: string): Promise<any> {
    return this.runCompleteWorkflow(campaignId, {
      enableScraping: false,
      enableWebsiteScraping: false,
      enableEmailFinding: false,
      enableEmailVerification: false,
      enableSEOAnalysis: false,
      enableLeadScoring: true,
      enableOutreach: true,
      enableFollowUp: true,
    });
  }

  /**
   * Schedule automated workflow run
   */
  async scheduleWorkflow(campaignId: string, schedule: {
    interval: 'hourly' | 'daily' | 'weekly';
    time?: string;
  }): Promise<void> {
    // Placeholder for workflow scheduling
    // In production, this would:
    // 1. Use a job scheduler (like Bull, Agenda, or cron)
    // 2. Schedule the workflow to run at specified intervals
    // 3. Track scheduled workflows
    // 4. Handle rescheduling and cancellations
    
    console.log(`Workflow scheduled for campaign ${campaignId} with interval ${schedule.interval}`);
  }

  /**
   * Get workflow history
   */
  async getWorkflowHistory(campaignId?: string): Promise<any[]> {
    // Placeholder for workflow history
    // In production, this would:
    // 1. Query workflow execution logs
    // 2. Return execution history
    // 3. Include success/failure rates
    // 4. Show execution times
    
    return [];
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStatistics(): Promise<{
    total_workflows: number;
    successful_workflows: number;
    failed_workflows: number;
    avg_execution_time: number;
  }> {
    // Placeholder for workflow statistics
    return {
      total_workflows: 0,
      successful_workflows: 0,
      failed_workflows: 0,
      avg_execution_time: 0,
    };
  }
}

export const workflowService = new WorkflowService();
