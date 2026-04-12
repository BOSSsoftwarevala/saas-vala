# SaaS Vala Security System Documentation

## Overview
This document outlines the comprehensive security system implemented across the SaaS Vala platform, providing multi-layered protection including authentication, authorization, rate limiting, audit logging, and advanced security monitoring.

## Security Architecture

### 1. Authentication & Authorization

#### JWT Token-Based Authentication
```typescript
async function authenticate(req: Request): Promise<{ userId: string; supabase: any } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  
  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await sb.auth.getClaims(token)
  
  if (error || !data) return null
  
  return {
    userId: data.sub,
    supabase: createClientWithToken(token)
  }
}
```

#### Role-Based Access Control (RBAC)
- **6 User Roles**: super_admin, admin, master_reseller, reseller, support, user
- **Permission Mapping**: Granular permissions per role and module
- **Resource Isolation**: Data access based on user roles and ownership

### 2. Rate Limiting System

#### Implementation
```typescript
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function enforceRateLimit(key: string, limit: number, windowMs: number): number | null {
  const now = Date.now()
  const existing = rateLimitStore.get(key)
  
  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  
  if (existing.count >= limit) {
    return Math.ceil((existing.resetAt - now) / 1000)
  }
  
  existing.count++
  return null
}
```

#### Rate Limiting Rules
- **Global API**: 120 requests per minute per user
- **Authentication**: 5 requests per minute per IP
- **Payments**: 5 requests per minute per user
- **Key Generation**: 10 requests per minute per user
- **Downloads**: 10 requests per hour per user per product
- **Webhooks**: 120 requests per minute per IP

### 3. Audit Logging System

#### Comprehensive Audit Trail
```typescript
interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  table_name: string;
  record_id: string;
  occurred_at_utc: string;
  ip_address: string;
  user_agent: string;
  request_id: string;
  old_value?: any;
  new_value?: any;
  risk_score: number;
  is_sensitive_action: boolean;
}
```

#### Audit Features
- **Real-time Logging**: All actions logged immediately
- **Data Change Tracking**: Before/after values for all modifications
- **Risk Scoring**: Automatic risk assessment for each action
- **Anomaly Detection**: AI-powered pattern recognition
- **Alert System**: Real-time security alerts via webhooks
- **Retention Policies**: Configurable data retention and archiving

### 4. Input Validation & Sanitization

#### Data Sanitization
```typescript
function sanitizeLogData(data: any): any {
  if (typeof data !== 'object' || data === null) return data;
  
  const sanitized = { ...data };
  for (const [key, value] of Object.entries(sanitized)) {
    if (/(password|token|secret|api[_-]?key|authorization|card|cvv|pin)/i.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    }
  }
  return sanitized;
}
```

#### Validation Rules
- **SQL Injection Prevention**: Parameterized queries everywhere
- **XSS Protection**: Input sanitization and output encoding
- **File Upload Security**: Type validation, size limits, virus scanning
- **API Input Validation**: Schema validation for all endpoints

### 5. CORS & Security Headers

