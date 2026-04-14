// Module 2: Website Scraper Service
import { leadGenerationDB } from './database.service';
import type {
  WebsiteScraperConfig,
  WebsiteScrapedData,
  Lead,
} from '@/types/lead-generation';

export class WebsiteScraperService {
  private rateLimitDelay = 2000; // 2 seconds between requests
  private maxRetries = 3;
  private isRunning = false;
  private stopSignal = false;

  /**
   * Scrape website for contact information
   */
  async scrapeWebsite(config: WebsiteScraperConfig): Promise<WebsiteScrapedData> {
    try {
      // In a real implementation, this would use:
      // 1. Puppeteer/Playwright for JavaScript-rendered sites
      // 2. Cheerio for static HTML parsing
      // 3. Custom regex patterns for email extraction
      // 4. API integrations (Apify, PhantomBuster)
      
      const scrapedData = await this.simulateScraping(config.url);
      
      return scrapedData;
    } catch (error) {
      console.error('Error scraping website:', error);
      return {
        emails: [],
        contactForms: [],
        socialLinks: [],
      };
    }
  }

  /**
   * Simulate website scraping (placeholder for real implementation)
   */
  private async simulateScraping(url: string): Promise<WebsiteScrapedData> {
    // This is a placeholder for the actual scraping logic
    // In production, this would:
    // 1. Fetch the website HTML
    // 2. Parse HTML to extract emails, forms, social links
    // 3. Handle pagination and multi-page crawling
    // 4. Respect robots.txt and rate limits
    
    // Generate some simulated data for testing
    const emails = [
      `contact@${new URL(url).hostname}`,
      `info@${new URL(url).hostname}`,
      `support@${new URL(url).hostname}`,
    ];
    
    const contactForms = [
      `${url}/contact`,
      `${url}/contact-us`,
    ];
    
    const socialLinks = [
      { platform: 'facebook', url: `https://facebook.com/${new URL(url).hostname}` },
      { platform: 'twitter', url: `https://twitter.com/${new URL(url).hostname}` },
      { platform: 'linkedin', url: `https://linkedin.com/company/${new URL(url).hostname}` },
    ];
    
    return {
      emails,
      contactForms,
      socialLinks,
    };
  }

  /**
   * Extract emails from text using regex
   */
  private extractEmails(text: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    return matches ? [...new Set(matches)] : [];
  }

  /**
   * Extract contact forms from HTML
   */
  private extractContactForms(html: string): string[] {
    // Placeholder for form extraction logic
    // In production, this would:
    // 1. Parse HTML to find form elements
    // 2. Identify contact forms by field names (name, email, message)
    // 3. Return form URLs
    
    return [];
  }

