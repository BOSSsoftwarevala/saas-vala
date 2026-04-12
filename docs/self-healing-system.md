# SaaS Vala Self-Healing System Documentation

## Overview
This document outlines the comprehensive self-healing system implemented across the SaaS Vala platform, providing automatic error detection, service recovery, retry mechanisms, and proactive health monitoring to ensure maximum uptime and reliability.

## Self-Healing Architecture

### 1. Error Detection & Monitoring

#### Real-Time Health Monitoring
```typescript
interface HealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastChecked: Date;
  errorCount: number;
  uptime: number;
}
```

#### Automated Health Checks
- **Database Connectivity**: Connection pool monitoring
- **API Endpoints**: Response time and error rate tracking
- **External Services**: Third-party service availability
- **System Resources**: CPU, memory, disk usage monitoring
- **Queue Systems**: Job queue depth and processing rates

### 2. Retry Mechanisms

#### Exponential Backoff Strategy
```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 5,
  baseDelay: 1000,      // 1 second
  maxDelay: 300000,     // 5 minutes
  backoffFactor: 2,
  jitter: true
};
```

#### Implementation Examples

**Audit Log Retry Queue**:
```typescript
async function appendAuditLogResilient(admin: any, payload: Record<string, any>) {
  const { error } = await admin.from('audit_logs').insert(insertPayload);
  
  if (!error) return { queued: false };
  
  // Queue for retry with exponential backoff
  await admin.from('audit_log_queue').insert({
    payload: JSON.stringify(payload),
    retry_count: 0,
    next_retry_at: new Date(Date.now() + 30_000).toISOString(),
    last_error: error.message,
    status: 'pending'
  });
  
  return { queued: true, error: error.message };
}
```

**API Request Retry**:
```typescript
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = defaultRetryConfig
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === config.maxRetries) break;
      
      const delay = calculateBackoffDelay(attempt, config);
      await sleep(delay);
    }
  }
  
  throw lastError;
}
```

### 3. Queue-Based Recovery System

