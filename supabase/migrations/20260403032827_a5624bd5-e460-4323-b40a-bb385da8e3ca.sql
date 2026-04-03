
-- Chat Channels
CREATE TABLE public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  channel_type TEXT NOT NULL DEFAULT 'public',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Channel Members
CREATE TABLE public.chat_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member',
  last_read_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Typing indicators
CREATE TABLE public.chat_typing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Indexes
CREATE INDEX idx_chat_messages_channel ON public.chat_messages(channel_id, created_at DESC);
CREATE INDEX idx_chat_channel_members_user ON public.chat_channel_members(user_id);

-- Enable RLS
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_typing ENABLE ROW LEVEL SECURITY;

-- RLS: Channels
CREATE POLICY "View channels" ON public.chat_channels FOR SELECT TO authenticated
  USING (channel_type = 'public' OR EXISTS (SELECT 1 FROM public.chat_channel_members WHERE channel_id = id AND user_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Create channels" ON public.chat_channels FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Update channels" ON public.chat_channels FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- RLS: Members
CREATE POLICY "View members" ON public.chat_channel_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_channel_members cm WHERE cm.channel_id = channel_id AND cm.user_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Join channels" ON public.chat_channel_members FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Update membership" ON public.chat_channel_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Leave channels" ON public.chat_channel_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- RLS: Messages
CREATE POLICY "View messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_channel_members WHERE channel_id = chat_messages.channel_id AND user_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Send messages" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND (EXISTS (SELECT 1 FROM public.chat_channel_members WHERE channel_id = chat_messages.channel_id AND user_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin')));

CREATE POLICY "Edit own messages" ON public.chat_messages FOR UPDATE TO authenticated USING (sender_id = auth.uid());

-- RLS: Typing
CREATE POLICY "View typing" ON public.chat_typing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Set typing" ON public.chat_typing FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Clear typing" ON public.chat_typing FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_typing;

-- Seed default channels
INSERT INTO public.chat_channels (name, description, channel_type) VALUES
  ('general', 'General discussion for everyone', 'public'),
  ('announcements', 'Important announcements', 'public'),
  ('dev-support', 'Developer support channel', 'public'),
  ('reseller-chat', 'Reseller discussions', 'public');
