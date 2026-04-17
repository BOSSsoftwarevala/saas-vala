# Marketplace Database Migration

## Instructions to Run Migration

### Option 1: Using Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `20240417_marketplace_schema.sql`
3. Paste into the SQL Editor
4. Click "Run" to execute the migration

### Option 2: Using Supabase CLI
```bash
supabase db push
```

### Option 3: Using psql
```bash
psql -h astmdnelnuqwpdbyzecr.supabase.co -U postgres -d postgres -f supabase/migrations/20240417_marketplace_schema.sql
```

## Tables Created
- marketplace_categories
- marketplace_products
- marketplace_orders
- marketplace_reviews
- marketplace_review_replies

## Features
- RLS (Row Level Security) enabled
- Indexes for performance
- Triggers for auto-updates
- Default categories inserted