  /**
   * Extract social media links from HTML
   */
  private extractSocialLinks(html: string): { platform: string; url: string }[] {
    const socialPatterns = [
      { platform: 'facebook', pattern: /facebook\.com\/[\w.-]+/g },
      { platform: 'twitter', pattern: /twitter\.com\/[\w.-]+/g },
      { platform: 'linkedin', pattern: /linkedin\.com\/[\w.-]+/g },
      { platform: 'instagram', pattern: /instagram\.com\/[\w.-]+/g },
      { platform: 'youtube', pattern: /youtube\.com\/[\w.-]+/g },
    ];
    
    const socialLinks: { platform: string; url: string }[] = [];
    
    for (const { platform, pattern } of socialPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const match of matches) {
          socialLinks.push({
            platform,
            url: match.startsWith('http') ? match : `https://${match}`,
          });
        }
      }
    }
    
    return socialLinks;
  }

  /**
   * Crawl multiple pages of a website
   */
  async crawlWebsite(config: WebsiteScraperConfig): Promise<WebsiteScrapedData> {
    const allEmails = new Set<string>();
    const allContactForms = new Set<string>();
    const allSocialLinks = new Set<string>();
    
    const pagesToCrawl = [config.url];
    const crawledPages = new Set<string>();
    const maxPages = config.maxPages || 10;
    
    while (pagesToCrawl.length > 0 && crawledPages.size < maxPages && !this.stopSignal) {
      const currentPage = pagesToCrawl.shift()!;
      
      if (crawledPages.has(currentPage)) continue;
      
      try {
        const scrapedData = await this.scrapeWebsite({
          ...config,
          url: currentPage,
        });
        
        scrapedData.emails.forEach(email => allEmails.add(email));
        scrapedData.contactForms.forEach(form => allContactForms.add(form));
        scrapedData.socialLinks.forEach(link => allSocialLinks.add(link.url));
        
        crawledPages.add(currentPage);
        
        // Extract internal links for further crawling
        // In production, this would parse HTML to find internal links
        // and add them to pagesToCrawl
        
        await this.delay(this.rateLimitDelay);
      } catch (error) {
        console.error(`Error crawling ${currentPage}:`, error);
      }
    }
    
    return {
      emails: Array.from(allEmails),
      contactForms: Array.from(allContactForms),
      socialLinks: Array.from(allSocialLinks).map(url => {
        const platform = this.detectPlatform(url);
        return { platform, url };
      }),
    };
  }

  /**
   * Detect social media platform from URL
   */
  private detectPlatform(url: string): string {
    if (url.includes('facebook')) return 'facebook';
    if (url.includes('twitter') || url.includes('x.com')) return 'twitter';
    if (url.includes('linkedin')) return 'linkedin';
    if (url.includes('instagram')) return 'instagram';
    if (url.includes('youtube')) return 'youtube';
    return 'other';
  }

  /**
   * Update lead with scraped website data
   */
  async updateLeadWithScrapedData(leadId: string, scrapedData: WebsiteScrapedData): Promise<Lead | null> {
    try {
      // Find the first valid email from scraped data
      const validEmail = scrapedData.emails.find(email => this.isValidEmail(email));
      
      const updates: Partial<Lead> = {};
      
      if (validEmail && !this.isDisposableEmail(validEmail)) {
        updates.email = validEmail;
        updates.email_status = 'unknown';
      }
      
      // Add social links as tags
      const socialTags = scrapedData.socialLinks.map(link => link.platform);
      updates.tags = socialTags;
      
      return await leadGenerationDB.updateLead(leadId, updates);
    } catch (error) {
      console.error('Error updating lead with scraped data:', error);
      return null;
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
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
    ];
    
    const domain = email.split('@')[1]?.toLowerCase();
    return disposableDomains.some(disposable => domain?.includes(disposable));
  }

  /**
   * Run complete website scraping workflow
   */
  async runScrapingWorkflow(config: WebsiteScraperConfig, leadId?: string): Promise<{
    emails: number;
    contactForms: number;
    socialLinks: number;
    leadUpdated: boolean;
  }> {
    if (this.isRunning) {
      throw new Error('Website scraping is already running');
    }
    
    this.isRunning = true;
    this.stopSignal = false;
    
    try {
      const scrapedData = await this.crawlWebsite(config);
      
      let leadUpdated = false;
      
      if (leadId) {
        const updatedLead = await this.updateLeadWithScrapedData(leadId, scrapedData);
        leadUpdated = !!updatedLead;
      }
      
      return {
        emails: scrapedData.emails.length,
        contactForms: scrapedData.contactForms.length,
        socialLinks: scrapedData.socialLinks.length,
        leadUpdated,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop the scraping process
   */
  stopScraping(): void {
    this.stopSignal = true;
  }

  /**
   * Check if scraping is currently running
   */
  isScrapingRunning(): boolean {
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

  /**
   * Check if URL is accessible
   */
  async isURLAccessible(url: string): Promise<boolean> {
    try {
      // In production, this would make a HEAD request to check URL accessibility
      // For now, we'll simulate it
      await this.delay(500);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get website metadata (title, description, etc.)
   */
  async getWebsiteMetadata(url: string): Promise<{
    title?: string;
    description?: string;
    keywords?: string[];
  }> {
    try {
      // Placeholder for metadata extraction
      // In production, this would:
      // 1. Fetch the website HTML
      // 2. Extract title, meta description, keywords
      // 3. Return structured metadata
      
      return {
        title: 'Website Title',
        description: 'Website Description',
        keywords: ['keyword1', 'keyword2'],
      };
    } catch (error) {
      console.error('Error getting website metadata:', error);
      return {};
    }
  }
}

export const websiteScraper = new WebsiteScraperService();
