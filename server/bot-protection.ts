import { EventEmitter } from 'events';
import crypto from 'crypto';
import { UltraLogger } from './logger';
import { UltraDatabase } from './database';
import { UltraAdvancedCache } from './advanced-cache';

export interface BotProtectionConfig {
  enabled: boolean;
  rateLimiting: {
    enabled: boolean;
    windowMs: number; // Time window in milliseconds
    maxRequests: number; // Max requests per window
    blockDurationMs: number; // How long to block
  };
  ipTracking: {
    enabled: boolean;
    suspiciousThreshold: number; // Number of suspicious actions before blocking
    blockDurationMs: number;
  };
  userAgents: {
    enabled: boolean;
    blockedPatterns: string[];
    allowedPatterns: string[];
  };
  captcha: {
    enabled: boolean;
    provider: 'recaptcha' | 'hcaptcha' | 'turnstile';
    siteKey: string;
    secretKey: string;
    threshold: number; // Score threshold (0-1)
    triggerAfter: number; // Trigger after X suspicious requests
  };
  behaviorAnalysis: {
    enabled: boolean;
    rapidRequestThreshold: number; // Requests per second
    unusualPathDetection: boolean;
    formSpamDetection: boolean;
  };
  geoBlocking: {
    enabled: boolean;
    blockedCountries: string[];
    allowedCountries: string[];
  };
}

export interface SuspiciousActivity {
  id: string;
  ip: string;
  userAgent?: string;
  type: 'rapid_requests' | 'suspicious_user_agent' | 'form_spam' | 'unusual_path' | 'failed_auth' | 'rate_limit_exceeded';
  timestamp: Date;
  details: any;
  score: number; // 0-100
  blocked: boolean;
}

export interface RateLimitEntry {
  ip: string;
  requests: number;
  windowStart: Date;
  blocked: boolean;
  blockedUntil?: Date;
}

export interface BotProtectionStats {
  totalRequests: number;
  blockedRequests: number;
  suspiciousActivities: number;
  rateLimitedIPs: number;
  blockedIPs: number;
  captchaChallenges: number;
  captchaPassed: number;
  captchaFailed: number;
  topBlockedIPs: Array<{ ip: string; count: number }>;
  activitiesByType: Record<string, number>;
}

export class UltraBotProtection extends EventEmitter {
  private static instance: UltraBotProtection;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private cache: UltraAdvancedCache;
  private config: BotProtectionConfig;
  private rateLimitMap: Map<string, RateLimitEntry> = new Map();
  private suspiciousActivities: Map<string, SuspiciousActivity[]> = new Map();
  private blockedIPs: Map<string, Date> = new Map();
  private stats: BotProtectionStats = {
    totalRequests: 0,
    blockedRequests: 0,
    suspiciousActivities: 0,
    rateLimitedIPs: 0,
    blockedIPs: 0,
    captchaChallenges: 0,
    captchaPassed: 0,
    captchaFailed: 0,
    topBlockedIPs: [],
    activitiesByType: {}
  };

  static getInstance(config?: BotProtectionConfig): UltraBotProtection {
    if (!UltraBotProtection.instance) {
      UltraBotProtection.instance = new UltraBotProtection(config);
    }
    return UltraBotProtection.instance;
  }

