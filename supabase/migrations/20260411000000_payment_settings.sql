-- Create payment_settings table for admin-controlled payment details
create table if not exists public.payment_settings (
  id uuid primary key default gen_random_uuid(),
  -- Bank Transfer
  bank_name text not null default 'INDIAN BANK',
  account_name text not null default 'SOFTWARE VALA',
  account_number text not null default '8045924772',
  ifsc_code text not null default 'IDIB000K196',
  branch_name text not null default 'KANKAR BAGH',
  account_type text not null default 'Current',
  -- UPI
  upi_id text not null default 'softwarevala@indianbank',
  -- Wise
  wise_pay_link text not null default 'https://wise.com/pay/business/manojkumar21?utm_source=quick_pay',
  -- Crypto
  binance_pay_id text not null default '1078928519',
  -- Remitly (uses same bank details)
  remitly_note text not null default 'Send to Indian Bank Account (same as Bank Transfer)',
  -- Flags
  upi_enabled boolean not null default true,
  bank_enabled boolean not null default true,
  wise_enabled boolean not null default true,
  crypto_enabled boolean not null default true,
  remitly_enabled boolean not null default true,
  -- Timestamps
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Only one row ever (singleton config)
-- Insert default row
insert into public.payment_settings (id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- RLS: only admins can write; anyone authenticated can read
alter table public.payment_settings enable row level security;

create policy "Anyone authenticated can read payment_settings"
  on public.payment_settings for select
  using (auth.uid() is not null);

create policy "Admins can update payment_settings"
  on public.payment_settings for update
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role in ('super_admin', 'admin')
    )
  );
