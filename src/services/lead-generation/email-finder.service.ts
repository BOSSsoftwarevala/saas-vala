// Module 3: Email Finder + Verifier Service
import { leadGenerationDB } from './database.service';
import type {
  EmailFinderConfig,
  EmailVerificationResult,
  EmailVerification,
  Lead,
} from '@/types/lead-generation';

export class EmailFinderService {
  private rateLimitDelay = 1000; // 1 second between requests
  private maxRetries = 3;
  private isRunning = false;
  private stopSignal = false;

  /**
   * Find emails for a domain using various strategies
   */
  async findEmails(config: EmailFinderConfig): Promise<string[]> {
    try {
      const emails: string[] = [];
      
      // Strategy 1: Common email patterns
      const patternEmails = this.generateEmailPatterns(config);
      emails.push(...patternEmails);
      
      // Strategy 2: API integrations (Hunter, Snov, Apollo)
      const apiEmails = await this.findEmailsViaAPI(config);
      emails.push(...apiEmails);
      
      // Remove duplicates and return
      return [...new Set(emails)];
    } catch (error) {
      console.error('Error finding emails:', error);
      return [];
    }
  }

  /**
   * Generate common email patterns based on name and domain
   */
  private generateEmailPatterns(config: EmailFinderConfig): string[] {
    const emails: string[] = [];
    const { domain, firstName, lastName, fullName } = config;
    
    if (!domain) return emails;
    
    // Extract first and last name from full name if not provided
    const first = firstName || fullName?.split(' ')[0]?.toLowerCase();
    const last = lastName || fullName?.split(' ')?.slice(-1)[0]?.toLowerCase();
    
    if (!first || !last) return emails;
    
    // Common email patterns
    const patterns = [
      `${first}.${last}@${domain}`,
      `${first}${last}@${domain}`,
      `${first}_${last}@${domain}`,
      `${first}-${last}@${domain}`,
      `${first[0]}${last}@${domain}`,
      `${first}${last[0]}@${domain}`,
      `${first}@${domain}`,
      `${last}@${domain}`,
      `${first}.${last[0]}@${domain}`,
      `${first[0]}.${last}@${domain}`,
      `info@${domain}`,
      `contact@${domain}`,
      `support@${domain}`,
      `sales@${domain}`,
      `hello@${domain}`,
    ];
    
    return patterns;
  }

  /**
   * Find emails using external APIs (Hunter, Snov, Apollo)
   */
  private async findEmailsViaAPI(config: EmailFinderConfig): Promise<string[]> {
    const emails: string[] = [];
    
    try {
      // Get active API integrations
      const integrations = await leadGenerationDB.getAPIIntegrations();
      
      for (const integration of integrations) {
        if (!integration.is_active) continue;
        
        try {
          const apiEmails = await this.queryAPI(integration.provider, config, integration.api_key);
          emails.push(...apiEmails);
          
          // Increment API request counter
          await leadGenerationDB.incrementAPIRequests(integration.provider);
          
          // Rate limiting
          await this.delay(this.rateLimitDelay);
        } catch (error) {
          console.error(`Error querying ${integration.provider} API:`, error);
        }
      }
    } catch (error) {
      console.error('Error finding emails via API:', error);
    }
    
    return emails;
  }

  /**
   * Query specific API for email finding
   */
  private async queryAPI(provider: string, config: EmailFinderConfig, apiKey?: string): Promise<string[]> {
    // Placeholder for API integration logic
    // In production, this would:
    // 1. Call Hunter.io API
    // 2. Call Snov.io API
    // 3. Call Apollo.io API
    // 4. Parse responses and extract emails
    
    switch (provider) {
      case 'hunter':
        return this.queryHunterAPI(config, apiKey);
      case 'snov':
        return this.querySnovAPI(config, apiKey);
      case 'apollo':
        return this.queryApolloAPI(config, apiKey);
      default:
        return [];
    }
  }

  /**
   * Query Hunter.io API
   */
  private async queryHunterAPI(config: EmailFinderConfig, apiKey?: string): Promise<string[]> {
    // Placeholder for Hunter.io API integration
    // In production, this would:
    // 1. Make HTTP request to Hunter.io API
    // 2. Parse response
    // 3. Return found emails
    
    return [];
  }

