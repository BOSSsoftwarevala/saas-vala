# SaaS Vala Real-Time System Documentation

## Overview
This document outlines the comprehensive real-time system implemented across the SaaS Vala platform, providing live updates for chat, logs, system health, and build pipelines through WebSocket connections and event-driven architecture.

## Real-Time Infrastructure

### 1. Socket Reuse Manager (`socketReuse.ts`)

**Purpose**: Singleton pattern for managing WebSocket connections efficiently across the application.

**Key Features**:
- Single connection per session to prevent resource waste
- Automatic reconnection with configurable retry logic
- Channel management with cleanup on unsubscribe
- Connection statistics and health monitoring
- Event deduplication to prevent duplicate messages

```typescript
export class SocketReuseManager {
  private static instance: SocketReuseManager;
  private client: RealtimeClient | null = null;
  private channels = new Map<string, RealtimeChannel>();
  
  async connect(config: SocketConfig): Promise<RealtimeClient>
  getChannel(channelName: string): RealtimeChannel
  async removeChannel(channelName: string): Promise<void>
  getStats(): SocketStats
}
```

**Configuration**:
```typescript
interface SocketConfig {
  url: string;
  apiKey: string;
  options?: {
    reconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
  };
}
```

### 2. Event Deduplication Engine (`eventDeduplication.ts`)

**Purpose**: Prevents duplicate socket events that can occur during reconnections or multiple subscriptions.

**Features**:
- Event fingerprinting for duplicate detection
- Configurable deduplication window
- Automatic cleanup of old event fingerprints
- Support for different event types (socket, API, user actions)

```typescript
export const createSocketEventDeduper = () => {
  // Process socket message with deduplication
  const deduper = createEventDeduper({
    windowMs: 5000, // 5 second deduplication window
    maxFingerprints: 1000
  });
  
  return deduper.process(event);
};
```

### 3. WebRTC Integration (`webrtc-connection.ts`, `webrtc-client.ts`)

**Purpose**: Peer-to-peer real-time communication for admin/support features.

**Features**:
- Direct data channels between users
- Screen sharing capabilities
- File transfer support
- Automatic connection management
- Fallback to WebSocket when WebRTC fails

```typescript
class WebRTCConnection {
  private dataChannel: RTCDataChannel | null = null;
  
  async connect(targetUserId: string): Promise<void>
  sendData(data: any): void
  onDataChannel(callback: (data: any) => void): void
}
```

## Real-Time Features

### 1. Chat System (`InternalChat.tsx`, `useSupport.ts`)

**Real-Time Capabilities**:
- Live message delivery
- Typing indicators
- Read receipts
- Online status updates
- File sharing with progress tracking
- Voice message support

**Channel Management**:
```typescript
// Real-time message subscription
const channel = supabase
  .channel(`chat-${channelId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'chat_messages',
    filter: `channel_id=eq.${channelId}`
  }, (payload) => {
    addMessage(payload.new);
  })
  .subscribe();
```

**Typing Indicators**:
```typescript
// Real-time typing status
supabase.channel(`typing-${channelId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'chat_typing'
  }, (payload) => {
    updateTypingStatus(payload.new);
  })
  .subscribe();
```

### 2. Build Pipeline Monitoring

**VALA Builder Real-Time Updates**:
```typescript
// Live build status
const channel = supabase
  .channel(`vala-builder-run-${runId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'vala_build_runs',
    filter: `id=eq.${runId}`
  }, (payload) => {
    updateBuildStatus(payload.new);
  })
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'vala_build_logs'
  }, (payload) => {
    addBuildLog(payload.new);
  })
  .subscribe();
```

**APK Pipeline Live Updates**:
```typescript
// Real-time build queue monitoring
const channel = supabase
  .channel('apk-build-queue-live')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'apk_build_queue'
  }, () => {
    refreshBuildQueue();
  })
  .subscribe();
