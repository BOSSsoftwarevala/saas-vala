// Module 7: AI Lead Scoring Service
import { leadGenerationDB } from './database.service';
import type {
  LeadScoreConfig,
  Lead,
} from '@/types/lead-generation';

export class LeadScoringService {
  private defaultConfig: LeadScoreConfig = {
    website_weight: 30,
    email_weight: 30,
    activity_weight: 20,
    rating_weight: 20,
  };

  /**
   * Score a lead based on various factors
   */
  async scoreLead(lead: Lead, config?: Partial<LeadScoreConfig>): Promise<{
    score: number;
    category: 'hot' | 'warm' | 'cold';
    breakdown: {
      website_score: number;
      email_score: number;
      activity_score: number;
      rating_score: number;
    };
  }> {
    const scoringConfig = { ...this.defaultConfig, ...config };
    
    const breakdown = {
      website_score: this.calculateWebsiteScore(lead),
      email_score: this.calculateEmailScore(lead),
      activity_score: this.calculateActivityScore(lead),
      rating_score: this.calculateRatingScore(lead),
    };
    
    const totalScore =
      (breakdown.website_score * scoringConfig.website_weight / 100) +
      (breakdown.email_score * scoringConfig.email_weight / 100) +
      (breakdown.activity_score * scoringConfig.activity_weight / 100) +
      (breakdown.rating_score * scoringConfig.rating_weight / 100);
    
    const category = this.determineCategory(totalScore);
    
    return {
      score: Math.round(totalScore),
      category,
      breakdown,
    };
  }

