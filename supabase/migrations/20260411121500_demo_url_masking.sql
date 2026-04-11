alter table public.products
  add column if not exists demo_source_url text;

update public.products
set demo_source_url = demo_url
where coalesce(demo_source_url, '') = ''
  and coalesce(demo_url, '') <> ''
  and demo_url !~* '^https://demo\.saasvala\.com(/|$)';

update public.products
set demo_url = 'https://demo.saasvala.com/' || slug
where coalesce(demo_source_url, '') <> ''
  and coalesce(slug, '') <> '';