  /**
   * Query Snov.io API
   */
  private async querySnovAPI(config: EmailFinderConfig, apiKey?: string): Promise<string[]> {
    // Placeholder for Snov.io API integration
    // In production, this would:
    // 1. Make HTTP request to Snov.io API
    // 2. Parse response
    // 3. Return found emails
    
    return [];
  }

  /**
   * Query Apollo.io API
   */
  private async queryApolloAPI(config: EmailFinderConfig, apiKey?: string): Promise<string[]> {
    // Placeholder for Apollo.io API integration
    // In production, this would:
    // 1. Make HTTP request to Apollo.io API
    // 2. Parse response
    // 3. Return found emails
    
    return [];
  }

  /**
   * Verify email using SMTP and other checks
   */
  async verifyEmail(email: string): Promise<EmailVerificationResult> {
    try {
      const result: EmailVerificationResult = {
        email,
        status: 'unknown',
        score: 0,
        details: {
          smtp_check: false,
          mx_record: false,
          disposable: false,
          free_provider: false,
        },
      };
      
      // Check 1: Format validation
      if (!this.isValidEmailFormat(email)) {
        result.status = 'invalid';
        result.score = 0;
        return result;
      }
      
      // Check 2: Disposable email detection
      result.details.disposable = this.isDisposableEmail(email);
      if (result.details.disposable) {
        result.status = 'disposable';
        result.score = 10;
        return result;
      }
      
      // Check 3: Free email provider detection
      result.details.free_provider = this.isFreeEmailProvider(email);
      
      // Check 4: MX record check
      result.details.mx_record = await this.checkMXRecord(email);
      
      // Check 5: SMTP verification
      result.details.smtp_check = await this.checkSMTP(email);
      
      // Calculate overall score
      result.score = this.calculateEmailScore(result.details);
      
      // Determine status based on score
      if (result.score >= 80) {
        result.status = 'valid';
      } else if (result.score >= 50) {
        result.status = 'risky';
      } else {
        result.status = 'invalid';
      }
      
      // Save verification result to database
      await this.saveEmailVerification(email, result);
      
      return result;
    } catch (error) {
      console.error('Error verifying email:', error);
      return {
        email,
        status: 'invalid',
        score: 0,
        details: {
          smtp_check: false,
          mx_record: false,
          disposable: false,
          free_provider: false,
        },
      };
    }
  }

