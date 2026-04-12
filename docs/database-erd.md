# SaaS Vala Database Entity Relationship Diagram (ERD)

## Overview
This document outlines the complete database structure for the SaaS Vala platform, including all tables, relationships, and data flow.

## Core Tables

### Users & Authentication
- **users** - Core user accounts with authentication
- **profiles** - Extended user profile information
- **roles** - System roles (admin, reseller, user, etc.)
- **user_roles** - Many-to-many relationship between users and roles

### Products & Licensing
- **products** - SaaS products and services
- **apks** - Mobile application packages
- **apk_versions** - Version control for APKs
- **api_keys** - API key management
- **apk_downloads** - Download tracking and licensing

### Financial System
- **wallets** - User wallet balances
- **transactions** - Financial transactions
- **billing_tracker** - Subscription and billing management

### Communication & Support
- **chat_rooms** - Chat room management
- **chat_messages** - Message storage
- **support_tickets** - Customer support tickets

### AI & Automation
- **ai_models** - AI model configurations
- **ai_requests** - AI API requests
- **ai_responses** - AI API responses
- **ai_costs** - Cost tracking for AI usage
- **ai_memories** - AI memory system
- **auto_software_queue** - Automated software generation queue

### Infrastructure & Monitoring
- **servers** - Server inventory and management
- **system_health_checks** - Health monitoring
- **audit_logs** - Audit trail
- **activity_logs** - User activity tracking

### Marketing & Leads
- **seo_campaigns** - SEO campaign management
- **leads** - Lead generation and management

## Key Relationships

### User-Centric Relationships
```
users (1) → (N) profiles
users (1) → (N) user_roles → (N) roles
users (1) → (N) wallets
users (1) → (N) transactions
users (1) → (N) api_keys
users (1) → (N) support_tickets
```

### Product Relationships
```
products (1) → (N) apks
products (1) → (N) api_keys
apks (1) → (N) apk_versions
products (1) → (N) apk_downloads
```

### AI System Relationships
```
ai_models (1) → (N) ai_requests
ai_requests (1) → (1) ai_responses
ai_requests (1) → (N) ai_costs
users (1) → (N) ai_requests
```

### Financial Relationships
```
users (1) → (N) wallets
wallets (1) → (N) transactions
transactions (1) → (N) apk_downloads
```

## Data Flow

### User Registration & Authentication
1. New user creates account → `users` table
2. Profile created → `profiles` table
3. Default role assigned → `user_roles` table
4. Wallet created → `wallets` table

### Product Purchase & Licensing
1. User browses products → `products` table
2. Purchase initiated → `transactions` table
3. License key generated → `api_keys` table
4. APK download tracked → `apk_downloads` table

### AI Service Usage
1. User makes AI request → `ai_requests` table
2. Model processes request → `ai_models` table
3. Response generated → `ai_responses` table
4. Cost calculated → `ai_costs` table
5. Usage tracked → `ai_usage` table

### Support & Communication
1. User creates ticket → `support_tickets` table
2. Support responds → `chat_messages` table
3. Activity logged → `activity_logs` table

## Indexes & Performance

### Primary Indexes
- All tables have UUID primary keys
- Foreign key relationships indexed
- Frequently queried fields indexed

### Performance Optimizations
- Composite indexes for complex queries
- Partitioning for large tables (audit_logs, activity_logs)
- JSONB indexes for metadata fields

## Security & Compliance

### Data Protection
- Encrypted API keys and sensitive data
- Audit trail for all data modifications
- Role-based access control enforced at database level

### Privacy
- PII stored in separate profiles table
- Data retention policies enforced
- GDPR compliance features

## Scaling Considerations

### Horizontal Scaling
- Read replicas for reporting queries
- Connection pooling implemented
- Database sharding ready for large scale

### Vertical Scaling
- Optimized for PostgreSQL 14+
- JSONB for flexible schema evolution
- Partitioning for time-series data

## Migration Strategy

### Version Control
- All schema changes tracked in migrations
- Backward compatibility maintained
- Rollback procedures documented

### Data Integrity
- Foreign key constraints enforced
- Check constraints for data validation
- Triggers for automated updates

## Monitoring & Maintenance

### Health Checks
- Database connection monitoring
- Query performance tracking
- Storage capacity monitoring

### Backup Strategy
- Daily automated backups
- Point-in-time recovery
- Cross-region replication

---

*This ERD documentation serves as the authoritative reference for the SaaS Vala database structure and should be updated with any schema changes.*
