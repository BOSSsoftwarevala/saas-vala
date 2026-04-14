-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked'))
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  original_language TEXT DEFAULT 'en',
  translated_text TEXT,
  target_language TEXT DEFAULT 'en',
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'ai', 'system', 'reward')),
  reward_type TEXT,
  reward_icon TEXT,
  reward_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Add preferred_language to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reward_type TEXT;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reward_icon TEXT;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reward_label TEXT;

ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_type_check;

ALTER TABLE public.messages
ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'ai', 'system', 'reward'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_participant_1 ON chats(participant_1_id);
CREATE INDEX IF NOT EXISTS idx_chats_participant_2 ON chats(participant_2_id);

-- Enable realtime for messages table
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Update chat timestamp on new message
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats
  SET updated_at = NOW(),
      last_message_at = NOW()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_timestamp ON public.messages;

CREATE TRIGGER trigger_update_chat_timestamp
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_timestamp();

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_participants_select" ON public.chats;
CREATE POLICY "chat_participants_select" ON public.chats
  FOR SELECT USING (
    auth.uid() = participant_1_id OR auth.uid() = participant_2_id
  );

DROP POLICY IF EXISTS "chat_participants_insert" ON public.chats;
CREATE POLICY "chat_participants_insert" ON public.chats
  FOR INSERT WITH CHECK (
    auth.uid() = participant_1_id OR auth.uid() = participant_2_id
  );

DROP POLICY IF EXISTS "chat_participants_update" ON public.chats;
CREATE POLICY "chat_participants_update" ON public.chats
  FOR UPDATE USING (
    auth.uid() = participant_1_id OR auth.uid() = participant_2_id
  );

DROP POLICY IF EXISTS "message_participants_select" ON public.messages;
CREATE POLICY "message_participants_select" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.chats c
      WHERE c.id = messages.chat_id
        AND (auth.uid() = c.participant_1_id OR auth.uid() = c.participant_2_id)
    )
  );

DROP POLICY IF EXISTS "message_participants_insert" ON public.messages;
CREATE POLICY "message_participants_insert" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.chats c
      WHERE c.id = messages.chat_id
        AND (auth.uid() = c.participant_1_id OR auth.uid() = c.participant_2_id)
    )
  );

DROP POLICY IF EXISTS "message_owner_update" ON public.messages;
CREATE POLICY "message_owner_update" ON public.messages
  FOR UPDATE USING (sender_id = auth.uid());
