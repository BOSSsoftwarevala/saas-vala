-- Internal Chat System Tables
-- WhatsApp-style internal messaging system

-- Chats table
CREATE TABLE IF NOT EXISTS internal_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_group BOOLEAN DEFAULT FALSE,
    group_name TEXT,
    group_avatar_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Chat members table
CREATE TABLE IF NOT EXISTS internal_chat_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES internal_chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_muted BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    UNIQUE(chat_id, user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS internal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES internal_chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    translated_text JSONB, -- Store translations in multiple languages
    voice_url TEXT,
    voice_duration INTEGER, -- in seconds
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'voice', 'image', 'file')),
    media_url TEXT,
    media_type TEXT,
    media_size INTEGER, -- in bytes
    reply_to_id UUID REFERENCES internal_messages(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read', 'failed')),
    read_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    edited_at TIMESTAMP WITH TIME ZONE,
    edit_count INTEGER DEFAULT 0
);

-- Message delivery receipts
CREATE TABLE IF NOT EXISTS internal_message_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES internal_messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('sent', 'delivered', 'read')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Typing indicators
CREATE TABLE IF NOT EXISTS internal_typing_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES internal_chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_typing BOOLEAN DEFAULT FALSE,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(chat_id, user_id)
);

-- Translation cache
CREATE TABLE IF NOT EXISTS internal_translation_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_text TEXT NOT NULL,
    source_language TEXT NOT NULL,
    target_language TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    translation_service TEXT DEFAULT 'auto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(original_text, source_language, target_language)
);

-- User language preferences
CREATE TABLE IF NOT EXISTS internal_user_languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    language_code TEXT NOT NULL, -- e.g., 'en', 'es', 'fr', 'hi'
    is_primary BOOLEAN DEFAULT FALSE,
    auto_translate BOOLEAN DEFAULT TRUE,
    auto_voice_translate BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, language_code)
);

-- Blocked users
CREATE TABLE IF NOT EXISTS internal_blocked_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT,
    UNIQUE(blocker_id, blocked_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_internal_chat_members_chat_id ON internal_chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_internal_chat_members_user_id ON internal_chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_chat_id ON internal_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_sender_id ON internal_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_internal_messages_created_at ON internal_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_message_receipts_message_id ON internal_message_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_internal_message_receipts_user_id ON internal_message_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_internal_typing_indicators_chat_id ON internal_typing_indicators(chat_id);
CREATE INDEX IF NOT EXISTS idx_internal_translation_cache_lookup ON internal_translation_cache(original_text, source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_internal_user_languages_user_id ON internal_user_languages(user_id);

-- RLS (Row Level Security) Policies
ALTER TABLE internal_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_translation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_user_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_blocked_users ENABLE ROW LEVEL SECURITY;

-- Chat policies
CREATE POLICY "Users can view chats they are members of" ON internal_chats
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM internal_chat_members 
            WHERE chat_id = internal_chats.id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert chats they create" ON internal_chats
    FOR INSERT WITH CHECK (created_by = auth.uid());

-- Chat members policies
CREATE POLICY "Users can view chat memberships for their chats" ON internal_chat_members
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM internal_chat_members cm2
            WHERE cm2.chat_id = internal_chat_members.chat_id 
            AND cm2.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert chat memberships" ON internal_chat_members
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own chat memberships" ON internal_chat_members
    FOR UPDATE USING (user_id = auth.uid());

-- Messages policies
CREATE POLICY "Users can view messages in their chats" ON internal_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM internal_chat_members 
            WHERE chat_id = internal_messages.chat_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages in their chats" ON internal_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM internal_chat_members 
            WHERE chat_id = internal_messages.chat_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own messages" ON internal_messages
    FOR UPDATE USING (sender_id = auth.uid());

-- Message receipts policies
CREATE POLICY "Users can manage their own message receipts" ON internal_message_receipts
    FOR ALL USING (user_id = auth.uid());

-- Typing indicators policies
CREATE POLICY "Users can view typing indicators in their chats" ON internal_typing_indicators
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM internal_chat_members 
            WHERE chat_id = internal_typing_indicators.chat_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own typing indicators" ON internal_typing_indicators
    FOR INSERT WITH CHECK (user_id = auth.uid())
    FOR UPDATE USING (user_id = auth.uid());

-- User language policies
CREATE POLICY "Users can manage their own language preferences" ON internal_user_languages
    FOR ALL USING (user_id = auth.uid());

-- Blocked users policies
CREATE POLICY "Users can manage their own blocked users" ON internal_blocked_users
    FOR ALL USING (blocker_id = auth.uid());

-- Functions and triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_internal_chats_updated_at BEFORE UPDATE ON internal_chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_internal_messages_updated_at BEFORE UPDATE ON internal_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_internal_typing_indicators_updated_at BEFORE UPDATE ON internal_typing_indicators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_internal_user_languages_updated_at BEFORE UPDATE ON internal_user_languages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
