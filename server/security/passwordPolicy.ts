import { UltraDatabase } from '../database';
import { UltraLogger } from '../logger';
import crypto from 'crypto';

export interface PasswordPolicyConfig {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventRepeatingChars: boolean;
  preventSequentialChars: boolean;
  preventCommonPasswords: boolean;
  preventPersonalInfo: boolean;
  maxAge: number; // days
  historyCount: number; // prevent reuse of last N passwords
  maxAttempts: number; // failed password change attempts
  lockoutDuration: number; // minutes
}

export interface PasswordValidationResult {
  valid: boolean;
  score: number; // 0-100
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export class PasswordPolicy {
  private readonly config: PasswordPolicyConfig;
  
  // Common weak passwords list
  private readonly commonPasswords = new Set([
    'password', '123456', '123456789', '12345678', '12345', '1234567',
    '1234567890', '1234', 'qwerty', 'abc123', 'password123', 'admin',
    'letmein', 'welcome', 'monkey', 'dragon', 'master', 'sunshine',
    'princess', 'football', 'baseball', 'shadow', 'superman', 'iloveyou',
    'starwars', 'whatever', '123abc', 'password1', 'admin123', 'root',
    'toor', 'pass', 'test', 'guest', 'user', 'temp', 'demo'
  ]);

  // Personal info patterns
  private readonly personalInfoPatterns = [
    /\b(name|first|last|surname)\b/gi,
    /\b(birth|born|dob|age)\b/gi,
    /\b(phone|mobile|tel)\b/gi,
    /\b(email|mail)\b/gi,
    /\b(address|street|city|state|zip)\b/gi,
    /\b(company|work|job)\b/gi
  ];

  constructor(
    private db: UltraDatabase,
    private logger: UltraLogger,
    config?: Partial<PasswordPolicyConfig>
  ) {
    this.config = {
      minLength: config?.minLength || 12,
      maxLength: config?.maxLength || 128,
      requireUppercase: config?.requireUppercase ?? true,
      requireLowercase: config?.requireLowercase ?? true,
      requireNumbers: config?.requireNumbers ?? true,
      requireSpecialChars: config?.requireSpecialChars ?? true,
      preventRepeatingChars: config?.preventRepeatingChars ?? true,
      preventSequentialChars: config?.preventSequentialChars ?? true,
      preventCommonPasswords: config?.preventCommonPasswords ?? true,
      preventPersonalInfo: config?.preventPersonalInfo ?? true,
      maxAge: config?.maxAge || 90, // 90 days
      historyCount: config?.historyCount || 5,
      maxAttempts: config?.maxAttempts || 5,
      lockoutDuration: config?.lockoutDuration || 30 // 30 minutes
    };
  }

  // Validate password against policy
  async validatePassword(
    password: string,
    userId?: string,
    userInfo?: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      birthDate?: string;
    }
  ): Promise<PasswordValidationResult> {
    const result: PasswordValidationResult = {
      valid: true,
      score: 0,
      errors: [],
      warnings: [],
      suggestions: []
    };

    try {
      // Length validation
      if (password.length < this.config.minLength) {
        result.errors.push(`Password must be at least ${this.config.minLength} characters long`);
        result.valid = false;
      }

      if (password.length > this.config.maxLength) {
        result.errors.push(`Password must not exceed ${this.config.maxLength} characters`);
        result.valid = false;
      }

      // Character type validation
      if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
        result.errors.push('Password must contain at least one uppercase letter');
        result.valid = false;
      }

      if (this.config.requireLowercase && !/[a-z]/.test(password)) {
        result.errors.push('Password must contain at least one lowercase letter');
        result.valid = false;
      }

      if (this.config.requireNumbers && !/\d/.test(password)) {
        result.errors.push('Password must contain at least one number');
        result.valid = false;
      }

      if (this.config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        result.errors.push('Password must contain at least one special character');
        result.valid = false;
      }

      // Common password validation
      if (this.config.preventCommonPasswords && this.isCommonPassword(password)) {
        result.errors.push('Password is too common and easily guessable');
        result.valid = false;
      }

      // Personal info validation
      if (this.config.preventPersonalInfo && userInfo && this.containsPersonalInfo(password, userInfo)) {
        result.errors.push('Password must not contain personal information');
        result.valid = false;
      }

      // Repeating characters validation
      if (this.config.preventRepeatingChars && this.hasRepeatingChars(password)) {
        result.errors.push('Password must not contain repeating characters (e.g., "aaa" or "111")');
        result.valid = false;
      }

      // Sequential characters validation
      if (this.config.preventSequentialChars && this.hasSequentialChars(password)) {
        result.errors.push('Password must not contain sequential characters (e.g., "abc" or "123")');
        result.valid = false;
      }

      // Password history validation
      if (userId && await this.isPasswordReused(password, userId)) {
        result.errors.push(`Password cannot be reused. Must be different from your last ${this.config.historyCount} passwords`);
        result.valid = false;
      }

      // Calculate password strength score
      result.score = this.calculatePasswordStrength(password);

      // Add suggestions based on score
      if (result.score < 60) {
        result.suggestions.push('Consider using a longer password with mixed character types');
      }

      if (result.score < 40) {
        result.suggestions.push('Password is weak. Consider using a passphrase or password manager');
      }

      // Add warnings
      if (password.length < 16) {
        result.warnings.push('Consider using a longer password for better security');
      }

      if (!/\d.*\d/.test(password)) {
        result.warnings.push('Consider using multiple numbers for better security');
      }

      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?].*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        result.warnings.push('Consider using multiple special characters for better security');
      }

      this.logger.info('Password validation completed', {
        userId,
        score: result.score,
        valid: result.valid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      });

      return result;

    } catch (error: any) {
      this.logger.error('Password validation error', { error: error.message, userId });
      return {
        valid: false,
        score: 0,
        errors: ['Password validation failed'],
        warnings: [],
        suggestions: []
      };
    }
  }

  // Check if password is common
  private isCommonPassword(password: string): boolean {
    const lowerPassword = password.toLowerCase();
    
    // Direct match
    if (this.commonPasswords.has(lowerPassword)) {
      return true;
    }

    // Contains common password
    for (const common of this.commonPasswords) {
      if (lowerPassword.includes(common)) {
        return true;
      }
    }

    // Common patterns
    const commonPatterns = [
      /^123+/,
      /^abc+/,
      /^qwe+/,
      /password/i,
      /admin/i,
      /user/i,
      /test/i,
      /guest/i,
      /^\d{6,}$/, // All numbers
      /^[a-z]{6,}$/i // All letters
    ];

    return commonPatterns.some(pattern => pattern.test(password));
  }

  // Check if password contains personal info
  private containsPersonalInfo(password: string, userInfo: any): boolean {
    const lowerPassword = password.toLowerCase();

    // Check against provided personal info
    if (userInfo.firstName && lowerPassword.includes(userInfo.firstName.toLowerCase())) {
      return true;
    }

    if (userInfo.lastName && lowerPassword.includes(userInfo.lastName.toLowerCase())) {
      return true;
    }

    if (userInfo.email) {
      const emailParts = userInfo.email.toLowerCase().split('@');
      if (emailParts[0] && lowerPassword.includes(emailParts[0])) {
        return true;
      }
    }

    if (userInfo.phone && lowerPassword.includes(userInfo.phone.replace(/\D/g, ''))) {
      return true;
    }

    if (userInfo.birthDate) {
      const birthYear = userInfo.birthDate.split('-')[0];
      if (birthYear && lowerPassword.includes(birthYear)) {
        return true;
      }
    }

    // Check against personal info patterns
    return this.personalInfoPatterns.some(pattern => pattern.test(password));
  }

  // Check for repeating characters
  private hasRepeatingChars(password: string): boolean {
    return /(.)\1{2,}/.test(password); // 3 or more repeating chars
  }

  // Check for sequential characters
  private hasSequentialChars(password: string): boolean {
    // Check for sequential numbers
    for (let i = 0; i < password.length - 2; i++) {
      const char1 = password.charCodeAt(i);
      const char2 = password.charCodeAt(i + 1);
      const char3 = password.charCodeAt(i + 2);

      // Sequential ascending
      if (char2 === char1 + 1 && char3 === char2 + 1) {
        return true;
      }

      // Sequential descending
      if (char2 === char1 - 1 && char3 === char2 - 1) {
        return true;
      }
    }

    return false;
  }

  // Calculate password strength score (0-100)
  private calculatePasswordStrength(password: string): number {
    let score = 0;

    // Length scoring
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 10;

    // Character variety scoring
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/\d/.test(password)) score += 10;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 10;

    // Complexity scoring
    if (/[a-z].*[A-Z]|[A-Z].*[a-z]/.test(password)) score += 5; // Mixed case
    if (/[a-zA-Z].*\d|\d.*[a-zA-Z]/.test(password)) score += 5; // Letters and numbers
    if (/[a-zA-Z\d].*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]|[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?].*[a-zA-Z\d]/.test(password)) score += 10; // Special chars

    // Deductions for weak patterns
    if (this.isCommonPassword(password)) score -= 20;
    if (this.hasRepeatingChars(password)) score -= 10;
    if (this.hasSequentialChars(password)) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  // Check if password was previously used
  private async isPasswordReused(password: string, userId: string): Promise<boolean> {
    try {
      // Hash the password for comparison
      const passwordHash = this.hashPassword(password);

      const result = await this.db.query(
        'SELECT 1 FROM password_history WHERE user_id = $1 AND password_hash = $2',
        [userId, passwordHash]
      ) as { rows: any[] };

      return result.rows.length > 0;

    } catch (error: any) {
      this.logger.error('Password history check failed', { error: error.message, userId });
      return false; // Fail open - don't block if history check fails
    }
  }

  // Hash password for storage
  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // Save password to history
  async savePasswordHistory(userId: string, password: string): Promise<void> {
    try {
      const passwordHash = this.hashPassword(password);

      // Add to history
      await this.db.query(`
        INSERT INTO password_history (id, user_id, password_hash, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [
        crypto.randomUUID(),
        userId,
        passwordHash
      ]);

      // Clean old history (keep only configured count)
      await this.db.query(`
        DELETE FROM password_history 
        WHERE user_id = $1 
        AND id NOT IN (
          SELECT id FROM password_history 
          WHERE user_id = $1 
          ORDER BY created_at DESC 
          LIMIT $2
        )
      `, [userId, this.config.historyCount]);

    } catch (error: any) {
      this.logger.error('Failed to save password history', { error: error.message, userId });
    }
  }

  // Check if password needs to be changed
  async isPasswordExpired(userId: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        'SELECT password_changed_at FROM users WHERE id = $1',
        [userId]
      ) as { rows: any[] };

      if (!result.rows[0]) {
        return true; // Force change if no record
      }

      const lastChanged = new Date(result.rows[0].password_changed_at);
      const maxAge = this.config.maxAge * 24 * 60 * 60 * 1000; // Convert days to milliseconds
      const expiresAt = new Date(lastChanged.getTime() + maxAge);

      return new Date() > expiresAt;

    } catch (error: any) {
      this.logger.error('Password expiry check failed', { error: error.message, userId });
      return false; // Fail open
    }
  }

  // Get password policy configuration
  getPolicy(): PasswordPolicyConfig {
    return { ...this.config };
  }

  // Generate secure random password
  generateSecurePassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let password = '';
    const allChars = uppercase + lowercase + numbers + special;

    // Ensure at least one of each required type
    if (this.config.requireUppercase) {
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
    }
    if (this.config.requireLowercase) {
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
    }
    if (this.config.requireNumbers) {
      password += numbers[Math.floor(Math.random() * numbers.length)];
    }
    if (this.config.requireSpecialChars) {
      password += special[Math.floor(Math.random() * special.length)];
    }

    // Fill remaining length
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  // Get password strength statistics
  async getPasswordStatistics(): Promise<{
    totalUsers: number;
    expiredPasswords: number;
    weakPasswords: number;
    averagePasswordAge: number;
    passwordStrengthDistribution: {
      strong: number; // 80-100
      medium: number; // 60-79
      weak: number;   // 0-59
    };
  }> {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN password_changed_at < NOW() - INTERVAL '${this.config.maxAge} days' THEN 1 END) as expired_passwords,
          AVG(EXTRACT(EPOCH FROM (NOW() - password_changed_at)) / 86400) as avg_age
        FROM users
        WHERE password_changed_at IS NOT NULL
      `) as { rows: any[] };

      // Note: Password strength distribution would require storing strength scores
      // This is a placeholder implementation
      return {
        totalUsers: parseInt(result.rows[0]?.total_users || '0'),
        expiredPasswords: parseInt(result.rows[0]?.expired_passwords || '0'),
        weakPasswords: 0, // Would need additional tracking
        averagePasswordAge: parseFloat(result.rows[0]?.avg_age || '0'),
        passwordStrengthDistribution: {
          strong: 0,
          medium: 0,
          weak: 0
        }
      };

    } catch (error: any) {
      this.logger.error('Failed to get password statistics', { error: error.message });
      return {
        totalUsers: 0,
        expiredPasswords: 0,
        weakPasswords: 0,
        averagePasswordAge: 0,
        passwordStrengthDistribution: {
          strong: 0,
          medium: 0,
          weak: 0
        }
      };
    }
  }
}

export default PasswordPolicy;
