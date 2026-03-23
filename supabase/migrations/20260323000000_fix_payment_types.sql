-- Fix payment transaction types and prevent duplicate submissions

-- Add 'purchase' type for manual payment intents (pending wallet credit requests)
-- This separates "user submitted payment proof" from "admin confirmed credit"
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'purchase';

-- Add 'verified' status for admin-verified manual payments
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'verified';

-- Prevent duplicate manual payment references (e.g. same UPI TxnID submitted twice)
-- Partial index: only enforce uniqueness when reference_id is non-null
CREATE UNIQUE INDEX IF NOT EXISTS transactions_reference_id_unique
  ON public.transactions(reference_id)
  WHERE reference_id IS NOT NULL;
