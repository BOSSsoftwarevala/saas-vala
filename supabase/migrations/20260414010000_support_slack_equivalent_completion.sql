-- Complete Support module capabilities: DM pairing, file sharing, read receipts,
-- searchable history, and message notifications (no new module).

ALTER TABLE public.chat_channels
  ADD COLUMN IF NOT EXISTS dm_pair_key TEXT;

DROP POLICY IF EXISTS "Create channels" ON public.chat_channels;
CREATE POLICY "Create channels"
  ON public.chat_channels
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      channel_type = 'direct'
      OR public.has_role(auth.uid(), 'support')
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Join channels" ON public.chat_channel_members;
CREATE POLICY "Join channels"
  ON public.chat_channel_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR (
      EXISTS (
        SELECT 1
        FROM public.chat_channels c
        WHERE c.id = chat_channel_members.channel_id
          AND c.channel_type = 'direct'
      )
      AND EXISTS (
        SELECT 1
        FROM public.chat_channel_members cm
        WHERE cm.channel_id = chat_channel_members.channel_id
          AND cm.user_id = auth.uid()
      )
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_channels_dm_pair_unique
  ON public.chat_channels(dm_pair_key)
  WHERE channel_type = 'direct' AND dm_pair_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.chat_message_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_message_receipts_user_channel
  ON public.chat_message_receipts(user_id, channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_message_receipts_unread
  ON public.chat_message_receipts(user_id, channel_id)
  WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS public.chat_message_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket_name TEXT NOT NULL DEFAULT 'support-files',
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_message_files_channel_created
  ON public.chat_message_files(channel_id, created_at DESC);

ALTER TABLE public.chat_message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own message receipts" ON public.chat_message_receipts;
CREATE POLICY "View own message receipts"
  ON public.chat_message_receipts
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.chat_channel_members cm
      WHERE cm.channel_id = chat_message_receipts.channel_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Insert own message receipts" ON public.chat_message_receipts;
CREATE POLICY "Insert own message receipts"
  ON public.chat_message_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.chat_channel_members cm
      WHERE cm.channel_id = chat_message_receipts.channel_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Update own message receipts" ON public.chat_message_receipts;
CREATE POLICY "Update own message receipts"
  ON public.chat_message_receipts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "View channel files" ON public.chat_message_files;
CREATE POLICY "View channel files"
  ON public.chat_message_files
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.chat_channel_members cm
      WHERE cm.channel_id = chat_message_files.channel_id
        AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Insert own channel files" ON public.chat_message_files;
CREATE POLICY "Insert own channel files"
  ON public.chat_message_files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR EXISTS (
        SELECT 1 FROM public.chat_channel_members cm
        WHERE cm.channel_id = chat_message_files.channel_id
          AND cm.user_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.create_or_get_direct_channel(
  p_other_user UUID,
  p_label TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_pair_key TEXT;
  v_channel_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_other_user IS NULL OR p_other_user = v_actor THEN
    RAISE EXCEPTION 'Invalid direct channel target';
  END IF;

  v_pair_key := LEAST(v_actor::text, p_other_user::text) || ':' || GREATEST(v_actor::text, p_other_user::text);

  SELECT id INTO v_channel_id
  FROM public.chat_channels
  WHERE channel_type = 'direct' AND dm_pair_key = v_pair_key
  LIMIT 1;

  IF v_channel_id IS NULL THEN
    INSERT INTO public.chat_channels(name, description, channel_type, created_by, dm_pair_key)
    VALUES (
      COALESCE(NULLIF(p_label, ''), 'direct-message'),
      'Direct message channel',
      'direct',
      v_actor,
      v_pair_key
    )
    RETURNING id INTO v_channel_id;
  END IF;

  INSERT INTO public.chat_channel_members(channel_id, user_id, role)
  VALUES (v_channel_id, v_actor, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  INSERT INTO public.chat_channel_members(channel_id, user_id, role)
  VALUES (v_channel_id, p_other_user, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN v_channel_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_or_get_direct_channel(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_chat_messages(
  p_query TEXT,
  p_channel_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  channel_id UUID,
  sender_id UUID,
  content TEXT,
  message_type TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT m.id, m.channel_id, m.sender_id, m.content, m.message_type, m.created_at
  FROM public.chat_messages m
  WHERE
    NULLIF(trim(p_query), '') IS NOT NULL
    AND (
      p_channel_id IS NULL
      OR m.channel_id = p_channel_id
    )
    AND EXISTS (
      SELECT 1 FROM public.chat_channel_members cm
      WHERE cm.channel_id = m.channel_id AND cm.user_id = auth.uid()
    )
    AND (
      m.content ILIKE '%' || p_query || '%'
      OR m.message_type = 'file'
    )
  ORDER BY m.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
$$;

GRANT EXECUTE ON FUNCTION public.search_chat_messages(TEXT, UUID, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_chat_message_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chat_message_receipts(channel_id, message_id, user_id, delivered_at, read_at)
  SELECT
    NEW.channel_id,
    NEW.id,
    cm.user_id,
    now(),
    CASE WHEN cm.user_id = NEW.sender_id THEN now() ELSE NULL END
  FROM public.chat_channel_members cm
  WHERE cm.channel_id = NEW.channel_id
  ON CONFLICT (message_id, user_id) DO UPDATE
    SET delivered_at = EXCLUDED.delivered_at;

  INSERT INTO public.notifications(type, title, message, read, user_id, action_url, created_at)
  SELECT
    'info',
    'New support message',
    CASE
      WHEN length(NEW.content) > 120 THEN left(NEW.content, 117) || '...'
      ELSE NEW.content
    END,
    false,
    cm.user_id,
    '/support',
    now()
  FROM public.chat_channel_members cm
  WHERE cm.channel_id = NEW.channel_id
    AND cm.user_id <> NEW.sender_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_message_events ON public.chat_messages;
CREATE TRIGGER trg_chat_message_events
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_chat_message_events();

-- Keep realtime channel update visibility for receipts.
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_receipts;

INSERT INTO storage.buckets (id, name, public)
SELECT 'support-files', 'support-files', false
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'support-files'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Support files read by channel members'
  ) THEN
    CREATE POLICY "Support files read by channel members"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'support-files'
        AND EXISTS (
          SELECT 1
          FROM public.chat_channel_members cm
          WHERE cm.user_id = auth.uid()
            AND cm.channel_id =
              CASE
                WHEN split_part(name, '/', 2) ~* '^[0-9a-fA-F-]{36}$' THEN split_part(name, '/', 2)::uuid
                ELSE NULL
              END
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Support files upload by owner'
  ) THEN
    CREATE POLICY "Support files upload by owner"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'support-files'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Support files delete by owner'
  ) THEN
    CREATE POLICY "Support files delete by owner"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'support-files'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
  END IF;
END;
$$;