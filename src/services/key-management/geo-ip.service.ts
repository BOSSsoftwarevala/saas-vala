// Geo + IP Control System for Key Management
import { supabase } from '@/lib/supabase';

export interface GeoIPRule {
  id: string;
  user_id?: string;
  key_id?: string;
  rule_type: 'allow' | 'block';
  ip_addresses: string[];
  ip_ranges: string[];
  countries: string[];
  regions: string[];
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface IPInfo {
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  timezone?: string;
}

export class GeoIPService {
  private ipCache: Map<string, IPInfo> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Check if IP is allowed
   */
  async isIPAllowed(
    ip: string,
    userId?: string,
    keyId?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const rules = await this.getRules(userId, keyId);

      if (rules.length === 0) {
        return { allowed: true };
      }

      // Get IP info
      const ipInfo = await this.getIPInfo(ip);

      // Check each rule
      for (const rule of rules) {
        if (!rule.is_active) {
          continue;
        }

        const matches = this.ruleMatches(rule, ip, ipInfo);

        if (matches) {
          if (rule.rule_type === 'block') {
            return {
              allowed: false,
              reason: rule.description || 'IP blocked by geo rule',
            };
          } else {
            return { allowed: true };
          }
        }
      }

      // Default: allow if no blocking rules matched
      const hasBlockRules = rules.some(r => r.rule_type === 'block' && r.is_active);
      
      if (hasBlockRules) {
        return {
          allowed: false,
          reason: 'IP not in allowlist',
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking IP allowance:', error);
      return { allowed: true }; // Fail open
    }
  }

  /**
   * Get rules for user/key
   */
  async getRules(userId?: string, keyId?: string): Promise<GeoIPRule[]> {
    try {
      let query = supabase.from('geo_ip_rules').select('*');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (keyId) {
        query = query.eq('key_id', keyId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return (data as GeoIPRule[]) || [];
    } catch (error) {
      console.error('Error getting geo IP rules:', error);
      return [];
    }
  }

  /**
   * Create rule
   */
  async createRule(rule: Partial<GeoIPRule>): Promise<GeoIPRule | null> {
    try {
      const { data, error } = await supabase
        .from('geo_ip_rules')
        .insert({
          user_id: rule.user_id,
          key_id: rule.key_id,
          rule_type: rule.rule_type || 'allow',
          ip_addresses: rule.ip_addresses || [],
          ip_ranges: rule.ip_ranges || [],
          countries: rule.countries || [],
          regions: rule.regions || [],
          is_active: rule.is_active !== undefined ? rule.is_active : true,
          description: rule.description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as GeoIPRule;
    } catch (error) {
      console.error('Error creating geo IP rule:', error);
      return null;
    }
  }

  /**
   * Update rule
   */
  async updateRule(ruleId: string, updates: Partial<GeoIPRule>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('geo_ip_rules')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ruleId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating geo IP rule:', error);
      return false;
    }
  }

  /**
   * Delete rule
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('geo_ip_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting geo IP rule:', error);
      return false;
    }
  }

  /**
   * Toggle rule active status
   */
  async toggleRule(ruleId: string): Promise<boolean> {
    try {
      const rule = await this.getRuleById(ruleId);

      if (!rule) {
        return false;
      }

      return await this.updateRule(ruleId, {
        is_active: !rule.is_active,
      });
    } catch (error) {
      console.error('Error toggling geo IP rule:', error);
      return false;
    }
  }

  /**
   * Get rule by ID
   */
  async getRuleById(ruleId: string): Promise<GeoIPRule | null> {
    try {
      const { data, error } = await supabase
        .from('geo_ip_rules')
        .select('*')
        .eq('id', ruleId)
        .single();

      if (error) throw error;
      return data as GeoIPRule;
    } catch (error) {
      console.error('Error getting geo IP rule by ID:', error);
      return null;
    }
  }

  /**
   * Check if rule matches IP
   */
  private ruleMatches(rule: GeoIPRule, ip: string, ipInfo?: IPInfo): boolean {
    // Check exact IP addresses
    if (rule.ip_addresses.includes(ip)) {
      return true;
    }

    // Check IP ranges
    if (this.isIPInRanges(ip, rule.ip_ranges)) {
      return true;
    }

    // Check countries
    if (ipInfo?.country && rule.countries.includes(ipInfo.country)) {
      return true;
    }

    // Check regions
    if (ipInfo?.region && rule.regions.includes(ipInfo.region)) {
      return true;
    }

    return false;
  }

  /**
   * Check if IP is in ranges
   */
  private isIPInRanges(ip: string, ranges: string[]): boolean {
    for (const range of ranges) {
      if (this.isIPInRange(ip, range)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if IP is in range
   */
  private isIPInRange(ip: string, range: string): boolean {
    // CIDR notation (e.g., 192.168.1.0/24)
    if (range.includes('/')) {
      return this.isIPInCIDR(ip, range);
    }

    // Range notation (e.g., 192.168.1.1-192.168.1.100)
    if (range.includes('-')) {
      return this.isIPInRangeNotation(ip, range);
    }

    return false;
  }

  /**
   * Check if IP is in CIDR range
   */
  private isIPInCIDR(ip: string, cidr: string): boolean {
    const [network, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength, 10);

    const ipNum = this.ipToNumber(ip);
    const networkNum = this.ipToNumber(network);
    const mask = (0xffffffff << (32 - prefix)) >>> 0;

    return (ipNum & mask) === (networkNum & mask);
  }

  /**
   * Check if IP is in range notation
   */
  private isIPInRangeNotation(ip: string, range: string): boolean {
    const [start, end] = range.split('-');
    const ipNum = this.ipToNumber(ip);
    const startNum = this.ipToNumber(start);
    const endNum = this.ipToNumber(end);

    return ipNum >= startNum && ipNum <= endNum;
  }

  /**
   * Convert IP to number
   */
  private ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (
      (parts[0] << 24) +
      (parts[1] << 16) +
      (parts[2] << 8) +
      parts[3]
    ) >>> 0;
  }

  /**
   * Get IP info (from cache or external service)
   */
  async getIPInfo(ip: string): Promise<IPInfo | null> {
    try {
      // Check cache
      if (this.ipCache.has(ip)) {
        const expiry = this.cacheExpiry.get(ip) || 0;
        if (Date.now() < expiry) {
          return this.ipCache.get(ip) || null;
        }
      }

      // In production, use an external IP geolocation service
      // For now, return null
      const ipInfo: IPInfo = {
        ip,
      };

      // Cache the result
      this.ipCache.set(ip, ipInfo);
      this.cacheExpiry.set(ip, Date.now() + this.cacheTTL);

      return ipInfo;
    } catch (error) {
      console.error('Error getting IP info:', error);
      return null;
    }
  }

  /**
   * Get IP from request
   */
  getClientIP(request: Request): string | null {
    // Try various headers for the real IP
    const headers = request.headers;
    
    const forwardedFor = headers.get('x-forwarded-for');
    const realIP = headers.get('x-real-ip');
    const cfConnectingIP = headers.get('cf-connecting-ip');

    if (forwardedFor) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return forwardedFor.split(',')[0].trim();
    }

    if (realIP) {
      return realIP;
    }

    if (cfConnectingIP) {
      return cfConnectingIP;
    }

    return null;
  }

  /**
   * Validate IP address
   */
  isValidIP(ip: string): boolean {
    const ipPattern =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
  }

  /**
   * Validate IP range
   */
  isValidIPRange(range: string): boolean {
    // CIDR notation
    if (range.includes('/')) {
      const [ip, prefix] = range.split('/');
      if (!this.isValidIP(ip)) return false;
      const prefixNum = parseInt(prefix, 10);
      return prefixNum >= 0 && prefixNum <= 32;
    }

    // Range notation
    if (range.includes('-')) {
      const [start, end] = range.split('-');
      return this.isValidIP(start) && this.isValidIP(end);
    }

    return false;
  }

  /**
   * Validate country code
   */
  isValidCountryCode(code: string): boolean {
    return /^[A-Z]{2}$/.test(code);
  }

  /**
   * Get blocked IPs for user
   */
  async getBlockedIPs(userId: string): Promise<string[]> {
    try {
      const rules = await this.getRules(userId);

      const blockedIPs: string[] = [];

      for (const rule of rules) {
        if (rule.rule_type === 'block' && rule.is_active) {
          blockedIPs.push(...rule.ip_addresses);
        }
      }

      return [...new Set(blockedIPs)];
    } catch (error) {
      console.error('Error getting blocked IPs:', error);
      return [];
    }
  }

  /**
   * Get allowed countries for user
   */
  async getAllowedCountries(userId: string): Promise<string[]> {
    try {
      const rules = await this.getRules(userId);

      const allowedCountries: string[] = [];

      for (const rule of rules) {
        if (rule.rule_type === 'allow' && rule.is_active) {
          allowedCountries.push(...rule.countries);
        }
      }

      return [...new Set(allowedCountries)];
    } catch (error) {
      console.error('Error getting allowed countries:', error);
      return [];
    }
  }

  /**
   * Block IP
   */
  async blockIP(
    userId: string,
    ip: string,
    description?: string
  ): Promise<boolean> {
    try {
      // Check if rule already exists
      const existingRules = await this.getRules(userId);
      const existingBlockRule = existingRules.find(
        r => r.rule_type === 'block' && r.ip_addresses.includes(ip)
      );

      if (existingBlockRule) {
        return true;
      }

      return await this.createRule({
        user_id: userId,
        rule_type: 'block',
        ip_addresses: [ip],
        description: description || `Blocked IP: ${ip}`,
      }) !== null;
    } catch (error) {
      console.error('Error blocking IP:', error);
      return false;
    }
  }

  /**
   * Unblock IP
   */
  async unblockIP(userId: string, ip: string): Promise<boolean> {
    try {
      const rules = await this.getRules(userId);

      for (const rule of rules) {
        if (rule.rule_type === 'block' && rule.ip_addresses.includes(ip)) {
          // Remove IP from rule
          const updatedIPs = rule.ip_addresses.filter(ipAddr => ipAddr !== ip);

          if (updatedIPs.length === 0) {
            // Delete rule if no IPs left
            await this.deleteRule(rule.id);
          } else {
            // Update rule
            await this.updateRule(rule.id, {
              ip_addresses: updatedIPs,
            });
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error unblocking IP:', error);
      return false;
    }
  }

  /**
   * Add country to allowlist
   */
  async allowCountry(
    userId: string,
    countryCode: string
  ): Promise<boolean> {
    try {
      if (!this.isValidCountryCode(countryCode)) {
        return false;
      }

      // Check if rule already exists
      const existingRules = await this.getRules(userId);
      const existingAllowRule = existingRules.find(
        r => r.rule_type === 'allow' && r.countries.includes(countryCode)
      );

      if (existingAllowRule) {
        return true;
      }

      return await this.createRule({
        user_id: userId,
        rule_type: 'allow',
        countries: [countryCode],
        description: `Allowed country: ${countryCode}`,
      }) !== null;
    } catch (error) {
      console.error('Error allowing country:', error);
      return false;
    }
  }

  /**
   * Remove country from allowlist
   */
  async removeAllowedCountry(
    userId: string,
    countryCode: string
  ): Promise<boolean> {
    try {
      const rules = await this.getRules(userId);

      for (const rule of rules) {
        if (rule.rule_type === 'allow' && rule.countries.includes(countryCode)) {
          // Remove country from rule
          const updatedCountries = rule.countries.filter(
            c => c !== countryCode
          );

          if (updatedCountries.length === 0) {
            // Delete rule if no countries left
            await this.deleteRule(rule.id);
          } else {
            // Update rule
            await this.updateRule(rule.id, {
              countries: updatedCountries,
            });
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error removing allowed country:', error);
      return false;
    }
  }

  /**
   * Get geo IP statistics
   */
  async getGeoIPStats(): Promise<{
    total_rules: number;
    active_rules: number;
    blocked_ips: number;
    allowed_countries: number;
    by_type: Record<'allow' | 'block', number>;
  }> {
    try {
      const [totalResult, activeResult] = await Promise.all([
        supabase.from('geo_ip_rules').select('id', { count: 'exact' }),
        supabase
          .from('geo_ip_rules')
          .select('id', { count: 'exact' })
          .eq('is_active', true),
      ]);

      const rules = await this.getRules();

      const blockedIPs = new Set();
      const allowedCountries = new Set();
      const byType: Record<'allow' | 'block', number> = {
        allow: 0,
        block: 0,
      };

      for (const rule of rules) {
        byType[rule.rule_type]++;
        blockedIPs.add(...rule.ip_addresses);
        allowedCountries.add(...rule.countries);
      }

      return {
        total_rules: totalResult.count || 0,
        active_rules: activeResult.count || 0,
        blocked_ips: blockedIPs.size,
        allowed_countries: allowedCountries.size,
        by_type,
      };
    } catch (error) {
      console.error('Error getting geo IP stats:', error);
      return {
        total_rules: 0,
        active_rules: 0,
        blocked_ips: 0,
        allowed_countries: 0,
        by_type: {
          allow: 0,
          block: 0,
        },
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.ipCache.clear();
    this.cacheExpiry.clear();
  }
}

export const geoIPService = new GeoIPService();
