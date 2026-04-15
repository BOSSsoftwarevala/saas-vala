# Database Constraints - Production-Ready Data Integrity

## Overview
This document defines all database constraints to ensure data integrity and prevent null critical fields.

## Critical Fields (NOT NULL)

### Users Table
- `id` - Primary key, NOT NULL
- `email` - Unique, NOT NULL
- `created_at` - Default NOW(), NOT NULL
- `updated_at` - Default NOW(), NOT NULL

### Products Table
- `id` - Primary key, NOT NULL
- `name` - NOT NULL
- `slug` - Unique, NOT NULL
- `price` - NOT NULL, DEFAULT 0
- `status` - NOT NULL, DEFAULT 'active'
- `created_at` - Default NOW(), NOT NULL
- `updated_at` - Default NOW(), NOT NULL

### Keys Table
- `id` - Primary key, NOT NULL
- `product_id` - Foreign key, NOT NULL
- `key_value` - Unique, NOT NULL
- `key_hash` - NOT NULL
- `status` - NOT NULL, DEFAULT 'active'
- `usage_limit` - NOT NULL, DEFAULT 100
- `used_count` - NOT NULL, DEFAULT 0
- `created_at` - Default NOW(), NOT NULL
- `updated_at` - Default NOW(), NOT NULL

### Orders Table
- `id` - Primary key, NOT NULL
- `user_id` - Foreign key, NOT NULL
- `product_id` - Foreign key, NOT NULL
- `amount` - NOT NULL
- `status` - NOT NULL, DEFAULT 'pending'
- `created_at` - Default NOW(), NOT NULL
- `updated_at` - Default NOW(), NOT NULL

### Wallets Table
- `id` - Primary key, NOT NULL
- `user_id` - Foreign key, Unique, NOT NULL
- `balance` - NOT NULL, DEFAULT 0
- `created_at` - Default NOW(), NOT NULL
- `updated_at` - Default NOW(), NOT NULL

### Wallet Transactions Table
- `id` - Primary key, NOT NULL
- `wallet_id` - Foreign key, NOT NULL
- `amount` - NOT NULL
- `type` - NOT NULL
- `status` - NOT NULL, DEFAULT 'completed'
- `created_at` - Default NOW(), NOT NULL

### APKs Table
- `id` - Primary key, NOT NULL
- `product_id` - Foreign key, NOT NULL
- `version` - NOT NULL
- `file_url` - NOT NULL
- `is_active` - NOT NULL, DEFAULT false
- `created_at` - Default NOW(), NOT NULL
- `updated_at` - Default NOW(), NOT NULL

### Servers Table
- `id` - Primary key, NOT NULL
- `name` - NOT NULL
- `ip_address` - NOT NULL
- `type` - NOT NULL
- `status` - NOT NULL, DEFAULT 'offline'
- `created_at` - Default NOW(), NOT NULL
- `updated_at` - Default NOW(), NOT NULL

### Support Tickets Table
- `id` - Primary key, NOT NULL
- `user_id` - Foreign key, NOT NULL
- `subject` - NOT NULL
- `description` - NOT NULL
- `status` - NOT NULL, DEFAULT 'open'
- `priority` - NOT NULL, DEFAULT 'medium'
- `created_at` - Default NOW(), NOT NULL
- `updated_at` - Default NOW(), NOT NULL

### Audit Logs Table
- `id` - Primary key, NOT NULL
- `user_id` - Foreign key, NOT NULL
- `action` - NOT NULL
- `entity_type` - NOT NULL
- `entity_id` - NOT NULL
- `status` - NOT NULL, DEFAULT 'success'
- `created_at` - Default NOW(), NOT NULL

### Resellers Table
- `id` - Primary key, NOT NULL
- `user_id` - Foreign key, Unique, NOT NULL
- `commission_rate` - NOT NULL, DEFAULT 0.1
- `status` - NOT NULL, DEFAULT 'active'
- `created_at` - Default NOW(), NOT NULL
- `updated_at` - Default NOW(), NOT NULL

## Foreign Key Constraints

### Products
- `category_id` → categories(id) ON DELETE SET NULL

### Keys
- `product_id` → products(id) ON DELETE CASCADE
- `assigned_user_id` → users(id) ON DELETE SET NULL
- `assigned_reseller_id` → resellers(id) ON DELETE SET NULL

### Orders
- `user_id` → users(id) ON DELETE CASCADE
- `product_id` → products(id) ON DELETE RESTRICT

### Wallets
- `user_id` → users(id) ON DELETE CASCADE

### Wallet Transactions
- `wallet_id` → wallets(id) ON DELETE CASCADE

### APKs
- `product_id` → products(id) ON DELETE CASCADE

### Support Tickets
- `user_id` → users(id) ON DELETE CASCADE
- `assigned_to` → users(id) ON DELETE SET NULL

### Audit Logs
- `user_id` → users(id) ON DELETE SET NULL

### Resellers
- `user_id` → users(id) ON DELETE CASCADE

## Unique Constraints

- `users.email`
- `products.slug`
- `keys.key_value`
- `wallets.user_id`
- `resellers.user_id`

## Check Constraints

### Wallets
- `balance >= 0`

### Keys
- `used_count >= 0`
- `used_count <= usage_limit`

### Products
- `price >= 0`

### Wallet Transactions
- `amount != 0`

## Indexes for Performance

### Users
- `idx_users_email` ON (email)
- `idx_users_created_at` ON (created_at)

### Products
- `idx_products_slug` ON (slug)
- `idx_products_status` ON (status)
- `idx_products_category` ON (category_id)

### Keys
- `idx_keys_product_id` ON (product_id)
- `idx_keys_status` ON (status)
- `idx_keys_key_value` ON (key_value)

### Orders
- `idx_orders_user_id` ON (user_id)
- `idx_orders_product_id` ON (product_id)
- `idx_orders_status` ON (status)
- `idx_orders_created_at` ON (created_at)

### Wallet Transactions
- `idx_wallet_transactions_wallet_id` ON (wallet_id)
- `idx_wallet_transactions_created_at` ON (created_at)

### Support Tickets
- `idx_support_tickets_user_id` ON (user_id)
- `idx_support_tickets_status` ON (status)
- `idx_support_tickets_created_at` ON (created_at)

### Audit Logs
- `idx_audit_logs_user_id` ON (user_id)
- `idx_audit_logs_action` ON (action)
- `idx_audit_logs_created_at` ON (created_at)

## SQL Migration Example

```sql
-- Example migration to add constraints
ALTER TABLE products 
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL,
  ADD CONSTRAINT products_slug_unique UNIQUE (slug);

ALTER TABLE keys 
  ALTER COLUMN key_value SET NOT NULL,
  ADD CONSTRAINT keys_key_value_unique UNIQUE (key_value);

ALTER TABLE orders 
  ALTER COLUMN amount SET NOT NULL,
  ADD CONSTRAINT orders_amount_check CHECK (amount > 0);

ALTER TABLE wallets 
  ADD CONSTRAINT wallets_balance_check CHECK (balance >= 0);
```

## Validation Rules

### Email Validation
- Must be valid email format
- Must be unique
- Case-insensitive comparison

### Slug Validation
- Must be URL-friendly (lowercase, hyphens only)
- Must be unique
- No special characters except hyphens

### Key Validation
- Must be unique
- Must match format pattern
- Case-sensitive

### Price Validation
- Must be non-negative
- Maximum 2 decimal places

### Balance Validation
- Must be non-negative
- Transaction atomicity required
