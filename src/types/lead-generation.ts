// Lead Generation Extension System Types

export interface Lead {
  id: string;
  business_name: string;
  phone?: string;
  email?: string;
  website?: string;
  rating?: number;
  reviews_count?: number;
  address?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  business_type?: string;
  source: 'maps' | 'website' | 'linkedin' | 'social';
  lead_score: 'hot' | 'warm' | 'cold';
  lead_score_value: number;
  status: 'new' | 'contacted' | 'interested' | 'converted' | 'lost';
  email_status: 'unknown' | 'valid' | 'invalid' | 'risky' | 'disposable';
  email_verified: boolean;
  is_duplicate: boolean;
  notes?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  indexed_at?: string;
  auto_generated: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  keywords: string[];
  target_city?: string;
  target_country?: string;
  target_business_types: string[];
  status: 'active' | 'paused' | 'completed';
  total_leads: number;
  contacted_leads: number;
  interested_leads: number;
  converted_leads: number;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
}

export interface OutreachMessage {
  id: string;
  lead_id: string;
  campaign_id?: string;
  channel: 'email' | 'whatsapp' | 'linkedin';
  template: string;
  personalized_content?: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'replied' | 'failed';
  sent_at?: string;
  opened_at?: string;
  replied_at?: string;
  error_message?: string;
  follow_up_sequence: number;
  created_at: string;
}

export interface EmailVerification {
  id: string;
  email: string;
  domain: string;
  status: 'unknown' | 'valid' | 'invalid' | 'risky' | 'disposable';
  smtp_check: boolean;
  mx_record: boolean;
  disposable: boolean;
  score: number;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SEOAnalysis {
  id: string;
  lead_id?: string;
  keyword: string;
  search_volume?: number;
  competition_score?: number;
  current_ranking?: number;
  backlinks_count?: number;
  on_page_score?: number;
  overall_score?: number;
  suggestions: string[];
  analyzed_at: string;
  created_at: string;
}

export interface APIIntegration {
  id: string;
  provider: 'hunter' | 'snov' | 'apollo' | 'serpapi' | 'dataforseo' | 'apify' | 'phantombuster';
  api_key?: string;
  is_active: boolean;
  rate_limit_per_hour: number;
  requests_today: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: 'note' | 'call' | 'email' | 'meeting' | 'task';
  description?: string;
  created_by: string;
  created_at: string;
}

export interface AnalyticsMetrics {
  id: string;
  metric_date: string;
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
  created_at: string;
}

// Module-specific types

export interface GoogleMapsSearchConfig {
  keyword: string;
  city: string;
  country?: string;
  maxResults?: number;
  businessTypes?: string[];
}

export interface GoogleMapsLead {
  business_name: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews_count?: number;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface WebsiteScraperConfig {
  url: string;
  maxPages?: number;
  extractEmails?: boolean;
  extractContactForms?: boolean;
  extractSocialLinks?: boolean;
}

export interface WebsiteScrapedData {
  emails: string[];
  contactForms: string[];
  socialLinks: {
    platform: string;
    url: string;
  }[];
}

export interface EmailFinderConfig {
  domain: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

export interface EmailVerificationResult {
  email: string;
  status: 'unknown' | 'valid' | 'invalid' | 'risky' | 'disposable';
  score: number;
  details: {
    smtp_check: boolean;
    mx_record: boolean;
    disposable: boolean;
    free_provider: boolean;
  };
}

export interface SEOAnalyzerConfig {
  keyword: string;
  website?: string;
  location?: string;
}

export interface SEOAnalyzerResult {
  keyword: string;
  search_volume: number;
  competition: number;
  current_ranking?: number;
  backlinks: number;
  on_page_score: number;
  overall_score: number;
  suggestions: string[];
}

export interface LinkedInExtractorConfig {
  searchQuery: string;
  maxResults?: number;
  extractCompanyData?: boolean;
  enrichEmails?: boolean;
}

export interface LinkedInProfile {
  name: string;
  title?: string;
  company?: string;
  email?: string;
  linkedin_url: string;
}

export interface SocialScraperConfig {
  platform: 'facebook' | 'instagram' | 'twitter';
  query: string;
  maxResults?: number;
}

export interface SocialProfile {
  username: string;
  email?: string;
  platform: string;
  profile_url: string;
  followers_count?: number;
}

export interface LeadScoreConfig {
  website_weight: number;
  email_weight: number;
  activity_weight: number;
  rating_weight: number;
}

export interface OutreachConfig {
  channel: 'email' | 'whatsapp' | 'linkedin';
  template: string;
  personalizationEnabled: boolean;
  followUpDays: number[];
  followUpTemplates: string[];
}

export interface OutreachResult {
  lead_id: string;
  message_id: string;
  status: 'sent' | 'failed';
  error?: string;
}

export interface CRMStage {
  name: string;
  order: number;
  color: string;
}

export interface CRMLead {
  lead: Lead;
  stage: string;
  activities: LeadActivity[];
  next_action?: string;
  next_action_date?: string;
}

export interface AnalyticsConfig {
  dateRange: '7d' | '30d' | '90d' | 'custom';
  startDate?: string;
  endDate?: string;
  metrics: string[];
}
