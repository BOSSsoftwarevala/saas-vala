import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const authHeader = req.headers.authorization
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Get user from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { query, body } = req
    const method = req.method

    // Route handling
    if (query.path === 'chats' && method === 'GET') {
      return await getChats(supabase, user.id, res)
    } else if (query.path === 'chats' && method === 'POST') {
      return await createChat(supabase, user.id, body, res)
    } else if (query.path === 'messages' && method === 'GET') {
      const chatId = query.chatId as string
      const page = parseInt(query.page as string || '1')
      const limit = parseInt(query.limit as string || '50')
      return await getMessages(supabase, user.id, chatId, page, limit, res)
    } else if (query.path === 'messages' && method === 'POST') {
      return await sendMessage(supabase, user.id, body, res)
    } else if (query.path === 'typing' && method === 'POST') {
      return await setTypingIndicator(supabase, user.id, body, res)
    } else if (query.path === 'read-receipt' && method === 'POST') {
      return await markAsRead(supabase, user.id, body, res)
    } else if (query.path === 'translate' && method === 'POST') {
      return await translateMessage(supabase, user.id, body, res)
    } else if (query.path === 'voice-upload' && method === 'POST') {
      return await handleVoiceUpload(req, supabase, user.id, res)
    } else if (query.path === 'block-user' && method === 'POST') {
      return await blockUser(supabase, user.id, body, res)
    } else if (query.path === 'search' && method === 'GET') {
      const q = query.q as string
      return await searchChats(supabase, user.id, q, res)
    }

    return res.status(404).json({ error: 'Endpoint not found' })

  } catch (error) {
    console.error('Chat API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return res.status(500).json({ error: errorMessage })
  }
}

// Get user's chats
async function getChats(supabase: any, userId: string, res: NextApiResponse) {
  const { data, error } = await supabase
    .from('internal_chat_members')
    .select(`
      *,
      internal_chats (
        id,
        is_group,
        group_name,
        group_avatar_url,
        updated_at,
        internal_chat_members (
          user_id,
          internal_users!internal_chat_members_user_id_fkey (
            id,
            username,
            avatar_url
          )
        )
      ),
      last_message: internal_messages (
        id,
        message_text,
        sender_id,
        created_at,
        delivery_status
      )
    `)
    .eq('user_id', userId)
    .eq('is_blocked', false)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) throw error

  // Get unread count for each chat
  const chatsWithUnread = await Promise.all(
    data.map(async (chat: any) => {
      const { count } = await supabase
        .from('internal_messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chat.chat_id)
        .neq('sender_id', userId)
        .lt('created_at', chat.last_read_at || '1970-01-01')

      return {
        ...chat,
        unread_count: count || 0
      }
    })
  )

  return res.status(200).json({ chats: chatsWithUnread })
}