  constructor(config?: BotProtectionConfig) {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.cache = UltraAdvancedCache.getInstance();
    
    this.config = {
      enabled: process.env.BOT_PROTECTION_ENABLED !== 'false',
      rateLimiting: {
        enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
        blockDurationMs: parseInt(process.env.RATE_LIMIT_BLOCK_DURATION_MS || '3600000') // 1 hour
      },
      ipTracking: {
        enabled: process.env.IP_TRACKING_ENABLED !== 'false',
        suspiciousThreshold: parseInt(process.env.SUSPICIOUS_THRESHOLD || '5'),
        blockDurationMs: parseInt(process.env.IP_BLOCK_DURATION_MS || '86400000') // 24 hours
      },
      userAgents: {
        enabled: process.env.USER_AGENT_CHECK_ENABLED !== 'false',
        blockedPatterns: (process.env.BLOCKED_USER_AGENTS || 'bot,crawler,scraper,spider').split(','),
        allowedPatterns: (process.env.ALLOWED_USER_AGENTS || 'mozilla,chrome,firefox,safari,edge').split(',')
      },
      captcha: {
        enabled: process.env.CAPTCHA_ENABLED === 'true',
        provider: (process.env.CAPTCHA_PROVIDER as any) || 'recaptcha',
        siteKey: process.env.CAPTCHA_SITE_KEY || '',
        secretKey: process.env.CAPTCHA_SECRET_KEY || '',
        threshold: parseFloat(process.env.CAPTCHA_THRESHOLD || '0.5'),
        triggerAfter: parseInt(process.env.CAPTCHA_TRIGGER_AFTER || '3')
      },
      behaviorAnalysis: {
        enabled: process.env.BEHAVIOR_ANALYSIS_ENABLED !== 'false',
        rapidRequestThreshold: parseInt(process.env.RAPID_REQUEST_THRESHOLD || '10'), // 10 req/sec
        unusualPathDetection: true,
        formSpamDetection: true
      },
      geoBlocking: {
        enabled: process.env.GEO_BLOCKING_ENABLED === 'true',
        blockedCountries: (process.env.BLOCKED_COUNTRIES || '').split(',').filter(Boolean),
        allowedCountries: (process.env.ALLOWED_COUNTRIES || '').split(',').filter(Boolean)
      },
      ...config
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Load blocked IPs from cache/database
      await this.loadBlockedIPs();
      
      // Start cleanup timer
      setInterval(() => {
        this.cleanup();
      }, 60000); // Cleanup every minute

      this.logger.info('bot-protection', 'Bot protection system initialized', {
        enabled: this.config.enabled,
        rateLimiting: this.config.rateLimiting.enabled,
        captcha: this.config.captcha.enabled,
        behaviorAnalysis: this.config.behaviorAnalysis.enabled,
        geoBlocking: this.config.geoBlocking.enabled
      });

    } catch (error) {
      this.logger.error('bot-protection', 'Failed to initialize bot protection', error as Error);
    }
  }

  async checkRequest(req: any): Promise<{
    allowed: boolean;
    reason?: string;
    requireCaptcha?: boolean;
    blockDuration?: number;
  }> {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    const path = req.path || req.url || '/';
    
    this.stats.totalRequests++;

    try {
      // Check if IP is blocked
      if (this.isIPBlocked(ip)) {
        this.stats.blockedRequests++;
        this.logger.warn('bot-protection', `Blocked IP attempted access: ${ip}`, { userAgent, path });
        return { 
          allowed: false, 
          reason: 'IP blocked',
          blockDuration: Math.ceil((this.blockedIPs.get(ip)!.getTime() - Date.now()) / 1000)
        };
      }

      // Check rate limiting
      if (this.config.rateLimiting.enabled) {
        const rateLimitResult = await this.checkRateLimit(ip);
        if (!rateLimitResult.allowed) {
          this.stats.rateLimitedIPs++;
          this.stats.blockedRequests++;
          return { 
            allowed: false, 
            reason: 'Rate limit exceeded',
            blockDuration: Math.ceil(rateLimitResult.blockDuration! / 1000)
          };
        }
      }

      // Check user agent
      if (this.config.userAgents.enabled) {
        const userAgentResult = this.checkUserAgent(userAgent);
        if (!userAgentResult.allowed) {
          await this.recordSuspiciousActivity(ip, userAgent, 'suspicious_user_agent', { userAgent });
          this.stats.blockedRequests++;
          return { allowed: false, reason: 'Suspicious user agent' };
        }
      }

      // Check geo-blocking
      if (this.config.geoBlocking.enabled) {
        const geoResult = await this.checkGeoBlocking(ip, req);
        if (!geoResult.allowed) {
          this.stats.blockedRequests++;
          return { allowed: false, reason: 'Geo-blocked' };
        }
      }

      // Behavior analysis
      if (this.config.behaviorAnalysis.enabled) {
        const behaviorResult = await this.analyzeBehavior(ip, userAgent, path, req);
        if (!behaviorResult.allowed) {
          this.stats.suspiciousActivities++;
          
          // Check if CAPTCHA should be triggered
          if (this.config.captcha.enabled && this.shouldTriggerCaptcha(ip)) {
            this.stats.captchaChallenges++;
            return { 
              allowed: true, 
              requireCaptcha: true,
              reason: behaviorResult.reason
            };
          }
          
          this.stats.blockedRequests++;
          return { allowed: false, reason: behaviorResult.reason };
        }
      }

      return { allowed: true };

    } catch (error) {
      this.logger.error('bot-protection', 'Error checking request', error as Error);
      // Allow request on error to avoid blocking legitimate traffic
      return { allowed: true };
    }
  }

