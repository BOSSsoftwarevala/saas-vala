alter table public.products
  add column if not exists business_type text,
  add column if not exists icon_path text,
  add column if not exists product_code text,
  add column if not exists visibility text default 'public';

update public.products
set business_type = coalesce(business_type, target_industry)
where coalesce(business_type, '') = ''
  and coalesce(target_industry, '') <> '';

update public.products
set visibility = coalesce(nullif(visibility, ''), 'public')
where coalesce(visibility, '') = '';