
INSERT INTO public.chat_channels (name, description, channel_type, is_archived)
VALUES 
  ('general', 'Company-wide announcements and work-based matters', 'public', false),
  ('random', 'Non-work banter and water cooler conversation', 'public', false),
  ('help-desk', 'Get help from the support team', 'public', false),
  ('dev-team', 'Engineering discussions and updates', 'public', false),
  ('sales', 'Sales team and reseller discussions', 'public', false),
  ('announcements', 'Important company announcements', 'public', false)
ON CONFLICT DO NOTHING;
