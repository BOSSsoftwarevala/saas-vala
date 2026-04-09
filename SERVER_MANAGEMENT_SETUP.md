# Server Management System - Premium Monitoring & Billing

A comprehensive server management system with agent-based real-time monitoring, AI-powered analysis, billing ($49/month), SSH management, SSL certificates, and role-based access control.

## Features

✅ **Real-time Monitoring**
- CPU, RAM, Disk, Network metrics (30-second intervals)
- Historical data retention (90 days)
- Anomaly detection and alerting

✅ **AI-Powered Analysis**
- OpenAI/Claude analysis of server health
- Automatic recommendations based on metrics
- Performance optimization suggestions
- Security vulnerability detection

✅ **Agent-Based Communication**
- Secure agent registration and heartbeat system
- Real-time status tracking for each server
- Automatic offline detection

✅ **SSH Key Management**
- Secure storage of SSH credentials
- Support for RSA and Ed25519 keys
- Key rotation and audit logging

✅ **Billing System**
- $49/month base charge
- Usage-based overage calculation
- Automatic monthly billing cycles
- Payment tracking and invoicing

✅ **SSL/TLS Management**
- Automatic certificate expiry monitoring
- Auto-renewal support
- Domain management
- Certificate provisioning

✅ **Comprehensive Logging**
- All operations logged with timestamps
- User and agent action tracking
- Error details and command output
- 180-day retention

✅ **Server Control**
- Start/Stop/Restart operations
- Deployment management
- Health checks and auto-restart

✅ **Role-Based Access**
- User ownership verification
- RLS policies for data isolation
- Agent-level permissions

## Database Schema

The system uses 8 main tables:

1. **server_metrics** - Real-time monitoring data (CPU, RAM, disk, network)
2. **server_ssh_keys** - Encrypted SSH credentials
3. **server_agents** - Agent registration and heartbeat tracking
4. **server_logs** - Comprehensive operation logging
5. **server_billing** - Monthly billing cycles and payments
6. **server_ai_analysis** - AI insights and recommendations
7. **server_ssl_certificates** - SSL/TLS certificate management
8. **server_deployment_history** - Deployment records and configurations

## API Endpoints

### Metrics
```
GET /server-management/{serverId}/metrics/latest
GET /server-management/{serverId}/metrics/history
POST /server-management/{serverId}/metrics/record
```

### SSH Keys
```
GET /server-management/{serverId}/ssh-keys
POST /server-management/{serverId}/ssh-keys/add
DELETE /server-management/{serverId}/ssh-keys/remove
```

### Agents
```
GET /server-management/{serverId}/agents
POST /server-management/{serverId}/agents/register
POST /server-management/{serverId}/agents/heartbeat
```

### Logs
```
GET /server-management/{serverId}/logs
POST /server-management/{serverId}/logs/log
```

### Billing
```
GET /server-management/{serverId}/billing/current
GET /server-management/{serverId}/billing/history
POST /server-management/{serverId}/billing/create-cycle
POST /server-management/{serverId}/billing/mark-paid
```

### AI Analysis
```
GET /server-management/{serverId}/ai-analysis/latest
POST /server-management/{serverId}/ai-analysis/analyze
```

### SSL Certificates
```
GET /server-management/{serverId}/ssl
POST /server-management/{serverId}/ssl/add
```

### Server Control
```
POST /server-management/{serverId}/control/start
POST /server-management/{serverId}/control/stop
POST /server-management/{serverId}/control/restart
POST /server-management/{serverId}/control/deploy
```

## Frontend Integration

### 1. Using the Hook

```typescript
import { useServerManagement } from '@/hooks/useServerManagement';

function ServerDashboard() {
  const { 
    metrics, 
    billing, 
    agents, 
    analysis,
    runAnalysis,
    startServer,
    stopServer 
  } = useServerManagement(serverId);

  return (
    <div>
      <h2>{metrics?.cpu_percent}% CPU</h2>
      <button onClick={runAnalysis}>Run AI Analysis</button>
      <div>{analysis?.response}</div>
    </div>
  );
}
```

### 2. Using the API Client

```typescript
import { serverManagementApi } from '@/lib/api';

// Get latest metrics
const metrics = await serverManagementApi.getLatestMetrics(serverId);

// Trigger AI analysis
const analysis = await serverManagementApi.analyzeServer(serverId);

// Get billing information
const billing = await serverManagementApi.getCurrentBilling(serverId);

// Control server
await serverManagementApi.startServer(serverId);
```

## Configuration

Edit `src/config/serverManagementConfig.ts` to customize:

- Monthly pricing ($49 default)
- Monitoring thresholds (CPU, RAM, Disk warnings/critical)
- AI analysis interval
- Agent heartbeat settings
- Billing cycle configuration
- Feature flags
- Alert settings

## Environment Variables

Add to your `.env.local`:

