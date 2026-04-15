# SaaS VALA - Database Entity Relationship Diagram (ERD)

## Core Tables

### users
```
- id (uuid, PK)
- email (varchar, unique)
- password_hash (varchar)
- role (enum: boss, admin, reseller, user)
- is_active (boolean)
- wallet_balance (decimal)
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp, nullable)
```

### roles
```
- id (uuid, PK)
- name (enum: boss, admin, reseller, user)
- display_name (varchar)
- permissions (jsonb)
- is_system_role (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

### products
```
- id (uuid, PK)
- name (varchar)
- description (text)
- price (decimal)
- currency (varchar)
- status (enum: active, inactive, draft, archived)
- category (varchar)
- thumbnail_url (varchar)
- demo_url (varchar)
- features (jsonb)
- seo_title (varchar)
- seo_description (text)
- seo_keywords (jsonb)
- created_by (uuid, FK → users.id)
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp, nullable)
```

### apks
```
- id (uuid, PK)
- product_id (uuid, FK → products.id)
- version (varchar)
- file_url (varchar)
- file_size (bigint)
- checksum (varchar)
- is_active (boolean)
- download_count (integer)
- created_at (timestamp)
- updated_at (timestamp)
```

### keys
```
- id (uuid, PK)
- product_id (uuid, FK → products.id)
- type (enum: api, feature, license)
- key_value (varchar, encrypted)
- key_hash (varchar)
- status (enum: active, suspended, expired, revoked)
- usage_limit (integer)
- used_count (integer)
- expiry_date (timestamp)
- grace_period_days (integer)
- assigned_user_id (uuid, FK → users.id, nullable)
- assigned_reseller_id (uuid, FK → users.id, nullable)
- device_bindings (jsonb)
- fail_count (integer)
- notes (text)
- last_verified_at (timestamp)
- created_at (timestamp)
- updated_at (timestamp)
- deleted_at (timestamp, nullable)
```

### key_activations
```
- id (uuid, PK)
- key_id (uuid, FK → keys.id)
- device_id (varchar)
- device_name (varchar)
- device_fingerprint (jsonb)
- ip_address (varchar)
- user_agent (varchar)
- status (enum: active, deactivated)
- activated_at (timestamp)
- deactivated_at (timestamp)
- created_at (timestamp)
```

### key_usage_logs
```
- id (uuid, PK)
- key_id (uuid, FK → keys.id)
- action (varchar)
- ip_address (varchar)
- user_agent (varchar)
- metadata (jsonb)
- created_at (timestamp)
```

### device_fingerprints
```
- id (uuid, PK)
- device_id (varchar, unique)
- fingerprint (jsonb)
- user_id (uuid, FK → users.id, nullable)
- is_blocked (boolean)
- suspicious_activity_count (integer)
- last_seen_at (timestamp)
- created_at (timestamp)
- updated_at (timestamp)
```

### key_validation_attempts
```
- id (uuid, PK)
- key_id (uuid, FK → keys.id)
- device_id (varchar)
- ip_address (varchar)
- success (boolean)
- error_message (text)
- attempted_at (timestamp)
```

## Subscription & Billing

### plans
```
- id (uuid, PK)
- name (varchar)
- description (text)
- price (decimal)
- currency (varchar)
- billing_cycle (enum: monthly, yearly, lifetime)
- features (jsonb)
- max_keys (integer)
- max_devices_per_key (integer)
- max_api_calls_per_month (integer)
- is_active (boolean)
- is_public (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

### subscriptions
```
- id (uuid, PK)
- user_id (uuid, FK → users.id)
- plan_id (uuid, FK → plans.id)
- status (enum: active, expired, cancelled, suspended, pending)
- start_date (timestamp)
- end_date (timestamp)
- auto_renew (boolean)
- payment_method_id (varchar)
- metadata (jsonb)
- created_at (timestamp)
- updated_at (timestamp)
```

### orders
```
- id (uuid, PK)
- user_id (uuid, FK → users.id)
- product_id (uuid, FK → products.id)
- amount (decimal)
- currency (varchar)
- status (enum: pending, paid, failed, refunded)
- payment_method (varchar)
- payment_id (varchar)
- key_type (enum: api, feature, license)
- quantity (integer)
- created_at (timestamp)
- updated_at (timestamp)
```

### order_keys
```
- id (uuid, PK)
- order_id (uuid, FK → orders.id)
- key_id (uuid, FK → keys.id)
- created_at (timestamp)
```

### wallets
```
- id (uuid, PK)
- user_id (uuid, FK → users.id, unique)
- balance (decimal)
- currency (varchar)
- created_at (timestamp)
- updated_at (timestamp)
```

### transactions
```
- id (uuid, PK)
- wallet_id (uuid, FK → wallets.id)
- type (enum: credit, debit, refund)
- amount (decimal)
- description (text)
- reference_id (varchar)
- reference_type (varchar)
- created_at (timestamp)
```

## Reseller Management

### resellers
```
- id (uuid, PK)
- user_id (uuid, FK → users.id, unique)
- commission_rate (decimal)
- discount_rate (decimal)
- max_keys (integer)
- assigned_keys_count (integer)
- total_sales (decimal)
- status (enum: active, suspended, pending)
- created_at (timestamp)
- updated_at (timestamp)
```

### product_resellers
```
- id (uuid, PK)
- product_id (uuid, FK → products.id)
- reseller_id (uuid, FK → resellers.id)
- discount_rate (decimal)
  created_at (timestamp)
```

### reseller_sales
```
- id (uuid, PK)
- reseller_id (uuid, FK → resellers.id)
- order_id (uuid, FK → orders.id)
- commission_amount (decimal)
  created_at (timestamp)
```

## Server Management

### servers
```
- id (uuid, PK)
- name (varchar)
- environment (enum: production, staging, backup, dev)
- status (enum: online, offline, deploying, error)
- region (varchar)
- ip_address (varchar)
- port (integer)
  uptime_percentage (decimal)
  last_heartbeat (timestamp)
  created_at (timestamp)
  updated_at (timestamp)
```

### server_deployments
```
- id (uuid, PK)
- server_id (uuid, FK → servers.id)
- version (varchar)
  status (enum: pending, deploying, success, failed)
  started_at (timestamp)
  completed_at (timestamp)
  logs (text)
  created_by (uuid, FK → users.id)
  created_at (timestamp)
```

## AI & Chat

### ai_chats
```
- id (uuid, PK)
- user_id (uuid, FK → users.id)
  assigned_to (uuid, FK → users.id, nullable)
  title (varchar)
  status (enum: active, closed, pending)
  created_at (timestamp)
  updated_at (timestamp)
```

### ai_messages
```
- id (uuid, PK)
- chat_id (uuid, FK → ai_chats.id)
  role (enum: user, assistant, system)
  content (text)
  metadata (jsonb)
  created_at (timestamp)
```

### ai_api_integrations
```
- id (uuid, PK)
- provider_id (uuid, FK → ai_providers.id)
  api_key (encrypted)
  endpoint_url (varchar)
  model (varchar)
  priority (integer)
  is_active (boolean)
  failover_enabled (boolean)
  daily_limit (integer)
  daily_cost_limit (decimal)
  created_at (timestamp)
  updated_at (timestamp)
```

### ai_providers
```
- id (uuid, PK)
  name (varchar)
  category (varchar)
  display_name (varchar)
  description (text)
  created_at (timestamp)
```

### ai_api_usage_logs
```
- id (uuid, PK)
- integration_id (uuid, FK → ai_api_integrations.id)
  request_id (varchar)
  model (varchar)
  tokens_used (integer)
  cost (decimal)
  latency_ms (integer)
  status (enum: success, error)
  error_message (text)
  created_at (timestamp)
```

## Support & Tickets

### support_tickets
```
- id (uuid, PK)
- user_id (uuid, FK → users.id)
  subject (varchar)
  description (text)
  status (enum: open, in_progress, resolved, closed)
  priority (enum: low, medium, high, urgent)
  assigned_to (uuid, FK → users.id, nullable)
  created_at (timestamp)
  updated_at (timestamp)
```

### support_responses
```
- id (uuid, PK)
- ticket_id (uuid, FK → support_tickets.id)
  user_id (uuid, FK → users.id)
  message (text)
  is_internal (boolean)
  created_at (timestamp)
```

## Feature Flags & Configuration

### feature_flags
```
- id (uuid, PK)
  key (varchar, unique)
  name (varchar)
  description (text)
  is_enabled (boolean)
  is_public (boolean)
  target_type (enum: all, user, role, subscription)
  target_ids (jsonb)
  metadata (jsonb)
  created_at (timestamp)
  updated_at (timestamp)
```

### settings
```
- id (uuid, PK)
  user_id (uuid, FK → users.id, nullable for global settings)
  key (varchar)
  value (jsonb)
  created_at (timestamp)
  updated_at (timestamp)
```

## Notifications & Webhooks

### notifications
```
- id (uuid, PK)
  user_id (uuid, FK → users.id, nullable)
  type (varchar)
  channel (enum: email, in_app, webhook, sms)
  title (varchar)
  message (text)
  data (jsonb)
  is_read (boolean)
  sent_at (timestamp)
  error (text)
  created_at (timestamp)
```

### notification_preferences
```
- id (uuid, PK)
  user_id (uuid, FK → users.id)
  notification_type (varchar)
  channels (jsonb)
  enabled (boolean)
  created_at (timestamp)
  updated_at (timestamp)
```

### webhooks
```
- id (uuid, PK)
  user_id (uuid, FK → users.id, nullable)
  event_type (varchar)
  url (varchar)
  secret (varchar)
  description (text)
  is_active (boolean)
  headers (jsonb)
  retry_count (integer)
  last_triggered_at (timestamp)
  last_success_at (timestamp)
  last_failure_at (timestamp)
  created_at (timestamp)
  updated_at (timestamp)
```

### webhook_deliveries
```
- id (uuid, PK)
  webhook_id (uuid, FK → webhooks.id)
  event_type (varchar)
  payload (jsonb)
  response_status (integer)
  response_body (text)
  error_message (text)
  delivered_at (timestamp)
  retry_count (integer)
  status (enum: pending, delivered, failed)
  created_at (timestamp)
```

## Sessions & Security

### sessions
```
- id (uuid, PK)
  key_id (uuid, FK → keys.id, nullable)
  user_id (uuid, FK → users.id, nullable)
  device_id (varchar)
  token (varchar, hashed)
  ip_address (varchar)
  user_agent (varchar)
  expires_at (timestamp)
  last_activity_at (timestamp)
  is_active (boolean)
  created_at (timestamp)
```

### geo_ip_rules
```
- id (uuid, PK)
  user_id (uuid, FK → users.id, nullable)
  key_id (uuid, FK → keys.id, nullable)
  rule_type (enum: allow, block)
  ip_addresses (jsonb)
  ip_ranges (jsonb)
  countries (jsonb)
  regions (jsonb)
  is_active (boolean)
  description (text)
  created_at (timestamp)
  updated_at (timestamp)
```

## Usage Metering

### usage_metrics
```
- id (uuid, PK)
  user_id (uuid, FK → users.id, nullable)
  key_id (uuid, FK → keys.id, nullable)
  metric_type (enum: api_calls, tokens, activations, validations, downloads)
  value (numeric)
  unit (varchar)
  timestamp (timestamp)
  metadata (jsonb)
  created_at (timestamp)
```

## Audit Logs

### audit_logs
```
- id (uuid, PK)
  user_id (uuid, FK → users.id, nullable)
  action (varchar)
  entity_type (varchar)
  entity_id (uuid)
  old_values (jsonb)
  new_values (jsonb)
  ip_address (varchar)
  user_agent (varchar)
  created_at (timestamp)
```

## System Health

### system_health
```
- id (uuid, PK)
  service_name (varchar)
  status (enum: healthy, degraded, down)
  response_time_ms (integer)
  uptime_percentage (decimal)
  last_check (timestamp)
  created_at (timestamp)
```

## Purchase Orders

### purchase_orders
```
- id (uuid, PK)
  product_id (uuid, FK → products.id)
  user_id (uuid, FK → users.id)
  amount (decimal)
  currency (varchar)
  status (enum: pending, paid, failed, refunded)
  payment_method (varchar)
  payment_id (varchar)
  key_type (enum: api, feature, license)
  quantity (integer)
  created_at (timestamp)
  updated_at (timestamp)
```

## Relationships Summary

### Primary Relationships
- users → roles (many-to-one)
- users → products (one-to-many, via created_by)
- users → keys (one-to-many, via assigned_user_id)
- users → subscriptions (one-to-many)
- users → wallets (one-to-one)
- users → resellers (one-to-one)
- users → ai_chats (one-to-many)
- users → support_tickets (one-to-many)
- products → apks (one-to-many)
- products → keys (one-to-many)
- products → product_resellers (one-to-many)
- keys → key_activations (one-to-many)
- keys → key_usage_logs (one-to-many)
- keys → key_validation_attempts (one-to-many)
- keys → sessions (one-to-many)
- subscriptions → plans (many-to-one)
- orders → products (many-to-one)
- orders → users (many-to-one)
- orders → order_keys (one-to-many)
- ai_chats → ai_messages (one-to-many)
- ai_api_integrations → ai_providers (many-to-one)
- ai_api_integrations → ai_api_usage_logs (one-to-many)
- support_tickets → support_responses (one-to-many)
- webhooks → webhook_deliveries (one-to-many)
- servers → server_deployments (one-to-many)

### Indexes
- All primary keys (id)
- All foreign keys
- users.email (unique)
- keys.key_hash (unique)
- device_fingerprints.device_id (unique)
- feature_flags.key (unique)
- All timestamp fields for time-based queries
- All status fields for filtering

### RLS (Row Level Security) Policies
- All tables have RLS enabled
- Boss role has full access
- Admin role has access to most tables except sensitive settings
- Reseller role has access to their own data and assigned products
- User role has access to their own data only
