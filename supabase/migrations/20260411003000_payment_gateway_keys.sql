alter table public.payment_settings
  add column if not exists razorpay_enabled boolean not null default false,
  add column if not exists razorpay_key_id text not null default '',
  add column if not exists razorpay_key_secret text not null default '',
  add column if not exists stripe_enabled boolean not null default false,
  add column if not exists stripe_publishable_key text not null default '',
  add column if not exists stripe_secret_key text not null default '',
  add column if not exists wallet_enabled boolean not null default true;