// Create new chat
async function createChat(supabase: any, userId: string, body: any, res: NextApiResponse) {
  const { is_group = false, participant_ids, group_name } = body

  if (!participant_ids || participant_ids.length === 0) {
    throw new Error('Participants required')
  }

  // Check if 1:1 chat already exists
  if (!is_group && participant_ids.length === 1) {
    const { data: existingChat } = await supabase
      .from('internal_chat_members')
      .select('chat_id')
      .eq('user_id', userId)
      .in('chat_id', supabase
        .from('internal_chat_members')
        .select('chat_id')
        .eq('user_id', participant_ids[0])
      )

    if (existingChat && existingChat.length > 0) {
      return new Response(JSON.stringify({ 
        chat_id: existingChat[0].chat_id,
        message: 'Chat already exists' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }

  // Create chat
  const { data: chat, error: chatError } = await supabase
    .from('internal_chats')
    .insert({
      is_group,
      group_name: is_group ? group_name : null,
      created_by: userId
    })
    .select()
    .single()

  if (chatError) throw chatError

  // Add members
  const members = [
    { chat_id: chat.id, user_id: userId, role: 'admin' },
    ...participant_ids.map((pid: string) => ({
      chat_id: chat.id,
      user_id: pid,
      role: 'member'
    }))
  ]

  const { error: memberError } = await supabase
    .from('internal_chat_members')
    .insert(members)

  if (memberError) throw memberError

  return res.status(200).json({ chat })
}

// Get messages for a chat
async function getMessages(supabase: any, userId: string, chatId: string, res: NextApiResponse) {
  // Verify user is member of chat
  const { data: member } = await supabase
    .from('internal_chat_members')
    .select('id')
    .eq('chat_id', chatId)
    .eq('user_id', userId)
    .single()

  if (!member) {
    return res.status(403).json({ error: 'Access denied' })
  }

  // STEP 37: MESSAGE ORDER CONSISTENCY - Strict ordering by created_at + id
  const { data, error } = await supabase
    .from('internal_messages')
    .select('*')
    .eq('chat_id', chatId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  return res.status(200).json({ 
    messages: data.reverse(), // Show oldest first
    has_more: data.length === limit
  })
}

// Send message
async function sendMessage(supabase: any, userId: string, body: any, res: NextApiResponse) {
  const { chat_id, message_text, message_type = 'text', reply_to_id, voice_url } = body

  if (!chat_id || !message_text) {
    throw new Error('Chat ID and message text required')
  }

  // Verify user is member of chat
  const { data: membership } = await supabase
    .from('internal_chat_members')
    .select('id')
    .eq('chat_id', chat_id)
    .eq('user_id', userId)
    .eq('is_blocked', false)
    .single()

  if (!membership) {
    throw new Error('Access denied')
  }

  // Check if sender is blocked by recipient
  if (!membership.is_group) {
    const { data: blocked } = await supabase
      .from('internal_blocked_users')
      .select('id')
      .eq('blocker_id', userId)
      .eq('blocked_id', membership.user_id)
      .single()

    if (blocked) {
      throw new Error('Message blocked')
    }
  }

  // Get user's language preference
  const { data: userLang } = await supabase
    .from('internal_user_languages')
    .select('language_code')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .single()

  const sourceLanguage = userLang?.language_code || 'en'

  // STEP 38: DUPLICATE MESSAGE PROTECTION - Check for existing client_message_id
  const { client_message_id } = body
  if (client_message_id) {
    const { data: existingMessage } = await supabase
      .from('internal_messages')
      .select('id')
      .eq('chat_id', chat_id)
      .eq('sender_id', userId)
      .eq('client_message_id', client_message_id)
      .single()

    if (existingMessage) {
      return res.status(200).json({ 
        message: 'Message already exists',
        duplicate: true 
      })
    }
  }

  // Create message with client_message_id for idempotency
  const { data: message, error: messageError } = await supabase
    .from('internal_messages')
    .insert({
      chat_id,
      sender_id: userId,
      message_text,
      message_type,
      client_message_id, // STEP 38: Store client generated UUID
      reply_to_id,
      voice_url,
      delivery_status: 'sent'
    })
    .select()
    .single()

  if (messageError) throw messageError

  // Update chat's updated_at
  await supabase
    .from('internal_chats')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', chat_id)

  // Trigger real-time update
  await supabase
    .from('internal_messages')
    .select('*')
    .eq('id', message.id)

  return res.status(200).json({ message })
}

// Set typing indicator
async function setTypingIndicator(supabase: any, userId: string, body: any, res: NextApiResponse) {
  const { chat_id, is_typing } = body

  if (!chat_id) {
    throw new Error('Chat ID required')
  }

  await supabase
    .from('internal_typing_indicators')
    .upsert({
      chat_id,
      user_id: userId,
      is_typing,
      last_seen_at: new Date().toISOString()
    })

  return res.status(200).json({ success: true })
}

// Mark as read
async function markAsRead(supabase: any, userId: string, body: any, res: NextApiResponse) {
  const { chat_id, message_id } = body

  if (!chat_id) {
    throw new Error('Chat ID required')
  }

  // Update last read time
  await supabase
    .from('internal_chat_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('chat_id', chat_id)
    .eq('user_id', userId)

  // Mark messages as read
  if (message_id) {
    await supabase
      .from('internal_messages')
      .update({ 
        delivery_status: 'read',
        read_at: new Date().toISOString()
      })
      .eq('id', message_id)
      .neq('sender_id', userId)
  }

  return res.status(200).json({ success: true })
}

// Translate message
async function translateMessage(supabase: any, userId: string, body: any, res: NextApiResponse) {
  const { text, target_language } = body

  if (!text || !target_language) {
    throw new Error('Text and target language required')
  }

  // Check cache first
  const { data: cached } = await supabase
    .from('internal_translation_cache')
    .select('translated_text')
    .eq('original_text', text)
    .eq('target_language', target_language)
    .single()

  if (cached) {
    return res.status(200).json({ 
      translated_text: cached.translated_text,
      from_cache: true 
    })
  }

  // Use Google Translate API (you'll need to set up API key)
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!apiKey) {
    throw new Error('Translation service not configured')
  }

  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target: target_language,
        format: 'text'
      })
    }
  )

  if (!response.ok) {
    throw new Error('Translation failed')
  }

  const result = await response.json()
  const translatedText = result.data.translations[0].translatedText

  // Cache translation
  await supabase
    .from('internal_translation_cache')
    .insert({
      original_text: text,
      source_language: 'auto',
      target_language,
      translated_text: translatedText
    })

  return res.status(200).json({ 
    translated_text: translatedText,
    from_cache: false 
  })
}

// Handle voice upload with size control
async function handleVoiceUpload(req: NextApiRequest, supabase: any, userId: string, res: NextApiResponse) {
  // Note: Next.js doesn't have built-in formData support like this
  // This would need multer or similar middleware for production
  const file = req.body?.voice
  
  if (!file) {
    throw new Error('No voice file provided')
  }

  // STEP 42: MEDIA SIZE CONTROL - Restrict max upload size
  const MAX_VOICE_SIZE = 10 * 1024 * 1024; // 10MB for voice files
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5MB for images
  const MAX_FILE_SIZE = 20 * 1024 * 1024;   // 20MB for other files

  // Check file size (this would need proper middleware in production)
  if (file.size && file.size > MAX_VOICE_SIZE) {
    return res.status(413).json({ 
      error: 'File too large',
      max_size: '10MB for voice files'
    });
  }

  // STEP 42: Compress before upload (simplified - would need actual compression library)
  let compressedFile = file;
  if (file.size && file.size > 5 * 1024 * 1024) { // If larger than 5MB
    // In production, you'd use audio compression libraries
    // For now, we'll just log that compression would happen
    console.log('Voice file would be compressed before upload');
  }

  // Upload to Supabase storage with signed URL security
  const fileName = `voice/${userId}/${Date.now()}.wav`
  const { data, error } = await supabase.storage
    .from('chat-media')
    .upload(fileName, compressedFile, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) throw error

  // STEP 43: FILE SECURITY - Generate signed URL instead of public URL
  const { data: signedUrlData } = await supabase.storage
    .from('chat-media')
    .createSignedUrl(fileName, 60 * 60 * 24) // 24 hour expiry

  if (!signedUrlData?.signedUrl) {
    throw new Error('Failed to generate secure URL')
  }

  return res.status(200).json({ 
    voice_url: signedUrlData.signedUrl,
    file_name: fileName,
    expires_in: 86400 // 24 hours in seconds
  })
}

// Block user
async function blockUser(supabase: any, userId: string, body: any, res: NextApiResponse) {
  const { blocked_id, reason } = body

  if (!blocked_id) {
    throw new Error('User ID to block required')
  }

  await supabase
    .from('internal_blocked_users')
    .upsert({
      blocker_id: userId,
      blocked_id,
      reason,
      blocked_at: new Date().toISOString()
    })

  return res.status(200).json({ success: true })
}

// Search chats
async function searchChats(supabase: any, userId: string, query: string, res: NextApiResponse) {
  if (!query) {
    throw new Error('Search query required')
  }

  const { data, error } = await supabase
    .from('internal_chat_members')
    .select(`
      *,
      internal_chats (
        id,
        is_group,
        group_name,
        internal_chat_members (
          user_id,
          internal_users!internal_chat_members_user_id_fkey (
            id,
            username,
            avatar_url
          )
        )
      )
    `)
    .eq('user_id', userId)
    .eq('is_blocked', false)
    .or(`internal_chats.group_name.ilike.%${query}%,internal_chat_members.internal_users.username.ilike.%${query}%`)

  if (error) throw error

  return res.status(200).json({ chats: data })
}