  private async checkRateLimit(ip: string): Promise<{
    allowed: boolean;
    blockDuration?: number;
  }> {
    const now = new Date();
    const entry = this.rateLimitMap.get(ip);

    if (!entry || now > new Date(entry.windowStart.getTime() + this.config.rateLimiting.windowMs)) {
      // New window
      this.rateLimitMap.set(ip, {
        ip,
        requests: 1,
        windowStart: now,
        blocked: false
      });
      return { allowed: true };
    }

    entry.requests++;

    if (entry.requests > this.config.rateLimiting.maxRequests) {
      if (!entry.blocked) {
        // Block the IP
        entry.blocked = true;
        entry.blockedUntil = new Date(now.getTime() + this.config.rateLimiting.blockDurationMs);
        this.blockIP(ip, this.config.rateLimiting.blockDurationMs);
        
        this.logger.warn('bot-protection', `IP rate limited: ${ip}`, {
          requests: entry.requests,
          maxRequests: this.config.rateLimiting.maxRequests,
          windowMs: this.config.rateLimiting.windowMs
        });
      }

      return {
        allowed: false,
        blockDuration: entry.blockedUntil ? entry.blockedUntil.getTime() - Date.now() : undefined
      };
    }

    return { allowed: true };
  }

  private checkUserAgent(userAgent: string): { allowed: boolean } {
    const ua = userAgent.toLowerCase();

    // Check blocked patterns
    for (const pattern of this.config.userAgents.blockedPatterns) {
      if (ua.includes(pattern.toLowerCase())) {
        return { allowed: false };
      }
    }

    // Check allowed patterns (if specified)
    if (this.config.userAgents.allowedPatterns.length > 0) {
      let allowed = false;
      for (const pattern of this.config.userAgents.allowedPatterns) {
        if (ua.includes(pattern.toLowerCase())) {
          allowed = true;
          break;
        }
      }
      if (!allowed) {
        return { allowed: false };
      }
    }

    return { allowed: true };
  }

  private async checkGeoBlocking(ip: string, req: any): Promise<{ allowed: boolean }> {
    // This is a simplified implementation
    // In production, you'd use a proper IP geolocation service
    
    if (this.config.geoBlocking.blockedCountries.length === 0 && 
        this.config.geoBlocking.allowedCountries.length === 0) {
      return { allowed: true };
    }

    // Placeholder for actual geo lookup
    const country = await this.getIPCountry(ip);
    
    if (this.config.geoBlocking.blockedCountries.includes(country)) {
      return { allowed: false };
    }

    if (this.config.geoBlocking.allowedCountries.length > 0 && 
        !this.config.geoBlocking.allowedCountries.includes(country)) {
      return { allowed: false };
    }

    return { allowed: true };
  }

  private async analyzeBehavior(ip: string, userAgent: string, path: string, req: any): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const now = Date.now();
    const activities = this.suspiciousActivities.get(ip) || [];

    // Check for rapid requests
    if (this.config.behaviorAnalysis.rapidRequestThreshold > 0) {
      const recentRequests = activities.filter(a => 
        a.type === 'rapid_requests' && 
        now - a.timestamp.getTime() < 1000 // Last second
      );

      if (recentRequests.length >= this.config.behaviorAnalysis.rapidRequestThreshold) {
        await this.recordSuspiciousActivity(ip, userAgent, 'rapid_requests', { 
          requestsPerSecond: recentRequests.length + 1,
          path 
        });
        return { allowed: false, reason: 'Rapid requests detected' };
      }
    }