#### Security Headers Configuration
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key, x-supabase-client-platform',
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};
```

### 6. Advanced Security Features

#### Security Scanning
```typescript
// Automated server security scanning
async function runSecurityScan(serverId: string) {
  const agentResult = await serverAgent({
    body: { action: 'run_security_scan', serverId }
  });
  
  await sb.from('server_security_issues').insert({
    server_id: serverId,
    issues: agentResult.issues,
    score: agentResult.score,
    scanned_at: new Date().toISOString()
  });
}
```

#### Encryption Audit
- **Key Management**: Tracking of all encryption key operations
- **Data Classification**: Automatic sensitivity classification
- **Compliance Reporting**: GDPR, SOC2, and HIPAA compliance tracking

## Security Monitoring

### 1. Real-time Dashboard

#### Security Metrics
- **Authentication Events**: Login attempts, failures, suspicious patterns
- **Rate Limit Violations**: Blocked requests and repeat offenders
- **Audit Log Volume**: Action frequency and risk distribution
- **System Security**: Server scan results and vulnerability scores
- **Data Access Patterns**: Unusual data access detection

### 2. Anomaly Detection

#### AI-Powered Threat Detection
```typescript
interface AnomalyAlert {
  id: string;
  audit_log_id: string;
  anomaly_type: string;
  confidence_score: number;
  description: string;
  resolved: boolean;
  created_at: string;
}
```

#### Detection Patterns
- **Unusual Login Patterns**: Multiple failed attempts, geographic anomalies
- **Data Access Anomalies**: Unusual data volume or access patterns
- **API Abuse**: Rapid requests, endpoint enumeration
- **Privilege Escalation**: Unauthorized access attempts

### 3. Alert System

#### Webhook Integration
```typescript
async function dispatchSecurityAlerts() {
  const endpoints = await admin.from('audit_webhook_endpoints')
    .select('*').eq('is_active', true).limit(50);
    
  const alerts = await admin.from('audit_anomaly_alerts')
    .select('*, audit_logs(*)').eq('resolved', false);
    
  for (const alert of alerts) {
    for (const endpoint of endpoints) {
      await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'audit_alert',
          timestamp: new Date().toISOString(),
          alert: alert,
          log: alert.audit_logs
        })
      });
    }
  }
}
```

## Database Security

### 1. Row-Level Security (RLS)

#### Implementation Examples
```sql
-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can access all data
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
```

### 2. Data Encryption

#### Encryption-at-Rest
- **Database Encryption**: AES-256 encryption for all sensitive data
- **API Key Storage**: Encrypted with rotating master keys
- **File Storage**: Encrypted blob storage with access controls

#### Encryption-in-Transit
- **TLS 1.3**: All communications encrypted with latest protocols
- **Certificate Management**: Automated certificate rotation
- **VPN Access**: Secure internal network access

## API Security

### 1. Endpoint Protection

#### Authentication Required
```typescript
// All endpoints except auth require JWT
if (module !== 'auth') {
  const auth = await authenticate(req)
  if (!auth) return err('Unauthorized', 401)
}
```

#### Permission Validation
```typescript
// Role-based endpoint access
const hasPermission = await hasMarketplacePermission(sb, userId, 'marketplace.admin.manage');
if (!hasPermission) {
  return err('Insufficient permissions', 403);
}
```

### 2. Input Validation

#### Schema Validation
```typescript
// Request body validation
const validatedBody = validateRequestSchema(body, schema);
if (!validatedBody.success) {
  return err('Invalid request body', 400);
}
```

### 3. Security Middleware

#### Request Security
```typescript
// Security middleware stack
1. Rate limiting check
2. Authentication validation
3. Authorization verification
4. Input sanitization
5. Audit logging
6. Response security headers
```

## Compliance & Governance

### 1. Data Privacy

#### GDPR Compliance
- **Data Minimization**: Collect only necessary data
- **Right to Deletion**: Automated data removal workflows
- **Data Portability**: Export functionality for user data
- **Consent Management**: Explicit consent tracking

#### Data Classification
```typescript
enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted'
}
```

### 2. Audit Compliance

#### SOC2 Type II
- **Security Controls**: Comprehensive security framework
- **Availability Monitoring**: Uptime and performance tracking
- **Processing Integrity**: Data accuracy and completeness
- **Confidentiality**: Data protection measures
- **Privacy**: Personal information protection

### 3. Retention Policies

#### Data Lifecycle Management
```sql
CREATE TABLE audit_retention_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope_key VARCHAR(100) NOT NULL,
  retention_days INTEGER NOT NULL,
  archive_after_days INTEGER,
  delete_after_days INTEGER,
  is_active BOOLEAN DEFAULT true
);
```

## Security Best Practices

### 1. Development Security

#### Secure Coding Practices
- **Input Validation**: Never trust user input
- **Error Handling**: Don't expose sensitive information
- **Logging**: Log security events without sensitive data
- **Dependencies**: Regular security updates and vulnerability scanning

#### Code Review Checklist
- [ ] Authentication and authorization implemented
- [ ] Input validation and sanitization
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CSRF protection
- [ ] Security headers configured
- [ ] Error handling doesn't leak information

### 2. Operational Security

#### Monitoring & Alerting
- **24/7 Monitoring**: Real-time security monitoring
- **Alert Escalation**: Tiered alert response system
- **Incident Response**: Automated incident response workflows
- **Security Metrics**: KPI tracking and reporting

#### Backup & Recovery
- **Encrypted Backups**: Daily encrypted backups
- **Disaster Recovery**: Geographic distribution
- **Recovery Testing**: Regular recovery drills
- **Data Integrity**: Backup verification and checksums

### 3. User Security

#### Password Security
- **Strong Passwords**: Minimum complexity requirements
- **Multi-Factor Authentication**: Optional 2FA support
- **Session Management**: Secure session handling
- **Password Reset**: Secure reset workflows

#### Account Security
- **Login Monitoring**: Failed login tracking
- **Account Lockout**: Temporary lockout after failures
- **Device Recognition**: Trusted device management
- **Activity Logging**: User activity tracking

## Security Testing

### 1. Automated Testing

#### Security Scans
- **Vulnerability Scanning**: Automated vulnerability detection
- **Penetration Testing**: Regular security assessments
- **Dependency Scanning**: Third-party vulnerability checks
- **Configuration Auditing**: Security configuration validation

### 2. Manual Testing

#### Security Assessments
- **Threat Modeling**: Regular threat analysis
- **Red Team Exercises**: Simulated attack scenarios
- **Social Engineering Testing**: Human factor security
- **Physical Security**: Infrastructure security review

## Incident Response

### 1. Response Plan

#### Incident Classification
```typescript
enum IncidentSeverity {
  LOW = 'low',      // Minimal impact
  MEDIUM = 'medium', // Limited impact
  HIGH = 'high',    // Significant impact
  CRITICAL = 'critical' // Severe impact
}
```

### 2. Response Procedures

#### Immediate Actions
1. **Containment**: Isolate affected systems
2. **Assessment**: Evaluate impact and scope
3. **Notification**: Alert stakeholders and authorities
4. **Preservation**: Preserve evidence for investigation

#### Recovery Actions
1. **Eradication**: Remove threat vectors
2. **Recovery**: Restore systems from clean backups
3. **Validation**: Verify system integrity
4. **Prevention**: Implement improvements

## Security Configuration

### 1. Environment Variables

#### Security Configuration
```bash
# Authentication
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
JWT_SECRET=your-jwt-secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=120

# Security
ENABLE_AUDIT_LOGGING=true
SECURITY_WEBHOOK_URL=https://your-webhook-url
ENCRYPTION_KEY=your-encryption-key
```

### 2. Database Security

#### Security Tables
```sql
-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action_type VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id UUID,
  risk_score INTEGER DEFAULT 0,
  is_sensitive_action BOOLEAN DEFAULT false,
  occurred_at_utc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security events
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  description TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Conclusion

This comprehensive security system provides multi-layered protection for the SaaS Vala platform, ensuring data confidentiality, integrity, and availability while maintaining compliance with industry standards and regulations.

The security infrastructure is designed to be:
- **Proactive**: Preventing attacks before they occur
- **Responsive**: Quick detection and response to threats
- **Scalable**: Growing with the platform's needs
- **Compliant**: Meeting regulatory requirements
- **Transparent**: Providing visibility into security posture

Regular security reviews, updates, and testing ensure the system remains effective against evolving threats while maintaining optimal performance and user experience.