```

### 3. System Health Monitoring (`SystemHealth.tsx`)

**Real-Time Health Checks**:
- Database connection status
- API endpoint response times
- WebSocket connection health
- External service availability
- Resource utilization metrics

**Health Check Implementation**:
```typescript
const healthChecks = [
  { name: 'Database', status: 'checking', check: checkDatabaseHealth },
  { name: 'API Gateway', status: 'checking', check: checkApiHealth },
  { name: 'WebSocket', status: 'checking', check: checkWebSocketHealth },
  { name: 'Audit Logs', status: 'checking', check: checkAuditLogHealth }
];
```

### 4. Audit Log Streaming

**Real-Time Audit Trail**:
```typescript
// Live audit log updates
const auditChannel = supabase
  .channel('audit-log-stream')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'audit_logs'
  }, (payload) => {
    addAuditLog(payload.new);
    updateActivityFeed(payload.new);
  })
  .subscribe();
```

**Dashboard Activity Feed**:
- Real-time user actions
- System events
- Security alerts
- Performance metrics

## Push Notification Fallback (`PushNotificationService.ts`)

**Purpose**: Provides fallback notification mechanism when WebSocket connections fail.

**Features**:
- Service Worker integration
- Push notification subscription management
- Offline message queuing
- Notification delivery tracking

```typescript
class PushNotificationService {
  async subscribeToPush(): Promise<string | null>
  async sendNotification(title: string, body: string, data?: any): Promise<void>
  async handlePushEvent(event: PushEvent): Promise<void>
}
```

## Database Real-Time Triggers

### 1. Notification Triggers
```sql
-- Real-time notification updates
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_message',
    json_build_object(
      'channel_id', NEW.channel_id,
      'message_id', NEW.id,
      'sender_id', NEW.sender_id
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_new_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();
```

### 2. System Health Triggers
```sql
-- Health status change notifications
CREATE OR REPLACE FUNCTION notify_health_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'health_change',
    json_build_object(
      'component', NEW.component,
      'status', NEW.status,
      'timestamp', NEW.updated_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Performance Optimization

### 1. Connection Pooling
- Single WebSocket connection per user session
- Channel reuse for multiple subscriptions
- Automatic cleanup of inactive connections

### 2. Event Batching
- Batch multiple events for efficiency
- Debounce rapid updates
- Priority queue for critical events

### 3. Caching Strategy
- In-memory caching of frequently accessed data
- Cache invalidation on real-time updates
- Optimistic UI updates with rollback on error

## Security Considerations

### 1. Authentication
- JWT token validation for WebSocket connections
- Role-based channel access control
- Automatic disconnection on token expiration

### 2. Authorization
- Channel-level permissions
- Row-level security for database changes
- API rate limiting for real-time endpoints

### 3. Data Privacy
- End-to-end encryption for sensitive data
- Message filtering based on user permissions
- Audit logging of all real-time events

## Monitoring & Debugging

### 1. Connection Metrics
```typescript
interface SocketStats {
  isConnected: boolean;
  connectionCount: number;
  reconnectAttempts: number;
  lastConnected: number | null;
  lastDisconnected: number | null;
  totalUptime: number;
  channelsCount: number;
}
```

### 2. Event Tracking
- Event delivery success rates
- Latency measurements
- Error tracking and alerting
- Performance analytics

### 3. Debug Tools
- Connection status dashboard
- Event log viewer
- Channel monitoring
- Performance metrics

## Best Practices

### 1. Connection Management
- Always cleanup channels on component unmount
- Implement proper error handling
- Use connection pooling for efficiency
- Monitor connection health

### 2. Event Handling
- Implement event deduplication
- Use proper error boundaries
- Handle reconnection scenarios
- Validate incoming data

### 3. Performance
- Minimize unnecessary subscriptions
- Use efficient data structures
- Implement proper caching
- Monitor resource usage

### 4. Security
- Validate all incoming data
- Implement proper authentication
- Use HTTPS/WSS connections
- Regular security audits

## Troubleshooting

### Common Issues
1. **Connection Drops**: Check network stability and reconnection logic
2. **Duplicate Events**: Verify event deduplication is working
3. **Performance Issues**: Monitor channel count and event frequency
4. **Permission Errors**: Validate user roles and channel access

### Debug Steps
1. Check browser console for WebSocket errors
2. Verify Supabase real-time configuration
3. Monitor network tab for connection status
4. Review database trigger implementations

---

This real-time system provides comprehensive live functionality across the SaaS Vala platform, ensuring users receive immediate updates for all critical actions and system events.
