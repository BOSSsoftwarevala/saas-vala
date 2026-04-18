/**
 * Security Offline Safe
 * Local token validation, role guard, no raw data exposure
 */

import React from 'react';
import { localApi } from './localApi';
import { selfHealingEngine } from './selfHealingEngine';

export interface SecurityConfig {
  enableTokenValidation: boolean;
  enableRoleGuard: boolean;
  enableDataSanitization: boolean;
  enableAuditLogging: boolean;
}

export interface SecurityValidationResult {
  valid: boolean;
  reason?: string;
  timestamp: string;
}

class SecurityOfflineSafe {
  private config: SecurityConfig = {
    enableTokenValidation: true,
    enableRoleGuard: true,
    enableDataSanitization: true,
    enableAuditLogging: true,
  };

  private currentToken: string | null = null;
  private currentUserId: string | null = null;
  private currentRole: string | null = null;
  private tokenExpiry: number = 0;

  async validateToken(token: string): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      valid: false,
      timestamp: new Date().toISOString(),
    };

    if (!this.config.enableTokenValidation) {
      result.valid = true;
      return result;
    }

    if (!token) {
      result.reason = 'Token is null or empty';
      return result;
    }

    try {
      // Check if token matches current token
      if (this.currentToken !== token) {
        result.reason = 'Token does not match current session';
        return result;
      }

      // Check if token is expired
      if (Date.now() > this.tokenExpiry) {
        result.reason = 'Token has expired';
        this.currentToken = null;
        this.currentUserId = null;
        this.currentRole = null;
        return result;
      }

      result.valid = true;
    } catch (error) {
      result.reason = `Token validation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return result;
  }

  async validateRole(requiredRole: string): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      valid: false,
      timestamp: new Date().toISOString(),
    };

    if (!this.config.enableRoleGuard) {
      result.valid = true;
      return result;
    }

    if (!this.currentRole) {
      result.reason = 'No current role set';
      return result;
    }

    // Role hierarchy: admin > boss > reseller > user
    const roleHierarchy = ['admin', 'boss', 'reseller', 'user'];
    const currentRoleIndex = roleHierarchy.indexOf(this.currentRole);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

    if (currentRoleIndex === -1) {
      result.reason = `Invalid current role: ${this.currentRole}`;
      return result;
    }

    if (requiredRoleIndex === -1) {
      result.reason = `Invalid required role: ${requiredRole}`;
      return result;
    }

    // Current role must be equal or higher in hierarchy
    if (currentRoleIndex > requiredRoleIndex) {
      result.reason = `Insufficient permissions. Required: ${requiredRole}, Current: ${this.currentRole}`;
      return result;
    }

    result.valid = true;
    return result;
  }

  async setSession(token: string, userId: string, role: string, expiry: number): Promise<void> {
    this.currentToken = token;
    this.currentUserId = userId;
    this.currentRole = role;
    this.tokenExpiry = expiry;

    if (this.config.enableAuditLogging) {
      await this.logSecurityEvent('session_set', { userId, role });
    }
  }

  async clearSession(): Promise<void> {
    this.currentToken = null;
    this.currentUserId = null;
    this.currentRole = null;
    this.tokenExpiry = 0;

    if (this.config.enableAuditLogging) {
      await this.logSecurityEvent('session_cleared', {});
    }
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  getCurrentRole(): string | null {
    return this.currentRole;
  }

  isAuthenticated(): boolean {
    return this.currentToken !== null && Date.now() < this.tokenExpiry;
  }

  sanitizeData<T>(data: T): T {
    if (!this.config.enableDataSanitization) {
      return data;
    }

    if (typeof data === 'string') {
      // Remove potentially dangerous characters
      return this.sanitizeString(data) as T;
    }

    if (typeof data === 'object' && data !== null) {
      // Recursively sanitize object
      const sanitized: any = {};
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          // Skip sensitive fields
          if (this.isSensitiveField(key)) {
            sanitized[key] = '[REDACTED]';
          } else {
            sanitized[key] = this.sanitizeData((data as any)[key]);
          }
        }
      }
      return sanitized as T;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item)) as T;
    }

    return data;
  }

  private sanitizeString(str: string): string {
    // Remove potentially dangerous characters for XSS prevention
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'privateKey',
      'creditCard',
      'ssn',
      'socialSecurity',
    ];

    const lowerFieldName = fieldName.toLowerCase();
    return sensitiveFields.some(field => lowerFieldName.includes(field));
  }

  async validateDataIntegrity(data: any): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      valid: true,
      timestamp: new Date().toISOString(),
    };

    if (!data) {
      result.valid = false;
      result.reason = 'Data is null or undefined';
      return result;
    }

    // Check for suspicious patterns
    const dataStr = JSON.stringify(data);

    // Check for script tags (XSS)
    if (/<script[^>]*>.*?<\/script>/i.test(dataStr)) {
      result.valid = false;
      result.reason = 'Potential XSS detected';
      return result;
    }

    // Check for SQL injection patterns
    if (/['\-]|;|(\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b)/i.test(dataStr)) {
      result.valid = false;
      result.reason = 'Potential SQL injection detected';
      return result;
    }

    return result;
  }

  async logSecurityEvent(eventType: string, context: any): Promise<void> {
    if (!this.config.enableAuditLogging) {
      return;
    }

    try {
      const logEntry = {
        id: crypto.randomUUID(),
        event_type: eventType,
        user_id: this.currentUserId,
        role: this.currentRole,
        context: this.sanitizeData(context),
        timestamp: new Date().toISOString(),
      };

      // In a real implementation, this would be saved to an audit log table
      // For now, just log to console (without sensitive data)
      console.log('[Security Audit]', {
        eventType,
        userId: this.currentUserId,
        timestamp: logEntry.timestamp,
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  async checkPermission(permission: string): Promise<boolean> {
    if (!this.config.enableRoleGuard) {
      return true;
    }

    // Define permission matrix
    const permissionMatrix: Record<string, string[]> = {
      admin: ['all'],
      boss: ['read', 'write', 'manage_products', 'manage_orders', 'manage_wallet'],
      reseller: ['read', 'write', 'manage_orders'],
      user: ['read', 'write'],
    };

    if (!this.currentRole) {
      return false;
    }

    const rolePermissions = permissionMatrix[this.currentRole] || [];
    return rolePermissions.includes('all') || rolePermissions.includes(permission);
  }

  setConfig(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  // React HOC for role-based access control
  withRoleGuard<P extends object>(
    Component: React.ComponentType<P>,
    requiredRole: string,
    fallbackComponent?: React.ComponentType<P>
  ): React.ComponentType<P> {
    return function WithRoleGuardWrapper(props: P) {
      const [hasAccess, setHasAccess] = React.useState(false);
      const [loading, setLoading] = React.useState(true);

      React.useEffect(() => {
        securityOfflineSafe.validateRole(requiredRole).then(result => {
          setHasAccess(result.valid);
          setLoading(false);

          if (!result.valid) {
            securityOfflineSafe.logSecurityEvent('access_denied', {
              component: Component.name,
              requiredRole,
              reason: result.reason,
            });
          }
        });
      }, [requiredRole]);

      if (loading) {
        return React.createElement('div', null, 'Loading...');
      }

      if (hasAccess) {
        return React.createElement(Component, props);
      }

      if (fallbackComponent) {
        return React.createElement(fallbackComponent, props);
      }

      return React.createElement('div', null, 'Access Denied');
    };
  }

  // React hook for authentication check
  useAuth(): {
    isAuthenticated: boolean;
    userId: string | null;
    role: string | null;
    logout: () => Promise<void>;
  } {
    const [isAuthenticated, setIsAuthenticated] = React.useState(this.isAuthenticated());
    const [userId, setUserId] = React.useState(this.getCurrentUserId());
    const [role, setRole] = React.useState(this.getCurrentRole());

    const logout = React.useCallback(async () => {
      await this.clearSession();
      setIsAuthenticated(false);
      setUserId(null);
      setRole(null);
    }, []);

    return { isAuthenticated, userId, role, logout };
  }
}

// Singleton instance
export const securityOfflineSafe = new SecurityOfflineSafe();
