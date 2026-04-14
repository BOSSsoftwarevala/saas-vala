// Duplicate Lead Detection and Removal Service
import { leadGenerationDB } from './database.service';
import type { Lead } from '@/types/lead-generation';

export class DuplicateDetectionService {
  /**
   * Find all duplicate leads in the database
   */
  async findDuplicates(): Promise<{
    total_duplicates: number;
    duplicate_groups: {
      key: string;
      leads: Lead[];
      duplicate_count: number;
    }[];
  }> {
    try {
      const leads = await leadGenerationDB.getLeads();
      const duplicateMap = new Map<string, Lead[]>();
      
      // Group leads by potential duplicate keys
      for (const lead of leads) {
        // Check by email
        if (lead.email) {
          const key = `email:${lead.email.toLowerCase()}`;
          if (!duplicateMap.has(key)) {
            duplicateMap.set(key, []);
          }
          duplicateMap.get(key)!.push(lead);
        }
        
        // Check by phone
        if (lead.phone) {
          const key = `phone:${lead.phone}`;
          if (!duplicateMap.has(key)) {
            duplicateMap.set(key, []);
          }
          duplicateMap.get(key)!.push(lead);
        }
        
        // Check by website
        if (lead.website) {
          const key = `website:${lead.website.toLowerCase()}`;
          if (!duplicateMap.has(key)) {
            duplicateMap.set(key, []);
          }
          duplicateMap.get(key)!.push(lead);
        }
        
        // Check by business name + city
        if (lead.business_name && lead.city) {
          const key = `name:${lead.business_name.toLowerCase()}:${lead.city.toLowerCase()}`;
          if (!duplicateMap.has(key)) {
            duplicateMap.set(key, []);
          }
          duplicateMap.get(key)!.push(lead);
        }
      }
      
      // Filter for actual duplicates (groups with more than 1 lead)
      const duplicateGroups: {
        key: string;
        leads: Lead[];
        duplicate_count: number;
      }[] = [];
      
      for (const [key, group] of duplicateMap) {
        if (group.length > 1) {
          duplicateGroups.push({
            key,
            leads: group,
            duplicate_count: group.length - 1,
          });
        }
      }
      
      const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.duplicate_count, 0);
      
      return {
        total_duplicates: totalDuplicates,
        duplicate_groups: duplicateGroups,
      };
    } catch (error) {
      console.error('Error finding duplicates:', error);
      return {
        total_duplicates: 0,
        duplicate_groups: [],
      };
    }
  }

  /**
   * Check if a lead is a duplicate before saving
   */
  async checkDuplicateBeforeSave(leadData: Partial<Lead>): Promise<{
    is_duplicate: boolean;
    existing_lead?: Lead;
    match_reason?: string;
  }> {
    try {
      // Check by email
      if (leadData.email) {
        const existingLeads = await leadGenerationDB.getLeads();
        const emailMatch = existingLeads.find(l => 
          l.email && l.email.toLowerCase() === leadData.email!.toLowerCase()
        );
        
        if (emailMatch) {
          return {
            is_duplicate: true,
            existing_lead: emailMatch,
            match_reason: 'email',
          };
        }
      }
      
      // Check by phone
      if (leadData.phone) {
        const existingLeads = await leadGenerationDB.getLeads();
        const phoneMatch = existingLeads.find(l => 
          l.phone && l.phone === leadData.phone
        );
        
        if (phoneMatch) {
          return {
            is_duplicate: true,
            existing_lead: phoneMatch,
            match_reason: 'phone',
          };
        }
      }
      
      // Check by website
      if (leadData.website) {
        const existingLeads = await leadGenerationDB.getLeads();
        const websiteMatch = existingLeads.find(l => 
          l.website && l.website.toLowerCase() === leadData.website!.toLowerCase()
        );
        
        if (websiteMatch) {
          return {
            is_duplicate: true,
            existing_lead: websiteMatch,
            match_reason: 'website',
          };
        }
      }
      
      // Check by business name + city (fuzzy match)
      if (leadData.business_name && leadData.city) {
        const existingLeads = await leadGenerationDB.getLeads();
        const nameMatch = existingLeads.find(l => 
          l.business_name && l.city &&
          l.business_name.toLowerCase() === leadData.business_name!.toLowerCase() &&
          l.city.toLowerCase() === leadData.city!.toLowerCase()
        );
        
        if (nameMatch) {
          return {
            is_duplicate: true,
            existing_lead: nameMatch,
            match_reason: 'business_name_and_city',
          };
        }
      }
      
      return {
        is_duplicate: false,
      };
    } catch (error) {
      console.error('Error checking duplicate before save:', error);
      return {
        is_duplicate: false,
      };
    }
  }

  /**
   * Merge duplicate leads - keep the most complete one and delete others
   */
  async mergeDuplicates(duplicateGroups: {
    key: string;
    leads: Lead[];
  }[]): Promise<{
    merged_count: number;
    deleted_count: number;
  }> {
    let mergedCount = 0;
    let deletedCount = 0;
    
    for (const group of duplicateGroups) {
      try {
        // Sort leads by completeness (most data first)
        const sortedLeads = this.sortLeadsByCompleteness(group.leads);
        
        // Keep the first (most complete) lead
        const primaryLead = sortedLeads[0];
        const duplicateLeads = sortedLeads.slice(1);
        
        // Merge data from duplicates into primary lead
        const mergedData = this.mergeLeadData(primaryLead, duplicateLeads);
        
        // Update primary lead with merged data
        await leadGenerationDB.updateLead(primaryLead.id, mergedData);
        
        // Mark duplicates as is_duplicate = true
        for (const duplicate of duplicateLeads) {
          await leadGenerationDB.updateLead(duplicate.id, { is_duplicate: true });
        }
        
        mergedCount++;
        deletedCount += duplicateLeads.length;
      } catch (error) {
        console.error('Error merging duplicate group:', error);
      }
    }
    
    return {
      merged_count: mergedCount,
      deleted_count: deletedCount,
    };
  }

  /**
   * Sort leads by completeness (most data first)
   */
  private sortLeadsByCompleteness(leads: Lead[]): Lead[] {
    return leads.sort((a, b) => {
      const scoreA = this.calculateCompletenessScore(a);
      const scoreB = this.calculateCompletenessScore(b);
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate completeness score for a lead
   */
  private calculateCompletenessScore(lead: Lead): number {
    let score = 0;
    
    if (lead.business_name) score += 10;
    if (lead.phone) score += 15;
    if (lead.email) score += 20;
    if (lead.website) score += 15;
    if (lead.rating) score += 10;
    if (lead.reviews_count) score += 5;
    if (lead.address) score += 10;
    if (lead.city) score += 5;
    if (lead.country) score += 5;
    if (lead.business_type) score += 5;
    
    return score;
  }

  /**
   * Merge data from multiple leads into one
   */
  private mergeLeadData(primaryLead: Lead, duplicateLeads: Lead[]): Partial<Lead> {
    const mergedData: Partial<Lead> = { ...primaryLead };
    
    for (const duplicate of duplicateLeads) {
      // Merge phone if primary doesn't have it
      if (!mergedData.phone && duplicate.phone) {
        mergedData.phone = duplicate.phone;
      }
      
      // Merge email if primary doesn't have it
      if (!mergedData.email && duplicate.email) {
        mergedData.email = duplicate.email;
      }
      
      // Merge website if primary doesn't have it
      if (!mergedData.website && duplicate.website) {
        mergedData.website = duplicate.website;
      }
      
      // Merge rating if duplicate has higher rating
      if (duplicate.rating && (!mergedData.rating || duplicate.rating > mergedData.rating)) {
        mergedData.rating = duplicate.rating;
      }
      
      // Merge reviews count if duplicate has more
      if (duplicate.reviews_count && (!mergedData.reviews_count || duplicate.reviews_count > mergedData.reviews_count)) {
        mergedData.reviews_count = duplicate.reviews_count;
      }
      
      // Merge address if primary doesn't have it
      if (!mergedData.address && duplicate.address) {
        mergedData.address = duplicate.address;
      }
      
      // Merge tags (combine unique tags)
      if (duplicate.tags && duplicate.tags.length > 0) {
        const existingTags = mergedData.tags || [];
        const newTags = duplicate.tags.filter(tag => !existingTags.includes(tag));
        mergedData.tags = [...existingTags, ...newTags];
      }
      
      // Merge notes (append)
      if (duplicate.notes) {
        mergedData.notes = mergedData.notes 
          ? `${mergedData.notes}\n\n[Merged from duplicate]: ${duplicate.notes}`
          : `[Merged from duplicate]: ${duplicate.notes}`;
      }
    }
    
    return mergedData;
  }

  /**
   * Delete duplicate leads (hard delete)
   */
  async deleteDuplicates(duplicateGroups: {
    key: string;
    leads: Lead[];
  }[]): Promise<{
    deleted_count: number;
  }> {
    let deletedCount = 0;
    
    for (const group of duplicateGroups) {
      try {
        // Sort leads by completeness, keep the first one
        const sortedLeads = this.sortLeadsByCompleteness(group.leads);
        const primaryLead = sortedLeads[0];
        const duplicateLeads = sortedLeads.slice(1);
        
        // Delete duplicates
        for (const duplicate of duplicateLeads) {
          const deleted = await leadGenerationDB.deleteLead(duplicate.id);
          if (deleted) deletedCount++;
        }
      } catch (error) {
        console.error('Error deleting duplicate group:', error);
      }
    }
    
    return {
      deleted_count: deletedCount,
    };
  }

  /**
   * Mark duplicates as is_duplicate = true (soft delete)
   */
  async markDuplicates(duplicateGroups: {
    key: string;
    leads: Lead[];
  }[]): Promise<{
    marked_count: number;
  }> {
    let markedCount = 0;
    
    for (const group of duplicateGroups) {
      try {
        // Sort leads by completeness, keep the first one
        const sortedLeads = this.sortLeadsByCompleteness(group.leads);
        const primaryLead = sortedLeads[0];
        const duplicateLeads = sortedLeads.slice(1);
        
        // Mark duplicates
        for (const duplicate of duplicateLeads) {
          await leadGenerationDB.updateLead(duplicate.id, { is_duplicate: true });
          markedCount++;
        }
      } catch (error) {
        console.error('Error marking duplicate group:', error);
      }
    }
    
    return {
      marked_count: markedCount,
    };
  }

  /**
   * Auto-clean duplicates (merge and mark)
   */
  async autoCleanDuplicates(): Promise<{
    found: number;
    merged: number;
    marked: number;
  }> {
    const duplicates = await this.findDuplicates();
    
    if (duplicates.total_duplicates === 0) {
      return {
        found: 0,
        merged: 0,
        marked: 0,
      };
    }
    
    // Merge duplicates
    const mergeResult = await this.mergeDuplicates(duplicates.duplicate_groups);
    
    // Mark remaining duplicates
    const markResult = await this.markDuplicates(duplicates.duplicate_groups);
    
    return {
      found: duplicates.total_duplicates,
      merged: mergeResult.merged_count,
      marked: markResult.marked_count,
    };
  }

  /**
   * Get duplicate statistics
   */
  async getDuplicateStatistics(): Promise<{
    total_leads: number;
    duplicate_leads: number;
    unique_leads: number;
    duplicate_rate: number;
    duplicates_by_field: {
      email: number;
      phone: number;
      website: number;
      business_name: number;
    };
  }> {
    try {
      const duplicates = await this.findDuplicates();
      const leads = await leadGenerationDB.getLeads();
      
      const duplicatesByEmail = duplicates.duplicate_groups.filter(g => g.key.startsWith('email:')).length;
      const duplicatesByPhone = duplicates.duplicate_groups.filter(g => g.key.startsWith('phone:')).length;
      const duplicatesByWebsite = duplicates.duplicate_groups.filter(g => g.key.startsWith('website:')).length;
      const duplicatesByName = duplicates.duplicate_groups.filter(g => g.key.startsWith('name:')).length;
      
      const duplicateRate = leads.length > 0 ? (duplicates.total_duplicates / leads.length) * 100 : 0;
      
      return {
        total_leads: leads.length,
        duplicate_leads: duplicates.total_duplicates,
        unique_leads: leads.length - duplicates.total_duplicates,
        duplicate_rate: Math.round(duplicateRate),
        duplicates_by_field: {
          email: duplicatesByEmail,
          phone: duplicatesByPhone,
          website: duplicatesByWebsite,
          business_name: duplicatesByName,
        },
      };
    } catch (error) {
      console.error('Error getting duplicate statistics:', error);
      return {
        total_leads: 0,
        duplicate_leads: 0,
        unique_leads: 0,
        duplicate_rate: 0,
        duplicates_by_field: {
          email: 0,
          phone: 0,
          website: 0,
          business_name: 0,
        },
      };
    }
  }

  /**
   * Export duplicate report to CSV
   */
  async exportDuplicateReport(): Promise<string> {
    try {
      const duplicates = await this.findDuplicates();
      
      const headers = [
        'Duplicate Key',
        'Match Type',
        'Duplicate Count',
        'Lead IDs',
        'Business Names',
      ];
      
      const rows = duplicates.duplicate_groups.map(group => {
        const matchType = group.key.split(':')[0];
        const leadIds = group.leads.map(l => l.id).join(', ');
        const businessNames = group.leads.map(l => l.business_name).join(', ');
        
        return [
          group.key,
          matchType,
          group.duplicate_count.toString(),
          leadIds,
          businessNames,
        ];
      });
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');
      
      return csvContent;
    } catch (error) {
      console.error('Error exporting duplicate report:', error);
      return '';
    }
  }
}

export const duplicateDetectionService = new DuplicateDetectionService();