  /**
   * Validate email format
   */
  private isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if email is from a disposable email provider
   */
  private isDisposableEmail(email: string): boolean {
    const disposableDomains = [
      'tempmail.com',
      'guerrillamail.com',
      'mailinator.com',
      '10minutemail.com',
      'throwawaymail.com',
      'sharklasers.com',
      'getairmail.com',
      'temp-mail.org',
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    return disposableDomains.some(disposable => domain?.includes(disposable));
  }

  /**
   * Check if email is from a free email provider
   */
  private isFreeEmailProvider(email: string): boolean {
    const freeProviders = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'aol.com',
      'icloud.com',
      'protonmail.com',
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    return freeProviders.includes(domain || '');
  }

  /**
   * Check MX record for domain
   */
  private async checkMXRecord(email: string): Promise<boolean> {
    try {
      // Placeholder for MX record check
      // In production, this would:
      // 1. Extract domain from email
      // 2. Perform DNS lookup for MX records
      // 3. Return true if MX records exist
      
      const domain = email.split('@')[1];
      await this.delay(100); // Simulate DNS lookup
      return true; // Simulated result
    } catch (error) {
      console.error('Error checking MX record:', error);
      return false;
    }
  }

  /**
   * Check SMTP for email
   */
  private async checkSMTP(email: string): Promise<boolean> {
    try {
      // Placeholder for SMTP check
      // In production, this would:
      // 1. Extract domain from email
      // 2. Connect to SMTP server
      // 3. Perform SMTP verification
      // 4. Return true if email exists
      
      await this.delay(200); // Simulate SMTP check
      return true; // Simulated result
    } catch (error) {
      console.error('Error checking SMTP:', error);
      return false;
    }
  }

  /**
   * Calculate email score based on verification details
   */
  private calculateEmailScore(details: EmailVerificationResult['details']): number {
    let score = 0;
    
    if (details.smtp_check) score += 40;
    if (details.mx_record) score += 30;
    if (!details.disposable) score += 20;
    if (!details.free_provider) score += 10;
    
    return score;
  }

  /**
   * Save email verification result to database
   */
  private async saveEmailVerification(email: string, result: EmailVerificationResult): Promise<void> {
    try {
      const existing = await leadGenerationDB.getEmailVerification(email);
      
      const verificationData: Partial<EmailVerification> = {
        email,
        domain: email.split('@')[1],
        status: result.status,
        smtp_check: result.details.smtp_check,
        mx_record: result.details.mx_record,
        disposable: result.details.disposable,
        score: result.score,
        verified_at: new Date().toISOString(),
      };
      
      if (existing) {
        await leadGenerationDB.updateEmailVerification(email, verificationData);
      } else {
        await leadGenerationDB.createEmailVerification(verificationData);
      }
    } catch (error) {
      console.error('Error saving email verification:', error);
    }
  }

  /**
   * Bulk verify emails
   */
  async bulkVerifyEmails(emails: string[]): Promise<EmailVerificationResult[]> {
    const results: EmailVerificationResult[] = [];
    
    for (const email of emails) {
      if (this.stopSignal) break;
      
      try {
        const result = await this.verifyEmail(email);
        results.push(result);
        
        // Rate limiting
        await this.delay(this.rateLimitDelay);
      } catch (error) {
        console.error(`Error verifying email ${email}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Run complete email finding and verification workflow
   */
  async runEmailWorkflow(config: EmailFinderConfig, verify: boolean = true): Promise<{
    found: number;
    verified: number;
    valid: number;
    risky: number;
    invalid: number;
    emails: string[];
  }> {
    if (this.isRunning) {
      throw new Error('Email workflow is already running');
    }
    
    this.isRunning = true;
    this.stopSignal = false;
    
    try {
      // Find emails
      const emails = await this.findEmails(config);
      
      if (this.stopSignal) {
        return {
          found: emails.length,
          verified: 0,
          valid: 0,
          risky: 0,
          invalid: 0,
          emails: [],
        };
      }
      
      let verificationResults: EmailVerificationResult[] = [];
      
      if (verify) {
        // Verify emails
        verificationResults = await this.bulkVerifyEmails(emails);
      }
      
      const valid = verificationResults.filter(r => r.status === 'valid').length;
      const risky = verificationResults.filter(r => r.status === 'risky').length;
      const invalid = verificationResults.filter(r => r.status === 'invalid').length;
      
      return {
        found: emails.length,
        verified: verificationResults.length,
        valid,
        risky,
        invalid,
        emails,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Update lead with verified email
   */
  async updateLeadWithEmail(leadId: string, email: string, verificationResult?: EmailVerificationResult): Promise<Lead | null> {
    try {
      const updates: Partial<Lead> = {
        email,
        email_status: verificationResult?.status || 'unknown',
        email_verified: verificationResult?.status === 'valid',
      };
      
      if (verificationResult) {
        updates.lead_score_value = verificationResult.score;
        updates.lead_score = this.determineLeadScore(verificationResult.score);
      }
      
      return await leadGenerationDB.updateLead(leadId, updates);
    } catch (error) {
      console.error('Error updating lead with email:', error);
      return null;
    }
  }

  /**
   * Determine lead score based on email verification score
   */
  private determineLeadScore(emailScore: number): 'hot' | 'warm' | 'cold' {
    if (emailScore >= 80) return 'hot';
    if (emailScore >= 50) return 'warm';
    return 'cold';
  }

  /**
   * Stop the email workflow
   */
  stopWorkflow(): void {
    this.stopSignal = true;
  }

  /**
   * Check if workflow is currently running
   */
  isWorkflowRunning(): boolean {
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

export const emailFinder = new EmailFinderService();