    // Check for unusual paths
    if (this.config.behaviorAnalysis.unusualPathDetection) {
      const suspiciousPaths = ['/admin', '/wp-admin', '/phpmyadmin', '/.env', '/config'];
      if (suspiciousPaths.some(suspiciousPath => path.includes(suspiciousPath))) {
        await this.recordSuspiciousActivity(ip, userAgent, 'unusual_path', { path });
        return { allowed: false, reason: 'Access to suspicious path' };
      }
    }

    // Check for form spam
    if (this.config.behaviorAnalysis.formSpamDetection && req.method === 'POST') {
      const formFields = Object.keys(req.body || {}).length;
      if (formFields > 50) { // Unusually large form
        await this.recordSuspiciousActivity(ip, userAgent, 'form_spam', { 
          formFields,
          path 
        });
        return { allowed: false, reason: 'Potential form spam' };
      }
    }

    return { allowed: true };
  }

  private shouldTriggerCaptcha(ip: string): boolean {
    const activities = this.suspiciousActivities.get(ip) || [];
    const recentActivities = activities.filter(a => 
      Date.now() - a.timestamp.getTime() < 3600000 // Last hour
    );

    return recentActivities.length >= this.config.captcha.triggerAfter;
  }

  async verifyCaptcha(token: string, ip: string): Promise<{
    valid: boolean;
    score?: number;
    reason?: string;
  }> {
    if (!this.config.captcha.enabled) {
      return { valid: true };
    }

    try {
      let response;

      switch (this.config.captcha.provider) {
        case 'recaptcha':
          response = await this.verifyRecaptcha(token);
          break;
        case 'hcaptcha':
          response = await this.verifyHCaptcha(token);
          break;
        case 'turnstile':
          response = await this.verifyTurnstile(token);
          break;
        default:
          return { valid: false, reason: 'Unknown CAPTCHA provider' };
      }

      if (response.valid) {
        this.stats.captchaPassed++;
        this.logger.info('bot-protection', `CAPTCHA passed for IP: ${ip}`);
      } else {
        this.stats.captchaFailed++;
        this.logger.warn('bot-protection', `CAPTCHA failed for IP: ${ip}`, { reason: response.reason });
      }

      return response;

    } catch (error) {
      this.logger.error('bot-protection', 'CAPTCHA verification failed', error as Error);
      return { valid: false, reason: 'CAPTCHA verification error' };
    }
  }

  private async verifyRecaptcha(token: string): Promise<{
    valid: boolean;
    score?: number;
    reason?: string;
  }> {
    // Placeholder for reCAPTCHA verification
    // In production, you'd make an HTTP request to Google's verification API
    return { valid: true, score: 0.9 };
  }

  private async verifyHCaptcha(token: string): Promise<{
    valid: boolean;
    score?: number;
    reason?: string;
  }> {
    // Placeholder for hCaptcha verification
    return { valid: true, score: 0.9 };
  }

  private async verifyTurnstile(token: string): Promise<{
    valid: boolean;
    score?: number;
    reason?: string;
  }> {
    // Placeholder for Cloudflare Turnstile verification
    return { valid: true, score: 0.9 };
  }

  private async recordSuspiciousActivity(
    ip: string, 
    userAgent: string, 
    type: SuspiciousActivity['type'], 
    details: any
  ): Promise<void> {
    const activity: SuspiciousActivity = {
      id: crypto.randomUUID(),
      ip,
      userAgent,
      type,
      timestamp: new Date(),
      details,
      score: this.calculateActivityScore(type, details),
      blocked: false
    };

    const activities = this.suspiciousActivities.get(ip) || [];
    activities.push(activity);
    this.suspiciousActivities.set(ip, activities);

    // Update stats
    this.stats.activitiesByType[type] = (this.stats.activitiesByType[type] || 0) + 1;

    // Check if IP should be blocked
    const totalScore = activities.reduce((sum, a) => sum + a.score, 0);
    if (totalScore >= this.config.ipTracking.suspiciousThreshold * 20) { // Each activity has max score of 20
      this.blockIP(ip, this.config.ipTracking.blockDurationMs);
      activity.blocked = true;
    }

    // Store in database for persistence
    try {
      await this.database.query(`
        INSERT INTO suspicious_activities (id, ip, user_agent, type, timestamp, details, score, blocked)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        activity.id,
        activity.ip,
        activity.userAgent,
        activity.type,
        activity.timestamp,
        JSON.stringify(activity.details),
        activity.score,
        activity.blocked
      ]);
    } catch (error) {
      this.logger.error('bot-protection', 'Failed to store suspicious activity', error as Error);
    }

    this.emit('suspiciousActivity', activity);
  }

  private calculateActivityScore(type: SuspiciousActivity['type'], details: any): number {
    const baseScores = {
      rapid_requests: 15,
      suspicious_user_agent: 20,
      form_spam: 10,
      unusual_path: 15,
      failed_auth: 5,
      rate_limit_exceeded: 10
    };

    let score = baseScores[type] || 5;

    // Add modifiers based on details
    if (type === 'rapid_requests' && details.requestsPerSecond > 20) {
      score += 10;
    }

    if (type === 'form_spam' && details.formFields > 100) {
      score += 10;
    }

    return Math.min(score, 20); // Max score of 20
  }

  private blockIP(ip: string, durationMs: number): void {
    const blockedUntil = new Date(Date.now() + durationMs);
    this.blockedIPs.set(ip, blockedUntil);
    this.stats.blockedIPs++;

    // Cache the blocked IP
    this.cache.set(`blocked_ip:${ip}`, true, { ttl: Math.ceil(durationMs / 1000) });

    this.logger.warn('bot-protection', `IP blocked: ${ip}`, { 
      duration: durationMs,
      blockedUntil 
    });

    this.emit('ipBlocked', { ip, durationMs, blockedUntil });
  }

  private isIPBlocked(ip: string): boolean {
    const blockedUntil = this.blockedIPs.get(ip);
    if (!blockedUntil) {
      return false;
    }

    if (new Date() > blockedUntil) {
      this.blockedIPs.delete(ip);
      return false;
    }

    return true;
  }

  private async getIPCountry(ip: string): Promise<string> {
    // Placeholder implementation
    // In production, you'd use a service like MaxMind GeoIP2
    return 'US';
  }

  private async loadBlockedIPs(): Promise<void> {
    try {
      // Load from cache first
      const cachedBlockedIPs = await this.cache.get('blocked_ips');
      if (cachedBlockedIPs) {
        for (const [ip, until] of Object.entries(cachedBlockedIPs)) {
          this.blockedIPs.set(ip, new Date(until as string));
        }
      }

      // Load from database
      const rows = await this.database.query(`
        SELECT ip, blocked_until FROM blocked_ips 
        WHERE blocked_until > NOW()
      `);

      for (const row of rows) {
        this.blockedIPs.set(row.ip, new Date(row.blocked_until));
      }

      this.logger.info('bot-protection', `Loaded ${this.blockedIPs.size} blocked IPs`);

    } catch (error) {
      this.logger.error('bot-protection', 'Failed to load blocked IPs', error as Error);
    }
  }

  private cleanup(): void {
    const now = new Date();

    // Cleanup rate limit entries
    for (const [ip, entry] of this.rateLimitMap.entries()) {
      if (now > new Date(entry.windowStart.getTime() + this.config.rateLimiting.windowMs)) {
        this.rateLimitMap.delete(ip);
      }
    }

    // Cleanup blocked IPs
    for (const [ip, blockedUntil] of this.blockedIPs.entries()) {
      if (now > blockedUntil) {
        this.blockedIPs.delete(ip);
        this.cache.delete(`blocked_ip:${ip}`);
      }
    }

    // Cleanup old suspicious activities
    for (const [ip, activities] of this.suspiciousActivities.entries()) {
      const recent = activities.filter(a => now.getTime() - a.timestamp.getTime() < 86400000); // Keep last 24 hours
      if (recent.length === 0) {
        this.suspiciousActivities.delete(ip);
      } else {
        this.suspiciousActivities.set(ip, recent);
      }
    }
  }

  // Public API methods
  async blockIPManually(ip: string, durationMs: number, reason: string): Promise<void> {
    this.blockIP(ip, durationMs);
    
    try {
      await this.database.query(`
        INSERT INTO blocked_ips (ip, blocked_until, reason, manual_block)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (ip) DO UPDATE SET
          blocked_until = EXCLUDED.blocked_until,
          reason = EXCLUDED.reason,
          manual_block = true
      `, [ip, new Date(Date.now() + durationMs), reason]);
    } catch (error) {
      this.logger.error('bot-protection', 'Failed to store manual IP block', error as Error);
    }

    this.logger.info('bot-protection', `IP manually blocked: ${ip}`, { reason, durationMs });
  }

  async unblockIP(ip: string): Promise<boolean> {
    const wasBlocked = this.blockedIPs.has(ip);
    
    this.blockedIPs.delete(ip);
    this.cache.delete(`blocked_ip:${ip}`);

    try {
      await this.database.query('DELETE FROM blocked_ips WHERE ip = $1', [ip]);
    } catch (error) {
      this.logger.error('bot-protection', 'Failed to remove IP block', error as Error);
    }

    if (wasBlocked) {
      this.logger.info('bot-protection', `IP unblocked: ${ip}`);
      this.emit('ipUnblocked', { ip });
    }

    return wasBlocked;
  }

  getBlockedIPs(): Array<{ ip: string; blockedUntil: Date }> {
    return Array.from(this.blockedIPs.entries()).map(([ip, blockedUntil]) => ({
      ip,
      blockedUntil
    }));
  }

  async getSuspiciousActivities(limit: number = 100): Promise<SuspiciousActivity[]> {
    try {
      const rows = await this.database.query(`
        SELECT * FROM suspicious_activities 
        ORDER BY timestamp DESC 
        LIMIT $1
      `, [limit]);

      return rows.map(row => ({
        id: row.id,
        ip: row.ip,
        userAgent: row.user_agent,
        type: row.type,
        timestamp: row.timestamp,
        details: row.details,
        score: row.score,
        blocked: row.blocked
      }));

    } catch (error) {
      this.logger.error('bot-protection', 'Failed to get suspicious activities', error as Error);
      return [];
    }
  }

  getProtectionStats(): BotProtectionStats {
    // Update top blocked IPs
    const ipCounts = new Map<string, number>();
    for (const activities of this.suspiciousActivities.values()) {
      for (const activity of activities) {
        ipCounts.set(activity.ip, (ipCounts.get(activity.ip) || 0) + 1);
      }
    }

    this.stats.topBlockedIPs = Array.from(ipCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { ...this.stats };
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    components: {
      rateLimiting: boolean;
      ipBlocking: boolean;
      captcha: boolean;
      behaviorAnalysis: boolean;
      geoBlocking: boolean;
    };
    issues: string[];
  }> {
    const issues: string[] = [];
    
    const components = {
      rateLimiting: this.config.rateLimiting.enabled,
      ipBlocking: this.config.ipTracking.enabled,
      captcha: this.config.captcha.enabled,
      behaviorAnalysis: this.config.behaviorAnalysis.enabled,
      geoBlocking: this.config.geoBlocking.enabled
    };

    // Check CAPTCHA configuration
    if (this.config.captcha.enabled && (!this.config.captcha.siteKey || !this.config.captcha.secretKey)) {
      issues.push('CAPTCHA enabled but missing site key or secret key');
      components.captcha = false;
    }

    return {
      healthy: issues.length === 0,
      components,
      issues
    };
  }

  updateConfig(newConfig: Partial<BotProtectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('bot-protection', 'Bot protection configuration updated');
  }
}

export default UltraBotProtection;
