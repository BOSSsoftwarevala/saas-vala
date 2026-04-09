-- High-reliability reseller schema upgrades

-- Wallet totals for reliable accounting
alter table if exists public.wallets
  add column if not exists reseller_id uuid,
  add column if not exists total_added numeric(12,2) not null default 0,
  add column if not exists total_spent numeric(12,2) not null default 0,
  add column if not exists total_earned numeric(12,2) not null default 0;

create index if not exists idx_wallets_reseller_id on public.wallets(reseller_id);

-- Reseller client registry
create table if not exists public.reseller_clients (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.resellers(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active', 'inactive', 'blocked')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reseller_clients_reseller on public.reseller_clients(reseller_id);
create index if not exists idx_reseller_clients_email on public.reseller_clients(email);

-- License key monetization and client assignment fields
alter table if exists public.license_keys
  add column if not exists client_id uuid,
  add column if not exists cost_price numeric(12,2),
  add column if not exists sell_price numeric(12,2),
  add column if not exists profit_amount numeric(12,2),
  add column if not exists delivery_status text;

create index if not exists idx_license_keys_client_id on public.license_keys(client_id);

alter table if exists public.license_keys
  drop constraint if exists license_keys_delivery_status_check;

alter table if exists public.license_keys
  add constraint license_keys_delivery_status_check
  check (delivery_status is null or delivery_status in ('pending', 'sent', 'failed'));

-- Add FK only when missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'license_keys_client_id_fkey'
  ) THEN
    ALTER TABLE public.license_keys
      ADD CONSTRAINT license_keys_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.reseller_clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Delivery and communication audit logs
create table if not exists public.license_key_deliveries (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.resellers(id) on delete cascade,
  client_id uuid references public.reseller_clients(id) on delete set null,
  license_key_id uuid not null references public.license_keys(id) on delete cascade,
  delivery_method text not null check (delivery_method in ('whatsapp', 'email', 'manual', 'sms')),
  delivery_status text not null default 'sent' check (delivery_status in ('pending', 'sent', 'failed')),
  delivered_to text,
  delivered_at timestamptz,
  notes text,
  meta jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_license_key_deliveries_reseller on public.license_key_deliveries(reseller_id, created_at desc);
create index if not exists idx_license_key_deliveries_license on public.license_key_deliveries(license_key_id);

-- Keep wallet linkage in sync when reseller exists for same user
update public.wallets w
set reseller_id = r.id
from public.resellers r
where r.user_id = w.user_id
  and (w.reseller_id is null or w.reseller_id <> r.id);