  /**
   * Calculate website score (0-100)
   */
  private calculateWebsiteScore(lead: Lead): number {
    let score = 0;
    
    // Has website
    if (lead.website) {
      score += 30;
      
      // Website looks professional (basic check)
      if (this.isProfessionalWebsite(lead.website)) {
        score += 20;
      }
    }
    
    // Has social media presence
    if (lead.tags && lead.tags.length > 0) {
      score += 20;
    }
    
    // Business type indicates professional service
    if (lead.business_type && this.isProfessionalService(lead.business_type)) {
      score += 15;
    }
    
    // Has address
    if (lead.address) {
      score += 15;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Calculate email score (0-100)
   */
  private calculateEmailScore(lead: Lead): number {
    let score = 0;
    
    // Has email
    if (lead.email) {
      score += 30;
      
      // Email is verified
      if (lead.email_verified) {
        score += 40;
      }
      
      // Email status is valid
      if (lead.email_status === 'valid') {
        score += 20;
      } else if (lead.email_status === 'risky') {
        score += 10;
      }
    }
    
    // Email is not disposable
    if (lead.email_status !== 'disposable') {
      score += 10;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Calculate activity score (0-100)
   */
  private calculateActivityScore(lead: Lead): number {
    let score = 0;
    
    // Has been contacted
    if (lead.status !== 'new') {
      score += 30;
    }
    
    // Has shown interest
    if (lead.status === 'interested') {
      score += 40;
    }
    
    // Has been converted
    if (lead.status === 'converted') {
      score += 50;
    }
    
    // Has notes or activities
    if (lead.notes && lead.notes.length > 0) {
      score += 20;
    }
    
    // Has tags (indicates engagement)
    if (lead.tags && lead.tags.length > 0) {
      score += 10;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Calculate rating score (0-100)
   */
  private calculateRatingScore(lead: Lead): number {
    let score = 0;
    
    // Has rating
    if (lead.rating) {
      // Rating 5.0 = 100 points, Rating 1.0 = 0 points
      score += (lead.rating / 5) * 50;
    }
    
    // Has reviews
    if (lead.reviews_count && lead.reviews_count > 0) {
      // More reviews = higher score (capped at 50)
      const reviewScore = Math.min(lead.reviews_count / 10, 1) * 50;
      score += reviewScore;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Determine lead category based on score
   */
  private determineCategory(score: number): 'hot' | 'warm' | 'cold' {
    if (score >= 70) return 'hot';
    if (score >= 40) return 'warm';
    return 'cold';
  }

  /**
   * Check if website looks professional
   */
  private isProfessionalWebsite(url: string): boolean {
    // Basic checks for professional websites
    // In production, this would:
    // 1. Check if website has SSL (HTTPS)
    // 2. Check if website loads properly
    // 3. Check if website has proper structure
    // 4. Check if website is not a parked domain
    
    if (!url) return false;
    
    // Check for HTTPS
    if (url.startsWith('https://')) return true;
    
    // Check for common TLDs
    const professionalTLDs = ['.com', '.org', '.net', '.io', '.co', '.in'];
    return professionalTLDs.some(tld => url.includes(tld));
  }

  /**
   * Check if business type indicates professional service
   */
  private isProfessionalService(businessType: string): boolean {
    const professionalServices = [
      'software', 'consulting', 'agency', 'services', 'solutions',
      'technology', 'digital', 'marketing', 'development', 'design',
    ];
    
    const lowerType = businessType.toLowerCase();
    return professionalServices.some(service => lowerType.includes(service));
  }

  /**
   * Score multiple leads in bulk
   */
  async bulkScoreLeads(leads: Lead[], config?: Partial<LeadScoreConfig>): Promise<Array<{
    leadId: string;
    score: number;
    category: 'hot' | 'warm' | 'cold';
    breakdown: {
      website_score: number;
      email_score: number;
      activity_score: number;
      rating_score: number;
    };
  }>> {
    const results = [];
    
    for (const lead of leads) {
      const scoringResult = await this.scoreLead(lead, config);
      
      results.push({
        leadId: lead.id,
        ...scoringResult,
      });
    }
    
    return results;
  }

  /**
   * Update lead with score
   */
  async updateLeadScore(leadId: string, score: number, category: 'hot' | 'warm' | 'cold'): Promise<Lead | null> {
    try {
      return await leadGenerationDB.updateLead(leadId, {
        lead_score_value: score,
        lead_score: category,
      });
    } catch (error) {
      console.error('Error updating lead score:', error);
      return null;
    }
  }

  /**
   * Run complete lead scoring workflow
   */
  async runLeadScoringWorkflow(config?: Partial<LeadScoreConfig>): Promise<{
    total_leads: number;
    hot_leads: number;
    warm_leads: number;
    cold_leads: number;
    updated: number;
  }> {
    try {
      // Get all leads
      const leads = await leadGenerationDB.getLeads();
      
      let updated = 0;
      let hotLeads = 0;
      let warmLeads = 0;
      let coldLeads = 0;
      
      // Score each lead
      for (const lead of leads) {
        const scoringResult = await this.scoreLead(lead, config);
        
        // Update lead with new score
        const updatedLead = await this.updateLeadScore(
          lead.id,
          scoringResult.score,
          scoringResult.category
        );
        
        if (updatedLead) {
          updated++;
          
          if (scoringResult.category === 'hot') hotLeads++;
          else if (scoringResult.category === 'warm') warmLeads++;
          else coldLeads++;
        }
      }
      
      return {
        total_leads: leads.length,
        hot_leads: hotLeads,
        warm_leads: warmLeads,
        cold_leads: coldLeads,
        updated,
      };
    } catch (error) {
      console.error('Error running lead scoring workflow:', error);
      return {
        total_leads: 0,
        hot_leads: 0,
        warm_leads: 0,
        cold_leads: 0,
        updated: 0,
      };
    }
  }

  /**
   * Get leads by score category
   */
  async getLeadsByCategory(category: 'hot' | 'warm' | 'cold'): Promise<Lead[]> {
    try {
      return await leadGenerationDB.getLeads({ lead_score: category });
    } catch (error) {
      console.error('Error getting leads by category:', error);
      return [];
    }
  }

  /**
   * Get lead scoring statistics
   */
  async getScoringStatistics(): Promise<{
    total_leads: number;
    hot_leads: number;
    warm_leads: number;
    cold_leads: number;
    average_score: number;
    score_distribution: {
      '0-20': number;
      '21-40': number;
      '41-60': number;
      '61-80': number;
      '81-100': number;
    };
  }> {
    try {
      const leads = await leadGenerationDB.getLeads();
      
      const hotLeads = leads.filter(l => l.lead_score === 'hot').length;
      const warmLeads = leads.filter(l => l.lead_score === 'warm').length;
      const coldLeads = leads.filter(l => l.lead_score === 'cold').length;
      
      const averageScore = leads.length > 0
        ? leads.reduce((sum, lead) => sum + lead.lead_score_value, 0) / leads.length
        : 0;
      
      const scoreDistribution: { '0-20': number; '21-40': number; '41-60': number; '61-80': number; '81-100': number } = {
        '0-20': leads.filter(l => l.lead_score_value <= 20).length,
        '21-40': leads.filter(l => l.lead_score_value > 20 && l.lead_score_value <= 40).length,
        '41-60': leads.filter(l => l.lead_score_value > 40 && l.lead_score_value <= 60).length,
        '61-80': leads.filter(l => l.lead_score_value > 60 && l.lead_score_value <= 80).length,
        '81-100': leads.filter(l => l.lead_score_value > 80).length,
      };
      
      return {
        total_leads: leads.length,
        hot_leads: hotLeads,
        warm_leads: warmLeads,
        cold_leads: coldLeads,
        average_score: Math.round(averageScore),
        score_distribution: scoreDistribution,
      };
    } catch (error) {
      console.error('Error getting scoring statistics:', error);
      return {
        total_leads: 0,
        hot_leads: 0,
        warm_leads: 0,
        cold_leads: 0,
        average_score: 0,
        score_distribution: {
          '0-20': 0,
          '21-40': 0,
          '41-60': 0,
          '61-80': 0,
          '81-100': 0,
        },
      };
    }
  }

  /**
   * Recalculate score for a specific lead
   */
  async recalculateLeadScore(leadId: string): Promise<{
    success: boolean;
    score?: number;
    category?: 'hot' | 'warm' | 'cold';
  }> {
    try {
      const lead = await leadGenerationDB.getLeadById(leadId);
      
      if (!lead) {
        return { success: false };
      }
      
      const scoringResult = await this.scoreLead(lead);
      
      const updatedLead = await this.updateLeadScore(
        leadId,
        scoringResult.score,
        scoringResult.category
      );
      
      return {
        success: !!updatedLead,
        score: scoringResult.score,
        category: scoringResult.category,
      };
    } catch (error) {
      console.error('Error recalculating lead score:', error);
      return { success: false };
    }
  }

  /**
   * Auto-score new leads
   */
  async autoScoreNewLeads(): Promise<number> {
    try {
      const newLeads = await leadGenerationDB.getLeads({ status: 'new' });
      
      let scored = 0;
      
      for (const lead of newLeads) {
        const scoringResult = await this.scoreLead(lead);
        
        const updatedLead = await this.updateLeadScore(
          lead.id,
          scoringResult.score,
          scoringResult.category
        );
        
        if (updatedLead) scored++;
      }
      
      return scored;
    } catch (error) {
      console.error('Error auto-scoring new leads:', error);
      return 0;
    }
  }
}

export const leadScoring = new LeadScoringService();