#### Priority Queue Architecture
```sql
CREATE TABLE platform_priority_queue_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue_name VARCHAR(100) NOT NULL,
  priority_level INTEGER DEFAULT 1,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'queued',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  next_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Queue Types & Recovery Actions

**1. Self-Heal Servers Queue**:
- **Trigger**: Server health check failures
- **Action**: Automatic health recheck and service restart
- **Priority**: High (critical infrastructure)

**2. API Recovery Queue**:
- **Trigger**: API endpoint failures or high error rates
- **Action**: Service restart and failover activation
- **Priority**: High (user-facing services)

**3. Database Recovery Queue**:
- **Trigger**: Database connectivity issues
- **Action**: Connection pool reset and reconnection attempts
- **Priority**: Critical (data layer)

**4. Audit Log Queue**:
- **Trigger**: Failed audit log writes
- **Action**: Retry with exponential backoff
- **Priority**: Medium (compliance)

### 4. Automatic Service Recovery

#### Server Health Recovery
```typescript
async function triggerServerSelfHeal(servers: Server[]) {
  for (const server of servers) {
    await admin.from('platform_priority_queue_jobs').insert({
      queue_name: 'self-heal-servers',
      priority_level: 1,
      payload: { server_id: server.id, action: 'health_check_and_recovery' },
      status: 'queued',
      max_retries: 3
    });
  }
}
```

#### API Service Recovery
```typescript
async function triggerAPIRecovery() {
  await admin.from('platform_priority_queue_jobs').insert({
    queue_name: 'self-heal-api',
    priority_level: 1,
    payload: { action: 'restart_api_services' },
    status: 'queued',
    max_retries: 5
  });
}
```

#### Database Recovery
```typescript
async function triggerDatabaseRecovery() {
  await admin.from('platform_priority_queue_jobs').insert({
    queue_name: 'self-heal-database',
    priority_level: 1,
    payload: { action: 'reconnect_and_validate' },
    status: 'queued',
    max_retries: 3
  });
}
```

### 5. Circuit Breaker Pattern

#### Implementation
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private monitor: (success: boolean) => void
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
    this.monitor(true);
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.monitor(false);
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

### 6. Deployment Queue System

#### Automatic Deployment Recovery
```typescript
async function queueDeploymentForServer(
  sb: any,
  userId: string,
  serverId: string,
  commitHash?: string,
  commitMessage?: string
) {
  // Check for existing deployments
  const { data: existing } = await sb
    .from('deployments')
    .select('id')
    .eq('server_id', serverId)
    .in('status', ['queued', 'building']);
    
  if (existing?.length > 0) {
    throw new Error('Deployment already in progress for this server');
  }
  
  // Queue new deployment
  const { data: deployment, error } = await sb.from('deployments').insert({
    server_id: serverId,
    user_id: userId,
    commit_hash: commitHash,
    status: 'queued',
    commit_message: commitMessage || 'Deployment queued',
    created_at: new Date().toISOString()
  }).select().single();
  
  if (error || !deployment) {
    throw new Error(error?.message || 'Failed to queue deployment');
  }
  
  // Trigger deployment worker
  await sb.functions.invoke('deployment-worker', {
    body: { action: 'process_queue', deployment_id: deployment.id }
  }).catch(() => {}); // Best effort
  
  return deployment;
}
```

### 7. Monitoring & Alerting

#### Health Metrics Dashboard
```typescript
interface SystemHealthMetrics {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: HealthStatus;
    api: HealthStatus;
    queue: HealthStatus;
    external_services: HealthStatus;
  };
  queue_stats: {
    queued: number;
    running: number;
    failed: number;
  };
  uptime: number;
  error_rate: number;
}
```

#### Automated Alerting
```typescript
async function checkAndTriggerAlerts() {
  const metrics = await collectHealthMetrics();
  
  // Trigger self-healing for critical components
  if (metrics.components.database.status === 'unhealthy') {
    await triggerDatabaseRecovery();
  }
  
  if (metrics.components.api.status === 'unhealthy') {
    await triggerAPIRecovery();
  }
  
  if (metrics.queue_stats.failed > 10) {
    await triggerQueueRecovery();
  }
  
  // Send alerts for critical issues
  if (metrics.overall === 'unhealthy') {
    await sendCriticalAlert(metrics);
  }
}
```

### 8. Queue Processing System

#### Audit Log Queue Processor
```typescript
async function processAuditLogQueue() {
  const nowIso = new Date().toISOString();
  
  const { data: queueRows, error } = await admin
    .from('audit_log_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('next_retry_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(100);
    
  if (error || !queueRows?.length) {
    return { success: true, queued: 0, processed: 0, failed: 0 };
  }
  
  let processed = 0;
  let failed = 0;
  
  for (const row of queueRows) {
    try {
      const payload = JSON.parse(row.payload);
      await admin.from('audit_logs').insert(payload);
      
      await admin.from('audit_log_queue')
        .update({ status: 'done', updated_at: nowIso })
        .eq('id', row.id);
        
      processed++;
    } catch (error) {
      const retryCount = Number(row.retry_count || 0) + 1;
      
      if (retryCount >= (row.max_retries || 5)) {
        await admin.from('audit_log_queue')
          .update({ status: 'failed', updated_at: nowIso })
          .eq('id', row.id);
      } else {
        const nextRetryAt = new Date(Date.now() + Math.pow(2, retryCount) * 30000);
        
        await admin.from('audit_log_queue')
          .update({
            retry_count: retryCount,
            next_retry_at: nextRetryAt.toISOString(),
            last_error: error.message,
            updated_at: nowIso
          })
          .eq('id', row.id);
      }
      
      failed++;
    }
  }
  
  return { success: true, queued: queueRows.length, processed, failed };
}
```

### 9. Auto-Pilot System

#### Intelligent Automation
```typescript
async function runAutoPilotCheck() {
  const checks = await Promise.all([
    checkServerHealth(),
    checkAPIHealth(),
    checkQueueHealth(),
    checkDatabaseHealth()
  ]);
  
  const actions = [];
  
  for (const check of checks) {
    if (check.status === 'unhealthy') {
      actions.push({
        component: check.component,
        action: 'trigger_self_heal',
        priority: 'high'
      });
    }
  }
  
  // Queue automated recovery actions
  for (const action of actions) {
    await admin.from('auto_software_queue').insert({
      component: action.component,
      action: action.action,
      priority: action.priority,
      status: 'pending',
      created_at: new Date().toISOString()
    });
  }
  
  return actions;
}
```

### 10. Failover Systems

#### Multi-Provider Failover
```typescript
async function executeWithFailover<T>(
  primaryProvider: () => Promise<T>,
  fallbackProviders: Array<() => Promise<T>>
): Promise<T> {
  let lastError: Error;
  
  // Try primary provider
  try {
    return await primaryProvider();
  } catch (error) {
    lastError = error;
    console.warn('Primary provider failed, trying fallbacks:', error);
  }
  
  // Try fallback providers
  for (const provider of fallbackProviders) {
    try {
      const result = await provider();
      console.log('Fallback provider succeeded');
      return result;
    } catch (error) {
      lastError = error;
      console.warn('Fallback provider failed:', error);
    }
  }
  
  throw new Error(`All providers failed. Last error: ${lastError.message}`);
}
```

## Recovery Procedures

### 1. Database Recovery

#### Connection Pool Reset
```typescript
async function resetDatabaseConnections() {
  // Close existing connections
  await connectionPool.close();
  
  // Reinitialize connection pool
  connectionPool = createConnectionPool({
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  });
  
  // Validate connectivity
  await validateDatabaseConnection();
}
```

#### Data Integrity Check
```typescript
async function validateDataIntegrity() {
  const checks = [
    checkUserTableIntegrity(),
    checkTransactionTableIntegrity(),
    checkAuditLogIntegrity()
  ];
  
  const results = await Promise.allSettled(checks);
  
  for (const result of results) {
    if (result.status === 'rejected') {
      await triggerDataRepair(result.reason);
    }
  }
}
```

### 2. API Service Recovery

#### Service Restart
```typescript
async function restartAPIServices() {
  const services = ['api-gateway', 'ai-chat', 'deployment-worker'];
  
  for (const service of services) {
    try {
      await supabase.functions.invoke(service, {
        body: { action: 'health_check' }
      });
    } catch (error) {
      console.warn(`Service ${service} unhealthy, attempting restart`);
      await triggerServiceRestart(service);
    }
  }
}
```

#### Load Balancer Reconfiguration
```typescript
async function reconfigureLoadBalancer() {
  const healthyInstances = await getHealthyAPIInstances();
  
  if (healthyInstances.length < 2) {
    // Enable emergency mode with reduced functionality
    await enableEmergencyMode();
  } else {
    // Update load balancer configuration
    await updateLoadBalancerConfig(healthyInstances);
  }
}
```

### 3. Queue Recovery

#### Queue Drain & Reset
```typescript
async function recoverQueue(queueName: string) {
  // Move stuck jobs to recovery queue
  await admin.from('platform_priority_queue_jobs')
    .update({ 
      status: 'failed',
      updated_at: new Date().toISOString()
    })
    .eq('queue_name', queueName)
    .eq('status', 'running')
    .lt('updated_at', new Date(Date.now() - 300000)); // 5 minutes ago
    
  // Reset queue processor
  await resetQueueProcessor(queueName);
}
```

## Monitoring & Metrics

### 1. Health Dashboard

#### Real-Time Metrics
- **System Uptime**: Overall platform availability
- **Component Health**: Individual service status
- **Queue Depth**: Number of pending jobs
- **Error Rates**: Failure percentages by component
- **Response Times**: Average and P95 response times
- **Recovery Actions**: Number of automatic recoveries

### 2. Performance Metrics

#### Key Indicators
```typescript
interface PerformanceMetrics {
  availability: {
    uptime: number;
    downtime: number;
    mttr: number; // Mean Time To Recovery
  };
  performance: {
    avg_response_time: number;
    p95_response_time: number;
    error_rate: number;
  };
  recovery: {
    auto_recoveries: number;
    manual_interventions: number;
    recovery_success_rate: number;
  };
}
```

### 3. Alert Configuration

#### Alert Rules
- **Critical**: System downtime > 5 minutes
- **High**: Error rate > 5% for 10 minutes
- **Medium**: Queue depth > 100 items
- **Low**: Response time > 2 seconds

## Best Practices

### 1. Recovery Design
- **Idempotency**: All recovery actions must be idempotent
- **Graceful Degradation**: Maintain basic functionality during failures
- **Fast Recovery**: Prioritize quick fixes over perfect solutions
- **Monitoring**: Log all recovery actions for analysis

### 2. Queue Management
- **Priority Levels**: Use priority queues for critical recovery actions
- **Dead Letter Queues**: Handle permanently failed jobs
- **Backpressure**: Implement flow control to prevent overload
- **Monitoring**: Track queue metrics and processing rates

### 3. Error Handling
- **Structured Logging**: Use consistent error logging format
- **Error Classification**: Categorize errors for appropriate handling
- **Circuit Breakers**: Prevent cascade failures
- **Timeout Management**: Set appropriate timeouts for all operations

### 4. Testing
- **Chaos Engineering**: Simulate failures to test recovery
- **Load Testing**: Verify recovery under high load
- **Failover Testing**: Test backup systems and procedures
- **Monitoring Validation**: Ensure alerts work correctly

## Configuration

### Environment Variables
```bash
# Self-Healing Configuration
SELF_HEALING_ENABLED=true
MAX_RETRY_ATTEMPTS=5
BASE_RETRY_DELAY=1000
MAX_RETRY_DELAY=300000
HEALTH_CHECK_INTERVAL=30000

# Queue Configuration
QUEUE_PROCESSOR_BATCH_SIZE=100
QUEUE_RETRY_DELAY=30000
QUEUE_MAX_DEPTH=1000

# Alert Configuration
ALERT_WEBHOOK_URL=https://alerts.example.com
CRITICAL_ALERT_THRESHOLD=5
HIGH_ALERT_THRESHOLD=10
```

### Database Tables
```sql
-- Recovery tracking
CREATE TABLE recovery_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
);

-- Health metrics
CREATE TABLE health_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  response_time INTEGER,
  error_count INTEGER DEFAULT 0,
  measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Conclusion

The self-healing system provides comprehensive automatic recovery capabilities that ensure maximum uptime and reliability for the SaaS Vala platform. By implementing multiple layers of error detection, retry mechanisms, and automated recovery procedures, the system can quickly recover from failures without manual intervention.

Key benefits:
- **Increased Uptime**: Automatic recovery reduces downtime
- **Improved Reliability**: Multiple fallback mechanisms ensure service continuity
- **Reduced Manual Work**: Automated recovery eliminates manual intervention
- **Better User Experience**: Minimal impact on users during failures
- **Proactive Monitoring**: Early detection and prevention of issues

The system is designed to be continuously improved through monitoring, metrics analysis, and regular testing to ensure it remains effective against evolving failure scenarios.