```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
OPENAI_API_KEY=<your-openai-api-key>
```

## Agent Implementation

Each server runs a lightweight agent that:

1. **Registers** with the system on startup
   ```
   POST /server-management/{serverId}/agents/register
   ```

2. **Sends Heartbeat** every 30 seconds
   ```
   POST /server-management/{serverId}/agents/heartbeat
   ```

3. **Reports Metrics** every 30 seconds
   ```
   POST /server-management/{serverId}/metrics/record
   ```

4. **Logs Actions** when operations complete
   ```
   POST /server-management/{serverId}/logs/log
   ```

### Agent Script Example (TypeScript/Deno)

```typescript
// server-agent.ts
const API_URL = `${process.env.API_URL}/api-gateway`;
const SERVER_ID = process.env.SERVER_ID;
const AGENT_API_TOKEN = process.env.AGENT_API_TOKEN;

async function registerAgent() {
  const res = await fetch(`${API_URL}/server-management/${SERVER_ID}/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_name: 'SaaSVala-Agent-v1',
      agent_version: '1.0.0',
      ip_address: getLocalIP()
    })
  });
  return res.json();
}

async function sendHeartbeat(agentId: string) {
  const metrics = await getSystemMetrics();
  await fetch(`${API_URL}/server-management/${SERVER_ID}/agents/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AGENT_API_TOKEN}`
    },
    body: JSON.stringify({
      agent_id: agentId,
      ip_address: getLocalIP(),
      status: 'online'
    })
  });
}

async function recordMetrics(metrics: SystemMetrics) {
  await fetch(`${API_URL}/server-management/${SERVER_ID}/metrics/record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AGENT_API_TOKEN}`
    },
    body: JSON.stringify(metrics)
  });
}

function getSystemMetrics() {
  return {
    cpu_percent: getCPUUsage(),
    ram_used_mb: getRamUsed(),
    ram_total_mb: getRamTotal(),
    disk_used_gb: getDiskUsed(),
    disk_total_gb: getDiskTotal(),
    network_in_mbps: getNetworkIn(),
    network_out_mbps: getNetworkOut(),
    request_count: getRequestCount(),
    error_count: getErrorCount(),
    avg_response_time_ms: getAvgResponseTime(),
    uptime_seconds: getUptimeSeconds(),
  };
}

// Initialize
(async () => {
  const agent = await registerAgent();
  const agentId = agent.data?.id;
  
  setInterval(() => sendHeartbeat(agentId), 30_000);
  setInterval(async () => {
    const metrics = await getSystemMetrics();
    await recordMetrics(metrics);
  }, 30_000);
})();
```

## Billing Flow

1. **Monthly Cycle Creation**
   - Every month on day 1, create new billing cycle
   - Set due date to 7 days after cycle end
   - Base price: $49.00

2. **Overage Calculation**
   - CPU overage: $0.50 per 10% above 80% average
   - RAM overage: $0.30 per 10% above 80% average
   - Calculated from historical metrics

3. **Payment Processing**
   - Email invoice to user
   - Track payment status (pending, paid, failed)
   - Send reminders before due date

## Security Considerations

1. **SSH Key Encryption**
   - Private keys are encrypted with AES-256-CBC
   - Use proper encryption library in production

2. **Agent Authentication**
   - Each agent gets unique API token
   - Rate limiting on agent requests
   - IP whitelist support (optional)

3. **Role-Based Access**
   - Users only see their own servers
   - RLS policies enforce data isolation
   - Admin actions are logged

4. **Data Transmission**
   - All API calls use HTTPS
   - Agent-to-server communication secured
   - Sensitive data encrypted at rest

## Monitoring & Alerts

The system automatically tracks:

- Server health and uptime
- Performance anomalies
- Resource exhaustion
- SSL certificate expiry
- Agent connectivity
- Billing issues

Configure alert preferences in serverManagementConfig.ts

## Troubleshooting

### Agent Not Sending Metrics
1. Check agent is registered: `GET /server-management/{serverId}/agents`
2. Verify heartbeat is recent: `last_heartbeat` < 2 minutes
3. Check API token is valid
4. Review server logs: `GET /server-management/{serverId}/logs`

### AI Analysis Failing
1. Verify OpenAI API key is set
2. Check metrics exist: `GET /server-management/{serverId}/metrics/latest`
3. Review API logs for errors
4. Ensure user has sufficient quota

### Billing Not Creating
1. Check server ownership
2. Verify billing cycles don't already exist
3. Review server logs for cycle creation logs

## Support & Documentation

- Full API documentation: See API Endpoints section
- Hook documentation: `src/hooks/useServerManagement.ts`
- Configuration: `src/config/serverManagementConfig.ts`
- Backend code: `supabase/functions/api-gateway/server-management-v2.ts`
- Database schema: `supabase/migrations/20260411000000_server_management_premium.sql`
